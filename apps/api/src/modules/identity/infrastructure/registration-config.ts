/** Registration stays closed unless this environment value is exactly `true`. */
export function readRegistrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REGISTRATION_ENABLED === 'true';
}

export const REGISTRATION_ENABLED = Symbol('REGISTRATION_ENABLED');
