import { IsString, MinLength } from 'class-validator';

export class DecryptDto {
  @IsString()
  @MinLength(1)
  encryptedPayload!: string;

  @IsString()
  @MinLength(1)
  encryptedDataKey!: string;
}
