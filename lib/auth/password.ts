import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 120_000;
const KEYLEN = 32;

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, "sha256").toString(
    "hex"
  );
  return { hash, salt };
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string
): boolean {
  const next = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, "sha256");
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}
