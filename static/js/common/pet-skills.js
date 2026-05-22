(() => {
  const LEVELS = ["一段階", "二段階", "三段階", "四段階"];
  const LABEL = {
    vit: "VIT",
    spd: "SPD",
    atk: "ATK",
    int: "INT",
    def: "DEF",
    mdef: "MDEF",
    luk: "LUK",
    mov: "MOV",
    exp: "経験値",
    capture: "基礎捕獲",
    drop: "基礎ドロップ",
    heal: "HP回復",
  };
  const fmtNumber = (v) => {
    if (typeof v !== "number") return String(v ?? "");
    return Number.isInteger(v) ? v.toLocaleString("ja-JP") : String(v);
  };
  const escapeHtml = (s) => {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };
  const entryToText = (entry) => {
    if (!entry || typeof entry !== "object") return "—";
    const keys = Object.keys(entry);
    if (keys.length === 0) return "—";
    const kind = keys[0];
    const payload = entry[kind];
    if (!payload || typeof payload !== "object") return "—";
    const stats = Object.keys(payload);
    if (stats.length === 0) return "—";
    const statKey = stats[0];
    const value = payload[statKey];
    const name = LABEL[statKey] ?? statKey;
    const num = fmtNumber(value);
    if (kind === "add") {
      return `${name} +${num}`;
    }
    if (kind === "mul") {
      return `${name} +${num}%`;
    }
    if (kind === "final_mul") {
      return `${name} 最終+${num}%`;
    }
    return `${name} ${num}`;
  };
  const buildRows = (skillsArr) => {
    const arr = Array.isArray(skillsArr) ? skillsArr : [];
    const rows = LEVELS.map((label, i) => {
      const text = entryToText(arr[i]);
      return `
        <div class="d-row">
          <dt>${label}</dt>
          <dd>${escapeHtml(text)}</dd>
        </div>
      `.trim();
    });
    return rows.join("");
  };
  const init = async () => {
    const section = document.getElementById("pet-skill-section");
    const list = document.getElementById("pet-skill-list");
    if (!section || !list) return;
    const monsterId = (section.dataset.monsterId || "").trim();
    const url = (section.dataset.jsonUrl || "").trim();
    if (!monsterId || !url) {
      list.innerHTML = `<div class="d-row"><dt>一段階</dt><dd>ペットスキルデータが見つかりません</dd></div>`;
      return;
    }
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const skillsArr = data[monsterId];
      if (!skillsArr) {
        list.innerHTML = buildRows([{}, {}, {}, {}]);
        return;
      }
      list.innerHTML = buildRows(skillsArr);
    } catch (e) {
      list.innerHTML = `<div class="d-row"><dt>一段階</dt><dd>読み込み失敗</dd></div>`;
    }
  };
  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
})();
