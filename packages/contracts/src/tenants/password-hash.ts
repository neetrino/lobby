import { z } from 'zod';

/** Encoded Argon2id PHC string. Auth creates it; Organizations only checks the shape. */
const PASSWORD_HASH_MAX_LENGTH = 255;

const argon2idHashPattern =
  /^\$argon2id\$v=19\$(?:m=\d+,t=\d+,p=\d+|m=\d+,p=\d+,t=\d+)\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

export const passwordHashSchema = z.string().max(PASSWORD_HASH_MAX_LENGTH).regex(argon2idHashPattern);
