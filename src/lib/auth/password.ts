import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const COST = 11;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/** Used to burn the same CPU time when the email doesn't exist (no user enumeration by timing). */
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", COST);

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Human-friendly temporary password, e.g. "Kq7m-Xp3Ra-9tWz". */
export function generateTempPassword() {
  const chunk = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${chunk(4)}-${chunk(5)}-${chunk(4)}`;
}
