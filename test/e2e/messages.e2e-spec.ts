import { INestApplication } from '@nestjs/common';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { randomBytes } from 'crypto';
import request from 'supertest';
import { createE2EApp, loginAs } from '../utils/e2e-app';
import { setupInMemoryDynamo } from '../utils/dynamo-mock';

const kmsMock = mockClient(KMSClient);
const MASTER_KEY = randomBytes(32);
const BLOB = Buffer.from('e2e-messages-data-key-blob');

const SEND = {
  action: 'send',
  subject: 'Incidente en producción',
  type: 'incident',
  employee: 'Juan Pérez',
  eventDate: '2026-06-19',
  confidentialityLevel: 'confidential',
  description: 'Incumplió el protocolo de seguridad en el turno de la tarde.',
};

describe('Messages e2e — reporte confidencial cifrado A→B', () => {
  let app: INestApplication;

  beforeEach(async () => {
    setupInMemoryDynamo();
    kmsMock.reset();
    kmsMock.on(GenerateDataKeyCommand).callsFake(() => ({
      Plaintext: new Uint8Array(MASTER_KEY),
      CiphertextBlob: new Uint8Array(BLOB),
    }));
    kmsMock.on(DecryptCommand).callsFake(() => ({
      Plaintext: new Uint8Array(MASTER_KEY),
    }));
    app = await createE2EApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('A envía (cifra), B lista metadatos y descifra el contenido', async () => {
    // Sistema A: el remitente crea el reporte.
    const sender = await loginAs(app, 'A', ['Users']);
    const sent = await sender.post('/messages').send(SEND);
    expect(sent.status).toBe(200);
    expect(sent.body.messageId).toEqual(expect.any(String));
    const { messageId } = sent.body;

    // Sistema B: la bandeja ve metadatos pero NO el contenido sensible.
    const reader = await loginAs(app, 'B', ['Managers']);
    const list = await reader.post('/messages').send({ action: 'list' });
    expect(list.status).toBe(200);
    expect(list.body.messages).toHaveLength(1);
    const summary = list.body.messages[0];
    expect(summary).toMatchObject({ messageId, subject: SEND.subject });
    expect(summary).not.toHaveProperty('encryptedPayload');
    expect(JSON.stringify(summary)).not.toContain('Juan Pérez');

    // Sistema B: al abrir el mensaje se descifra con KMS.
    const dec = await reader
      .post('/messages')
      .send({ action: 'decrypt', messageId });
    expect(dec.status).toBe(200);
    expect(dec.body).toMatchObject({
      employee: 'Juan Pérez',
      description: SEND.description,
      status: 'read',
    });
  });

  it('rechaza send sin sesión (401)', async () => {
    const res = await request(app.getHttpServer()).post('/messages').send(SEND);
    expect(res.status).toBe(401);
  });

  it('un usuario normal no puede eliminar (403)', async () => {
    const sender = await loginAs(app, 'A', ['Users']);
    const sent = await sender.post('/messages').send(SEND);
    const del = await sender
      .post('/messages')
      .send({ action: 'delete', messageId: sent.body.messageId });
    expect(del.status).toBe(403);
  });

  it('un Admin elimina el mensaje (deleted:true)', async () => {
    const sender = await loginAs(app, 'A', ['Users']);
    const sent = await sender.post('/messages').send(SEND);

    const admin = await loginAs(app, 'A', ['Admins']);
    const del = await admin
      .post('/messages')
      .send({ action: 'delete', messageId: sent.body.messageId });
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ deleted: true });
  });
});
