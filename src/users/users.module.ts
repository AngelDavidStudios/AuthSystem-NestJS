import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { VacationModule } from '../vacation/vacation.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Importa VacationModule para reutilizar AuditRepo (bitácora compartida).
@Module({
  imports: [ConfigModule, AuthModule, VacationModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
