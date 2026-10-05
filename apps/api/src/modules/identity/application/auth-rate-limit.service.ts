import { Inject, Injectable } from '@nestjs/common';

import { ApiError, apiErrorCodes } from '../../../common/http/api-error';
import {
  AUTH_RATE_LIMITS,
  type AuthRateLimitConfig,
  type RateLimitPolicy,
} from '../infrastructure/rate-limit-config';
import {
  acceptIpKey,
  invalidSessionIpKey,
  passwordResetAccountKey,
  passwordResetConfirmIpKey,
  passwordResetIpKey,
  inviteIpKey,
  inviteUserKey,
  loginAccountKey,
  loginIpKey,
  registerIpKey,
} from '../infrastructure/rate-limit-keys';
import { RATE_LIMIT_REDIS, type RateLimitRedis } from '../infrastructure/rate-limit-redis';

@Injectable()
export class AuthRateLimitService {
  constructor(
    @Inject(RATE_LIMIT_REDIS) private readonly redis: RateLimitRedis,
    @Inject(AUTH_RATE_LIMITS) private readonly config: AuthRateLimitConfig,
  ) {}

  /**
   * Counts one login attempt for the address and the normalized account.
   * The account bucket is the same whether or not that account exists.
   */
  async consumeLogin(ip: string | null, subdomain: string, email: string): Promise<void> {
    const address = this.requireAddress(ip);
    await this.hit(loginIpKey(address), this.config.loginIp);
    await this.hit(loginAccountKey(subdomain, email), this.config.loginAccount);
  }

  /** Clears only the account bucket. The IP bucket stays so a shared address cannot reset itself. */
  async resetLoginAccount(subdomain: string, email: string): Promise<void> {
    await this.redis.delete(loginAccountKey(subdomain, email));
  }

  async consumeRegister(ip: string | null): Promise<void> {
    await this.hit(registerIpKey(this.requireAddress(ip)), this.config.registerIp);
  }

  async consumeInvite(ip: string | null, tenantId: string, userId: string): Promise<void> {
    await this.hit(inviteIpKey(this.requireAddress(ip)), this.config.inviteIp);
    await this.hit(inviteUserKey(tenantId, userId), this.config.inviteUser);
  }

  async consumeAccept(ip: string | null): Promise<void> {
    await this.hit(acceptIpKey(this.requireAddress(ip)), this.config.acceptIp);
  }

  /** Counts a reset request for the address and the account, whether or not it exists. */
  async consumePasswordResetRequest(ip: string | null, subdomain: string, email: string): Promise<void> {
    const address = this.requireAddress(ip);
    await this.hit(passwordResetIpKey(address), this.config.passwordResetIp);
    await this.hit(passwordResetAccountKey(subdomain, email), this.config.passwordResetAccount);
  }

  async consumePasswordResetConfirm(ip: string | null): Promise<void> {
    await this.hit(passwordResetConfirmIpKey(this.requireAddress(ip)), this.config.passwordResetConfirmIp);
  }

  async recordInvalidSession(ip: string | null): Promise<void> {
    await this.hit(invalidSessionIpKey(this.requireAddress(ip)), this.config.invalidSessionIp);
  }

  private requireAddress(ip: string | null): string {
    const address = ip?.trim() ?? '';
    if (address.length === 0) {
      throw new ApiError(apiErrorCodes.RATE_LIMITED);
    }
    return address;
  }

  private async hit(key: string, policy: RateLimitPolicy): Promise<void> {
    const count = await this.redis.increment(key, policy.windowMs);
    if (count > policy.limit) {
      throw new ApiError(apiErrorCodes.RATE_LIMITED);
    }
  }
}
