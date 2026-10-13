import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@lobby/contracts';

import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { passwordResetExpiresAt } from '../domain/password-reset-policy';
import type { LoginAccount } from '../infrastructure/prisma-login-account';
import { PrismaLoginAccountStore } from '../infrastructure/prisma-login-account';
import { PrismaPasswordResetStore } from '../infrastructure/prisma-password-reset';
import {
  createPasswordResetSecret,
  PASSWORD_RESET_TOKEN_KEY,
  sealPasswordResetToken,
} from '../infrastructure/password-reset-seal';

export type RequestPasswordResetInput = {
  subdomain: string;
  email: string;
  locale: Locale;
};

@Injectable()
export class RequestPasswordResetService {
  constructor(
    private readonly accounts: PrismaLoginAccountStore,
    private readonly resets: PrismaPasswordResetStore,
    @Inject(PASSWORD_RESET_TOKEN_KEY) private readonly tokenKey: Buffer | null,
  ) {}

  /**
   * Queues a reset email for an active account.
   * A missing or disabled account still returns success and sends nothing.
   */
  async request(input: RequestPasswordResetInput): Promise<void> {
    if (this.tokenKey === null) {
      throw new IdentityError(identityErrorCodes.PASSWORD_RESET_UNAVAILABLE);
    }
    const account = await this.accounts.findBySubdomainAndEmail(input.subdomain, input.email);
    if (!isActiveAccount(account)) {
      createPasswordResetSecret();
      return;
    }
    await this.issue(account, input.locale, this.tokenKey);
  }

  private async issue(account: LoginAccount, locale: Locale, key: Buffer): Promise<void> {
    const secret = createPasswordResetSecret();
    const now = new Date();
    await this.resets.issue({
      tenantId: account.tenant.id,
      userId: account.user.id,
      email: account.user.email,
      organizationName: account.tenant.name,
      locale,
      tokenHash: secret.tokenHash,
      tokenCiphertext: sealPasswordResetToken(secret.token, key),
      expiresAt: passwordResetExpiresAt(now),
      now,
    });
  }
}

function isActiveAccount(account: LoginAccount | null): account is LoginAccount {
  return account !== null && account.user.status === 'ACTIVE';
}
