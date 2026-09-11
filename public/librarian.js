import { api, escapeHtml, fmtDate, requireAuth, logout, showMessage, hideMessage } from "/app.js";

let readers = [];
let readersAll = [];
let books = [];
let issues = [];
let selectedReader = null;
let selectedBook = null;

const readersBody = document.getElementById("readers-tbody");
const booksBody = document.getElementById("books-tbody");
const issuesBody = document.getElementById("issues-tbody");

document.getElementById("logout-btn").addEventListener("click", logout);

document.getElementById("burger-btn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("collapsed");
});

document.querySelectorAll(".sidebar-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-item").forEach((i) => i.classList.remove("active"));
    item.classList.add("active");

    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    document.getElementById(`panel-${item.dataset.panel}`).classList.add("active");

    if (item.dataset.panel === "readers") loadReaders();
    if (item.dataset.panel === "books") loadBooks();
  });
});

async function loadReaders() {
  const params = new URLSearchParams();
  const search = document.getElementById("reader-search").value.trim();
  const debtors = document.getElementById("only-debtors").checked;
  const klass = document.getElementById("reader-class-filter").value;

  if (debtors) params.set("debtors", "1");
  else if (search) params.set("search", search);

  readers = await api(`/api/readers?${params}`);

  if (!debtors && !search) {
    readersAll = readers;
    fillClassFilter();
  }

  if (klass) {
    readers = readers.filter((r) => r.Класс === klass);
  }

  renderReaders();
}

function fillClassFilter() {
  const select = document.getElementById("reader-class-filter");
  const current = select.value;
  const classes = [...new Set(readersAll.map((r) => r.Класс).filter(Boolean))].sort();
  select.innerHTML = `<option value="">Все классы</option>` +
    classes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  select.value = current;
}

async function loadBooks() {
  const params = new URLSearchParams();
  const search = document.getElementById("book-search").value.trim();
  const availability = document.getElementById("book-availability-filter").value;

  if (search) params.set("search", search);

  books = await api(`/api/books?${params}`);

  if (availability === "available") books = books.filter((b) => b.Количество > 0);
  if (availability === "empty") books = books.filter((b) => b.Количество === 0);

  renderBooks();
}

async function loadIssues() {
  if (!selectedReader) {
    issues = [];
    renderIssues();
    return;
  }
  issues = await api(`/api/issues?readerId=${selectedReader.IdЧитателя}`);
  renderIssues();
}

function renderReaders() {
  if (readers.length === 0) {
    readersBody.innerHTML = `<tr><td colspan="3" class="empty">Нет читателей</td></tr>`;
    return;
  }
  readersBody.innerHTML = readers.map((r) => `
    <tr data-id="${r.IdЧитателя}" class="${selectedReader?.IdЧитателя === r.IdЧитателя ? "selected" : ""}">
      <td>${escapeHtml(r.ФИО)}</td>
      <td>${escapeHtml(r.Телефон ?? "")}</td>
      <td>${escapeHtml(r.Класс ?? "")}</td>
    </tr>
  `).join("");

  readersBody.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => selectReader(Number(tr.dataset.id)));
  });
}

async function selectReader(id) {
  selectedReader = readers.find((r) => r.IdЧитателя === id) ?? null;
  renderReaders();
  renderProfile();
  await loadIssues();
}

function renderProfile() {
  const box = document.getElementById("reader-profile");
  const issueBtn = document.getElementById("issue-book-btn");
  const delBtn = document.getElementById("delete-reader-btn");

  if (!selectedReader) {
    box.className = "muted small";
    box.textContent = "Выберите читателя из списка";
    issueBtn.disabled = true;
    delBtn.disabled = true;
    return;
  }

  box.className = "profile";
  box.innerHTML = `
    <div class="label">ФИО</div><div class="value">${escapeHtml(selectedReader.ФИО)}</div>
    <div class="label">Логин</div><div class="value">${escapeHtml(selectedReader.Логин ?? "—")}</div>
    <div class="label">Пароль</div><div class="value">${escapeHtml(selectedReader.ПарольОткрытый ?? "—")}</div>
    <div class="label">Телефон</div><div class="value">${escapeHtml(selectedReader.Телефон ?? "—")}</div>
    <div class="label">Класс</div><div class="value">${escapeHtml(selectedReader.Класс ?? "—")}</div>
    <div class="label">ID</div><div class="value">${selectedReader.IdЧитателя}</div>
  `;

  const hasActive = issues.some((i) => i.Статус !== "Возвращена");
  issueBtn.disabled = hasActive;
  issueBtn.title = hasActive ? "У читателя уже есть книга" : "";
  delBtn.disabled = false;
}

function renderIssues() {
  if (!selectedReader) {
    issuesBody.innerHTML = `<tr><td colspan="6" class="empty">Выберите читателя</td></tr>`;
    return;
  }

  const statusFilter = document.getElementById("issue-status-filter").value;
  let list = issues;

  if (statusFilter === "active") list = issues.filter((i) => i.Статус !== "Возвращена");
  if (statusFilter === "returned") list = issues.filter((i) => i.Статус === "Возвращена");

  if (list.length === 0) {
    issuesBody.innerHTML = `<tr><td colspan="6" class="empty">Нет книг</td></tr>`;
    renderProfile();
    return;
  }

  issuesBody.innerHTML = list.map((i) => {
    const cls = i.Статус === "Просрочена" ? "status-overdue"
      : i.Статус === "Возвращена" ? "status-returned"
      : "status-issued";

    const returned = i.Статус === "Возвращена";
    const action = returned
      ? `<span class="muted small">Сдана</span>`
      : `<button class="primary" data-action="return" data-issue="${i.IdВыдачи}" style="padding:4px 10px;font-size:12px">Вернуть</button>`;

    return `
      <tr data-issue="${i.IdВыдачи}">
        <td>${escapeHtml(i.Название)}</td>
        <td>${escapeHtml(i.Автор ?? "")}</td>
        <td>${fmtDate(i.ДатаВыдачи)}</td>
        <td>${fmtDate(i.ДатаОкончания)}</td>
        <td class="${cls}">${escapeHtml(i.Статус)}</td>
        <td>${action}</td>
      </tr>
    `;
  }).join("");

  issuesBody.querySelectorAll("button[data-action='return']").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const issueId = Number(btn.dataset.issue);
      if (!confirm("Вернуть эту книгу?")) return;
      try {
        await api("/api/return", {
          method: "POST",
          body: JSON.stringify({ issueId }),
        });
        await loadIssues();
        await loadBooks();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  renderProfile();
}

function renderBooks() {
  if (books.length === 0) {
    booksBody.innerHTML = `<tr><td colspan="5" class="empty">Нет книг</td></tr>`;
    return;
  }
  booksBody.innerHTML = books.map((b) => `
    <tr data-id="${b.Id}" class="${selectedBook?.Id === b.Id ? "selected" : ""}">
      <td>${escapeHtml(b.Название)}</td>
      <td>${escapeHtml(b.Автор)}</td>
      <td>${escapeHtml(b.Год ?? "")}</td>
      <td>${escapeHtml(b.ISBN ?? "")}</td>
      <td>${b.Количество}</td>
    </tr>
  `).join("");

  booksBody.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = Number(tr.dataset.id);
      selectedBook = books.find((b) => b.Id === id) ?? null;
      renderBooks();
      document.getElementById("delete-book-btn").disabled = !selectedBook;
    });
  });
}

document.getElementById("reader-search").addEventListener("input", debounce(loadReaders, 250));
document.getElementById("reader-class-filter").addEventListener("change", loadReaders);
document.getElementById("only-debtors").addEventListener("change", loadReaders);

document.getElementById("book-search").addEventListener("input", debounce(loadBooks, 250));
document.getElementById("book-availability-filter").addEventListener("change", loadBooks);

document.getElementById("issue-status-filter").addEventListener("change", renderIssues);

document.getElementById("delete-reader-btn").addEventListener("click", async () => {
  if (!selectedReader) return;
  if (!confirm(`Удалить читателя ${selectedReader.ФИО}?`)) return;
  try {
    await api(`/api/reader?id=${selectedReader.IdЧитателя}`, { method: "DELETE" });
    selectedReader = null;
    renderProfile();
    renderIssues();
    await loadReaders();
  } catch (e) {
    alert(e.message);
  }
});

document.getElementById("delete-book-btn").addEventListener("click", async () => {
  if (!selectedBook) return;
  if (!confirm(`Удалить книгу "${selectedBook.Название}"?`)) return;
  try {
    await api(`/api/book?id=${selectedBook.Id}`, { method: "DELETE" });
    selectedBook = null;
    document.getElementById("delete-book-btn").disabled = true;
    await loadBooks();
  } catch (e) {
    alert(e.message);
  }
});

document.getElementById("ab-save").addEventListener("click", async () => {
  const msg = document.getElementById("ab-msg");
  hideMessage(msg);

  const payload = {
    title: document.getElementById("ab-title").value.trim(),
    author: document.getElementById("ab-author").value.trim(),
    year: document.getElementById("ab-year").value.trim(),
    isbn: document.getElementById("ab-isbn").value.trim(),
    quantity: Number(document.getElementById("ab-quantity").value),
  };

  try {
    await api("/api/books", { method: "POST", body: JSON.stringify(payload) });
    for (const id of ["ab-title", "ab-author", "ab-year", "ab-isbn"]) {
      document.getElementById(id).value = "";
    }
    document.getElementById("ab-quantity").value = "1";
    showMessage(msg, "Книга добавлена", "success");
  } catch (e) {
    showMessage(msg, e.message, "error");
  }
});

document.getElementById("ar-save").addEventListener("click", async () => {
  const msg = document.getElementById("ar-msg");
  hideMessage(msg);

  const payload = {
    lastName: document.getElementById("ar-last").value.trim(),
    firstName: document.getElementById("ar-first").value.trim(),
    middleName: document.getElementById("ar-middle").value.trim(),
    phone: document.getElementById("ar-phone").value.trim(),
    className: document.getElementById("ar-class").value.trim(),
  };

  try {
    const data = await api("/api/readers", { method: "POST", body: JSON.stringify(payload) });
    for (const id of ["ar-last", "ar-first", "ar-middle", "ar-phone", "ar-class"]) {
      document.getElementById(id).value = "";
    }
    showMessage(
      msg,
      `Читатель создан. Логин: ${data.login} / Пароль: ${data.password}`,
      "success"
    );
    await loadReaders();
  } catch (e) {
    showMessage(msg, e.message, "error");
  }
});

const issueModal = document.getElementById("issue-modal");
const issueBooksBody = document.getElementById("issue-books-tbody");
const issueMsg = document.getElementById("issue-msg");

document.getElementById("issue-book-btn").addEventListener("click", () => {
  if (!selectedReader) return;
  hideMessage(issueMsg);
  document.getElementById("issue-search").value = "";
  loadIssueBooks();
  issueModal.classList.remove("hidden");
});

document.getElementById("issue-cancel").addEventListener("click", () => {
  issueModal.classList.add("hidden");
});

async function loadIssueBooks() {
  const search = document.getElementById("issue-search").value.trim();
  const params = new URLSearchParams({ available: "1" });
  if (search) params.set("search", search);
  const list = await api(`/api/books?${params}`);

  if (list.length === 0) {
    issueBooksBody.innerHTML = `<tr><td colspan="5" class="empty">Нет доступных книг</td></tr>`;
    return;
  }

  issueBooksBody.innerHTML = list.map((b) => `
    <tr data-id="${b.Id}">
      <td>${escapeHtml(b.Название)}</td>
      <td>${escapeHtml(b.Автор)}</td>
      <td>${escapeHtml(b.Год ?? "")}</td>
      <td>${escapeHtml(b.ISBN ?? "")}</td>
      <td>${b.Количество}</td>
    </tr>
  `).join("");

  issueBooksBody.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", async () => {
      const bookId = Number(tr.dataset.id);
      try {
        await api("/api/issues", {
          method: "POST",
          body: JSON.stringify({ readerId: selectedReader.IdЧитателя, bookId }),
        });
        issueModal.classList.add("hidden");
        await loadIssues();
        await loadBooks();
      } catch (e) {
        showMessage(issueMsg, e.message, "error");
      }
    });
  });
}

document.getElementById("issue-search").addEventListener("input", debounce(loadIssueBooks, 250));

document.getElementById("export-readers-btn").addEventListener("click", async () => {
  const list = await api("/api/readers");
  const rows = list.map((r) => ({
    ФИО: r.ФИО,
    Логин: r.Логин ?? "",
    Пароль: r.ПарольОткрытый ?? "",
    Телефон: r.Телефон ?? "",
    Класс: r.Класс ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 31 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Читатели");
  XLSX.writeFile(wb, `Читатели_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

document.getElementById("export-books-btn").addEventListener("click", async () => {
  const list = await api("/api/books");
  const rows = list.map((b) => ({
    Название: b.Название,
    Автор: b.Автор,
    Год: b.Год ?? "",
    ISBN: b.ISBN ?? "",
    Количество: b.Количество,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 36 },
    { wch: 21 },
    { wch: 8 },
    { wch: 19 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Книги");
  XLSX.writeFile(wb, `Книги_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

document.getElementById("import-readers-input").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = "";

  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    const readers = rows.map((r) => {
      if (r["ФИО"]) {
        const parts = String(r["ФИО"]).trim().split(/\s+/);
        return {
          lastName: parts[0] ?? "",
          firstName: parts[1] ?? "",
          middleName: parts[2] ?? "",
          phone: String(r["Телефон"] ?? ""),
          className: r["Класс"] ?? "",
        };
      }
      return {
        lastName: r["Фамилия"] ?? "",
        firstName: r["Имя"] ?? "",
        middleName: r["Отчество"] ?? "",
        phone: String(r["Телефон"] ?? ""),
        className: r["Класс"] ?? "",
      };
    });

    if (readers.length === 0) {
      return alert("Файл пустой или неверный формат");
    }

    const res = await api("/api/import-readers", {
      method: "POST",
      body: JSON.stringify({ readers }),
    });

    let text = `Создано: ${res.created}, пропущено: ${res.skipped}`;
    if (res.credentials?.length) {
      text += `\n\nЛогины и пароли:\n` +
        res.credentials.map((c) => `${c.name} — ${c.login} / ${c.password}`).join("\n");
    }
    alert(text);

    await loadReaders();
  } catch (err) {
    alert("Ошибка импорта: " + err.message);
  }
});

document.getElementById("import-books-input").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = "";

  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    const books = rows.map((r) => ({
      title: r["Название"] ?? "",
      author: r["Автор"] ?? "",
      year: r["Год"] ?? "",
      isbn: String(r["ISBN"] ?? ""),
      quantity: r["Количество"] ?? "",
    }));

    if (books.length === 0) {
      return alert("Файл пустой или неверный формат");
    }

    const res = await api("/api/import-books", {
      method: "POST",
      body: JSON.stringify({ books }),
    });

    alert(`Добавлено: ${res.inserted}, обновлено: ${res.updated}, пропущено: ${res.skipped}`);
    await loadBooks();
  } catch (err) {
    alert("Ошибка импорта: " + err.message);
  }
});

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

(async () => {
  const me = await requireAuth("librarian");
  if (!me) return;
  await loadReaders();
  await loadBooks();
  renderProfile();
  renderIssues();
})();