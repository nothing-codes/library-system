import { getSession, requireLibrarian } from "../../lib/auth.js";
import { supabase } from "../../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const s = await getSession(req, process.env.JWT_SECRET);
    if (!s) return res.status(401).json({ error: "Не авторизован" });

    const readerId = Number(req.query.readerId);
    if (!readerId) return res.status(400).json({ error: "readerId обязателен" });

    if (s.role === "reader" && s.readerId !== readerId) {
      return res.status(403).json({ error: "Нет доступа" });
    }

    const { data, error } = await supabase
      .from("issues")
      .select(`
        id, issue_date, due_date, return_date,
        books ( id, title, author ),
        statuses ( name )
      `)
      .eq("reader_id", readerId)
      .order("issue_date", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const mapped = data.map(i => {
      let status = "Выдана";
      if (i.statuses?.name === "returned") status = "Возвращена";
      if (i.statuses?.name === "overdue") status = "Просрочена";

      return {
        IdВыдачи: i.id,
        IdКниги: i.books?.id,
        Название: i.books?.title,
        Автор: i.books?.author,
        ДатаВыдачи: i.issue_date,
        ДатаОкончания: i.due_date,
        Статус: status
      };
    });
    return res.json(mapped);
  }

  if (req.method === "POST") {
    const session = await requireLibrarian(req, res);
    if (!session) return;

    const { readerId, bookId } = req.body;
    if (!readerId || !bookId) return res.status(400).json({ error: "readerId и bookId обязательны" });

    // Проверка активных выдач
    const { data: active } = await supabase.from("issues").select("id").eq("reader_id", readerId).in("status_id", [2, 3]).limit(1);
    if (active && active.length > 0) {
      return res.status(409).json({ error: "У читателя уже есть книга. Сначала верните её." });
    }

    // Проверка наличия книги
    const { data: book } = await supabase.from("books").select("quantity").eq("id", bookId).single();
    if (!book || book.quantity < 1) {
      return res.status(409).json({ error: "Книга недоступна" });
    }

    const today = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 14);

    const { error: issueError } = await supabase.from("issues").insert({
      book_id: bookId,
      reader_id: readerId,
      issue_date: today.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      status_id: 2 // 2 = issued
    });

    if (issueError) return res.status(500).json({ error: issueError.message });

    await supabase.from("books").update({ quantity: book.quantity - 1 }).eq("id", bookId);

    return res.json({ ok: true });
  }
  res.status(405).end();
}