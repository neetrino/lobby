import { describe, expect, it } from 'vitest';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordPolicySchema } from './password-policy';

describe('passwordPolicySchema', () => {
  it('rejects a password shorter than the minimum', () => {
    const password = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
    const result = passwordPolicySchema.safeParse(password);

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain(password);
  });

  it('rejects a password longer than the maximum', () => {
    const password = 'a'.repeat(PASSWORD_MAX_LENGTH + 1);
    const result = passwordPolicySchema.safeParse(password);

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain(password);
  });

  it('accepts a password at both length boundaries', () => {
    expect(passwordPolicySchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH)).success).toBe(true);
    expect(passwordPolicySchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH)).success).toBe(true);
  });
});
