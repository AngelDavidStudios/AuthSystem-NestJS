import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoService } from '../shared/dynamo/dynamo.service';
import type { Env } from '../config/env.schema';
import type { SecureMessageRecord } from './messages.types';

/**
 * Acceso a la tabla de mensajes seguros (`wfn-secure-messages`).
 * PK: `messageId`. Persiste metadatos legibles + payload cifrado opaco.
 */
@Injectable()
export class MessagesRepo {
  private readonly table: string;

  constructor(
    private readonly dynamo: DynamoService,
    config: ConfigService<Env, true>,
  ) {
    this.table = config.get('DDB_TABLE_SECURE_MESSAGES', { infer: true });
  }

  async put(record: SecureMessageRecord): Promise<SecureMessageRecord> {
    return this.dynamo.put(this.table, record);
  }

  async get(messageId: string): Promise<SecureMessageRecord | undefined> {
    return this.dynamo.get<SecureMessageRecord>(this.table, { messageId });
  }

  async list(): Promise<SecureMessageRecord[]> {
    const records = await this.dynamo.scan<SecureMessageRecord>(this.table);
    // Más recientes primero (bandeja estilo email).
    return records.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }

  async delete(messageId: string): Promise<void> {
    await this.dynamo.delete(this.table, { messageId });
  }
}
