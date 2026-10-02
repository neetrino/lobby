import type { Locale } from '@lobby/contracts';

/** Delivery contract. Provider SDKs stay behind this interface. */
export type MemberInvitationEmail = {
  to: string;
  organizationName: string;
  inviterName: string;
  invitationUrl: string;
  locale: Locale;
};

export interface EmailProvider {
  sendMemberInvitation(input: MemberInvitationEmail): Promise<void>;
}

const PLACEHOLDER_RESEND_KEY = 're_...';

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

  async sendMemberInvitation(input: MemberInvitationEmail): Promise<void> {
    const response = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject: invitationSubject(input),
        text: invitationText(input),
      }),
    });
    if (!response.ok) {
      throw new Error('Email provider rejected the invitation.');
    }
  }
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
