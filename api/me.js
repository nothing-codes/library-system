import { getSession } from "../../lib/auth.js";

export default async function handler(req, res) {
  const s = await getSession(req, process.env.JWT_SECRET);
  if (!s) return res.status(401).json({ error: "Не авторизован" });
  return res.json(s);
}