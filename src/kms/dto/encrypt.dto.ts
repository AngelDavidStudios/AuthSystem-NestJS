import { IsString, MinLength } from 'class-validator';

export class EncryptDto {
  @IsString()
  @MinLength(1)
  payload!: string;
}
