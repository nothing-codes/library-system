import { supabase } from "../lib/supabase.js";
import { requireLibrarian } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { search = "", available } = req.query;
    let query = supabase.from("books").select("*");

    if (available === "1") query = query.gt("quantity", 0);
    if (search) {
      query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%`);
    }

    const { data, error } = await query.order("title", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    // Маппинг английских полей БД в русские ключи, ожидаемые фронтендом
    const mapped = data.map(b => ({
      Id: b.id,
      Название: b.title,
      Автор: b.author,
      Год: b.year,
      ISBN: b.isbn,
      Количество: b.quantity
    }));
    return res.json(mapped);
  }

  if (req.method === "POST") {
    const session = await requireLibrarian(req, res);
    if (!session) return;

    const { title, author, year, isbn, quantity } = req.body;
    if (!title || !author || !isbn || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: "Заполните все поля" });
    }

    const { data: existing } = await supabase.from("books").select("id, quantity").eq("isbn", isbn).maybeSingle();

    if (existing) {
      await supabase.from("books").update({ quantity: existing.quantity + Number(quantity) }).eq("id", existing.id);
    } else {
      await supabase.from("books").insert({
        title,
        author,
        year: year ? Number(year) : null,
        isbn,
        quantity: Number(quantity)
      });
    }
    return res.json({ ok: true });
  }
  res.status(405).end();
}