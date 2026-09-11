import { supabase } from "../lib/supabase.js";
import { verifyPassword } from "../lib/hash.js";
import { setSession } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: "Введите логин и пароль" });
  }

  // Ищем пользователя (логин в нижнем регистре для надежности)
  const { data: user, error } = await supabase
    .from("users")
    .select('id, password, role_id')
    .eq("login", login.toLowerCase())
    .maybeSingle();

  if (error || !user) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }

  // Проверяем пароль
  if (!verifyPassword(password, user.password)) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }

  // Определяем роль (1 = reader, 2 = librarian)
  const role = user.role_id === 1 ? "reader" : "librarian";
  let readerId = null;
  let name = "";

  // Если это читатель — ищем его профиль
  if (role === "reader") {
    const { data: reader, error: readerError } = await supabase
      .from("readers")
      .select('reader_id, last_name, first_name, middle_name')
      .eq("user_id", user.id)
      .maybeSingle();

    // Если профиль не найден — значит, при создании что-то пошло не так
    if (readerError || !reader) {
      return res.status(500).json({ error: "Профиль читателя не найден. Обратитесь к библиотекарю." });
    }

    readerId = reader.reader_id;
    name = `${reader.last_name} ${reader.first_name} ${reader.middle_name ?? ""}`.trim();
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
