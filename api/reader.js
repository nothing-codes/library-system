import { requireLibrarian } from "../../lib/auth.js";
import { supabase } from "../../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).end();
  const session = await requireLibrarian(req, res);
  if (!session) return;

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "id обязателен" });

  const { data: issues } = await supabase.from("issues").select("id").eq("reader_id", id).limit(1);
  if (issues && issues.length > 0) {
    return res.status(409).json({ error: "Нельзя удалить: у читателя есть история выдач" });
  }

  const { data: reader } = await supabase.from("readers").select("user_id").eq("reader_id", id).single();
  if (!reader) return res.status(404).json({ error: "Читатель не найден" });

  await supabase.from("readers").delete().eq("reader_id", id);
  if (reader.user_id) {
    await supabase.from("users").delete().eq("id", reader.user_id);
  }

  return res.json({ ok: true });
}