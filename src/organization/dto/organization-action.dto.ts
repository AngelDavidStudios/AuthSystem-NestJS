import { IsIn, IsOptional, IsString } from 'class-validator';

const ACTIONS = [
  'createNode',
  'updateNode',
  'deleteNode',
  'getNode',
  'getTree',
  'getNodeByUserId',
  'getSubordinates',
  'assignSupervisor',
] as const;

export type OrganizationAction = (typeof ACTIONS)[number];

/**
 * DTO único de dispatch para `POST /organization`. Como el ValidationPipe global
 * usa `whitelist + forbidNonWhitelisted`, se declara la unión de todos los params;
 * los requeridos por acción los valida el service.
 */
export class OrganizationActionDto {
  @IsIn(ACTIONS)
  action!: OrganizationAction;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userEmail?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;
}
