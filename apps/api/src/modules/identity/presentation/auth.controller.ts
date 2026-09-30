import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common';

import { Public } from '../../../common/auth/public';
import { ZodBody } from '../../../common/pipes/zod-input';
import { readClientAddress } from '../../../common/security/client-address';
import { AuthRateLimitService } from '../application/auth-rate-limit.service';
import { LoginService, type SignedInAccount } from '../application/login.service';
import { LogoutService } from '../application/logout.service';
import { RegisterService, type RegisteredAccount } from '../application/register.service';
import { SessionCookie, type SessionCookieWriter } from '../infrastructure/session-cookie';
import { loginSchema, type LoginInput } from './dto/login.schema';
import { registerSchema, type RegisterInput } from './dto/register.schema';

type ClientRequest = {
  ip?: string;
  socket?: { remoteAddress?: string };
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterService,
    private readonly loginUser: LoginService,
    private readonly logoutUser: LogoutService,
    private readonly sessionCookie: SessionCookie,
    private readonly rates: AuthRateLimitService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  async register(
    @ZodBody(registerSchema) body: RegisterInput,
    @Res({ passthrough: true }) response: SessionCookieWriter,
    @Req() request: ClientRequest,
  ): Promise<{ data: RegisteredAccount }> {
    await this.rates.consumeRegister(readClientAddress(request));
    const created = await this.registerUser.register(body);
    this.sessionCookie.set(response, created.rawSessionId);
    return { data: created.account };
  }

  /** Always stores a new session id. An existing session cookie is not read or reused. */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @ZodBody(loginSchema) body: LoginInput,
    @Res({ passthrough: true }) response: SessionCookieWriter,
    @Req() request: ClientRequest,
  ): Promise<{ data: SignedInAccount }> {
    await this.rates.consumeLogin(readClientAddress(request), body.subdomain, body.email);
    const signedIn = await this.loginUser.login(body);
    await this.rates.resetLoginAccount(body.subdomain, body.email);
    this.sessionCookie.set(response, signedIn.rawSessionId);
    return { data: signedIn.account };
  }

  /** Idempotent. A missing or already revoked session still clears the cookie and returns success. */
  @Public()
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
