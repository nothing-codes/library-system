import { supabase } from "../lib/supabase.js";
import { requireLibrarian } from "../lib/auth.js";
import { hashPassword } from "../lib/hash.js";

function generatePassword(len = 8) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default async function handler(req, res) {
  const session = await requireLibrarian(req, res);
  if (!session) return;

  if (req.method === "GET") {
    const { search = "", debtors } = req.query;
    let query = supabase.from("readers").select(`
      reader_id, last_name, first_name, middle_name, phone, class_name, open_password,
      users ( login )
    `);

    if (search) {
      query = query.or(`last_name.ilike.%${search}%,first_name.ilike.%${search}%`);
    }

    const { data, error } = await query.order("last_name", { ascending: true }).order("first_name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    let result = data.map(r => ({
      IdЧитателя: r.reader_id,
      ФИО: `${r.last_name} ${r.first_name} ${r.middle_name ?? ""}`.trim(),
      Телефон: r.phone,
      Класс: r.class_name,
      Логин: r.users?.login ?? null,
      ПарольОткрытый: r.open_password
    }));

    if (debtors === "1") {
      const { data: overdueIssues } = await supabase.from("issues").select("reader_id").eq("status_id", 3);
      const debtorIds = new Set(overdueIssues?.map(i => i.reader_id) || []);
      result = result.filter(r => debtorIds.has(r.IdЧитателя));
    }

    return res.json(result);
  }

  if (req.method === "POST") {
    const { lastName, firstName, middleName, phone, className } = req.body;
    if (!lastName || !firstName) return res.status(400).json({ error: "Фамилия и имя обязательны" });

    const login = `${lastName.toLowerCase()}.${firstName[0].toLowerCase()}`;
    const password = generatePassword(8);
    const hashed = hashPassword(password);

    try {
      // 1. Создаем пользователя
      const { data: user, error: userError } = await supabase.from("users").insert({
        login,
        password: hashed,
        role_id: 1 // 1 = reader
      }).select("id").single();

      if (userError) throw userError;

      // 2. Создаем профиль читателя
      const { error: readerError } = await supabase.from("readers").insert({
        user_id: user.id,
        last_name: lastName,
        first_name: firstName,
        middle_name: middleName ?? "",
        phone: phone ?? "",
        class_name: className ?? "",
        open_password: password
      });

      // 3. Если профиль не создался — откатываем создание пользователя
      if (readerError) {
        await supabase.from("users").delete().eq("id", user.id);
        throw new Error(`Ошибка сохранения читателя: ${readerError.message}`);
      }

      res.json({ login, password });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
}
