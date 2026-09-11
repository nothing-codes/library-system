import { getSession } from "../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const s = await getSession(request, env.JWT_SECRET);
  if (!s) return Response.json({ error: "Не авторизован" }, { status: 401 });
  return Response.json(s);
}