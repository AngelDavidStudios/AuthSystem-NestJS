import { BadRequestException } from '@nestjs/common';
import { VacationController } from '../../src/vacation/vacation.controller';
import { VacationService } from '../../src/vacation/vacation.service';
import type { VacationActionDto } from '../../src/vacation/dto/vacation-action.dto';
import type { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';

const USER: CurrentUserData = {
  sub: 's',
  email: 'jdoe@example.com',
  username: 'jdoe',
  groups: ['Users'],
};

function makeController() {
  // Cada método del service mockeado devuelve una marca para verificar el ruteo.
  const service = {
    createRequest: jest.fn().mockResolvedValue('createRequest'),
    approveRequest: jest.fn().mockResolvedValue('approveRequest'),
    rejectRequest: jest.fn().mockResolvedValue('rejectRequest'),
    cancelRequest: jest.fn().mockResolvedValue('cancelRequest'),
    getRequest: jest.fn().mockResolvedValue('getRequest'),
    getMyRequests: jest.fn().mockResolvedValue('getMyRequests'),
    getPendingApprovals: jest.fn().mockResolvedValue('getPendingApprovals'),
    getAllRequests: jest.fn().mockResolvedValue('getAllRequests'),
    getBalance: jest.fn().mockResolvedValue('getBalance'),
    setBalance: jest.fn().mockResolvedValue('setBalance'),
    getAllBalances: jest.fn().mockResolvedValue('getAllBalances'),
    getAuditLogs: jest.fn().mockResolvedValue('getAuditLogs'),
  } as unknown as VacationService;
  return { controller: new VacationController(service), service };
}

const dispatch = (dto: Partial<VacationActionDto>) =>
  makeController().controller.dispatch(dto as VacationActionDto, USER);

describe('VacationController (dispatch POST /vacation)', () => {
  it('createRequest delega con el payload mapeado', async () => {
    const { controller, service } = makeController();
    await controller.dispatch(
      {
        action: 'createRequest',
        startDate: '2026-07-01',
        endDate: '2026-07-05',
        type: 'VACATION',
        userId: 'jdoe',
        userEmail: 'jdoe@example.com',
        userName: 'John Doe',
      } as VacationActionDto,
      USER,
    );
    expect(service.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-07-01', userId: 'jdoe' }),
      USER,
    );
  });

  it('rutea cada acción a su método de service', async () => {
    expect(await dispatch({ action: 'approveRequest', id: 'r1' })).toBe(
      'approveRequest',
    );
    expect(await dispatch({ action: 'rejectRequest', id: 'r1' })).toBe(
      'rejectRequest',
    );
    expect(await dispatch({ action: 'cancelRequest', id: 'r1' })).toBe(
      'cancelRequest',
    );
    expect(await dispatch({ action: 'getRequest', id: 'r1' })).toBe(
      'getRequest',
    );
    expect(await dispatch({ action: 'getMyRequests', userId: 'jdoe' })).toBe(
      'getMyRequests',
    );
    expect(
      await dispatch({ action: 'getPendingApprovals', userId: 'jdoe' }),
    ).toBe('getPendingApprovals');
    expect(await dispatch({ action: 'getAllRequests' })).toBe('getAllRequests');
    expect(await dispatch({ action: 'getBalance', userId: 'jdoe' })).toBe(
      'getBalance',
    );
    expect(await dispatch({ action: 'getAllBalances' })).toBe('getAllBalances');
    expect(await dispatch({ action: 'getAuditLogs' })).toBe('getAuditLogs');
  });

  it('setBalance delega con el payload mapeado', async () => {
    const { controller, service } = makeController();
    await controller.dispatch(
      {
        action: 'setBalance',
        userId: 'jdoe',
        userEmail: 'jdoe@example.com',
        userName: 'John Doe',
        totalDays: 20,
        adminUserId: 'boss',
      } as VacationActionDto,
      USER,
    );
    expect(service.setBalance).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'jdoe', totalDays: 20 }),
      USER,
    );
  });

  it('lanza BadRequest si falta un parámetro requerido por la acción', () => {
    expect(() => dispatch({ action: 'approveRequest' })).toThrow(
      BadRequestException,
    );
    expect(() => dispatch({ action: 'getBalance' })).toThrow(
      BadRequestException,
    );
  });
});
