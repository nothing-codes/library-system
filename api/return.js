import { requireLibrarian } from "../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await requireLibrarian(request, env);
  if (!session) return Response.json({ error: "Нет доступа" }, { status: 403 });

  const { issueId } = await request.json();
  if (!issueId) {
    return Response.json({ error: "issueId обязателен" }, { status: 400 });
  }

  const issue = await env.DB.prepare(
    `SELECT Id, IdКниги, IdСтатус FROM Выдачи WHERE Id = ?`
  ).bind(issueId).first();

  if (!issue) {
    return Response.json({ error: "Выдача не найдена" }, { status: 404 });
  }

  if (issue.IdСтатус === 1) {
    return Response.json({ error: "Книга уже возвращена" }, { status: 409 });
  }

  await env.DB.prepare(
    `UPDATE Выдачи SET IdСтатус = 1, ДатаВозврата = ? WHERE Id = ?`
  ).bind(new Date().toISOString().slice(0, 10), issueId).run();

  await env.DB.prepare(
    `UPDATE Книги SET Количество = Количество + 1 WHERE Id = ?`
  ).bind(issue.IdКниги).run();

  return Response.json({ ok: true });
}