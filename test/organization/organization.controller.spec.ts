import { BadRequestException } from '@nestjs/common';
import { OrganizationController } from '../../src/organization/organization.controller';
import { OrganizationService } from '../../src/organization/organization.service';
import type { OrganizationActionDto } from '../../src/organization/dto/organization-action.dto';
import type { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';

const ADMIN: CurrentUserData = {
  sub: 's',
  email: 'boss@example.com',
  username: 'boss',
  groups: ['Admins'],
};

function makeController() {
  const service = {
    createNode: jest.fn().mockResolvedValue('createNode'),
    updateNode: jest.fn().mockResolvedValue('updateNode'),
    deleteNode: jest.fn().mockResolvedValue('deleteNode'),
    getNode: jest.fn().mockResolvedValue('getNode'),
    getTree: jest.fn().mockResolvedValue('getTree'),
    getNodeByUserId: jest.fn().mockResolvedValue('getNodeByUserId'),
    getSubordinates: jest.fn().mockResolvedValue('getSubordinates'),
    assignSupervisor: jest.fn().mockResolvedValue('assignSupervisor'),
  } as unknown as OrganizationService;
  return { controller: new OrganizationController(service), service };
}

const dispatch = (dto: Partial<OrganizationActionDto>) =>
  makeController().controller.dispatch(dto as OrganizationActionDto, ADMIN);

describe('OrganizationController (dispatch POST /organization)', () => {
  it('createNode delega con el payload mapeado', async () => {
    const { controller, service } = makeController();
    await controller.dispatch(
      {
        action: 'createNode',
        userId: 'jdoe',
        userEmail: 'jdoe@example.com',
        userName: 'John Doe',
        position: 'Dev',
        department: 'Eng',
      } as OrganizationActionDto,
      ADMIN,
    );
    expect(service.createNode).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'jdoe', position: 'Dev' }),
      ADMIN,
    );
  });

  it('rutea cada acción a su método de service', async () => {
    expect(await dispatch({ action: 'deleteNode', id: 'n1' })).toBe(
      'deleteNode',
    );
    expect(await dispatch({ action: 'getNode', id: 'n1' })).toBe('getNode');
    expect(await dispatch({ action: 'getTree' })).toBe('getTree');
    expect(await dispatch({ action: 'getNodeByUserId', userId: 'jdoe' })).toBe(
      'getNodeByUserId',
    );
    expect(await dispatch({ action: 'getSubordinates', id: 'n1' })).toBe(
      'getSubordinates',
    );
    expect(
      await dispatch({ action: 'assignSupervisor', id: 'n1', supervisorId: 'boss' }),
    ).toBe('assignSupervisor');
  });

  it('updateNode delega los campos opcionales presentes', async () => {
    const { controller, service } = makeController();
    await controller.dispatch(
      { action: 'updateNode', id: 'n1', position: 'Lead' } as OrganizationActionDto,
      ADMIN,
    );
    expect(service.updateNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', position: 'Lead' }),
      ADMIN,
    );
  });

  it('lanza BadRequest si falta un parámetro requerido', () => {
    expect(() => dispatch({ action: 'getNode' })).toThrow(BadRequestException);
    expect(() => dispatch({ action: 'assignSupervisor', id: 'n1' })).toThrow(
      BadRequestException,
    );
  });
});
