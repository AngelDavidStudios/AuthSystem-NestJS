import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [RolesController],
  providers: [RolesService, RolesGuard],
  exports: [RolesService, RolesGuard],
})
export class RolesModule {}
