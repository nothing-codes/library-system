import { requireLibrarian } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).end();
  
  const session = await requireLibrarian(req, res);
  if (!session) return;

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "id обязателен" });

  // 1. Находим читателя, чтобы получить его user_id
  const { data: reader, error: readerError } = await supabase
    .from("readers")
    .select("user_id")
    .eq("reader_id", id)
    .single();

  if (readerError || !reader) {
    return res.status(404).json({ error: "Читатель не найден" });
  }

  const userId = reader.user_id;

  // 2. Находим активные выдачи (статусы 2 - выдана, 3 - просрочена)
  const { data: activeIssues } = await supabase
    .from("issues")
    .select("id, book_id")
    .eq("reader_id", id)
    .in("status_id", [2, 3]);

  // 3. Возвращаем книги на склад
  if (activeIssues && activeIssues.length > 0) {
    for (const issue of activeIssues) {
      const { data: book } = await supabase
        .from("books")
        .select("quantity")
        .eq("id", issue.book_id)
        .single();
        
      if (book) {
        await supabase
          .from("books")
          .update({ quantity: book.quantity + 1 })
          .eq("id", issue.book_id);
      }
    }
  }

  // 4. Удаляем всю историю выдач (и активные, и возвращенные)
  await supabase.from("issues").delete().eq("reader_id", id);

  // 5. Удаляем самого читателя
  await supabase.from("readers").delete().eq("reader_id", id);

  // 6. Удаляем учетную запись пользователя
  if (userId) {
    await supabase.from("users").delete().eq("id", userId);
  }

  return res.json({ ok: true });
}
