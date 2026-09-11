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

    let q = supabase
      .from("readers")
      .select("reader_id, last_name, first_name, middle_name, phone, class_name, open_password, users(login)")
      .order("last_name");

    if (search) {
      q = q.or(`last_name.ilike.%${search}%,first_name.ilike.%${search}%`);
    }

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    let result = data.map((r) => ({
      readerId: r.reader_id,
      lastName: r.last_name,
      firstName: r.first_name,
      middleName: r.middle_name,
      fullName: `${r.last_name} ${r.first_name} ${r.middle_name ?? ""}`.trim(),
      phone: r.phone,
      className: r.class_name,
      openPassword: r.open_password,
      login: r.users?.login ?? null,
    }));

    if (debtors === "1") {
      const { data: debtorsData } = await supabase
        .from("issues")
        .select("reader_id")
        .eq("status_id", 3);
      const ids = new Set((debtorsData ?? []).map((x) => x.reader_id));
      result = result.filter((r) => ids.has(r.readerId));
    }

    return res.json(result);
  }

  if (req.method === "POST") {
    const { lastName, firstName, middleName, phone, className } = req.body ?? {};
    if (!lastName || !firstName) {
      return res.status(400).json({ error: "Фамилия и имя обязательны" });
    }

    const login = `${lastName.toLowerCase()}.${firstName[0].toLowerCase()}`;
    const password = generatePassword(8);
    const hashed = hashPassword(password);

    const { data: user, error: userErr } = await supabase
      .from("users")
      .insert({ login, password: hashed, role_id: 1 })
      .select("id")
      .single();

    if (userErr) return res.status(500).json({ error: userErr.message });

    const { error: readerErr } = await supabase.from("readers").insert({
      user_id: user.id,
      last_name: lastName,
      first_name: firstName,
      middle_name: middleName ?? "",
      phone: phone ?? "",
      class_name: className ?? "",
      open_password: password,
    });

    if (readerErr) return res.status(500).json({ error: readerErr.message });

    res.json({ login, password });
  }
}
