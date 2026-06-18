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
import { UsersService } from './users.service';
import { UsersActionDto } from './dto/users-action.dto';

/**
 * `POST /users` — administración de usuarios Cognito vía dispatch
 * `{ action, ...params }`. Extiende lo que hace `roles/` (que solo cubre grupos).
 * La autorización es mixta y la aplica el UsersService por acción:
 *   - listUsers, getUserGroups → Admins/Managers
 *   - createUser, deleteUser, addToGroup, removeFromGroup, resetPassword → Admins
 */
@Controller('users')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  dispatch(@Body() dto: UsersActionDto, @CurrentUser() user: CurrentUserData) {
    switch (dto.action) {
      case 'listUsers':
        return this.users.listUsers(user);

      case 'createUser':
        return this.users.createUser(
          {
            email: req(dto.email, 'email'),
            username: req(dto.username, 'username'),
            temporaryPassword: dto.temporaryPassword,
          },
          user,
        );

      case 'deleteUser':
        return this.users.deleteUser(req(dto.username, 'username'), user);

      case 'addToGroup':
        return this.users.addToGroup(
          req(dto.username, 'username'),
          req(dto.groupName, 'groupName'),
          user,
        );

      case 'removeFromGroup':
        return this.users.removeFromGroup(
          req(dto.username, 'username'),
          req(dto.groupName, 'groupName'),
          user,
        );

      case 'getUserGroups':
        return this.users.getUserGroups(req(dto.username, 'username'), user);

      case 'resetPassword':
        return this.users.resetPassword(
          req(dto.username, 'username'),
          req(dto.newPassword, 'newPassword'),
          user,
        );
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
