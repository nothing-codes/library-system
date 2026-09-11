import { requireLibrarian } from "../../lib/auth.js";

export async function onRequestDelete({ request, env }) {
  const session = await requireLibrarian(request, env);
  if (!session) return Response.json({ error: "Нет доступа" }, { status: 403 });

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return Response.json({ error: "id обязателен" }, { status: 400 });

  const row = await env.DB.prepare(
    `SELECT Количество FROM Книги WHERE Id = ?`
  ).bind(id).first();

  if (!row) return Response.json({ error: "Книга не найдена" }, { status: 404 });

  if (row.Количество <= 1) {
    await env.DB.prepare(`DELETE FROM Книги WHERE Id = ?`).bind(id).run();
  } else {
    await env.DB.prepare(
      `UPDATE Книги SET Количество = Количество - 1 WHERE Id = ?`
    ).bind(id).run();
  }

  return Response.json({ ok: true });
}