import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { VacationModule } from '../vacation/vacation.module';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationRepo } from './organization.repo';

// Importa VacationModule para reutilizar AuditRepo (bitácora compartida).
@Module({
  imports: [ConfigModule, AuthModule, VacationModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationRepo],
  exports: [OrganizationService, OrganizationRepo],
})
export class OrganizationModule {}
