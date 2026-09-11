export async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export async function requireAuth(role) {
  try {
    const me = await api("/api/me");
    if (role && me.role !== role) {
      window.location.href = me.role === "librarian" ? "/librarian" : "/reader";
      return null;
    }
    return me;
  } catch {
    window.location.href = "/";
    return null;
  }
}

export async function logout() {
  await api("/api/logout", { method: "POST" });
  window.location.href = "/";
}

export function showMessage(el, text, type = "info") {
  if (!el) return;
  el.className = `msg ${type}`;
  el.textContent = text;
  el.classList.remove("hidden");
}

export function hideMessage(el) {
  if (el) el.classList.add("hidden");
}