import { build } from 'esbuild';

// Bundlea la salida ya compilada por `nest build` (dist/lambda.js) en un único
// archivo para AWS Lambda. Bundlear el JS compilado (no el TS) preserva los
// metadatos de decoradores que tsc ya emitió, evitando el problema clásico de
// esbuild con `emitDecoratorMetadata`.
//
// - El AWS SDK v3 (@aws-sdk/*, @smithy/*) se externaliza: el runtime de Lambda
//   (Node 18+) ya lo incluye, así no infla el bundle ni el cold start.
// - EXCEPCIÓN: `@aws-sdk/s3-request-presigner` (+ su util `util-format-url`) NO
//   están garantizados en el runtime gestionado, así que se BUNDLEAN vía el
//   plugin de abajo. Son paquetes pequeños y puros; sus dependencias @smithy/*
//   siguen externas (esas sí las trae el runtime). Sin esto el Lambda lanzaría
//   "Cannot find module '@aws-sdk/s3-request-presigner'" al firmar URLs de S3.
// - Los paquetes opcionales de NestJS que no usamos se externalizan; Nest los
//   carga con require() en try/catch, así que su ausencia no rompe nada.
const BUNDLE_AWS = new Set([
  '@aws-sdk/s3-request-presigner',
  '@aws-sdk/util-format-url',
]);
const awsExternalPlugin = {
  name: 'aws-external-except-presigner',
  setup(build) {
    // @aws-sdk/*: externo salvo los del set (que se bundlean).
    build.onResolve({ filter: /^@aws-sdk\// }, (args) =>
      BUNDLE_AWS.has(args.path) ? null : { path: args.path, external: true },
    );
    // @smithy/* siempre externo (lo provee el runtime).
    build.onResolve({ filter: /^@smithy\// }, (args) => ({
      path: args.path,
      external: true,
    }));
  },
};

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
  plugins: [awsExternalPlugin],
  external: [
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
