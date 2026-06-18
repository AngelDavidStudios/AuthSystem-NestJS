import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { VacationService } from '../../src/vacation/vacation.service';
import type { VacationRepo } from '../../src/vacation/vacation.repo';
import type { AuditRepo } from '../../src/vacation/audit.repo';
import type { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';
import type {
  VacationBalanceRecord,
  VacationRequest,
} from '../../src/vacation/vacation.types';

const admin = (sub = 'admin-1'): CurrentUserData => ({
  sub,
  email: 'admin@x.com',
  groups: ['Admins'],
});
const member = (sub = 'user-1'): CurrentUserData => ({
  sub,
  email: 'user@x.com',
  groups: ['Users'],
});

function balanceRecord(
  over: Partial<VacationBalanceRecord> = {},
): VacationBalanceRecord {
  return {
    id: 'bal-1',
    userId: 'user-1',
    userEmail: 'user@x.com',
    userName: 'User One',
    totalDays: 30,
    year: 2026,
    lastUpdated: '2026-01-01T00:00:00.000Z',
    updatedBy: 'admin-1',
    ...over,
  };
}

function req(over: Partial<VacationRequest> = {}): VacationRequest {
  return {
    id: 'req-1',
    requesterId: 'user-1',
    requesterEmail: 'user@x.com',
    requesterName: 'User One',
    supervisorId: '',
    supervisorEmail: '',
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    totalDays: 3,
    type: 'VACATION',
    status: 'PENDING',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

function makeRepo(over: Partial<jest.Mocked<VacationRepo>> = {}) {
  return {
    putRequest: jest.fn(async (r: VacationRequest) => r),
    getRequest: jest.fn(),
    getRequestsByRequester: jest.fn(async () => []),
    getRequestsBySupervisor: jest.fn(async () => []),
    getAllRequests: jest.fn(async () => []),
    putBalance: jest.fn(async (b: VacationBalanceRecord) => b),
    getBalance: jest.fn(),
    getAllBalances: jest.fn(async () => []),
    getOrgNodeByUserId: jest.fn(),
    getOrgNodeById: jest.fn(),
    ...over,
  } as unknown as jest.Mocked<VacationRepo>;
}

function makeAudit() {
  return {
    write: jest.fn(async () => ({})),
  } as unknown as jest.Mocked<AuditRepo>;
}

describe('VacationService', () => {
  describe('balance derivado', () => {
    it('getBalance calcula used/pending/available al vuelo', async () => {
      const repo = makeRepo({
        getBalance: jest.fn(async () => balanceRecord({ totalDays: 30 })),
        getRequestsByRequester: jest.fn(async () => [
          req({ id: 'a', status: 'APPROVED', totalDays: 5 }),
          req({ id: 'p', status: 'PENDING', totalDays: 3 }),
          req({ id: 'c', status: 'CANCELLED', totalDays: 10 }),
        ]),
      });
      const service = new VacationService(repo, makeAudit());

      const { balance } = await service.getBalance('user-1', member());

      expect(balance.usedDays).toBe(5);
      expect(balance.pendingDays).toBe(3);
      expect(balance.availableDays).toBe(22);
    });

    it('getBalance ajeno está prohibido para no-admin', async () => {
      const service = new VacationService(makeRepo(), makeAudit());
      await expect(
        service.getBalance('otro', member('user-1')),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createRequest', () => {
    const params = {
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      type: 'VACATION' as const,
      userId: 'user-1',
      userEmail: 'user@x.com',
      userName: 'User One',
    };

    it('rechaza crear a nombre de otro usuario (anti-suplantación)', async () => {
      const service = new VacationService(makeRepo(), makeAudit());
      await expect(
        service.createRequest(params, member('otro-sub')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('falla si el usuario no tiene balance', async () => {
      const repo = makeRepo({ getBalance: jest.fn(async () => undefined) });
      const service = new VacationService(repo, makeAudit());
      await expect(
        service.createRequest(params, member('user-1')),
      ).rejects.toThrow(/balance/i);
    });

    it('falla si no hay días disponibles suficientes', async () => {
      const repo = makeRepo({
        getBalance: jest.fn(async () => balanceRecord({ totalDays: 2 })),
      });
      const service = new VacationService(repo, makeAudit());
      await expect(
        service.createRequest(params, member('user-1')),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea PENDING, resuelve supervisor del árbol y audita', async () => {
      const audit = makeAudit();
      const repo = makeRepo({
        getBalance: jest.fn(async () => balanceRecord({ totalDays: 30 })),
        getOrgNodeByUserId: jest.fn(async () => ({
          id: 'node-emp',
          userId: 'user-1',
          userEmail: 'user@x.com',
          userName: 'User One',
          supervisorId: 'node-sup',
        })),
        getOrgNodeById: jest.fn(async () => ({
          id: 'node-sup',
          userId: 'sup-sub',
          userEmail: 'sup@x.com',
          userName: 'Supervisor',
          supervisorId: 'ROOT',
        })),
      });
      const service = new VacationService(repo, audit);

      const { request } = await service.createRequest(params, member('user-1'));

      expect(request.status).toBe('PENDING');
      expect(request.totalDays).toBe(3);
      expect(request.supervisorId).toBe('sup-sub');
      expect(request.supervisorEmail).toBe('sup@x.com');
      expect(repo.putRequest).toHaveBeenCalledTimes(1);
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REQUEST_CREATED' }),
      );
    });
  });

  describe('approve/reject/cancel', () => {
    it('un admin puede aprobar aunque no sea el supervisor', async () => {
      const repo = makeRepo({
        getRequest: jest.fn(async () => req({ supervisorId: 'sup-x' })),
      });
      const service = new VacationService(repo, makeAudit());

      await service.approveRequest('req-1', admin());

      expect(repo.putRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'APPROVED',
          resolvedAt: expect.any(String),
        }),
      );
    });

    it('un usuario ajeno (ni supervisor ni admin) no puede aprobar', async () => {
      const repo = makeRepo({
        getRequest: jest.fn(async () => req({ supervisorId: 'sup-x' })),
      });
      const service = new VacationService(repo, makeAudit());
      await expect(
        service.approveRequest('req-1', member('intruso')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('no se puede resolver una solicitud que no está PENDING', async () => {
      const repo = makeRepo({
        getRequest: jest.fn(async () => req({ status: 'APPROVED' })),
      });
      const service = new VacationService(repo, makeAudit());
      await expect(service.rejectRequest('req-1', admin())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('solo el dueño cancela y solo si está PENDING', async () => {
      const repo = makeRepo({
        getRequest: jest.fn(async () => req({ requesterId: 'user-1' })),
      });
      const service = new VacationService(repo, makeAudit());

      await expect(
        service.cancelRequest('req-1', member('otro')),
      ).rejects.toThrow(ForbiddenException);

      await service.cancelRequest('req-1', member('user-1'));
      expect(repo.putRequest).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CANCELLED' }),
      );
    });
  });

  describe('acciones de admin', () => {
    it('getAllRequests está prohibido para no-admin', async () => {
      const service = new VacationService(makeRepo(), makeAudit());
      await expect(service.getAllRequests(member())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('setBalance no permite asignar menos días que los ya usados', async () => {
      const repo = makeRepo({
        getRequestsByRequester: jest.fn(async () => [
          req({ status: 'APPROVED', totalDays: 10 }),
        ]),
      });
      const service = new VacationService(repo, makeAudit());
      await expect(
        service.setBalance(
          {
            userId: 'user-1',
            userEmail: 'user@x.com',
            userName: 'User One',
            totalDays: 5,
            adminUserId: 'admin-1',
          },
          admin(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('setBalance persiste y devuelve el balance derivado', async () => {
      const repo = makeRepo({
        getRequestsByRequester: jest.fn(async () => []),
      });
      const service = new VacationService(repo, makeAudit());

      const { balance } = await service.setBalance(
        {
          userId: 'user-1',
          userEmail: 'user@x.com',
          userName: 'User One',
          totalDays: 20,
          adminUserId: 'admin-1',
        },
        admin(),
      );

      expect(repo.putBalance).toHaveBeenCalledTimes(1);
      expect(balance.totalDays).toBe(20);
      expect(balance.availableDays).toBe(20);
    });
  });
});
