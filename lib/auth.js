import { SignJWT, jwtVerify } from "jose";

export async function setSession(secret, payload) {
  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);

  return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
}

export function clearSession() {
  return "session=; Path=/; HttpOnly; Max-Age=0";
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