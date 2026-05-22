// ============================================================
// calc-utils.js  数値・フォーマット系ユーティリティ
// ============================================================

function normalizeDigitsOnly(raw) {
  return (raw ?? "").toString().replace(/[^\d]/g, "");
}

function normalizeFormattedNonNegIntValue(raw, fallback = 0) {
  const digits = normalizeDigitsOnly(raw);
  if (digits === "") return String(fallback);
  const n = Math.floor(Number(digits));
  if (!Number.isFinite(n) || n < 0) return String(fallback);
  return String(n);
}

function parseFormattedInt(el, fallback = 0) {
  if (!el) return fallback;
  const s = normalizeFormattedNonNegIntValue(el.value, fallback);
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function formatIntString(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ja-JP");
}

function applyCommaFormatting(el, fallback = 0) {
  if (!el) return;
  const normalized = normalizeFormattedNonNegIntValue(el.value, fallback);
  el.value = formatIntString(normalized);
}

function removeCommaFormatting(el, fallback = 0) {
  if (!el) return;
  el.value = normalizeFormattedNonNegIntValue(el.value, fallback);
}

function attachCommaInputBehavior(id, fallback = 0) {
  const el = document.getElementById(id);
  if (!el) return;

  applyCommaFormatting(el, fallback);

  el.addEventListener("focus", () => {
    removeCommaFormatting(el, fallback);
  });

  el.addEventListener("input", () => {
    const normalized = normalizeDigitsOnly(el.value);
    el.value = normalized;
  });

  el.addEventListener("blur", () => {
    applyCommaFormatting(el, fallback);
  });
}

function normalizeLv(el) {
  const n = Math.max(1, parseFormattedInt(el, 1));
  el.value = formatIntString(n);
  return n;
}

function fmt(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("ja-JP");
}
