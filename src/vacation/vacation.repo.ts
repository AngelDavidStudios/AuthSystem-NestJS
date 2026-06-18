import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoService } from '../shared/dynamo/dynamo.service';
import type { Env } from '../config/env.schema';
import type {
  OrgNodeRef,
  VacationBalanceRecord,
  VacationRequest,
} from './vacation.types';

/**
 * Acceso a las tablas de vacaciones: solicitudes y balances persistidos.
 * Lee org-nodes solo para resolver el supervisor de una solicitud (read-only);
 * la escritura del árbol vive en el módulo organization (F2).
 */
@Injectable()
export class VacationRepo {
  private readonly requestsTable: string;
  private readonly balancesTable: string;
  private readonly orgNodesTable: string;

  constructor(
    private readonly dynamo: DynamoService,
    config: ConfigService<Env, true>,
  ) {
    this.requestsTable = config.get('DDB_TABLE_VACATION_REQUESTS', {
      infer: true,
    });
    this.balancesTable = config.get('DDB_TABLE_VACATION_BALANCES', {
      infer: true,
    });
    this.orgNodesTable = config.get('DDB_TABLE_ORG_NODES', { infer: true });
  }

  // ---- Solicitudes -------------------------------------------------------

  putRequest(request: VacationRequest): Promise<VacationRequest> {
    return this.dynamo.put(this.requestsTable, request);
  }

  getRequest(id: string): Promise<VacationRequest | undefined> {
    return this.dynamo.get<VacationRequest>(this.requestsTable, { id });
  }

  getRequestsByRequester(requesterId: string): Promise<VacationRequest[]> {
    return this.dynamo.query<VacationRequest>(
      this.requestsTable,
      'requesterId',
      requesterId,
      'byRequester',
    );
  }

  getRequestsBySupervisor(supervisorId: string): Promise<VacationRequest[]> {
    return this.dynamo.query<VacationRequest>(
      this.requestsTable,
      'supervisorId',
      supervisorId,
      'bySupervisor',
    );
  }

  getAllRequests(): Promise<VacationRequest[]> {
    return this.dynamo.scan<VacationRequest>(this.requestsTable);
  }

  // ---- Balances ----------------------------------------------------------

  putBalance(balance: VacationBalanceRecord): Promise<VacationBalanceRecord> {
    return this.dynamo.put(this.balancesTable, balance);
  }

  getBalance(userId: string): Promise<VacationBalanceRecord | undefined> {
    return this.dynamo.get<VacationBalanceRecord>(this.balancesTable, {
      userId,
    });
  }

  getAllBalances(): Promise<VacationBalanceRecord[]> {
    return this.dynamo.scan<VacationBalanceRecord>(this.balancesTable);
  }

  // ---- Org (solo lectura, para resolver supervisor) ----------------------

  async getOrgNodeByUserId(userId: string): Promise<OrgNodeRef | undefined> {
    const nodes = await this.dynamo.query<OrgNodeRef>(
      this.orgNodesTable,
      'userId',
      userId,
      'byUser',
    );
    return nodes[0];
  }

  getOrgNodeById(id: string): Promise<OrgNodeRef | undefined> {
    return this.dynamo.get<OrgNodeRef>(this.orgNodesTable, { id });
  }
}
