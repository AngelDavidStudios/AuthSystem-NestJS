import { build } from 'esbuild';

// Bundlea la salida ya compilada por `nest build` (dist/lambda.js) en un único
// archivo para AWS Lambda. Bundlear el JS compilado (no el TS) preserva los
// metadatos de decoradores que tsc ya emitió, evitando el problema clásico de
// esbuild con `emitDecoratorMetadata`.
//
// - El AWS SDK v3 (@aws-sdk/*, @smithy/*) se **bundlea completo**, NO se
//   externaliza. Aunque el runtime de Lambda trae una copia del SDK, su versión
//   es más vieja e inconsistente con la que instalamos: mezclar piezas nuestras
//   (p.ej. s3-request-presigner nuevo) con el `@aws-sdk/core` viejo del runtime
//   rompía el init con `ERR_PACKAGE_PATH_NOT_EXPORTED: subpath './util' is not
//   defined ... @aws-sdk/core`. Bundlear todo el SDK elimina ese skew de versión
//   (enfoque recomendado por AWS). Sube el bundle a unos pocos MB — irrelevante
//   frente al límite de 250MB y a cambio el runtime ya no influye.
// - Los paquetes opcionales de NestJS que no usamos se externalizan; Nest los
//   carga con require() en try/catch, así que su ausencia no rompe nada.
await build({
  entryPoints: ['dist/lambda.js'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'lambda-bundle/index.js',
  minify: true,
  keepNames: true, // Nest/DI dependen de nombres de clase estables
  sourcemap: false,
  external: [
    // Dependencia OPCIONAL del SDK (firma CRT para SigV4a / multi-region access
    // points, que no usamos). No está instalada; su require va en un try/catch
    // que cae al firmador JS puro. Externalizar = no romper el build de esbuild.
    '@aws-sdk/signature-v4-crt',
    '@nestjs/microservices',
    '@nestjs/websockets',
    '@nestjs/platform-socket.io',
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
    'cache-manager',
    'class-transformer/storage',
    '@fastify/static',
  ],
  logLevel: 'info',
});
