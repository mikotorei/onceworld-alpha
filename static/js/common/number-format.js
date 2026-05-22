(() => {
  const isNumericText = (s) => /^-?\d+(\.\d+)?$/.test(String(s).trim());

  const formatValue = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value ?? "");

    if (Number.isInteger(num)) {
      return num.toLocaleString("ja-JP");
    }
    return String(num);
  };

  const formatNode = (el) => {
    const raw = (el.textContent || "").trim();
    if (!raw) return;
    if (!isNumericText(raw)) return;

    el.textContent = formatValue(raw);
  };

  const formatAll = (root) => {
    const r = root && root.querySelectorAll ? root : document;
    r.querySelectorAll(".n").forEach(formatNode);
  };

  window.formatNumbers = formatAll;
  window.fmt = formatValue;

  document.addEventListener("DOMContentLoaded", () => formatAll(document));
  window.addEventListener("load", () => formatAll(document));
})();
