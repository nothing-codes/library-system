import { requireLibrarian } from "../lib/auth.js"; // ИСПРАВЛЕНО
import { supabase } from "../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).end();
  const session = await requireLibrarian(req, res);
  if (!session) return;

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "id обязателен" });

  const { data: book, error } = await supabase.from("books").select("quantity").eq("id", id).single();
  if (error || !book) return res.status(404).json({ error: "Книга не найдена" });

  if (book.quantity <= 1) {
    await supabase.from("books").delete().eq("id", id);
  } else {
    await supabase.from("books").update({ quantity: book.quantity - 1 }).eq("id", id);
  }

  return res.json({ ok: true });
}