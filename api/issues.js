import { getSession, requireLibrarian } from "../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const s = await getSession(request, env.JWT_SECRET);
  if (!s) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const readerId = Number(url.searchParams.get("readerId"));
  if (!readerId) return Response.json({ error: "readerId обязателен" }, { status: 400 });

  if (s.role === "reader" && s.readerId !== readerId) {
    return Response.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { results } = await env.DB.prepare(
    `SELECT Выдачи.Id AS IdВыдачи,
            Книги.Название, Книги.Автор, Книги.Id AS IdКниги,
            Выдачи.ДатаВыдачи, Выдачи.ДатаОкончания, Выдачи.ДатаВозврата,
            CASE Выдачи.IdСтатус
              WHEN 1 THEN 'Возвращена'
              WHEN 2 THEN 'Выдана'
              WHEN 3 THEN 'Просрочена'
            END AS Статус
     FROM Выдачи
     JOIN Книги ON Книги.Id = Выдачи.IdКниги
     WHERE Выдачи.IdЧитателя = ?
     ORDER BY Выдачи.ДатаВыдачи DESC`
  ).bind(readerId).all();

  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const session = await requireLibrarian(request, env);
  if (!session) return Response.json({ error: "Нет доступа" }, { status: 403 });

  const { readerId, bookId } = await request.json();
  if (!readerId || !bookId) {
    return Response.json({ error: "readerId и bookId обязательны" }, { status: 400 });
  }

  // Проверка: у читателя не должно быть активных выдач
  const active = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM Выдачи
     WHERE IdЧитателя = ? AND IdСтатус IN (2, 3)`
  ).bind(readerId).first();

  if (active.c > 0) {
    return Response.json(
      { error: "У читателя уже есть книга. Сначала верните её." },
      { status: 409 }
    );
  }

  // Проверка: книга в наличии
  const book = await env.DB.prepare(
    `SELECT Количество FROM Книги WHERE Id = ?`
  ).bind(bookId).first();

  if (!book || book.Количество < 1) {
    return Response.json({ error: "Книга недоступна" }, { status: 409 });
  }

  const today = new Date();
  const due = new Date();
  due.setDate(due.getDate() + 14);

  const todayStr = today.toISOString().slice(0, 10);
  const dueStr = due.toISOString().slice(0, 10);

  await env.DB.prepare(
    `INSERT INTO Выдачи (IdКниги, IdЧитателя, ДатаВыдачи, ДатаОкончания, СрокВыдачи, IdСтатус)
     VALUES (?, ?, ?, ?, 14, 2)`
  ).bind(bookId, readerId, todayStr, dueStr).run();

  await env.DB.prepare(
    `UPDATE Книги SET Количество = Количество - 1 WHERE Id = ?`
  ).bind(bookId).run();

  return Response.json({ ok: true });
}