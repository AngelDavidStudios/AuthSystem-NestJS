import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DynamoService } from '../shared/dynamo/dynamo.service';
import type { Env } from '../config/env.schema';
import type { AuditAction, AuditEntityType, AuditLog } from './vacation.types';

export interface WriteAuditInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  userId: string;
  userEmail: string;
  details?: Record<string, unknown>;
}

/**
 * Escritura/lectura de la bitácora de auditoría (`wfn-audit-logs`).
 * Compartida por vacation/organization/users (todos registran sus acciones aquí).
 */
@Injectable()
export class AuditRepo {
  private readonly table: string;

  constructor(
    private readonly dynamo: DynamoService,
    config: ConfigService<Env, true>,
  ) {
    this.table = config.get('DDB_TABLE_AUDIT_LOGS', { infer: true });
  }

  async write(input: WriteAuditInput): Promise<AuditLog> {
    const log: AuditLog = {
      id: randomUUID(),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
      userEmail: input.userEmail,
      details: input.details,
      createdAt: new Date().toISOString(),
    };
    return this.dynamo.put(this.table, log);
  }

  async list(filters?: {
    actionFilter?: string;
    entityType?: string;
  }): Promise<AuditLog[]> {
    const logs = await this.dynamo.scan<AuditLog>(this.table);
    const filtered = logs.filter((l) => {
      if (filters?.actionFilter && l.action !== filters.actionFilter) {
        return false;
      }
      if (filters?.entityType && l.entityType !== filters.entityType) {
        return false;
      }
      return true;
    });
    // Más recientes primero.
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
