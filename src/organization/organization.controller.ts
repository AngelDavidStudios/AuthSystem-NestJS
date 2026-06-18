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
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import {
  CurrentUser,
  type CurrentUserData,
} from '../auth/decorators/current-user.decorator';
import { OrganizationService } from './organization.service';
import { OrganizationActionDto } from './dto/organization-action.dto';

/**
 * `POST /organization` — dispatch por `{ action, ...params }`. Todo el árbol
 * organizacional es administración: el controller exige el grupo Cognito
 * `Admins` (= rol `super_admin` en el frontend) para cualquier acción.
 */
@Controller('organization')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles('Admins')
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  dispatch(
    @Body() dto: OrganizationActionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    switch (dto.action) {
      case 'createNode':
        return this.organization.createNode(
          {
            userId: req(dto.userId, 'userId'),
            userEmail: req(dto.userEmail, 'userEmail'),
            userName: req(dto.userName, 'userName'),
            supervisorId: dto.supervisorId,
            position: req(dto.position, 'position'),
            department: req(dto.department, 'department'),
          },
          user,
        );

      case 'updateNode':
        return this.organization.updateNode(
          {
            id: req(dto.id, 'id'),
            supervisorId: dto.supervisorId,
            position: dto.position,
            department: dto.department,
          },
          user,
        );

      case 'deleteNode':
        return this.organization.deleteNode(req(dto.id, 'id'), user);

      case 'getNode':
        return this.organization.getNode(req(dto.id, 'id'));

      case 'getTree':
        return this.organization.getTree();

      case 'getNodeByUserId':
        return this.organization.getNodeByUserId(req(dto.userId, 'userId'));

      case 'getSubordinates':
        return this.organization.getSubordinates(req(dto.id, 'id'));

      case 'assignSupervisor':
        return this.organization.assignSupervisor(
          req(dto.id, 'id'),
          req(dto.supervisorId, 'supervisorId'),
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
