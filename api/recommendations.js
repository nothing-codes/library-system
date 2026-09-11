import { getSession } from "../lib/auth.js"; // ИСПРАВЛЕНО
import { supabase } from "../lib/supabase.js"; // ИСПРАВЛЕНО

export default async function handler(req, res) {
  const s = await getSession(req, process.env.JWT_SECRET);
  if (!s || s.role !== "reader" || !s.readerId) {
    return res.status(403).json({ error: "Нет доступа" });
  }

  const readerId = s.readerId;

  const { data: history } = await supabase.from("issues").select("books ( author )").eq("reader_id", readerId).in("status_id", [2, 3]);
  const authors = [...new Set(history?.map(h => h.books?.author).filter(Boolean))] || [];

  let result = [];
  let type = "author";

  if (authors.length > 0) {
    const { data: readBookIds } = await supabase.from("issues").select("book_id").eq("reader_id", readerId);
    const readIds = readBookIds?.map(r => r.book_id) || [];

    let q = supabase.from("books").select("id, title, author, year").in("author", authors).gt("quantity", 0).order("year", { ascending: false }).limit(5);
    if (readIds.length > 0) {
      q = q.not("id", "in", `(${readIds.join(",")})`);
    }
    const { data: byAuthor } = await q;
    if (byAuthor && byAuthor.length > 0) {
      result = byAuthor;
    } else {
      type = "popular";
    }
  } else {
    type = "popular";
  }

  if (type === "popular" || result.length === 0) {
    const { data: allBooks } = await supabase.from("books").select("id, title, author, year").gt("quantity", 0).limit(5);
    result = allBooks || [];
  }

  const mapped = result.map(b => ({
    Id: b.id,
    Название: b.title,
    Автор: b.author,
    Год: b.year
  }));

  return res.json({ type, books: mapped });
}