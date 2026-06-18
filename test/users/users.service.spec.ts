import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mockClient } from 'aws-sdk-client-mock';
import {
  AdminCreateUserCommand,
  AdminListGroupsForUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { UsersService } from '../../src/users/users.service';
import type { AuditRepo } from '../../src/vacation/audit.repo';
import type { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';
import type { Env } from '../../src/config/env.schema';

const cognitoMock = mockClient(CognitoIdentityProviderClient);

const admin: CurrentUserData = {
  sub: 'admin-1',
  email: 'admin@x.com',
  groups: ['Admins'],
};
const manager: CurrentUserData = {
  sub: 'mgr-1',
  email: 'mgr@x.com',
  groups: ['Managers'],
};
const member: CurrentUserData = {
  sub: 'user-1',
  email: 'user@x.com',
  groups: ['Users'],
};

function makeService() {
  const config = {
    get: (key: keyof Env) =>
      key === 'COGNITO_REGION'
        ? 'us-east-1'
        : key === 'COGNITO_USER_POOL_ID'
          ? 'us-east-1_Test'
          : undefined,
  } as unknown as ConfigService<Env, true>;
  const audit = {
    write: jest.fn(async () => ({})),
  } as unknown as jest.Mocked<AuditRepo>;
  return { service: new UsersService(config, audit), audit };
}

describe('UsersService', () => {
  beforeEach(() => cognitoMock.reset());

  describe('autorización', () => {
    it('listUsers prohíbe a usuarios normales', async () => {
      const { service } = makeService();
      await expect(service.listUsers(member)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('createUser está reservado a Admins (un Manager no puede)', async () => {
      const { service } = makeService();
      await expect(
        service.createUser({ email: 'n@x.com', username: 'nuevo' }, manager),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listUsers', () => {
    it('un Manager puede listar; mapea atributos y grupos', async () => {
      cognitoMock.on(ListUsersCommand).resolves({
        Users: [
          {
            Username: 'juan',
            UserStatus: 'CONFIRMED',
            Enabled: true,
            Attributes: [
              { Name: 'email', Value: 'juan@x.com' },
              { Name: 'name', Value: 'Juan' },
            ],
          },
        ],
      });
      cognitoMock
        .on(AdminListGroupsForUserCommand)
        .resolves({ Groups: [{ GroupName: 'Users' }] });

      const { service } = makeService();
      const { users } = await service.listUsers(manager);

      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({
        username: 'juan',
        email: 'juan@x.com',
        name: 'Juan',
        status: 'CONFIRMED',
        enabled: true,
        groups: ['Users'],
      });
    });
  });

  describe('createUser', () => {
    it('genera contraseña temporal, suprime el email y audita', async () => {
      cognitoMock.on(AdminCreateUserCommand).resolves({
        User: {
          Username: 'nuevo',
          UserStatus: 'FORCE_CHANGE_PASSWORD',
          Enabled: true,
          Attributes: [{ Name: 'email', Value: 'n@x.com' }],
        },
      });

      const { service, audit } = makeService();
      const result = await service.createUser(
        { email: 'n@x.com', username: 'nuevo' },
        admin,
      );

      expect(result.user.temporaryPassword).toEqual(expect.any(String));
      expect(result.user.temporaryPassword.length).toBeGreaterThan(7);

      const call = cognitoMock.commandCalls(AdminCreateUserCommand)[0];
      expect(call.args[0].input).toMatchObject({ MessageAction: 'SUPPRESS' });
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_CREATED' }),
      );
    });
  });

  describe('resetPassword', () => {
    it('establece la contraseña como permanente', async () => {
      cognitoMock.on(AdminSetUserPasswordCommand).resolves({});

      const { service } = makeService();
      await service.resetPassword('juan', 'NewPass123!', admin);

      const call = cognitoMock.commandCalls(AdminSetUserPasswordCommand)[0];
      expect(call.args[0].input).toMatchObject({
        Username: 'juan',
        Password: 'NewPass123!',
        Permanent: true,
      });
    });
  });
});
