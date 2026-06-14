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

const kmsMock = mockClient(KMSClient);
const MASTER_KEY = randomBytes(32);
const BLOB = Buffer.from('e2e-data-key-blob');

describe('KMS e2e — encrypt/decrypt y partición por sistema', () => {
  let app: INestApplication;

  beforeEach(async () => {
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

  it('usuario puede cifrar y luego descifrar (round-trip A→B)', async () => {
    const agent = await loginAs(app, 'A', ['Users']);

    const enc = await agent
      .post('/kms/encrypt')
      .set('X-System', 'A')
      .send({ payload: 'mensaje A->B' });
    expect(enc.status).toBe(200);
    expect(enc.body).toHaveProperty('encryptedPayload');
    expect(enc.body).toHaveProperty('encryptedDataKey');

    const dec = await agent
      .post('/kms/decrypt')
      .set('X-System', 'B')
      .send(enc.body);
    expect(dec.status).toBe(200);
    expect(dec.body.payload).toBe('mensaje A->B');
  });

  it('admin (origin A) recibe 403 al operar KMS desde el Sistema B', async () => {
    const agent = await loginAs(app, 'A', ['Admins']);

    const res = await agent
      .post('/kms/decrypt')
      .set('X-System', 'B')
      .send({ encryptedPayload: 'x', encryptedDataKey: 'y' });

    expect(res.status).toBe(403);
  });

  it('rechaza sin sesión (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/kms/encrypt')
      .set('X-System', 'A')
      .send({ payload: 'x' });
    expect(res.status).toBe(401);
  });
});
