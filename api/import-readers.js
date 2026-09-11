import { requireLibrarian } from "../lib/auth.js"; // ИСПРАВЛЕНО
import { supabase } from "../lib/supabase.js"; // ИСПРАВЛЕНО
import { hashPassword } from "../lib/hash.js"; // ИСПРАВЛЕНО

function generatePassword(len = 8) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await requireLibrarian(req, res);
  if (!session) return;

  const { readers } = req.body;
  if (!Array.isArray(readers) || readers.length === 0) return res.status(400).json({ error: "Нет данных для импорта" });

  let created = 0, skipped = 0;
  const credentials = [];

  for (const r of readers) {
    const lastName = String(r.lastName ?? "").trim();
    const firstName = String(r.firstName ?? "").trim();
    const middleName = String(r.middleName ?? "").trim();
    const phone = String(r.phone ?? "").trim();
    const className = String(r.className ?? "").trim();

    if (!lastName || !firstName) { skipped++; continue; }

    const login = `${lastName.toLowerCase()}.${firstName[0].toLowerCase()}`;
    const { data: existing } = await supabase.from("users").select("id").eq("login", login).maybeSingle();
    if (existing) { skipped++; continue; }

    const password = generatePassword(8);
    const hashed = hashPassword(password);

    try {
      const { data: user } = await supabase.from("users").insert({ login, password: hashed, role_id: 1 }).select("id").single();
      await supabase.from("readers").insert({
        user_id: user.id,
        last_name: lastName,
        first_name: firstName,
        middle_name: middleName,
        phone,
        class_name: className,
        open_password: password
      });
      credentials.push({ login, password, name: `${lastName} ${firstName} ${middleName}`.trim() });
      created++;
    } catch {
      skipped++;
    }
  }

  return res.json({ created, skipped, credentials });
}