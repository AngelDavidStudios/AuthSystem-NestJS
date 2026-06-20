import { ConfigService } from '@nestjs/config';
import { DynamoService } from '../../src/shared/dynamo/dynamo.service';
import { MessagesRepo } from '../../src/messages/messages.repo';
import type { Env } from '../../src/config/env.schema';
import type { SecureMessageRecord } from '../../src/messages/messages.types';
import { setupInMemoryDynamo } from '../utils/dynamo-mock';

const config = {
  get: (key: keyof Env) => (key === 'AWS_REGION' ? 'us-east-1' : key),
} as unknown as ConfigService<Env, true>;

function record(over: Partial<SecureMessageRecord> = {}): SecureMessageRecord {
  return {
    messageId: 'm1',
    subject: 'Incidente',
    type: 'incident',
    confidentialityLevel: 'confidential',
    sentBy: 'ana',
    sentByName: 'Ana Supervisora',
    sentAt: '2026-06-19T10:00:00.000Z',
    status: 'unread',
    encryptedPayload: 'cipher==',
    encryptedDataKey: 'key==',
    ...over,
  };
}

describe('MessagesRepo (DynamoDB wfn-secure-messages)', () => {
  let repo: MessagesRepo;

  beforeEach(() => {
    setupInMemoryDynamo();
    repo = new MessagesRepo(new DynamoService(config), config);
  });

  it('put + get por messageId', async () => {
    await repo.put(record({ messageId: 'm1' }));
    const got = await repo.get('m1');
    expect(got?.messageId).toBe('m1');
    expect(got?.encryptedPayload).toBe('cipher==');
  });

  it('get devuelve undefined si no existe', async () => {
    expect(await repo.get('nope')).toBeUndefined();
  });

  it('put sobreescribe el mismo messageId (marcar como leído)', async () => {
    await repo.put(record({ messageId: 'm1', status: 'unread' }));
    await repo.put(record({ messageId: 'm1', status: 'read' }));
    expect((await repo.get('m1'))?.status).toBe('read');
  });

  it('list escanea y ordena por sentAt descendente', async () => {
    await repo.put(
      record({ messageId: 'm1', sentAt: '2026-06-17T00:00:00.000Z' }),
    );
    await repo.put(
      record({ messageId: 'm2', sentAt: '2026-06-19T00:00:00.000Z' }),
    );
    await repo.put(
      record({ messageId: 'm3', sentAt: '2026-06-18T00:00:00.000Z' }),
    );
    const list = await repo.list();
    expect(list.map((m) => m.messageId)).toEqual(['m2', 'm3', 'm1']);
  });

  it('delete elimina por messageId', async () => {
    await repo.put(record({ messageId: 'm1' }));
    await repo.delete('m1');
    expect(await repo.get('m1')).toBeUndefined();
  });
});
