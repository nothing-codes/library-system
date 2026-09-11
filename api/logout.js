import { clearSession } from "../../lib/auth.js";

export async function onRequestPost() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSession() } }
  );
}