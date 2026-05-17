import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { KmsController } from './kms.controller';
import { KmsService } from './kms.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [KmsController],
  providers: [KmsService],
  exports: [KmsService],
})
export class KmsModule {}
