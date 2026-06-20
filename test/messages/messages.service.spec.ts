import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MessagesService } from '../../src/messages/messages.service';
import type { KmsService } from '../../src/kms/kms.service';
import type { MessagesRepo } from '../../src/messages/messages.repo';
import type { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';
import type {
  SecureMessageContent,
  SecureMessageRecord,
} from '../../src/messages/messages.types';

const USER: CurrentUserData = {
  sub: 'sub-1',
  email: 'ana@x.com',
  name: 'Ana Supervisora',
  username: 'ana',
  groups: ['Users'],
};
const ADMIN: CurrentUserData = {
  ...USER,
  username: 'boss',
  groups: ['Admins'],
};
const MANAGER: CurrentUserData = {
  ...USER,
  username: 'mgr',
  groups: ['Managers'],
};

const SEND_INPUT = {
  subject: 'Incidente en producción',
  type: 'incident' as const,
  employee: 'Juan Pérez',
  eventDate: '2026-06-19',
  confidentialityLevel: 'confidential' as const,
  description: 'Incumplió el protocolo de seguridad.',
};

function record(over: Partial<SecureMessageRecord> = {}): SecureMessageRecord {
  return {
    messageId: 'm1',
    subject: 'Incidente en producción',
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

function makeKms(over: Partial<jest.Mocked<KmsService>> = {}) {
  return {
    encrypt: jest.fn(async () => ({
      encryptedPayload: 'cipher==',
      encryptedDataKey: 'key==',
    })),
    decrypt: jest.fn(),
    ...over,
  } as unknown as jest.Mocked<KmsService>;
}

function makeRepo(over: Partial<jest.Mocked<MessagesRepo>> = {}) {
  return {
    put: jest.fn(async (r: SecureMessageRecord) => r),
    get: jest.fn(),
    list: jest.fn(async () => []),
    delete: jest.fn(async () => undefined),
    ...over,
  } as unknown as jest.Mocked<MessagesRepo>;
}

describe('MessagesService', () => {
  describe('send', () => {
    it('cifra el contenido completo con KMS y persiste solo metadatos legibles', async () => {
      const kms = makeKms();
      const repo = makeRepo();
      const service = new MessagesService(kms, repo);

      const result = await service.send(SEND_INPUT, USER);

      // Devuelve id + timestamp.
      expect(result.messageId).toEqual(expect.any(String));
      expect(result.sentAt).toEqual(expect.any(String));

      // KMS recibe el JSON con los campos sensibles dentro.
      const encrypted = JSON.parse(
        kms.encrypt.mock.calls[0][0],
      ) as SecureMessageContent;
      expect(encrypted).toMatchObject({
        employee: 'Juan Pérez',
        description: 'Incumplió el protocolo de seguridad.',
        eventDate: '2026-06-19',
        sentBy: 'ana',
        sentByName: 'Ana Supervisora',
      });

      // El record persistido NO contiene los campos sensibles en claro.
      const saved = repo.put.mock.calls[0][0];
      expect(saved.encryptedPayload).toBe('cipher==');
      expect(saved.encryptedDataKey).toBe('key==');
      expect(saved.status).toBe('unread');
      expect(saved).not.toHaveProperty('employee');
      expect(saved).not.toHaveProperty('description');
      expect(JSON.stringify(saved)).not.toContain('Juan Pérez');
    });

    it('usa la identidad de la sesión como remitente (no del body)', async () => {
      const kms = makeKms();
      const repo = makeRepo();
      const service = new MessagesService(kms, repo);

      await service.send(SEND_INPUT, USER);
      const saved = repo.put.mock.calls[0][0];
      expect(saved.sentBy).toBe('ana');
      expect(saved.sentByName).toBe('Ana Supervisora');
    });

    it('cae a username/email cuando no hay name legible', async () => {
      const kms = makeKms();
      const repo = makeRepo();
      const service = new MessagesService(kms, repo);

      await service.send(SEND_INPUT, {
        sub: 'sub-2',
        username: 'jdoe',
        groups: ['Users'],
      });
      const saved = repo.put.mock.calls[0][0];
      expect(saved.sentBy).toBe('jdoe');
      expect(saved.sentByName).toBe('jdoe');
    });
  });

  describe('list', () => {
    it('devuelve solo metadatos, sin los campos cifrados', async () => {
      const repo = makeRepo({
        list: jest.fn(async () => [record({ messageId: 'm1' })]),
      });
      const service = new MessagesService(makeKms(), repo);

      const { messages } = await service.list();
      expect(messages).toHaveLength(1);
      expect(messages[0]).not.toHaveProperty('encryptedPayload');
      expect(messages[0]).not.toHaveProperty('encryptedDataKey');
      expect(messages[0]).toMatchObject({
        messageId: 'm1',
        subject: 'Incidente en producción',
      });
    });
  });

  describe('decrypt', () => {
    it('descifra con KMS, parsea el contenido y marca como leído', async () => {
      const content: SecureMessageContent = {
        subject: 'Incidente en producción',
        type: 'incident',
        employee: 'Juan Pérez',
        eventDate: '2026-06-19',
        confidentialityLevel: 'confidential',
        description: 'Detalle confidencial',
        sentBy: 'ana',
        sentByName: 'Ana Supervisora',
        sentAt: '2026-06-19T10:00:00.000Z',
      };
      const kms = makeKms({
        decrypt: jest.fn(async () => JSON.stringify(content)),
      });
      const repo = makeRepo({
        get: jest.fn(async () => record({ messageId: 'm1', status: 'unread' })),
      });
      const service = new MessagesService(kms, repo);

      const result = await service.decrypt('m1');

      expect(kms.decrypt).toHaveBeenCalledWith('cipher==', 'key==');
      expect(result).toMatchObject({
        messageId: 'm1',
        employee: 'Juan Pérez',
        description: 'Detalle confidencial',
        status: 'read',
      });
      // Reescribe el record con status read.
      expect(repo.put).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: 'm1', status: 'read' }),
      );
    });

    it('no reescribe si ya estaba leído (idempotente)', async () => {
      const kms = makeKms({ decrypt: jest.fn(async () => '{"subject":"x"}') });
      const repo = makeRepo({
        get: jest.fn(async () => record({ messageId: 'm1', status: 'read' })),
      });
      const service = new MessagesService(kms, repo);

      await service.decrypt('m1');
      expect(repo.put).not.toHaveBeenCalled();
    });

    it('lanza NotFound si el mensaje no existe', async () => {
      const repo = makeRepo({ get: jest.fn(async () => undefined) });
      const service = new MessagesService(makeKms(), repo);
      await expect(service.decrypt('ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lanza 500 si el payload descifrado no es JSON válido', async () => {
      const kms = makeKms({ decrypt: jest.fn(async () => 'no-json') });
      const repo = makeRepo({ get: jest.fn(async () => record()) });
      const service = new MessagesService(kms, repo);
      await expect(service.decrypt('m1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('delete', () => {
    it('un usuario normal no puede eliminar', async () => {
      const repo = makeRepo();
      const service = new MessagesService(makeKms(), repo);
      await expect(service.delete('m1', USER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('un Admin elimina el mensaje', async () => {
      const repo = makeRepo({ get: jest.fn(async () => record()) });
      const service = new MessagesService(makeKms(), repo);
      const result = await service.delete('m1', ADMIN);
      expect(result).toEqual({ deleted: true });
      expect(repo.delete).toHaveBeenCalledWith('m1');
    });

    it('un Manager elimina el mensaje', async () => {
      const repo = makeRepo({ get: jest.fn(async () => record()) });
      const service = new MessagesService(makeKms(), repo);
      await service.delete('m1', MANAGER);
      expect(repo.delete).toHaveBeenCalledWith('m1');
    });

    it('lanza NotFound si el mensaje a eliminar no existe', async () => {
      const repo = makeRepo({ get: jest.fn(async () => undefined) });
      const service = new MessagesService(makeKms(), repo);
      await expect(service.delete('ghost', ADMIN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
