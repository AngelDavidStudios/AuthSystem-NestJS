import { NestFactory } from '@nestjs/core';
import serverlessExpress from '@codegenie/serverless-express';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Handler,
} from 'aws-lambda';
import type { Express } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

// Lambda Function URL usa el formato de evento/respuesta v2.0.
type FnUrlHandler = Handler<APIGatewayProxyEventV2, APIGatewayProxyResultV2>;

/**
 * Entry point para AWS Lambda (Function URL, HTTPS nativo). Envuelve la app
 * Nest/Express con serverless-express. El handler se cachea entre invocaciones
 * (warm starts) para no reconstruir la app en cada request.
 *
 * iron-session es stateless (cookie cifrada), así que no hay estado de servidor
 * que perder entre invocaciones; KMS/Cognito usan el execution role de la Lambda.
 */
let cachedHandler: FnUrlHandler;

async function bootstrap(): Promise<FnUrlHandler> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.init();
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  const proxy = serverlessExpress({
    app: expressApp,
  }) as unknown as FnUrlHandler;
  return proxy;
}

export const handler: FnUrlHandler = async (event, context, callback) => {
  cachedHandler = cachedHandler ?? (await bootstrap());
  return cachedHandler(event, context, callback);
};
