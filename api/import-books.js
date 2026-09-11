import { requireLibrarian } from "../lib/auth.js"; // ИСПРАВЛЕНО
import { supabase } from "../lib/supabase.js"; // ИСПРАВЛЕНО

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await requireLibrarian(req, res);
  if (!session) return;

  const { books } = req.body;
  if (!Array.isArray(books) || books.length === 0) return res.status(400).json({ error: "Нет данных для импорта" });

  let inserted = 0, updated = 0, skipped = 0;

  for (const b of books) {
    const title = String(b.title ?? "").trim();
    const author = String(b.author ?? "").trim();
    const isbn = String(b.isbn ?? "").trim();
    const quantity = Number(b.quantity);

    if (!title || !author || !isbn || !quantity || quantity <= 0) { skipped++; continue; }

    const { data: existing } = await supabase.from("books").select("id, quantity").eq("isbn", isbn).maybeSingle();
    if (existing) {
      await supabase.from("books").update({ quantity: existing.quantity + quantity }).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("books").insert({
        title,
        author,
        year: b.year ? Number(b.year) : null,
        isbn,
        quantity
      });
      inserted++;
    }
  }

  return res.json({ inserted, updated, skipped });
}