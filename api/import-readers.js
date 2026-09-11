import { requireLibrarian } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { hashPassword } from "../lib/hash.js";

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
  if (!Array.isArray(readers) || readers.length === 0) {
    return res.status(400).json({ error: "Нет данных для импорта" });
  }

  let created = 0, skipped = 0;
  const credentials = [];

  for (const r of readers) {
    const lastName = String(r.lastName ?? "").trim();
    const firstName = String(r.firstName ?? "").trim();
    const middleName = String(r.middleName ?? "").trim();
    const phone = String(r.phone ?? "").trim();
    const className = String(r.className ?? "").trim();

    if (!lastName || !firstName) {
      skipped++;
      continue;
    }

    // Генерируем логин (как и раньше)
    const login = `${lastName.toLowerCase()}.${firstName[0].toLowerCase()}`;

    // Проверяем, есть ли уже такой пользователь
    const { data: existing } = await supabase.from("users").select("id").eq("login", login).maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    // БЕРЕМ ПАРОЛЬ ИЗ EXCEL ИЛИ ГЕНЕРИРУЕМ СЛУЧАЙНЫЙ
    let password = String(r.password ?? "").trim();
    if (!password) {
      password = generatePassword(8);
    }

    const hashed = hashPassword(password);

    try {
      // 1. Создаем пользователя
      const { data: user, error: userError } = await supabase.from("users").insert({
        login,
        password: hashed,
        role_id: 1 // 1 = reader
      }).select("id").single();

      if (userError) throw userError;

      // 2. Создаем профиль читателя
      const { error: readerError } = await supabase.from("readers").insert({
        user_id: user.id,
        last_name: lastName,
        first_name: firstName,
        middle_name: middleName,
        phone: phone,
        class_name: className,
        open_password: password // Сохраняем пароль в открытом виде для библиотекаря
      });

      // 3. Если профиль не создался — откатываем создание пользователя
      if (readerError) {
        await supabase.from("users").delete().eq("id", user.id);
        throw new Error(`Ошибка сохранения читателя: ${readerError.message}`);
      }

      credentials.push({
        login,
        password,
        name: `${lastName} ${firstName} ${middleName}`.trim()
      });
      created++;

    } catch (e) {
      console.error(`Ошибка при импорте ${login}:`, e.message);
      skipped++;
    }
  }

  return res.json({ created, skipped, credentials });
}
