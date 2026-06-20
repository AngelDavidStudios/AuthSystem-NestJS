import { ConfigService } from '@nestjs/config';
import { DynamoService } from '../../src/shared/dynamo/dynamo.service';
import { AuditRepo } from '../../src/vacation/audit.repo';
import type { Env } from '../../src/config/env.schema';
import { setupInMemoryDynamo } from '../utils/dynamo-mock';

const config = {
  get: (key: keyof Env) => (key === 'AWS_REGION' ? 'us-east-1' : key),
} as unknown as ConfigService<Env, true>;

describe('AuditRepo (bitácora compartida wfn-audit-logs)', () => {
  let repo: AuditRepo;

  beforeEach(() => {
    setupInMemoryDynamo();
    repo = new AuditRepo(new DynamoService(config), config);
  });

  it('write genera id + createdAt y persiste el log', async () => {
    const log = await repo.write({
      action: 'REQUEST_CREATED',
      entityType: 'VacationRequest',
      entityId: 'r1',
      userId: 'jdoe',
      userEmail: 'jdoe@example.com',
      details: { days: 5 },
    });
    expect(log.id).toMatch(/[0-9a-f-]{36}/);
    expect(log.createdAt).toBeDefined();
    expect(await repo.list()).toHaveLength(1);
  });

  it('list ordena por createdAt descendente (más reciente primero)', async () => {
    await repo.write({
      action: 'REQUEST_CREATED',
      entityType: 'VacationRequest',
      entityId: 'old',
      userId: 'a',
      userEmail: 'a@x.com',
    });
    // Garantiza un createdAt posterior.
    await new Promise((r) => setTimeout(r, 5));
    await repo.write({
      action: 'REQUEST_APPROVED',
      entityType: 'VacationRequest',
      entityId: 'new',
      userId: 'b',
      userEmail: 'b@x.com',
    });
    const logs = await repo.list();
    expect(logs[0].entityId).toBe('new');
  });

  it('list filtra por actionFilter', async () => {
    await repo.write({
      action: 'REQUEST_CREATED',
      entityType: 'VacationRequest',
      entityId: 'r1',
      userId: 'a',
      userEmail: 'a@x.com',
    });
    await repo.write({
      action: 'REQUEST_APPROVED',
      entityType: 'VacationRequest',
      entityId: 'r2',
      userId: 'b',
      userEmail: 'b@x.com',
    });
    const onlyCreated = await repo.list({ actionFilter: 'REQUEST_CREATED' });
    expect(onlyCreated.map((l) => l.entityId)).toEqual(['r1']);
  });

  it('list filtra por entityType', async () => {
    await repo.write({
      action: 'REQUEST_CREATED',
      entityType: 'VacationRequest',
      entityId: 'r1',
      userId: 'a',
      userEmail: 'a@x.com',
    });
    await repo.write({
      action: 'HIERARCHY_CREATED',
      entityType: 'OrganizationNode',
      entityId: 'n1',
      userId: 'b',
      userEmail: 'b@x.com',
    });
    const onlyOrg = await repo.list({ entityType: 'OrganizationNode' });
    expect(onlyOrg.map((l) => l.entityId)).toEqual(['n1']);
  });
});
