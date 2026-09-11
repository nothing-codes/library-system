import { requireLibrarian } from "../../lib/auth.js";

export async function onRequestDelete({ request, env }) {
  const session = await requireLibrarian(request, env);
  if (!session) return Response.json({ error: "Нет доступа" }, { status: 403 });

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return Response.json({ error: "id обязателен" }, { status: 400 });

  const issues = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM Выдачи WHERE IdЧитателя = ?`
  ).bind(id).first();

  if (issues.c > 0) {
    return Response.json(
      { error: "Нельзя удалить: у читателя есть история выдач" },
      { status: 409 }
    );
  }

  const reader = await env.DB.prepare(
    `SELECT IdПользователя FROM Читатели WHERE ЧитательID = ?`
  ).bind(id).first();

  if (!reader) {
    return Response.json({ error: "Читатель не найден" }, { status: 404 });
  }

  const userId = reader.IdПользователя;

  await env.DB.prepare(`DELETE FROM Читатели WHERE ЧитательID = ?`).bind(id).run();
  if (userId) {
    await env.DB.prepare(`DELETE FROM Пользователи WHERE Id = ?`).bind(userId).run();
  }

  return Response.json({ ok: true });
}