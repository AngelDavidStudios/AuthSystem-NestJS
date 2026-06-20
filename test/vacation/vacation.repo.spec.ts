import { ConfigService } from '@nestjs/config';
import { DynamoService } from '../../src/shared/dynamo/dynamo.service';
import { VacationRepo } from '../../src/vacation/vacation.repo';
import type { Env } from '../../src/config/env.schema';
import type {
  VacationBalanceRecord,
  VacationRequest,
} from '../../src/vacation/vacation.types';
import { setupInMemoryDynamo } from '../utils/dynamo-mock';

// Cada key de tabla se mapea a su propio nombre (= la key) para aislar tablas.
const config = {
  get: (key: keyof Env) => (key === 'AWS_REGION' ? 'us-east-1' : key),
} as unknown as ConfigService<Env, true>;

const REQUESTS = 'DDB_TABLE_VACATION_REQUESTS';
const BALANCES = 'DDB_TABLE_VACATION_BALANCES';
const ORG = 'DDB_TABLE_ORG_NODES';

function request(over: Partial<VacationRequest>): VacationRequest {
  return {
    id: 'r1',
    requesterId: 'jdoe',
    requesterEmail: 'jdoe@example.com',
    requesterName: 'John Doe',
    supervisorId: 'boss',
    supervisorEmail: 'boss@example.com',
    startDate: '2026-07-01',
    endDate: '2026-07-05',
    totalDays: 5,
    type: 'VACATION',
    status: 'PENDING',
    createdAt: '2026-06-19T00:00:00.000Z',
    ...over,
  };
}

describe('VacationRepo (DynamoDB requests/balances/org)', () => {
  let repo: VacationRepo;

  beforeEach(() => {
    setupInMemoryDynamo();
    repo = new VacationRepo(new DynamoService(config), config);
  });

  describe('solicitudes', () => {
    it('putRequest + getRequest', async () => {
      await repo.putRequest(request({ id: 'r1' }));
      const got = await repo.getRequest('r1');
      expect(got?.id).toBe('r1');
    });

    it('getRequest devuelve undefined si no existe', async () => {
      expect(await repo.getRequest('nope')).toBeUndefined();
    });

    it('getRequestsByRequester filtra por el GSI byRequester', async () => {
      await repo.putRequest(request({ id: 'r1', requesterId: 'jdoe' }));
      await repo.putRequest(request({ id: 'r2', requesterId: 'jdoe' }));
      await repo.putRequest(request({ id: 'r3', requesterId: 'other' }));
      const mine = await repo.getRequestsByRequester('jdoe');
      expect(mine.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
    });

    it('getRequestsBySupervisor filtra por el GSI bySupervisor', async () => {
      await repo.putRequest(request({ id: 'r1', supervisorId: 'boss' }));
      await repo.putRequest(request({ id: 'r2', supervisorId: 'other' }));
      const toApprove = await repo.getRequestsBySupervisor('boss');
      expect(toApprove.map((r) => r.id)).toEqual(['r1']);
    });

    it('getAllRequests escanea la tabla', async () => {
      await repo.putRequest(request({ id: 'r1' }));
      await repo.putRequest(request({ id: 'r2' }));
      expect(await repo.getAllRequests()).toHaveLength(2);
    });
  });

  describe('balances', () => {
    const balance = (userId: string): VacationBalanceRecord => ({
      id: `bal-${userId}`,
      userId,
      userEmail: `${userId}@example.com`,
      userName: userId,
      totalDays: 20,
      year: 2026,
      lastUpdated: '2026-06-19T00:00:00.000Z',
      updatedBy: 'boss',
    });

    it('putBalance + getBalance por userId', async () => {
      await repo.putBalance(balance('jdoe'));
      const got = await repo.getBalance('jdoe');
      expect(got?.totalDays).toBe(20);
    });

    it('getAllBalances escanea la tabla', async () => {
      await repo.putBalance(balance('jdoe'));
      await repo.putBalance(balance('other'));
      expect(await repo.getAllBalances()).toHaveLength(2);
    });
  });

  describe('org (read-only para resolver supervisor)', () => {
    it('getOrgNodeByUserId devuelve el primer nodo del GSI byUser', async () => {
      const ds = new DynamoService(config);
      await ds.put(ORG, {
        id: 'n1',
        userId: 'jdoe',
        supervisorId: 'boss',
      });
      const node = await repo.getOrgNodeByUserId('jdoe');
      expect(node?.id).toBe('n1');
    });

    it('getOrgNodeById busca por clave primaria', async () => {
      const ds = new DynamoService(config);
      await ds.put(ORG, { id: 'n1', userId: 'jdoe', supervisorId: 'boss' });
      expect((await repo.getOrgNodeById('n1'))?.userId).toBe('jdoe');
    });

    it('getOrgNodeByUserId devuelve undefined si no hay nodo', async () => {
      expect(await repo.getOrgNodeByUserId('ghost')).toBeUndefined();
    });
  });

  // Silencia "variable no usada" para las constantes de tabla expuestas como doc.
  it('usa las tablas configuradas', () => {
    expect([REQUESTS, BALANCES, ORG]).toHaveLength(3);
  });
});
