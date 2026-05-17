import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { KmsModule } from './kms/kms.module';
import { RolesModule } from './roles/roles.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    AuthModule,
    KmsModule,
    RolesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
