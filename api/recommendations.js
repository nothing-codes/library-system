import { getSession } from "../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const s = await getSession(request, env.JWT_SECRET);
  if (!s || s.role !== "reader" || !s.readerId) {
    return Response.json({ error: "Нет доступа" }, { status: 403 });
  }

  const readerId = s.readerId;

  const byAuthor = await env.DB.prepare(
    `SELECT Книги.Id, Книги.Название, Книги.Автор, Книги.Год
     FROM Книги
     WHERE Книги.Автор IN (
       SELECT DISTINCT Книги.Автор FROM Выдачи
       JOIN Книги ON Книги.Id = Выдачи.IdКниги
       WHERE Выдачи.IdЧитателя = ? AND Выдачи.IdСтатус IN (2, 3)
     )
     AND Книги.Id NOT IN (SELECT IdКниги FROM Выдачи WHERE IdЧитателя = ?)
     AND Книги.Количество > 0
     ORDER BY Книги.Год DESC
     LIMIT 5`
  ).bind(readerId, readerId).all();

  if (byAuthor.results.length > 0) {
    return Response.json({ type: "author", books: byAuthor.results });
  }

  const popular = await env.DB.prepare(
    `SELECT Книги.Id, Книги.Название, Книги.Автор, Книги.Год, COUNT(*) AS cnt
     FROM Книги
     JOIN Выдачи ON Книги.Id = Выдачи.IdКниги
     WHERE Выдачи.IdСтатус IN (2, 3)
     GROUP BY Книги.Id
     ORDER BY cnt DESC
     LIMIT 5`
  ).all();

  return Response.json({ type: "popular", books: popular.results });
}