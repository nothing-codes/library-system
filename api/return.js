import { requireLibrarian } from "../lib/auth.js"; // ИСПРАВЛЕНО
import { supabase } from "../lib/supabase.js"; // ИСПРАВЛЕНО

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await requireLibrarian(req, res);
  if (!session) return;

  const { issueId } = req.body;
  if (!issueId) return res.status(400).json({ error: "issueId обязателен" });

  const { data: issue, error: fetchError } = await supabase.from("issues").select("id, book_id, status_id").eq("id", issueId).single();
  if (fetchError || !issue) return res.status(404).json({ error: "Выдача не найдена" });

  if (issue.status_id === 1) return res.status(409).json({ error: "Книга уже возвращена" });

  const { error: updateError } = await supabase.from("issues").update({
    status_id: 1,
    return_date: new Date().toISOString().slice(0, 10)
  }).eq("id", issueId);

  if (updateError) return res.status(500).json({ error: updateError.message });

  const { data: book } = await supabase.from("books").select("quantity").eq("id", issue.book_id).single();
  if (book) {
    await supabase.from("books").update({ quantity: book.quantity + 1 }).eq("id", issue.book_id);
  }

  return res.json({ ok: true });
}