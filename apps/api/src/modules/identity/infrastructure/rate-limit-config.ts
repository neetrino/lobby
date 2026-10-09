/** Injection token for {@link AuthRateLimitConfig}. */
export const AUTH_RATE_LIMITS = Symbol('AUTH_RATE_LIMITS');

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

export type AuthRateLimitConfig = {
  loginIp: RateLimitPolicy;
  loginAccount: RateLimitPolicy;
  registerIp: RateLimitPolicy;
  invalidSessionIp: RateLimitPolicy;
  inviteIp: RateLimitPolicy;
  inviteUser: RateLimitPolicy;
  acceptIp: RateLimitPolicy;
  passwordResetIp: RateLimitPolicy;
  passwordResetAccount: RateLimitPolicy;
  passwordResetConfirmIp: RateLimitPolicy;
  teamMessageIp: RateLimitPolicy;
  teamMessageUser: RateLimitPolicy;
};

/**
 * Initial auth windows. Each environment can override them.
 * A request is rejected only after this many accepted attempts in the window.
 */
const DEFAULT_LOGIN_IP_LIMIT = 20;
const DEFAULT_LOGIN_IP_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOGIN_ACCOUNT_LIMIT = 10;
const DEFAULT_LOGIN_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_REGISTER_IP_LIMIT = 5;
const DEFAULT_REGISTER_IP_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_INVALID_SESSION_IP_LIMIT = 30;
const DEFAULT_INVALID_SESSION_IP_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_INVITE_IP_LIMIT = 5;
const DEFAULT_INVITE_IP_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_INVITE_USER_LIMIT = 20;
const DEFAULT_INVITE_USER_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_ACCEPT_IP_LIMIT = 20;
const DEFAULT_ACCEPT_IP_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_PASSWORD_RESET_IP_LIMIT = 10;
const DEFAULT_PASSWORD_RESET_IP_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_PASSWORD_RESET_ACCOUNT_LIMIT = 5;
const DEFAULT_PASSWORD_RESET_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_PASSWORD_RESET_CONFIRM_IP_LIMIT = 10;
const DEFAULT_PASSWORD_RESET_CONFIRM_IP_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_TEAM_MESSAGE_IP_LIMIT = 60;
const DEFAULT_TEAM_MESSAGE_IP_WINDOW_MS = 60 * 1000;
const DEFAULT_TEAM_MESSAGE_USER_LIMIT = 30;
const DEFAULT_TEAM_MESSAGE_USER_WINDOW_MS = 60 * 1000;

export function readAuthRateLimitConfig(env: NodeJS.ProcessEnv = process.env): AuthRateLimitConfig {
  return {
    ...credentialPolicies(env),
    ...invitationPolicies(env),
    ...passwordResetPolicies(env),
    ...teamMessagePolicies(env),
  };
}

function credentialPolicies(env: NodeJS.ProcessEnv): Pick<
  AuthRateLimitConfig,
  'loginIp' | 'loginAccount' | 'registerIp' | 'invalidSessionIp'
> {
  return {
    loginIp: policy(env, 'RATE_LIMIT_LOGIN_IP_LIMIT', 'RATE_LIMIT_LOGIN_IP_WINDOW_MS', DEFAULT_LOGIN_IP_LIMIT, DEFAULT_LOGIN_IP_WINDOW_MS),
    loginAccount: policy(env, 'RATE_LIMIT_LOGIN_ACCOUNT_LIMIT', 'RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_MS', DEFAULT_LOGIN_ACCOUNT_LIMIT, DEFAULT_LOGIN_ACCOUNT_WINDOW_MS),
    registerIp: policy(env, 'RATE_LIMIT_REGISTER_IP_LIMIT', 'RATE_LIMIT_REGISTER_IP_WINDOW_MS', DEFAULT_REGISTER_IP_LIMIT, DEFAULT_REGISTER_IP_WINDOW_MS),
    invalidSessionIp: policy(env, 'RATE_LIMIT_INVALID_SESSION_IP_LIMIT', 'RATE_LIMIT_INVALID_SESSION_IP_WINDOW_MS', DEFAULT_INVALID_SESSION_IP_LIMIT, DEFAULT_INVALID_SESSION_IP_WINDOW_MS),
  };
}

function invitationPolicies(env: NodeJS.ProcessEnv): Pick<AuthRateLimitConfig, 'inviteIp' | 'inviteUser' | 'acceptIp'> {
  return {
    inviteIp: policy(env, 'RATE_LIMIT_INVITE_IP_LIMIT', 'RATE_LIMIT_INVITE_IP_WINDOW_MS', DEFAULT_INVITE_IP_LIMIT, DEFAULT_INVITE_IP_WINDOW_MS),
    inviteUser: policy(env, 'RATE_LIMIT_INVITE_USER_LIMIT', 'RATE_LIMIT_INVITE_USER_WINDOW_MS', DEFAULT_INVITE_USER_LIMIT, DEFAULT_INVITE_USER_WINDOW_MS),
    acceptIp: policy(env, 'RATE_LIMIT_ACCEPT_IP_LIMIT', 'RATE_LIMIT_ACCEPT_IP_WINDOW_MS', DEFAULT_ACCEPT_IP_LIMIT, DEFAULT_ACCEPT_IP_WINDOW_MS),
  };
}

function teamMessagePolicies(env: NodeJS.ProcessEnv): Pick<AuthRateLimitConfig, 'teamMessageIp' | 'teamMessageUser'> {
  return {
    teamMessageIp: policy(env, 'RATE_LIMIT_TEAM_MESSAGE_IP_LIMIT', 'RATE_LIMIT_TEAM_MESSAGE_IP_WINDOW_MS', DEFAULT_TEAM_MESSAGE_IP_LIMIT, DEFAULT_TEAM_MESSAGE_IP_WINDOW_MS),
    teamMessageUser: policy(env, 'RATE_LIMIT_TEAM_MESSAGE_USER_LIMIT', 'RATE_LIMIT_TEAM_MESSAGE_USER_WINDOW_MS', DEFAULT_TEAM_MESSAGE_USER_LIMIT, DEFAULT_TEAM_MESSAGE_USER_WINDOW_MS),
  };
}

function passwordResetPolicies(env: NodeJS.ProcessEnv): Pick<
  AuthRateLimitConfig,
  'passwordResetIp' | 'passwordResetAccount' | 'passwordResetConfirmIp'
> {
  return {
    passwordResetIp: policy(env, 'RATE_LIMIT_PASSWORD_RESET_IP_LIMIT', 'RATE_LIMIT_PASSWORD_RESET_IP_WINDOW_MS', DEFAULT_PASSWORD_RESET_IP_LIMIT, DEFAULT_PASSWORD_RESET_IP_WINDOW_MS),
    passwordResetAccount: policy(env, 'RATE_LIMIT_PASSWORD_RESET_ACCOUNT_LIMIT', 'RATE_LIMIT_PASSWORD_RESET_ACCOUNT_WINDOW_MS', DEFAULT_PASSWORD_RESET_ACCOUNT_LIMIT, DEFAULT_PASSWORD_RESET_ACCOUNT_WINDOW_MS),
    passwordResetConfirmIp: policy(env, 'RATE_LIMIT_PASSWORD_RESET_CONFIRM_IP_LIMIT', 'RATE_LIMIT_PASSWORD_RESET_CONFIRM_IP_WINDOW_MS', DEFAULT_PASSWORD_RESET_CONFIRM_IP_LIMIT, DEFAULT_PASSWORD_RESET_CONFIRM_IP_WINDOW_MS),
  };
}

/** High ceilings for tests that are not exercising the limiter. */
export function permissiveAuthRateLimits(): AuthRateLimitConfig {
  const open = { limit: 1_000, windowMs: 60_000 };
  return {
    loginIp: open,
    loginAccount: open,
    registerIp: open,
    invalidSessionIp: open,
    inviteIp: open,
    inviteUser: open,
    acceptIp: open,
    passwordResetIp: open,
    passwordResetAccount: open,
    passwordResetConfirmIp: open,
    teamMessageIp: open,
    teamMessageUser: open,
  };
}

function policy(
  env: NodeJS.ProcessEnv,
  limitName: string,
  windowName: string,
  limitFallback: number,
  windowFallback: number,
): RateLimitPolicy {
  return {
    limit: readPositiveInt(env, limitName, limitFallback),
    windowMs: readPositiveInt(env, windowName, windowFallback),
  };
}

function readPositiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim() ?? '';
  if (raw.length === 0) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${name}.`);
  }
  return value;
}
