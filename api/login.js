import { prisma } from "../lib/db.js";
import { verifyPassword } from "../lib/hash.js";
import { setSession } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: "Введите логин и пароль" });
  }

  const user = await prisma.Пользователи.findUnique({
    where: { Логин: login },
    include: { Роль: true },
  });

  if (!user || !(await verifyPassword(password, user.Пароль))) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }

  const role = user.Роль.Название;
  let readerId = null;
  let name = "";

  if (role === "Читатель") {
    const reader = await prisma.Читатели.findFirst({
      where: { IdПользователя: user.Id },
    });
    if (reader) {
      readerId = reader.ЧитательID;
      name = `${reader.Фамилия} ${reader.Имя} ${reader.Отчество ?? ""}`.trim();
    }
  }

  const cookie = await setSession(process.env.JWT_SECRET, {
    userId: user.Id,
    role: role === "Читатель" ? "reader" : "librarian",
    readerId,
    name,
  });

  res.setHeader("Set-Cookie", cookie);
  res.json({ role: role === "Читатель" ? "reader" : "librarian" });
}