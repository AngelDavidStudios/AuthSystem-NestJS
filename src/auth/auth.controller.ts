import {
  Controller,
  Get,
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
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './strategies/cognito-jwt.strategy';
import type { Env } from '../config/env.schema';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  private readonly defaultReturnA: string;
  private readonly defaultReturnB: string;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.defaultReturnA = config.get('FRONTEND_URL_A', { infer: true });
    this.defaultReturnB = config.get('FRONTEND_URL_B', { infer: true });
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
    };
    req.session.tokens = {
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
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
  logout(@Req() req: Request): { logoutUrl: string } {
    req.session.destroy();
    return { logoutUrl: this.authService.buildLogoutUrl() };
  }

  @Get('session')
  getSession(@Req() req: Request): {
    authenticated: boolean;
    user?: { sub: string; email?: string; username?: string; groups: string[] };
  } {
    if (!req.session.user) return { authenticated: false };
    return { authenticated: true, user: req.session.user };
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
  me(@Req() req: Request) {
    if (!req.session.user) {
      throw new UnauthorizedException('No active session');
    }
    return req.session.user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
  ): Promise<{ ok: true; expiresIn: number }> {
    const tokens = req.session.tokens;
    const user = req.session.user;
    if (!tokens || !user?.username) {
      throw new UnauthorizedException('No active session to refresh');
    }
    const refreshed = await this.authService.refreshTokens(
      tokens.refreshToken,
      user.username,
    );
    req.session.tokens = {
      idToken: refreshed.id_token,
      accessToken: refreshed.access_token,
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
      const candidate = new URL(returnTo);
      const allowed = new URL(base);
      if (candidate.origin !== allowed.origin) return base;
      return returnTo;
    } catch {
      const path = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
      return base + path;
    }
  }
}
