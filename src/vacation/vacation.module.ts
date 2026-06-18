import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { VacationController } from './vacation.controller';
import { VacationService } from './vacation.service';
import { VacationRepo } from './vacation.repo';
import { AuditRepo } from './audit.repo';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [VacationController],
  providers: [VacationService, VacationRepo, AuditRepo],
  exports: [VacationService, VacationRepo, AuditRepo],
})
export class VacationModule {}
