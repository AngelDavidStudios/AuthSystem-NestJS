import { mockClient } from 'aws-sdk-client-mock';
import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  ListGroupsCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { ConfigService } from '@nestjs/config';
import { RolesService } from '../../src/roles/roles.service';
import type { Env } from '../../src/config/env.schema';

const cognitoMock = mockClient(CognitoIdentityProviderClient);

const POOL = 'us-east-1_pool';

const config = {
  get: (key: keyof Env) =>
    key === 'COGNITO_REGION'
      ? 'us-east-1'
      : key === 'COGNITO_USER_POOL_ID'
        ? POOL
        : undefined,
} as unknown as ConfigService<Env, true>;

describe('RolesService (Cognito groups)', () => {
  let service: RolesService;

  beforeEach(() => {
    cognitoMock.reset();
    service = new RolesService(config);
  });

  it('listGroups mapea los grupos del pool', async () => {
    cognitoMock.on(ListGroupsCommand).resolves({
      Groups: [
        { GroupName: 'Admins', Description: 'admins', Precedence: 1 },
        { GroupName: 'Users' },
      ],
    });
    const groups = await service.listGroups();
    expect(groups).toEqual([
      {
        name: 'Admins',
        description: 'admins',
        precedence: 1,
        roleArn: undefined,
      },
      {
        name: 'Users',
        description: undefined,
        precedence: undefined,
        roleArn: undefined,
      },
    ]);
    expect(
      cognitoMock.commandCalls(ListGroupsCommand)[0].args[0].input,
    ).toMatchObject({ UserPoolId: POOL });
  });

  it('listGroups devuelve [] cuando el pool no tiene grupos', async () => {
    cognitoMock.on(ListGroupsCommand).resolves({});
    expect(await service.listGroups()).toEqual([]);
  });

  it('addUserToGroup envía el comando con pool/grupo/usuario', async () => {
    cognitoMock.on(AdminAddUserToGroupCommand).resolves({});
    await service.addUserToGroup('Admins', 'jdoe');
    expect(
      cognitoMock.commandCalls(AdminAddUserToGroupCommand)[0].args[0].input,
    ).toMatchObject({
      UserPoolId: POOL,
      GroupName: 'Admins',
      Username: 'jdoe',
    });
  });

  it('removeUserFromGroup envía el comando correspondiente', async () => {
    cognitoMock.on(AdminRemoveUserFromGroupCommand).resolves({});
    await service.removeUserFromGroup('Admins', 'jdoe');
    expect(
      cognitoMock.commandCalls(AdminRemoveUserFromGroupCommand)[0].args[0]
        .input,
    ).toMatchObject({
      UserPoolId: POOL,
      GroupName: 'Admins',
      Username: 'jdoe',
    });
  });

  it('listGroupsForUser mapea los grupos del usuario', async () => {
    cognitoMock.on(AdminListGroupsForUserCommand).resolves({
      Groups: [{ GroupName: 'Managers', Precedence: 2 }],
    });
    const groups = await service.listGroupsForUser('jdoe');
    expect(groups).toEqual([
      {
        name: 'Managers',
        description: undefined,
        precedence: 2,
        roleArn: undefined,
      },
    ]);
  });
});
