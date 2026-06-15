import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildAllowlist } from './config/origins';
import type { Env } from './config/env.schema';

/**
 * Configuración común de la app Nest, compartida por el arranque local
 * (`main.ts`, servidor HTTP) y el de AWS Lambda (`lambda.ts`, Function URL).
 *
 * `X-System` debe ir en `allowedHeaders`: en local los SPAs usan proxy (mismo
 * origen, sin CORS), pero contra el despliegue HTTPS las peticiones son
 * cross-origin y el header custom dispara preflight.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.enableCors({
    origin: buildAllowlist(config),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-System'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
