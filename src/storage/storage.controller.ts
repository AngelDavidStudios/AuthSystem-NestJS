import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import {
  CurrentUser,
  type CurrentUserData,
} from '../auth/decorators/current-user.decorator';
import { StorageService } from './storage.service';
import { StorageActionDto } from './dto/storage-action.dto';

/**
 * `POST /storage` — fotos de perfil vía dispatch `{ action, ...params }`.
 * La autenticación es por cookie (SessionAuthGuard); la autorización fina la
 * aplica el StorageService por acción (propia key vs. Admins/Managers).
 */
@Controller('storage')
@UseGuards(SessionAuthGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  dispatch(
    @Body() dto: StorageActionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    switch (dto.action) {
      case 'getUploadUrl':
        return this.storage.getUploadUrl(
          req(dto.contentType, 'contentType'),
          user,
        );

      case 'get':
        return this.storage.getMyPictureUrl(user);

      case 'getByUser':
        return this.storage.getUserPictureUrl(
          req(dto.username, 'username'),
          user,
        );

      case 'delete':
        return this.storage.delete(user);
    }
  }
}

/** Asegura que un parámetro requerido por la acción esté presente. */
function req<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null || value === '') {
    throw new BadRequestException(`Falta el parámetro requerido: ${name}`);
  }
  return value;
}
