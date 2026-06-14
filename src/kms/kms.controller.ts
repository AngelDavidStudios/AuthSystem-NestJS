import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';
import { SystemAccessGuard } from '../auth/guards/system-access.guard';
import { KmsService } from './kms.service';
import { EncryptDto } from './dto/encrypt.dto';
import { DecryptDto } from './dto/decrypt.dto';

@Controller('kms')
@UseGuards(HybridAuthGuard, SystemAccessGuard)
export class KmsController {
  constructor(private readonly kmsService: KmsService) {}

  @Post('encrypt')
  @HttpCode(HttpStatus.OK)
  encrypt(@Body() dto: EncryptDto) {
    return this.kmsService.encrypt(dto.payload);
  }

  @Post('decrypt')
  @HttpCode(HttpStatus.OK)
  async decrypt(@Body() dto: DecryptDto): Promise<{ payload: string }> {
    return {
      payload: await this.kmsService.decrypt(
        dto.encryptedPayload,
        dto.encryptedDataKey,
      ),
    };
  }
}
