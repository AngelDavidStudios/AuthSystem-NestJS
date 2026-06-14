import { mockClient } from 'aws-sdk-client-mock';
import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { KmsService } from '../../src/kms/kms.service';
import type { Env } from '../../src/config/env.schema';

const kmsMock = mockClient(KMSClient);

// Data key AES-256 fija (32 bytes) compartida por GenerateDataKey y Decrypt.
// Se devuelve una COPIA en cada llamada porque el servicio hace dataKey.fill(0).
const MASTER_KEY = randomBytes(32);
const BLOB = Buffer.from('ciphertext-blob-de-la-data-key');

function makeService(): KmsService {
  const config = {
    get: (key: keyof Env) =>
      key === 'AWS_REGION'
        ? 'us-east-1'
        : key === 'KMS_KEY_ID'
          ? 'test-key-id'
          : undefined,
  } as unknown as ConfigService<Env, true>;
  return new KmsService(config);
}

describe('KmsService (envelope encryption)', () => {
  let service: KmsService;

  beforeEach(() => {
    kmsMock.reset();
    kmsMock
      .on(GenerateDataKeyCommand)
      .callsFake(() => ({
        Plaintext: new Uint8Array(MASTER_KEY),
        CiphertextBlob: new Uint8Array(BLOB),
      }));
    kmsMock.on(DecryptCommand).callsFake(() => ({
      Plaintext: new Uint8Array(MASTER_KEY),
    }));
    service = makeService();
  });

  it('encrypt → decrypt recupera el texto plano (round-trip)', async () => {
    const plaintext = 'mensaje secreto A→B';

    const { encryptedPayload, encryptedDataKey } =
      await service.encrypt(plaintext);

    expect(typeof encryptedPayload).toBe('string');
    expect(encryptedDataKey).toBe(BLOB.toString('base64'));

    const recovered = await service.decrypt(encryptedPayload, encryptedDataKey);
    expect(recovered).toBe(plaintext);
  });

  it('encrypt llama GenerateDataKey con la KeyId y KeySpec correctos', async () => {
    await service.encrypt('x');
    const calls = kmsMock.commandCalls(GenerateDataKeyCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toMatchObject({
      KeyId: 'test-key-id',
      KeySpec: 'AES_256',
    });
  });

  it('decrypt lanza BadRequestException si el payload fue manipulado', async () => {
    const { encryptedPayload, encryptedDataKey } =
      await service.encrypt('intacto');

    // Voltea un byte dentro del ciphertext (después de iv[12] + authTag[16]).
    const bundle = Buffer.from(encryptedPayload, 'base64');
    bundle[bundle.length - 1] ^= 0xff;
    const tampered = bundle.toString('base64');

    await expect(service.decrypt(tampered, encryptedDataKey)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('decrypt lanza BadRequestException si el bundle es demasiado corto', async () => {
    const tooShort = Buffer.alloc(10).toString('base64');
    await expect(
      service.decrypt(tooShort, BLOB.toString('base64')),
    ).rejects.toThrow(BadRequestException);
  });
});
