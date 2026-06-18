import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DynamoService } from './dynamo.service';

// Global: cualquier módulo de negocio (vacation/organization) puede inyectar
// DynamoService sin volver a importar este módulo.
@Global()
@Module({
  imports: [ConfigModule],
  providers: [DynamoService],
  exports: [DynamoService],
})
export class DynamoModule {}
