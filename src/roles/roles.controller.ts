import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(HybridAuthGuard, RolesGuard)
@Roles('Admins')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list() {
    return this.rolesService.listGroups();
  }

  @Post(':groupName/users/:username')
  @HttpCode(HttpStatus.NO_CONTENT)
  async addUser(
    @Param('groupName') groupName: string,
    @Param('username') username: string,
  ): Promise<void> {
    await this.rolesService.addUserToGroup(groupName, username);
  }

  @Delete(':groupName/users/:username')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeUser(
    @Param('groupName') groupName: string,
    @Param('username') username: string,
  ): Promise<void> {
    await this.rolesService.removeUserFromGroup(groupName, username);
  }

  @Get('user/:username')
  listForUser(@Param('username') username: string) {
    return this.rolesService.listGroupsForUser(username);
  }
}
