import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const ACTIONS = [
  'listUsers',
  'createUser',
  'deleteUser',
  'addToGroup',
  'removeFromGroup',
  'getUserGroups',
  'resetPassword',
] as const;

export type UsersAction = (typeof ACTIONS)[number];

/**
 * DTO único de dispatch para `POST /users`. Como el ValidationPipe global usa
 * `whitelist + forbidNonWhitelisted`, se declara la unión de todos los params;
 * los requeridos por acción los valida el controller. La autorización (mixta:
 * Admins vs Admins/Managers) la aplica el UsersService por acción.
 */
export class UsersActionDto {
  @IsIn(ACTIONS)
  action!: UsersAction;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  temporaryPassword?: string;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}
