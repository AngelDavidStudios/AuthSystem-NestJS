import { BadRequestException } from '@nestjs/common';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';
import type { UsersActionDto } from '../../src/users/dto/users-action.dto';
import type { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';

const ADMIN: CurrentUserData = {
  sub: 's',
  email: 'boss@example.com',
  username: 'boss',
  groups: ['Admins'],
};

function makeController() {
  const service = {
    listUsers: jest.fn().mockResolvedValue('listUsers'),
    createUser: jest.fn().mockResolvedValue('createUser'),
    deleteUser: jest.fn().mockResolvedValue('deleteUser'),
    addToGroup: jest.fn().mockResolvedValue('addToGroup'),
    removeFromGroup: jest.fn().mockResolvedValue('removeFromGroup'),
    getUserGroups: jest.fn().mockResolvedValue('getUserGroups'),
    resetPassword: jest.fn().mockResolvedValue('resetPassword'),
  } as unknown as UsersService;
  return { controller: new UsersController(service), service };
}

const dispatch = (dto: Partial<UsersActionDto>) =>
  makeController().controller.dispatch(dto as UsersActionDto, ADMIN);

describe('UsersController (dispatch POST /users)', () => {
  it('rutea cada acción a su método de service', async () => {
    expect(await dispatch({ action: 'listUsers' })).toBe('listUsers');
    expect(await dispatch({ action: 'deleteUser', username: 'jdoe' })).toBe(
      'deleteUser',
    );
    expect(await dispatch({ action: 'getUserGroups', username: 'jdoe' })).toBe(
      'getUserGroups',
    );
  });

  it('createUser delega con el payload mapeado', async () => {
    const { controller, service } = makeController();
    await controller.dispatch(
      {
        action: 'createUser',
        email: 'new@example.com',
        username: 'newbie',
      },
      ADMIN,
    );
    expect(service.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', username: 'newbie' }),
      ADMIN,
    );
  });

  it('addToGroup / removeFromGroup pasan username + groupName', async () => {
    const { controller, service } = makeController();
    await controller.dispatch(
      {
        action: 'addToGroup',
        username: 'jdoe',
        groupName: 'Admins',
      },
      ADMIN,
    );
    expect(service.addToGroup).toHaveBeenCalledWith('jdoe', 'Admins', ADMIN);

    await controller.dispatch(
      {
        action: 'removeFromGroup',
        username: 'jdoe',
        groupName: 'Admins',
      },
      ADMIN,
    );
    expect(service.removeFromGroup).toHaveBeenCalledWith(
      'jdoe',
      'Admins',
      ADMIN,
    );
  });

  it('resetPassword pasa username + newPassword', async () => {
    const { controller, service } = makeController();
    await controller.dispatch(
      {
        action: 'resetPassword',
        username: 'jdoe',
        newPassword: 'S3cret!',
      },
      ADMIN,
    );
    expect(service.resetPassword).toHaveBeenCalledWith(
      'jdoe',
      'S3cret!',
      ADMIN,
    );
  });

  it('lanza BadRequest si falta un parámetro requerido', () => {
    expect(() => dispatch({ action: 'deleteUser' })).toThrow(
      BadRequestException,
    );
    expect(() => dispatch({ action: 'addToGroup', username: 'jdoe' })).toThrow(
      BadRequestException,
    );
  });
});
