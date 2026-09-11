import { supabase } from "../lib/supabase.js";
import { verifyPassword } from "../lib/hash.js";
import { setSession } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: "Введите логин и пароль" });
  }

  const { data: user, error } = await supabase
    .from("users")
    .select('id, password, role_id, roles(name)')
    .eq("login", login)
    .maybeSingle();

  if (error || !user) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }

  if (!verifyPassword(password, user.password)) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }

  const roleName = user.roles?.name ?? "";
  const role = roleName === "reader" ? "reader" : "librarian";
  let readerId = null;
  let name = "";

  if (role === "reader") {
    const { data: reader } = await supabase
      .from("readers")
      .select('reader_id, last_name, first_name, middle_name')
      .eq("user_id", user.id)
      .maybeSingle();

    if (reader) {
      readerId = reader.reader_id;
      name = `${reader.last_name} ${reader.first_name} ${reader.middle_name ?? ""}`.trim();
    }
  }

  const cookie = await setSession(process.env.JWT_SECRET, {
    userId: user.id,
    role,
    readerId,
    name,
  });

  res.setHeader("Set-Cookie", cookie);
  res.json({ role });
}