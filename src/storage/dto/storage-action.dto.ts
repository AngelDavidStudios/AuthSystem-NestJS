import { IsIn, IsOptional, IsString } from 'class-validator';

const ACTIONS = ['getUploadUrl', 'get', 'getByUser', 'delete'] as const;

export type StorageAction = (typeof ACTIONS)[number];

/**
 * DTO único de dispatch para `POST /storage` (fotos de perfil). Igual que en
 * `users/`, el ValidationPipe global usa whitelist + forbidNonWhitelisted, así
 * que se declaran todos los params posibles; los requeridos por acción los
 * valida el controller. Autorización mixta aplicada por el StorageService:
 *   - getUploadUrl / get / delete → cualquier usuario autenticado (su propia key)
 *   - getByUser                   → Admins/Managers (avatar de otros usuarios)
 */
export class StorageActionDto {
  @IsIn(ACTIONS)
  action!: StorageAction;

  // Tipo MIME del archivo a subir (validado contra la allowlist en el service).
  @IsOptional()
  @IsString()
  contentType?: string;

  // username Cognito de otro usuario (solo getByUser).
  @IsOptional()
  @IsString()
  username?: string;
}
