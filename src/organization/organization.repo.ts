import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoService } from '../shared/dynamo/dynamo.service';
import type { Env } from '../config/env.schema';
import type { OrganizationNode } from './organization.types';

/** Acceso a la tabla `wfn-org-nodes` (árbol organizacional). */
@Injectable()
export class OrganizationRepo {
  private readonly table: string;

  constructor(
    private readonly dynamo: DynamoService,
    config: ConfigService<Env, true>,
  ) {
    this.table = config.get('DDB_TABLE_ORG_NODES', { infer: true });
  }

  put(node: OrganizationNode): Promise<OrganizationNode> {
    return this.dynamo.put(this.table, node);
  }

  getById(id: string): Promise<OrganizationNode | undefined> {
    return this.dynamo.get<OrganizationNode>(this.table, { id });
  }

  async getByUserId(userId: string): Promise<OrganizationNode | undefined> {
    const nodes = await this.dynamo.query<OrganizationNode>(
      this.table,
      'userId',
      userId,
      'byUser',
    );
    return nodes[0];
  }

  getBySupervisorId(supervisorId: string): Promise<OrganizationNode[]> {
    return this.dynamo.query<OrganizationNode>(
      this.table,
      'supervisorId',
      supervisorId,
      'bySupervisor',
    );
  }

  getAll(): Promise<OrganizationNode[]> {
    return this.dynamo.scan<OrganizationNode>(this.table);
  }

  delete(id: string): Promise<void> {
    return this.dynamo.delete(this.table, { id });
  }
}
