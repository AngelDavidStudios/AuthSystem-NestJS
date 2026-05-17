import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CognitoJwtStrategy } from './strategies/cognito-jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { HybridAuthGuard } from './guards/hybrid-auth.guard';

@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [
    AuthService,
    CognitoJwtStrategy,
    JwtAuthGuard,
    SessionAuthGuard,
    HybridAuthGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    SessionAuthGuard,
    HybridAuthGuard,
    PassportModule,
  ],
})
export class AuthModule {}
