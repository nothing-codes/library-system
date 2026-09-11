import { prisma } from "../lib/db.js";
import { requireLibrarian } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { search = "", available } = req.query;

    const where = {};
    if (available === "1") where.Количество = { gt: 0 };
    if (search) {
      where.OR = [
        { Название: { contains: search, mode: "insensitive" } },
        { Автор: { contains: search, mode: "insensitive" } },
        { ISBN: { contains: search, mode: "insensitive" } },
      ];
    }

    const books = await prisma.Книги.findMany({
      where,
      orderBy: { Название: "asc" },
    });
    return res.json(books);
  }

  if (req.method === "POST") {
    const session = await requireLibrarian(req, res);
    if (!session) return;

    const { title, author, year, isbn, quantity } = req.body;
    if (!title || !author || !isbn || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: "Заполните все поля" });
    }

    const existing = await prisma.Книги.findUnique({ where: { ISBN: isbn } });

    if (existing) {
      await prisma.Книги.update({
        where: { ISBN: isbn },
        data: { Количество: { increment: Number(quantity) } },
      });
    } else {
      await prisma.Книги.create({
        data: {
          Название: title,
          Автор: author,
          Год: year ? Number(year) : null,
          ISBN: isbn,
          Количество: Number(quantity),
        },
      });
    }

    res.json({ ok: true });
  }
}