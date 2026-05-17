import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  type GroupType,
  ListGroupsCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { Env } from '../config/env.schema';

export interface CognitoGroup {
  name?: string;
  description?: string;
  precedence?: number;
  roleArn?: string;
}

function mapGroup(g: GroupType): CognitoGroup {
  return {
    name: g.GroupName,
    description: g.Description,
    precedence: g.Precedence,
    roleArn: g.RoleArn,
  };
}

@Injectable()
export class RolesService {
  private readonly cognito: CognitoIdentityProviderClient;
  private readonly userPoolId: string;

  constructor(config: ConfigService<Env, true>) {
    this.cognito = new CognitoIdentityProviderClient({
      region: config.get('COGNITO_REGION', { infer: true }),
    });
    this.userPoolId = config.get('COGNITO_USER_POOL_ID', { infer: true });
  }

  async listGroups(): Promise<CognitoGroup[]> {
    const result = await this.cognito.send(
      new ListGroupsCommand({ UserPoolId: this.userPoolId }),
    );
    return (result.Groups ?? []).map(mapGroup);
  }

  async addUserToGroup(groupName: string, username: string): Promise<void> {
    await this.cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        GroupName: groupName,
        Username: username,
      }),
    );
  }

  async removeUserFromGroup(
    groupName: string,
    username: string,
  ): Promise<void> {
    await this.cognito.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: this.userPoolId,
        GroupName: groupName,
        Username: username,
      }),
    );
  }

  async listGroupsForUser(username: string): Promise<CognitoGroup[]> {
    const result = await this.cognito.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      }),
    );
    return (result.Groups ?? []).map(mapGroup);
  }
}
