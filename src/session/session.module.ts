import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IronSessionMiddleware } from './iron-session.middleware';

@Module({
  imports: [ConfigModule],
  providers: [IronSessionMiddleware],
  exports: [IronSessionMiddleware],
})
export class SessionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(IronSessionMiddleware).forRoutes('*');
  }
}
