import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { VacationModule } from '../vacation/vacation.module';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

// Importa VacationModule para reutilizar AuditRepo (bitácora compartida),
// igual que UsersModule.
@Module({
  imports: [ConfigModule, AuthModule, VacationModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
