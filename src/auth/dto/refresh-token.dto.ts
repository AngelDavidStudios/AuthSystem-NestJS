import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  refreshToken!: string;

  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsOptional()
  @IsString()
  username?: string;
}
