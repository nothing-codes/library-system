import { SignJWT, jwtVerify } from "jose";

export async function setSession(secret, payload) {
  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);

  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  const sameSite = isProd ? "None" : "Lax";

  return `session=${token}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${60 * 60 * 24 * 7}${secureFlag}`;
}

export function clearSession() {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  const sameSite = isProd ? "None" : "Lax";
  return `session=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secureFlag}`;
}

export async function getSession(req, secret) {
  const cookie = req.headers.cookie ?? "";
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  if (!match) return null;

  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(match[1], key);
    return payload;
  } catch {
    return null;
  }
}

export async function requireLibrarian(req, res) {
  const s = await getSession(req, process.env.JWT_SECRET);
  if (!s || s.role !== "librarian") {
    res.status(403).json({ error: "Нет доступа" });
    return null;
  }
  return s;
}
