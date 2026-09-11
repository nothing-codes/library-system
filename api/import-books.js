import { requireLibrarian } from "../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await requireLibrarian(request, env);
  if (!session) return Response.json({ error: "Нет доступа" }, { status: 403 });

  const { books } = await request.json();
  if (!Array.isArray(books) || books.length === 0) {
    return Response.json({ error: "Нет данных для импорта" }, { status: 400 });
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const b of books) {
    const title = String(b.title ?? "").trim();
    const author = String(b.author ?? "").trim();
    const isbn = String(b.isbn ?? "").trim();
    const quantity = Number(b.quantity);

    if (!title || !author || !isbn || !quantity || quantity <= 0) {
      skipped++;
      continue;
    }

    const existing = await env.DB.prepare(
      `SELECT Id FROM Книги WHERE ISBN = ?`
    ).bind(isbn).first();

    if (existing) {
      await env.DB.prepare(
        `UPDATE Книги SET Количество = Количество + ? WHERE ISBN = ?`
      ).bind(quantity, isbn).run();
      updated++;
    } else {
      const year = b.year ? Number(b.year) : null;
      await env.DB.prepare(
        `INSERT INTO Книги (Название, Автор, Год, ISBN, Количество) VALUES (?, ?, ?, ?, ?)`
      ).bind(title, author, year, isbn, quantity).run();
      inserted++;
    }
  }

  return Response.json({ inserted, updated, skipped });
}