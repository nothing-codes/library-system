import { api, escapeHtml, fmtDate, requireAuth, logout } from "/app.js";

let me = null;

document.getElementById("logout-btn").addEventListener("click", logout);

async function loadMyBooks() {
  const issues = await api(`/api/issues?readerId=${me.readerId}`);
  const tbody = document.getElementById("my-books-tbody");

  if (issues.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Пока нет книг</td></tr>`;
    return;
  }

  tbody.innerHTML = issues.map((i) => {
    const cls = i.Статус === "Просрочена" ? "status-overdue"
      : i.Статус === "Возвращена" ? "status-returned"
      : "status-issued";
    return `
      <tr>
        <td>${escapeHtml(i.Название)}</td>
        <td>${escapeHtml(i.Автор ?? "")}</td>
        <td>${fmtDate(i.ДатаВыдачи)}</td>
        <td>${fmtDate(i.ДатаОкончания)}</td>
        <td class="${cls}">${escapeHtml(i.Статус)}</td>
      </tr>
    `;
  }).join("");
}

async function loadCatalog() {
  const search = document.getElementById("catalog-search").value.trim();
  const params = new URLSearchParams({ available: "1" });
  if (search) params.set("search", search);
  const books = await api(`/api/books?${params}`);

  const tbody = document.getElementById("catalog-tbody");
  if (books.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Ничего не найдено</td></tr>`;
    return;
  }
  tbody.innerHTML = books.map((b) => `
    <tr>
      <td>${escapeHtml(b.Название)}</td>
      <td>${escapeHtml(b.Автор)}</td>
      <td>${escapeHtml(b.Год ?? "")}</td>
      <td>${escapeHtml(b.ISBN ?? "")}</td>
      <td>${b.Количество}</td>
    </tr>
  `).join("");
}

async function loadRecommendations() {
  const data = await api("/api/recommendations");
  const tbody = document.getElementById("recs-tbody");

  if (data.books.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">Пока нет рекомендаций</td></tr>`;
    return;
  }

  tbody.innerHTML = data.books.map((b) => `
    <tr>
      <td>${escapeHtml(b.Название)}</td>
      <td>${escapeHtml(b.Автор)}</td>
      <td>${escapeHtml(b.Год ?? "")}</td>
    </tr>
  `).join("");
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const name = tab.dataset.tab;
    document.getElementById("tab-my").classList.toggle("hidden", name !== "my");
    document.getElementById("tab-recs").classList.toggle("hidden", name !== "recs");

    if (name === "recs") loadRecommendations();
  });
});

document.getElementById("catalog-search").addEventListener("input", debounce(loadCatalog, 250));

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

(async () => {
  me = await requireAuth("reader");
  if (!me) return;
  document.getElementById("brand").textContent = me.name
    ? `Библиотека — ${me.name}`
    : "Библиотека";
  await loadMyBooks();
  await loadCatalog();
})();