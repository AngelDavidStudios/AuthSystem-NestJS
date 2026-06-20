import { ConfigService } from '@nestjs/config';
import { DynamoService } from '../../src/shared/dynamo/dynamo.service';
import { OrganizationRepo } from '../../src/organization/organization.repo';
import type { Env } from '../../src/config/env.schema';
import type { OrganizationNode } from '../../src/organization/organization.types';
import { setupInMemoryDynamo } from '../utils/dynamo-mock';

const config = {
  get: (key: keyof Env) => (key === 'AWS_REGION' ? 'us-east-1' : key),
} as unknown as ConfigService<Env, true>;

function node(over: Partial<OrganizationNode>): OrganizationNode {
  return {
    id: 'n1',
    userId: 'jdoe',
    userEmail: 'jdoe@example.com',
    userName: 'John Doe',
    supervisorId: 'boss',
    position: 'Dev',
    department: 'Eng',
    level: 1,
    createdAt: '2026-06-19T00:00:00.000Z',
    ...over,
  };
}

describe('OrganizationRepo (árbol wfn-org-nodes)', () => {
  let repo: OrganizationRepo;

  beforeEach(() => {
    setupInMemoryDynamo();
    repo = new OrganizationRepo(new DynamoService(config), config);
  });

  it('put + getById por clave primaria', async () => {
    await repo.put(node({ id: 'n1' }));
    expect((await repo.getById('n1'))?.userId).toBe('jdoe');
  });

  it('getById devuelve undefined si no existe', async () => {
    expect(await repo.getById('ghost')).toBeUndefined();
  });

  it('getByUserId resuelve el primer nodo del GSI byUser', async () => {
    await repo.put(node({ id: 'n1', userId: 'jdoe' }));
    expect((await repo.getByUserId('jdoe'))?.id).toBe('n1');
  });

  it('getByUserId devuelve undefined si no hay nodo del usuario', async () => {
    expect(await repo.getByUserId('ghost')).toBeUndefined();
  });

  it('getBySupervisorId lista los subordinados', async () => {
    await repo.put(node({ id: 'n1', userId: 'a', supervisorId: 'boss' }));
    await repo.put(node({ id: 'n2', userId: 'b', supervisorId: 'boss' }));
    await repo.put(node({ id: 'n3', userId: 'c', supervisorId: 'other' }));
    const subs = await repo.getBySupervisorId('boss');
    expect(subs.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
  });

  it('getAll escanea el árbol completo', async () => {
    await repo.put(node({ id: 'n1' }));
    await repo.put(node({ id: 'n2', userId: 'b' }));
    expect(await repo.getAll()).toHaveLength(2);
  });

  it('delete elimina el nodo por id', async () => {
    await repo.put(node({ id: 'n1' }));
    await repo.delete('n1');
    expect(await repo.getById('n1')).toBeUndefined();
  });
});
