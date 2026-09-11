import { requireLibrarian } from "../../lib/auth.js";
import { hashPassword } from "../../lib/hash.js";

function generatePassword(len = 8) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function onRequestPost({ request, env }) {
  const session = await requireLibrarian(request, env);
  if (!session) return Response.json({ error: "Нет доступа" }, { status: 403 });

  const { readers } = await request.json();
  if (!Array.isArray(readers) || readers.length === 0) {
    return Response.json({ error: "Нет данных для импорта" }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;
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

    const login = `${lastName.toLowerCase()}.${firstName[0].toLowerCase()}`;

    const existing = await env.DB.prepare(
      `SELECT Id FROM Пользователи WHERE Логин = ?`
    ).bind(login).first();

    if (existing) {
      skipped++;
      continue;
    }

    const password = generatePassword(8);
    const hashed = await hashPassword(password);

    try {
      const userRes = await env.DB.prepare(
        `INSERT INTO Пользователи (Логин, Пароль, IdРоли) VALUES (?, ?, 1) RETURNING Id`
      ).bind(login, hashed).first();

      await env.DB.prepare(
        `INSERT INTO Читатели (IdПользователя, Фамилия, Имя, Отчество, Телефон, Класс, ПарольОткрытый)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(userRes.Id, lastName, firstName, middleName, phone, className, password).run();

      credentials.push({
        login,
        password,
        name: `${lastName} ${firstName} ${middleName}`.trim(),
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return Response.json({ created, skipped, credentials });
}