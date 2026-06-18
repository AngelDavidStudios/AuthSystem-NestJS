import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { VACATION_TYPES, type VacationType } from '../vacation.types';

const ACTIONS = [
  'createRequest',
  'approveRequest',
  'rejectRequest',
  'cancelRequest',
  'getRequest',
  'getMyRequests',
  'getPendingApprovals',
  'getAllRequests',
  'getBalance',
  'setBalance',
  'getAllBalances',
  'getAuditLogs',
] as const;

export type VacationAction = (typeof ACTIONS)[number];

/**
 * DTO único de dispatch para `POST /vacation`. El ValidationPipe global usa
 * `whitelist + forbidNonWhitelisted`, así que todos los params posibles deben
 * declararse aquí (unión de todas las acciones). Los requeridos por acción los
 * valida el service.
 */
export class VacationActionDto {
  @IsIn(ACTIONS)
  action!: VacationAction;

  // --- createRequest ---
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsIn(VACATION_TYPES)
  type?: VacationType;

  @IsOptional()
  @IsString()
  reason?: string;

  // --- identidad / objetivo ---
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userEmail?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  // --- por id de solicitud (approve/reject/cancel/get) ---
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  // --- setBalance ---
  @IsOptional()
  @IsInt()
  @Min(0)
  totalDays?: number;

  @IsOptional()
  @IsString()
  adminUserId?: string;

  // --- getAuditLogs ---
  @IsOptional()
  @IsString()
  actionFilter?: string;

  @IsOptional()
  @IsString()
  entityType?: string;
}
