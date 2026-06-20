import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CONFIDENTIALITY_LEVELS,
  MESSAGE_TYPES,
  type ConfidentialityLevel,
  type MessageType,
} from '../messages.types';

const ACTIONS = ['send', 'list', 'decrypt', 'delete'] as const;
export type MessageAction = (typeof ACTIONS)[number];

/**
 * DTO único de dispatch para `POST /messages` (mismo patrón que vacation).
 * El ValidationPipe global usa `whitelist + forbidNonWhitelisted`, así que todos
 * los params posibles se declaran aquí. Los requeridos por acción los valida el
 * controller (`req(...)`), igual que en VacationController.
 */
export class MessageActionDto {
  @IsIn(ACTIONS)
  action!: MessageAction;

  // --- send ---
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsIn(MESSAGE_TYPES)
  type?: MessageType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  employee?: string;

  @IsOptional()
  @IsString()
  eventDate?: string;

  @IsOptional()
  @IsIn(CONFIDENTIALITY_LEVELS)
  confidentialityLevel?: ConfidentialityLevel;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  // --- decrypt / delete ---
  @IsOptional()
  @IsString()
  messageId?: string;
}
