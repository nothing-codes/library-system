const SALT = "LibrarySalt_2025!Secure";

export async function hashPassword(password) {
  const data = new TextEncoder().encode(SALT + password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(password, hash) {
  return (await hashPassword(password)) === hash;
}