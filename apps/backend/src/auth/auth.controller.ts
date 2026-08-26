import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { PasswordResetRequestDto, PasswordResetConfirmDto } from './dto/password-reset.dto';
import { RegisterDto, SendRegistrationOtpDto } from './dto/register.dto';
import { StepUpDto } from './dto/step-up.dto';
import { AuthenticatedRequest, SessionUser } from './guards/session-auth.guard';
import { generateOpaqueToken } from '../common/security/hash-token.util';

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'nest_session';

// API Contract §4. Every route here is under the "strict" rate-limit tier
// (API Contract §11) except logout/step-up, which require an existing
// session and so aren't part of the pre-auth abuse surface the strict
// tier is defending.
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, requestContext(req));
    if ('two_factor_required' in result) {
      return result;
    }
    setSessionCookie(res, result.rawSessionToken, dto.remember_me);
    return { user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register/send-otp')
  @HttpCode(HttpStatus.OK)
  async sendRegistrationOtp(@Body() dto: SendRegistrationOtpDto) {
    await this.authService.sendRegistrationOtp(dto.email);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto, requestContext(req));
    if (result.rawSessionToken) {
      setSessionCookie(res, result.rawSessionToken);
    }
    return { user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body('token') token: string, @Req() req: Request) {
    if (!token) throw new BadRequestException('Token is required');
    await this.authService.verifyEmail(token, requestContext(req));
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactor(
    @Body() dto: TwoFactorVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyTwoFactor(dto, requestContext(req));
    setSessionCookie(res, result.rawSessionToken, dto.remember_me);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: SessionUser,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.sessionId, user.id, requestContext(req));
    res.clearCookie(SESSION_COOKIE_NAME);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Req() req: Request) {
    await this.authService.requestPasswordReset(dto, requestContext(req));
    // API Contract §4 — identical response regardless of outcome.
    return { message: 'If an account exists for this email, a reset link has been sent.' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto, @Req() req: Request) {
    await this.authService.confirmPasswordReset(dto, requestContext(req));
    return { message: 'Password updated.' };
  }

  @Post('step-up')
  @HttpCode(HttpStatus.OK)
  async stepUp(
    @Body() dto: StepUpDto,
    @CurrentUser() user: SessionUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.stepUp(user.id, req.sessionId, dto);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: SessionUser) {
    const fullUser = await this.authService.getMe(user.id);
    return { user: fullUser };
  }

  @Public()
  @Get('csrf')
  getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let token = req.cookies['csrf-token'];
    if (!token) {
      token = generateOpaqueToken();
      res.cookie('csrf-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }
    return { csrf_token: token };
  }
}

function requestContext(req: Request) {
  return {
    ipAddress: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}

function setSessionCookie(res: Response, rawToken: string, rememberMe: boolean = false) {
  // HttpOnly + Secure + SameSite=Strict per ADR-005. `secure` is
  // conditional on NODE_ENV so local HTTP development still works;
  // production always runs behind Caddy's TLS termination (ADR-007).
  const cookieOptions: any = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
  if (rememberMe) {
    cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }
  res.cookie(SESSION_COOKIE_NAME, rawToken, cookieOptions);
}
