import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './strategies/cognito-jwt.strategy';
import { isSessionVisibleToSystem } from './system-access.util';
import { buildAllowlist } from '../config/origins';
import type { Env } from '../config/env.schema';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  private readonly defaultReturnA: string;
  private readonly defaultReturnB: string;
  private readonly allowlist: string[];

  constructor(
    private readonly authService: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.defaultReturnA = config.get('FRONTEND_URL_A', { infer: true });
    this.defaultReturnB = config.get('FRONTEND_URL_B', { infer: true });
    this.allowlist = buildAllowlist(config);
  }

  // ─────────── BFF — OIDC orquestado por Sistema C ───────────

  @Get('login')
  async login(
    @Query('origin') originRaw: string | undefined,
    @Query('return_to') returnTo: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const origin: 'A' | 'B' = originRaw === 'B' ? 'B' : 'A';
    const state = this.authService.generateState();
    const finalReturn = this.resolveReturnTo(origin, returnTo);
    req.session.oauth = { state, returnTo: finalReturn, origin };
    await req.session.save();
    res.redirect(this.authService.buildAuthorizeUrl(state));
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (error) {
      throw new UnauthorizedException(`Cognito returned error: ${error}`);
    }
    if (!code || !state) {
      throw new UnauthorizedException('Missing code or state on callback');
    }
    const oauth = req.session.oauth;
    if (!oauth || oauth.state !== state) {
      throw new UnauthorizedException('Invalid OAuth state (CSRF protection)');
    }

    const tokens = await this.authService.exchangeCodeForTokens(code);
    const claims = this.authService.decodeIdToken(tokens.id_token);

    req.session.user = {
      sub: claims.sub,
      email: claims.email,
      username: claims['cognito:username'],
      groups: claims['cognito:groups'] ?? [],
      loginOrigin: oauth.origin,
    };
    req.session.tokens = {
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };
    const returnTo = oauth.returnTo;
    req.session.oauth = undefined;
    await req.session.save();
    res.redirect(returnTo);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @Query('origin') originRaw: string | undefined,
    @Query('return_to') returnTo: string | undefined,
    @Req() req: Request,
  ): { logoutUrl: string } {
    const origin: 'A' | 'B' = originRaw === 'B' ? 'B' : 'A';
    req.session.destroy();
    const fallback = origin === 'B' ? this.defaultReturnB : this.defaultReturnA;
    const logoutUri = this.resolveLogoutUri(returnTo, fallback);
    return { logoutUrl: this.authService.buildLogoutUrl(logoutUri) };
  }

  @Get('session')
  getSession(
    @Req() req: Request,
    @Headers('x-system') system: string | undefined,
  ): {
    authenticated: boolean;
    user?: { sub: string; email?: string; username?: string; groups: string[] };
  } {
    const user = req.session.user;
    // Confinamiento: un Admin solo está "autenticado" en su sistema de origen.
    // Para el otro SPA devolvemos authenticated:false → se queda en login.
    if (!user || !isSessionVisibleToSystem(user, system)) {
      return { authenticated: false };
    }
    return { authenticated: true, user };
  }

  // ─────────── Bearer compat (Postman, server-to-server) ───────────

  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  verifyToken(@Req() req: AuthenticatedRequest): {
    valid: true;
    claims: AuthenticatedUser;
  } {
    return { valid: true, claims: req.user };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() req: Request) {
    return req.session.user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async refresh(@Req() req: Request): Promise<{ ok: true; expiresIn: number }> {
    const tokens = req.session.tokens;
    const user = req.session.user;
    if (!tokens || !user?.username) {
      throw new UnauthorizedException('Session has no tokens to refresh');
    }
    const refreshed = await this.authService.refreshTokens(
      tokens.refreshToken,
      user.username,
    );
    req.session.tokens = {
      refreshToken: refreshed.refresh_token,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
    };
    await req.session.save();
    return { ok: true, expiresIn: refreshed.expires_in };
  }

  // ─────────── helpers ───────────

  private resolveReturnTo(origin: 'A' | 'B', returnTo?: string): string {
    const base = origin === 'B' ? this.defaultReturnB : this.defaultReturnA;
    if (!returnTo) return base;
    try {
      // URL absoluta: se acepta si su origen está en la allowlist; así el BFF
      // redirige de vuelta al frontend que inició (localhost, Netlify, Vercel…).
      const candidate = new URL(returnTo);
      return this.allowlist.includes(candidate.origin) ? returnTo : base;
    } catch {
      // Path relativo: se cuelga del frontend por defecto del origin.
      const path = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
      return base + path;
    }
  }

  /** logout_uri para Cognito: el origen que cierra sesión si está permitido. */
  private resolveLogoutUri(
    returnTo: string | undefined,
    fallback: string,
  ): string {
    if (!returnTo) return fallback;
    try {
      const candidate = new URL(returnTo);
      return this.allowlist.includes(candidate.origin)
        ? candidate.origin
        : fallback;
    } catch {
      return fallback;
    }
  }
}
