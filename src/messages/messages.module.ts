import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { KmsModule } from '../kms/kms.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesRepo } from './messages.repo';

// DynamoService es @Global, no hace falta importar DynamoModule.
// KmsModule exporta KmsService (reuso de la encriptación envelope).
@Module({
  imports: [ConfigModule, AuthModule, KmsModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepo],
  exports: [MessagesService],
})
export class MessagesModule {}
