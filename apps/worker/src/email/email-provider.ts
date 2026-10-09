import type { Locale } from '@lobby/contracts';
import { readInvitationTokenKey } from '@lobby/database';

/** Delivery contract. Provider SDKs stay behind this interface. */
export type MemberInvitationEmail = {
  to: string;
  organizationName: string;
  inviterName: string;
  invitationUrl: string;
  locale: Locale;
  idempotencyKey: string;
};

export type PasswordResetEmail = {
  to: string;
  organizationName: string;
  resetUrl: string;
  locale: Locale;
  idempotencyKey: string;
};

export interface EmailProvider {
  sendMemberInvitation(input: MemberInvitationEmail): Promise<void>;
  sendPasswordReset(input: PasswordResetEmail): Promise<void>;
}

const PLACEHOLDER_RESEND_KEY = 're_...';

/** One hung Resend call must not hold the outbox poll open. */
export const RESEND_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Production refuses to poll until invitation email can be sent.
 * Other environments keep the relay up so contact and tenant handlers still run.
 */
export function assertProductionInvitationEmailConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }
  const missing = missingInvitationEmailConfig(env);
  if (missing.length > 0) {
    throw new Error(`Invitation email configuration is incomplete: ${missing.join(', ')}.`);
  }
}

/** Resend HTTP API. Returns null when the key or sender address is not configured. */
export function readEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider | null {
  const apiKey = env.RESEND_API_KEY?.trim() ?? '';
  const from = env.RESEND_FROM_EMAIL?.trim() ?? '';
  if (apiKey.length === 0 || apiKey === PLACEHOLDER_RESEND_KEY || from.length === 0) {
    return null;
  }
  return new ResendEmailProvider(apiKey, from);
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  sendMemberInvitation(input: MemberInvitationEmail): Promise<void> {
    return this.deliver({
      to: input.to,
      subject: invitationSubject(input),
      text: invitationText(input),
      idempotencyKey: input.idempotencyKey,
      failure: 'Email provider rejected the invitation.',
    });
  }

  sendPasswordReset(input: PasswordResetEmail): Promise<void> {
    return this.deliver({
      to: input.to,
      subject: resetSubject(input),
      text: resetText(input),
      idempotencyKey: input.idempotencyKey,
      failure: 'Email provider rejected the password reset.',
    });
  }

  private async deliver(input: {
    to: string;
    subject: string;
    text: string;
    idempotencyKey: string;
    failure: string;
  }): Promise<void> {
    const response = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(RESEND_REQUEST_TIMEOUT_MS),
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!response.ok) {
      throw new Error(input.failure);
    }
  }
}

function missingInvitationEmailConfig(env: NodeJS.ProcessEnv): string[] {
  const missing: string[] = [];
  const apiKey = env.RESEND_API_KEY?.trim() ?? '';
  if (apiKey.length === 0 || apiKey === PLACEHOLDER_RESEND_KEY) {
    missing.push('RESEND_API_KEY');
  }
  if ((env.RESEND_FROM_EMAIL?.trim() ?? '').length === 0) {
    missing.push('RESEND_FROM_EMAIL');
  }
  if ((env.APP_URL?.trim() ?? '').length === 0) {
    missing.push('APP_URL');
  }
  if (!hasInvitationTokenKey(env)) {
    missing.push('INVITATION_TOKEN_KEY');
  }
  return missing;
}

function hasInvitationTokenKey(env: NodeJS.ProcessEnv): boolean {
  try {
    return readInvitationTokenKey(env) !== null;
  } catch {
    return false;
  }
}

function resetSubject(input: PasswordResetEmail): string {
  if (input.locale === 'hy') {
    return `${input.organizationName} գաղտնաբառի վերականգնում`;
  }
  if (input.locale === 'ru') {
    return `Восстановление пароля ${input.organizationName}`;
  }
  return `Reset your ${input.organizationName} password`;
}

function resetText(input: PasswordResetEmail): string {
  if (input.locale === 'hy') {
    return [
      `${input.organizationName}-ի գաղտնաբառը վերականգնելու հղում։`,
      '',
      input.resetUrl,
      '',
      'Հղումը գործում է 30 րոպե և մեկ անգամ։',
      'Եթե սա չէիք սպասում, անտեսեք այս նամակը։',
    ].join('\n');
  }
  if (input.locale === 'ru') {
    return [
      `Ссылка для восстановления пароля ${input.organizationName}.`,
      '',
      input.resetUrl,
      '',
      'Ссылка действует 30 минут и только один раз.',
      'Если вы её не ждали, проигнорируйте это письмо.',
    ].join('\n');
  }
  return [
    `Use this link to reset your ${input.organizationName} password.`,
    '',
    input.resetUrl,
    '',
    'The link works once and expires in 30 minutes.',
    'If you were not expecting it, ignore this email.',
  ].join('\n');
}

function invitationSubject(input: MemberInvitationEmail): string {
  if (input.locale === 'hy') {
    return `Ձեզ հրավիրել են ${input.organizationName}`;
  }
  if (input.locale === 'ru') {
    return `Вас пригласили в ${input.organizationName}`;
  }
  return `You were invited to join ${input.organizationName}`;
}

function invitationText(input: MemberInvitationEmail): string {
  if (input.locale === 'hy') {
    return [
      `${input.inviterName}-ը հրավիրել է ձեզ միանալ ${input.organizationName}-ին որպես անդամ։`,
      '',
      input.invitationUrl,
      '',
      'Հրավերն ուժի մեջ է 72 ժամ։',
      'Եթե սա չէիք սպասում, անտեսեք այս նամակը։',
    ].join('\n');
  }
  if (input.locale === 'ru') {
    return [
      `${input.inviterName} приглашает вас в ${input.organizationName} как участника.`,
      '',
      input.invitationUrl,
      '',
      'Приглашение действует 72 часа.',
      'Если вы его не ждали, проигнорируйте это письмо.',
    ].join('\n');
  }
  return [
    `${input.inviterName} invited you to join ${input.organizationName} as a Member.`,
    '',
    input.invitationUrl,
    '',
    'This invitation expires in 72 hours.',
    'If you were not expecting it, ignore this email.',
  ].join('\n');
}
