import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { KmsModule } from './kms/kms.module';
import { RolesModule } from './roles/roles.module';
import { SessionModule } from './session/session.module';
import { DynamoModule } from './shared/dynamo/dynamo.module';
import { VacationModule } from './vacation/vacation.module';
import { OrganizationModule } from './organization/organization.module';
import { UsersModule } from './users/users.module';
import { StorageModule } from './storage/storage.module';
import { MessagesModule } from './messages/messages.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SessionModule,
    DynamoModule,
    AuthModule,
    KmsModule,
    RolesModule,
    VacationModule,
    OrganizationModule,
    UsersModule,
    StorageModule,
    MessagesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
