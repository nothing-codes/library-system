import { prisma } from "../lib/db.js";
import { requireLibrarian } from "../lib/auth.js";
import { hashPassword } from "../lib/hash.js";

function generatePassword(len = 8) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default async function handler(req, res) {
  const session = await requireLibrarian(req, res);
  if (!session) return;

  if (req.method === "GET") {
    const { search = "", debtors } = req.query;

    const where = {};
    if (debtors === "1") {
      where.Выдачи = { some: { IdСтатус: 3 } };
    } else if (search) {
      where.OR = [
        { Фамилия: { contains: search, mode: "insensitive" } },
        { Имя: { contains: search, mode: "insensitive" } },
      ];
    }

    const readers = await prisma.Читатели.findMany({
      where,
      include: { Пользователь: true },
      orderBy: [{ Фамилия: "asc" }, { Имя: "asc" }],
    });

    const result = readers.map((r) => ({
      IdЧитателя: r.ЧитательID,
      Фамилия: r.Фамилия,
      Имя: r.Имя,
      Отчество: r.Отчество,
      ФИО: `${r.Фамилия} ${r.Имя} ${r.Отчество ?? ""}`.trim(),
      Телефон: r.Телефон,
      Класс: r.Класс,
      ПарольОткрытый: r.ПарольОткрытый,
      Логин: r.Пользователь?.Логин ?? null,
    }));

    return res.json(result);
  }

  if (req.method === "POST") {
    const { lastName, firstName, middleName, phone, className } = req.body;
    if (!lastName || !firstName) {
      return res.status(400).json({ error: "Фамилия и имя обязательны" });
    }

    const login = `${lastName.toLowerCase()}.${firstName[0].toLowerCase()}`;
    const password = generatePassword(8);
    const hashed = await hashPassword(password);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.Пользователи.create({
          data: { Логин: login, Пароль: hashed, IdРоли: 1 },
        });

        await tx.Читатели.create({
          data: {
            IdПользователя: user.Id,
            Фамилия: lastName,
            Имя: firstName,
            Отчество: middleName ?? "",
            Телефон: phone ?? "",
            Класс: className ?? "",
            ПарольОткрытый: password,
          },
        });

        return { login, password };
      });

      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
}