import { Body, Controller, HttpCode, Post, Req, Res, UseFilters } from '@nestjs/common';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LoginService, type SignedInAccount } from '../application/login.service';
import { LogoutService } from '../application/logout.service';
import { RegisterService, type RegisteredAccount } from '../application/register.service';
import { SessionCookie, type SessionCookieWriter } from '../infrastructure/session-cookie';
import { loginSchema, type LoginInput } from './dto/login.schema';
import { registerSchema, type RegisterInput } from './dto/register.schema';
import { IdentityExceptionFilter } from './identity-exception.filter';

@Controller('v1/auth')
@UseFilters(IdentityExceptionFilter)
export class AuthController {
  constructor(
    private readonly registerUser: RegisterService,
    private readonly loginUser: LoginService,
    private readonly logoutUser: LogoutService,
    private readonly sessionCookie: SessionCookie,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Res({ passthrough: true }) response: SessionCookieWriter,
  ): Promise<{ data: RegisteredAccount }> {
    const created = await this.registerUser.register(body);
    this.sessionCookie.set(response, created.rawSessionId);
    return { data: created.account };
  }

  /** Always stores a new session id. An existing session cookie is not read or reused. */
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) response: SessionCookieWriter,
  ): Promise<{ data: SignedInAccount }> {
    const signedIn = await this.loginUser.login(body);
    this.sessionCookie.set(response, signedIn.rawSessionId);
    return { data: signedIn.account };
  }

  /** Idempotent. A missing or already revoked session still clears the cookie and returns success. */
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: { headers: { cookie?: string | readonly string[] } },
    @Res({ passthrough: true }) response: SessionCookieWriter,
  ): Promise<void> {
    await this.logoutUser.logout(this.sessionCookie.read(request.headers.cookie));
    this.sessionCookie.clear(response);
  }
}
