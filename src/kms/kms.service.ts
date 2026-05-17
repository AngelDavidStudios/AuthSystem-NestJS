import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { Env } from '../config/env.schema';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface EncryptResult {
  encryptedPayload: string;
  encryptedDataKey: string;
}

@Injectable()
export class KmsService {
  private readonly kms: KMSClient;
  private readonly keyId: string;

  constructor(config: ConfigService<Env, true>) {
    this.kms = new KMSClient({
      region: config.get('AWS_REGION', { infer: true }),
    });
    this.keyId = config.get('KMS_KEY_ID', { infer: true });
  }

  async encrypt(payload: string): Promise<EncryptResult> {
    const { Plaintext: dataKey, CiphertextBlob: encryptedDataKey } =
      await this.kms.send(
        new GenerateDataKeyCommand({
          KeyId: this.keyId,
          KeySpec: 'AES_256',
        }),
      );

    if (!dataKey || !encryptedDataKey) {
      throw new InternalServerErrorException(
        'KMS GenerateDataKey returned an incomplete response',
      );
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, dataKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(payload, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    dataKey.fill(0);

    return {
      encryptedPayload: Buffer.concat([iv, authTag, ciphertext]).toString(
        'base64',
      ),
      encryptedDataKey: Buffer.from(encryptedDataKey).toString('base64'),
    };
  }

  async decrypt(
    encryptedPayload: string,
    encryptedDataKey: string,
  ): Promise<string> {
    const bundle = Buffer.from(encryptedPayload, 'base64');
    if (bundle.length < IV_LENGTH + TAG_LENGTH + 1) {
      throw new BadRequestException(
        'encryptedPayload is too short to contain iv + authTag + ciphertext',
      );
    }
    const iv = bundle.subarray(0, IV_LENGTH);
    const authTag = bundle.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = bundle.subarray(IV_LENGTH + TAG_LENGTH);

    const { Plaintext: dataKey } = await this.kms.send(
      new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedDataKey, 'base64'),
        KeyId: this.keyId,
      }),
    );

    if (!dataKey) {
      throw new InternalServerErrorException(
        'KMS Decrypt returned no plaintext data key',
      );
    }

    const decipher = createDecipheriv(ALGORITHM, dataKey, iv);
    decipher.setAuthTag(authTag);

    try {
      const plaintext =
        decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
      return plaintext;
    } catch {
      throw new BadRequestException(
        'Decryption failed — payload may be tampered or the encryptedDataKey does not match',
      );
    } finally {
      dataKey.fill(0);
    }
  }
}
