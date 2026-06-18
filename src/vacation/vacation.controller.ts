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
import { VacationService } from './vacation.service';
import { VacationActionDto } from './dto/vacation-action.dto';

/**
 * `POST /vacation` — endpoint único con dispatch por `{ action, ...params }`
 * (patrón heredado de los handlers tipo Lambda del frontend WFN). La identidad
 * sale de la sesión iron-session (cookie), nunca de los params. La autorización
 * fina por acción la aplica el VacationService.
 */
@Controller('vacation')
@UseGuards(SessionAuthGuard)
export class VacationController {
  constructor(private readonly vacation: VacationService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  dispatch(
    @Body() dto: VacationActionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    switch (dto.action) {
      case 'createRequest':
        return this.vacation.createRequest(
          {
            startDate: req(dto.startDate, 'startDate'),
            endDate: req(dto.endDate, 'endDate'),
            type: req(dto.type, 'type'),
            reason: dto.reason,
            userId: req(dto.userId, 'userId'),
            userEmail: req(dto.userEmail, 'userEmail'),
            userName: req(dto.userName, 'userName'),
          },
          user,
        );

      case 'approveRequest':
        return this.vacation.approveRequest(
          req(dto.id, 'id'),
          user,
          dto.comment,
        );

      case 'rejectRequest':
        return this.vacation.rejectRequest(
          req(dto.id, 'id'),
          user,
          dto.comment,
        );

      case 'cancelRequest':
        return this.vacation.cancelRequest(req(dto.id, 'id'), user);

      case 'getRequest':
        return this.vacation.getRequest(req(dto.id, 'id'), user);

      case 'getMyRequests':
        return this.vacation.getMyRequests(req(dto.userId, 'userId'), user);

      case 'getPendingApprovals':
        return this.vacation.getPendingApprovals(
          req(dto.userId, 'userId'),
          user,
        );

      case 'getAllRequests':
        return this.vacation.getAllRequests(user);

      case 'getBalance':
        return this.vacation.getBalance(req(dto.userId, 'userId'), user);

      case 'setBalance':
        return this.vacation.setBalance(
          {
            userId: req(dto.userId, 'userId'),
            userEmail: req(dto.userEmail, 'userEmail'),
            userName: req(dto.userName, 'userName'),
            totalDays: req(dto.totalDays, 'totalDays'),
            adminUserId: req(dto.adminUserId, 'adminUserId'),
          },
          user,
        );

      case 'getAllBalances':
        return this.vacation.getAllBalances(user);

      case 'getAuditLogs':
        return this.vacation.getAuditLogs(
          { actionFilter: dto.actionFilter, entityType: dto.entityType },
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
