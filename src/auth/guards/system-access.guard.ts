import '../../session/session.types';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { isSessionVisibleToSystem } from '../system-access.util';

/**
 * Confinamiento de sesión por sistema de origen (defensa en profundidad).
 *
 * Las SPAs se identifican con la cabecera `X-System: A | B`. Un Admin que inició
 * sesión en un sistema NO puede operar endpoints sensibles (p.ej. `/kms/decrypt`)
 * desde el otro sistema, aunque comparta la cookie. Los usuarios no-admin no se
 * ven afectados (SSO en ambos). Ver `isSessionVisibleToSystem`.
 */
@Injectable()
export class SystemAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.session?.user;
    const system = req.header('x-system');

    if (user && !isSessionVisibleToSystem(user, system)) {
      throw new ForbiddenException(
        'Sesión de Admin confinada a su sistema de origen',
      );
    }
    return true;
  }
}
