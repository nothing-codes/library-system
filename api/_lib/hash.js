import { createHash } from "node:crypto";

const SALT = "LibrarySalt_2025!Secure";

export function hashPassword(password) {
  return createHash("sha256").update(SALT + password).digest("hex");
}

export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}
