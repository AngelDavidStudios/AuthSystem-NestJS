import { build } from 'esbuild';

// Bundlea la salida ya compilada por `nest build` (dist/lambda.js) en un único
// archivo para AWS Lambda. Bundlear el JS compilado (no el TS) preserva los
// metadatos de decoradores que tsc ya emitió, evitando el problema clásico de
// esbuild con `emitDecoratorMetadata`.
//
// - El AWS SDK v3 (@aws-sdk/*, @smithy/*) se externaliza: el runtime de Lambda
//   (Node 18+) ya lo incluye, así no infla el bundle ni el cold start.
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
    '@aws-sdk/*',
    '@smithy/*',
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
