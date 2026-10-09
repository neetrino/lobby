/**
 * Fixed unusable Argon2id digest for unknown-user login.
 * Encoded with the hasher parameters (19 MiB, 2 iterations, 1 lane)
 * so a failed lookup still pays the same verification cost.
 * The password that produced this digest is not stored.
 */
export const UNKNOWN_USER_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$JdTcssR2c768bagsEzzRkQ$MgnuKHueLnbYayCyFF31k3WpUDwY40Tfx9qt9rR+xj8';
