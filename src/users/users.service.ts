import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type AttributeType,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { AuditRepo } from '../vacation/audit.repo';
import type { Env } from '../config/env.schema';
import type { CognitoUser } from './users.types';

const ADMIN_GROUP = 'Admins';
const MANAGER_GROUP = 'Managers';

@Injectable()
export class UsersService {
  private readonly cognito: CognitoIdentityProviderClient;
  private readonly userPoolId: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly audit: AuditRepo,
  ) {
    this.cognito = new CognitoIdentityProviderClient({
      region: config.get('COGNITO_REGION', { infer: true }),
    });
    this.userPoolId = config.get('COGNITO_USER_POOL_ID', { infer: true });
  }

  async listUsers(user: CurrentUserData): Promise<{ users: CognitoUser[] }> {
    this.assertManagerOrAdmin(user);
    const result = await this.cognito.send(
      new ListUsersCommand({ UserPoolId: this.userPoolId }),
    );
    const users = await Promise.all(
      (result.Users ?? []).map(async (u) => {
        const groups = await this.fetchGroups(u.Username!);
        return mapUser(u, groups);
      }),
    );
    return { users };
  }

  async createUser(
    params: { email: string; username: string; temporaryPassword?: string },
    user: CurrentUserData,
  ): Promise<{
    message: string;
    user: CognitoUser & { temporaryPassword: string };
  }> {
    this.assertAdmin(user);
    const temporaryPassword =
      params.temporaryPassword?.trim() || generateTempPassword();

    const result = await this.cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: params.username,
        TemporaryPassword: temporaryPassword,
        // El admin comparte la contraseña temporal manualmente (no email de Cognito).
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: params.email },
          { Name: 'email_verified', Value: 'true' },
        ],
      }),
    );
    if (!result.User) {
      throw new InternalServerErrorException('No se pudo crear el usuario');
    }

    await this.audit.write({
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: params.username,
      userId: user.sub,
      userEmail: user.email ?? '',
      details: { email: params.email },
    });

    return {
      message:
        'Usuario creado. Comparte la contraseña temporal con el usuario.',
      user: { ...mapUser(result.User, []), temporaryPassword },
    };
  }

  async deleteUser(
    username: string,
    user: CurrentUserData,
  ): Promise<{ message: string }> {
    this.assertAdmin(user);
    await this.cognito.send(
      new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      }),
    );
    await this.audit.write({
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: username,
      userId: user.sub,
      userEmail: user.email ?? '',
    });
    return { message: 'Usuario eliminado' };
  }

  async addToGroup(
    username: string,
    groupName: string,
    user: CurrentUserData,
  ): Promise<{ message: string }> {
    this.assertAdmin(user);
    await this.cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: groupName,
      }),
    );
    await this.audit.write({
      action: 'ROLE_ASSIGNED',
      entityType: 'User',
      entityId: username,
      userId: user.sub,
      userEmail: user.email ?? '',
      details: { groupName },
    });
    return { message: `Usuario agregado al grupo ${groupName}` };
  }

  async removeFromGroup(
    username: string,
    groupName: string,
    user: CurrentUserData,
  ): Promise<{ message: string }> {
    this.assertAdmin(user);
    await this.cognito.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: groupName,
      }),
    );
    await this.audit.write({
      action: 'ROLE_REMOVED',
      entityType: 'User',
      entityId: username,
      userId: user.sub,
      userEmail: user.email ?? '',
      details: { groupName },
    });
    return { message: `Usuario removido del grupo ${groupName}` };
  }

  async getUserGroups(
    username: string,
    user: CurrentUserData,
  ): Promise<{ groups: string[] }> {
    this.assertManagerOrAdmin(user);
    const groups = await this.fetchGroups(username);
    return { groups };
  }

  async resetPassword(
    username: string,
    newPassword: string,
    user: CurrentUserData,
  ): Promise<{ message: string }> {
    this.assertAdmin(user);
    await this.cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        Password: newPassword,
        Permanent: true,
      }),
    );
    await this.audit.write({
      action: 'PASSWORD_RESET',
      entityType: 'User',
      entityId: username,
      userId: user.sub,
      userEmail: user.email ?? '',
    });
    return { message: 'Contraseña restablecida' };
  }

  // ---- helpers ----------------------------------------------------------

  private async fetchGroups(username: string): Promise<string[]> {
    const result = await this.cognito.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      }),
    );
    return (result.Groups ?? [])
      .map((g) => g.GroupName)
      .filter((name): name is string => Boolean(name));
  }

  private assertAdmin(user: CurrentUserData): void {
    if (!user.groups.includes(ADMIN_GROUP)) {
      throw new ForbiddenException('Requiere rol de administrador');
    }
  }

  private assertManagerOrAdmin(user: CurrentUserData): void {
    if (
      !user.groups.includes(ADMIN_GROUP) &&
      !user.groups.includes(MANAGER_GROUP)
    ) {
      throw new ForbiddenException('Requiere rol de administrador o manager');
    }
  }
}

// ---- funciones puras -----------------------------------------------------

function attr(
  attrs: AttributeType[] | undefined,
  name: string,
): string | undefined {
  return attrs?.find((a) => a.Name === name)?.Value;
}

function mapUser(u: UserType, groups: string[]): CognitoUser {
  return {
    username: u.Username ?? '',
    email: attr(u.Attributes, 'email'),
    preferredUsername: attr(u.Attributes, 'preferred_username'),
    name: attr(u.Attributes, 'name'),
    status: u.UserStatus ?? 'UNKNOWN',
    enabled: u.Enabled ?? false,
    createdAt: u.UserCreateDate?.toISOString(),
    groups,
  };
}

/**
 * Contraseña temporal que cumple políticas típicas de Cognito (mayúscula,
 * minúscula, dígito, símbolo, ≥8). El admin la comparte con el usuario, que
 * la cambia en el primer login (estado FORCE_CHANGE_PASSWORD).
 */
function generateTempPassword(): string {
  return `Aa1!${randomBytes(9).toString('hex')}`;
}
