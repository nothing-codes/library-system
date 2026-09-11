import { clearSession } from "./lib/auth.js";

export default function handler(req, res) {
  res.setHeader("Set-Cookie", clearSession());
  res.json({ ok: true });
}
