// ============================================================
// build-sim-ui.js  ビルドシミュレーター UI・状態管理
// status-sim.js / calc-logic.js / build-sim-logic.js を前提とする
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

const SIM_STATE_KEY = "build_sim_state_v1";
const EQUIP_URL = (() => {
  const p = window.location.pathname.split("/tools/")[0];
  return window.location.origin + p + "/db/equipment.json";
})();

function $(id) { return document.getElementById(id); }

const tabButtons = Array.from(document.querySelectorAll("[data-tab]"));
const tabPanels  = Array.from(document.querySelectorAll("[data-panel]"));

function switchTab(tabName) {
  tabButtons.forEach(btn => {
    btn.setAttribute("aria-pressed", btn.getAttribute("data-tab") === tabName ? "true" : "false");
  });
  tabPanels.forEach(panel => {
    const hidden = panel.getAttribute("data-panel") !== tabName;
    panel.hidden = hidden;
    panel.style.setProperty("display", hidden ? "none" : "", hidden ? "important" : "");
  });
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
});

const state = {
  attackType:  "physical",
  heroElement: "fire",
  spell:       "fire",
  debuffWood:  false,
  debuffDark:  false,
  npanLimit:   3
};

let lastReverseResult = null;
let equipItemsCache   = [];
let equipItemsMap     = new Map();

async function loadEquipItems() {
  if (equipItemsCache.length > 0) return;
  try {
    const res  = await fetch(EQUIP_URL, { cache: "no-store" });
    const data = await res.json();
    equipItemsCache = Array.isArray(data.items) ? data.items : [];
    equipItemsCache.forEach(item => equipItemsMap.set(String(item.id), item));
  } catch(e) { console.error("equipment.json 読み込み失敗", e); }
}

function getHeroStats() {
  const ft = window.lastFinalTotal || {};
  return {
    atk:                  Math.max(0, Math.round(ft.atk  || 0)),
    int:                  Math.max(0, Math.round(ft.int  || 0)),
    spd:                  Math.max(0, Math.round(ft.spd  || 0)),
    analysisBook:         Math.max(0, parseFormattedInt($("analysis-book"), 0)),
    analysisBookAdvanced: Math.max(0, parseFormattedInt($("analysis-book-advanced"), 0)),
    crystalCount:         Math.max(0, parseFormattedInt($("crystal-count"), 0))
  };
}

function saveSimState() {
  try {
    localStorage.setItem(SIM_STATE_KEY, JSON.stringify({ state }));
  } catch (e) {}
}

function loadSimState() {
  try {
    const raw = localStorage.getItem(SIM_STATE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.state) {
      if (["physical","magic"].includes(d.state.attackType)) state.attackType = d.state.attackType;
      if (["fire","water","wood","light","dark"].includes(d.state.heroElement)) state.heroElement = d.state.heroElement;
      if (["fire","water","wood","light","dark","shingan"].includes(d.state.spell)) state.spell = d.state.spell;
      state.debuffWood = !!d.state.debuffWood;
      state.debuffDark = !!d.state.debuffDark;
      if (Number.isFinite(Number(d.state.npanLimit))) state.npanLimit = Math.max(1, Number(d.state.npanLimit));
    }
  } catch (e) {}
}

function setPressed(buttons, selectedValue, attrName) {
  buttons.forEach(btn => {
    btn.setAttribute("aria-pressed", btn.getAttribute(attrName) === selectedValue ? "true" : "false");
  });
}

function applyModeUI() {
  const isMagic = state.attackType === "magic";
  document.querySelectorAll(".bs-magic-only").forEach(el => {
    el.hidden = !isMagic;
    el.style.setProperty("display", !isMagic ? "none" : "", !isMagic ? "important" : "");
  });
  document.querySelectorAll(".bs-phys-only").forEach(el => {
    el.hidden = isMagic;
    el.style.setProperty("display", isMagic ? "none" : "", isMagic ? "important" : "");
  });
  setPressed(document.querySelectorAll("[data-bs-attack-type]"),  state.attackType,  "data-bs-attack-type");
  setPressed(document.querySelectorAll("[data-bs-hero-element]"), state.heroElement, "data-bs-hero-element");
  setPressed(document.querySelectorAll("[data-bs-spell]"),        state.spell,       "data-bs-spell");
  $("bs-debuff-wood")?.setAttribute("aria-pressed", state.debuffWood ? "true" : "false");
  $("bs-debuff-dark")?.setAttribute("aria-pressed", state.debuffDark ? "true" : "false");
  $("bs-debuff-wood-magic")?.setAttribute("aria-pressed", state.debuffWood ? "true" : "false");
}

function renderScanResults(results) {
  const wrap = $("bs-scan-results");
  if (!wrap) return;
  wrap.innerHTML = "";
  const killable = results.filter(r => r.killable);
  if (killable.length === 0) {
    const p = document.createElement("p");
    p.textContent = "条件を満たすモンスターが見つかりませんでした。";
    wrap.appendChild(p);
    return;
  }
  const byArea = {};
  killable.forEach(r => {
    const areas = r.monster.locations && r.monster.locations.length > 0
      ? r.monster.locations : ["（出現エリア不明）"];
    areas.forEach(area => {
      if (!byArea[area]) byArea[area] = [];
      byArea[area].push(r);
    });
  });
  Object.keys(byArea).sort().forEach(area => {
    const section = document.createElement("div");
    section.className = "bs-area-section";
    const h3 = document.createElement("h3");
    h3.className = "bs-area-title";
    h3.textContent = area;
    section.appendChild(h3);
    const list = document.createElement("ul");
    list.className = "bs-monster-list";
    byArea[area].forEach(r => {
      const li = document.createElement("li");
      li.className = "bs-monster-item";
      li.textContent = `${r.monster.title}（${r.label}） — ${r.npan != null ? r.npan + "パン" : "計算不可"}`;
      list.appendChild(li);
    });
    section.appendChild(list);
    wrap.appendChild(section);
  });
}

function normalizeJP(s) {
  return (s ?? "").toString().trim().toLowerCase()
    .replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function setupMonsterSearch(searchId, suggestId, lvInputId, shortcutWrapId) {
  const search  = $(searchId);
  const suggest = $(suggestId);
  const lvInput = $(lvInputId);
  const scWrap  = $(shortcutWrapId);
  if (!search || !suggest) return { getPicked: () => null };
  let picked = null;

  function closeSuggest() { suggest.hidden = true; suggest.innerHTML = ""; }

  function renderShortcuts(m) {
    if (!scWrap) return;
    scWrap.innerHTML = "";
    const arr = Array.isArray(m.level_shortcuts) ? m.level_shortcuts : [];
    arr.forEach(sc => {
      const lv    = Math.floor(Number(sc?.lv ?? sc));
      const label = sc?.label ? String(sc.label) : String(lv);
      if (!Number.isFinite(lv) || lv < 0) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", () => { if (lvInput) lvInput.value = formatIntString(lv); });
      scWrap.appendChild(btn);
    });
  }

  function openSuggest(items) {
    suggest.hidden = false;
    suggest.innerHTML = "";
    items.forEach(m => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = m.title;
      btn.addEventListener("click", () => {
        picked = m;
        search.value = m.title;
        closeSuggest();
        renderShortcuts(m);
      });
      suggest.appendChild(btn);
    });
  }

  search.addEventListener("input", () => {
    const q = search.value;
    if (q.trim() === "") { picked = null; closeSuggest(); return; }
    if (picked && q !== picked.title) picked = null;
    const items = Array.isArray(window.MONSTERS)
      ? window.MONSTERS.filter(m => normalizeJP(m.title).includes(normalizeJP(q))).slice(0, 50) : [];
    if (items.length === 0) closeSuggest();
    else openSuggest(items);
  });

  search.addEventListener("focus", () => {
    const items = Array.isArray(window.MONSTERS)
      ? window.MONSTERS.filter(m => normalizeJP(m.title).includes(normalizeJP(search.value))).slice(0, 50) : [];
    if (items.length > 0) openSuggest(items);
  });

  document.addEventListener("click", e => {
    if (e.target === search || suggest.contains(e.target)) return;
    closeSuggest();
  });

  return { getPicked: () => picked };
}

let reverseSearchHandle = null;

function renderReverseResult() {
  const wrap   = $("bs-reverse-result");
  if (!wrap) return;
  wrap.innerHTML = "";
  const lvEl   = $("bs-reverse-lv");
  const npanEl = $("bs-reverse-npan");
  if (!lvEl || !npanEl) return;
  const picked = reverseSearchHandle?.getPicked();
  if (!picked) { wrap.textContent = "モンスターを選択してください。"; return; }
  const lv         = Math.max(0, parseFormattedInt(lvEl, 0));
  const targetNpan = Math.max(1, parseFormattedInt(npanEl, 1));
  const hero       = getHeroStats();
  const lvLabel    = lv > 0 ? `Lv${fmt(lv)}` : "基本";

  let neededVal = 0, statKey = "";

  if (state.attackType === "physical") {
    neededVal = reversePhysicalAtk(picked, lv, hero.spd, state.heroElement, state.debuffWood, state.debuffDark, targetNpan);
    const current = calcPhysicalKillInfo(hero.atk, hero.spd, picked, lv, state.heroElement, state.debuffWood, state.debuffDark);
    statKey = "atk";
    appendResult(wrap, `目標: ${picked.title}（${lvLabel}）を${targetNpan}パン以内`);
    appendResult(wrap, `必要atk: ${fmt(neededVal)} 以上`);
    appendResult(wrap, `現在のatk(${fmt(hero.atk)})での討伐: ${current.npan != null ? current.npan + "パン" : "計算不可"}`);
    appendJudge(wrap, hero.atk >= neededVal, `あと atk ${fmt(neededVal - hero.atk)} 不足`);
  } else {
    neededVal = reverseMagicInt(picked, lv, hero.analysisBook, hero.analysisBookAdvanced, hero.crystalCount, state.spell, state.heroElement, state.debuffWood, targetNpan);
    const current = calcMagicKillInfo(hero.int, hero.analysisBook, hero.analysisBookAdvanced, hero.crystalCount, state.spell, picked, lv, state.heroElement, state.debuffWood);
    statKey = "int";
    appendResult(wrap, `目標: ${picked.title}（${lvLabel}）を${targetNpan}パン以内`);
    appendResult(wrap, `必要int: ${fmt(neededVal)} 以上`);
    appendResult(wrap, `現在のint(${fmt(hero.int)})での討伐: ${current.npan != null ? current.npan + "パン" : "計算不可"}`);
    appendJudge(wrap, hero.int >= neededVal, `あと int ${fmt(neededVal - hero.int)} 不足`);
  }

  lastReverseResult = { stat: statKey, needed: neededVal };
  const searchWrap = $("bs-search-equip-wrap");
  if (searchWrap) searchWrap.hidden = false;
  const equipResult = $("bs-equip-result");
  if (equipResult) equipResult.innerHTML = "";
}

function appendResult(wrap, text) {
  const p = document.createElement("p");
  p.textContent = text;
  wrap.appendChild(p);
}

function appendJudge(wrap, ok, ngText) {
  const p = document.createElement("p");
  if (ok) { p.className = "bs-ok"; p.textContent = "✅ 現在のビルドで達成可能です"; }
  else    { p.className = "bs-ng"; p.textContent = `⚠️ ${ngText}`; }
  wrap.appendChild(p);
}

function renderGlvAnalysis(analysis, stat, needed) {
  const wrap = $("bs-equip-result");
  if (!wrap) return;
  wrap.innerHTML = "";

  const STAT_LABEL = { atk:"ATK", int:"INT", spd:"SPD", def:"DEF", mdef:"MDEF", vit:"VIT", luk:"LUK" };

  const header = document.createElement("div");
  header.className = "bs-area-title";
  header.textContent = `現在の装備で ${STAT_LABEL[stat]||stat} ${fmt(needed)} 達成するためのG強化分析`;
  wrap.appendChild(header);

  if (analysis.achieved) {
    const p = document.createElement("p");
    p.className = "bs-ok";
    p.textContent = "✅ 現在の装備・強化レベルで既に達成しています";
    wrap.appendChild(p);
    renderAccTable(wrap, analysis.accSlots, stat);
    return;
  }

  if (analysis.stillShort) {
    const p = document.createElement("p");
    p.className = "bs-ng";
    p.textContent = `⚠️ 全スロットをG100にしても不足します。装備の見直しが必要です。`;
    wrap.appendChild(p);
  }

  const armorTitle = document.createElement("div");
  armorTitle.className = "bs-equip-subtitle";
  armorTitle.textContent = "武器・防具 G強化配分（perG効率順に割り振り）";
  wrap.appendChild(armorTitle);

  const table = document.createElement("table");
  table.className = "bs-equip-table";

  const thead = document.createElement("tr");
  ["スロット", "装備名", "現在G", "推奨G", "追加G数", "現在値", "強化後"].forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    th.style.cssText = "padding:6px 8px;font-size:12px;color:#666;border-bottom:1px solid #ddd;white-space:nowrap;text-align:left;";
    thead.appendChild(th);
  });
  table.appendChild(thead);

  analysis.slots.forEach(s => {
    if (!s.item) return;
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";

    const isChanged = s.addedGlv > 0;
    const isMax     = s.neededGlv >= 100 && s.addedGlv > 0;

    const addedText = isChanged
      ? `+${s.addedGlv}個${isMax ? "（G100）" : ""}`
      : (s.canEnhance ? "変更不要" : "-");

    [
      { text: s.label,              cls: "bs-equip-slot" },
      { text: s.item.name,          cls: "" },
      { text: `G${s.currentGlv}`,   cls: "" },
      { text: s.canEnhance ? `G${s.neededGlv}` : "-", cls: "" },
      { text: addedText,            cls: isChanged ? "bs-glv-needed" : "bs-glv-ok" },
      { text: fmt(s.currentStatVal),cls: "" },
      { text: s.canEnhance ? fmt(calcWeaponArmorStatG(s.item, stat, s.neededGlv)) : fmt(s.currentStatVal), cls: isChanged ? "bs-glv-needed" : "" },
    ].forEach(c => {
      const td = document.createElement("td");
      td.textContent = c.text;
      td.style.cssText = "padding:6px 8px;font-size:14px;";
      if (c.cls) td.className = c.cls;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  wrap.appendChild(table);

  renderAccTable(wrap, analysis.accSlots, stat);
}

function renderAccTable(wrap, accSlots, stat) {
  const hasAccData = accSlots.some(s => s.item && (s.currentAdd > 0 || s.currentRate > 0));
  if (!hasAccData) return;

  const accTitle = document.createElement("div");
  accTitle.className = "bs-equip-subtitle";
  accTitle.textContent = "アクセサリの現状";
  wrap.appendChild(accTitle);

  const accTable = document.createElement("table");
  accTable.className = "bs-equip-table";
  accSlots.forEach(s => {
    if (!s.item) return;
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";
    const fmtAcc = (add, rate) => {
      const parts = [];
      if (add  > 0) parts.push(`+${fmt(Math.floor(add))}`);
      if (rate > 0) parts.push(`+${rate.toFixed(1)}%`);
      return parts.join(" / ") || "-";
    };
    [
      { text: s.label,  cls: "bs-equip-slot" },
      { text: s.item.name },
      { text: `Lv${s.currentLv}` },
      { text: fmtAcc(s.currentAdd, s.currentRate) },
      { text: s.canLevelUp ? `最大Lv${s.maxLv}: ${fmtAcc(s.maxAdd, s.maxRate)}` : "（maxLv）" },
    ].forEach(c => {
      const td = document.createElement("td");
      td.textContent = c.text;
      td.style.cssText = "padding:6px 8px;font-size:13px;";
      if (c.cls) td.className = c.cls;
      tr.appendChild(td);
    });
    accTable.appendChild(tr);
  });
  wrap.appendChild(accTable);
}

function tenkuFloorToLv(floor) {
  const n = Math.floor(Number(floor));
  if (!Number.isFinite(n) || n < 1) return null;
  if (n % 100 === 0) return 100 * n + 9900;
  if (n >= 10000)    return 100 * n;
  return 100 * n + 10000;
}

// --- 初期化 ---
loadSimState();
applyModeUI();
switchTab("scan");
loadEquipItems();

["bs-reverse-lv", "bs-reverse-npan"].forEach(id => attachCommaInputBehavior(id, 0));

document.querySelectorAll("[data-bs-attack-type]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.attackType = btn.getAttribute("data-bs-attack-type");
    if (state.attackType !== "physical") state.debuffDark = false;
    applyModeUI(); saveSimState();
  });
});

document.querySelectorAll("[data-bs-hero-element]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.heroElement = btn.getAttribute("data-bs-hero-element");
    applyModeUI(); saveSimState();
  });
});

document.querySelectorAll("[data-bs-spell]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.spell = btn.getAttribute("data-bs-spell");
    applyModeUI(); saveSimState();
  });
});

$("bs-debuff-wood")?.addEventListener("click", () => {
  state.debuffWood = !state.debuffWood; applyModeUI(); saveSimState();
});
$("bs-debuff-dark")?.addEventListener("click", () => {
  if (state.attackType !== "physical") return;
  state.debuffDark = !state.debuffDark; applyModeUI(); saveSimState();
});
$("bs-debuff-wood-magic")?.addEventListener("click", () => {
  if (state.attackType !== "magic") return;
  state.debuffWood = !state.debuffWood; applyModeUI(); saveSimState();
});

$("bs-tenku-apply")?.addEventListener("click", () => {
  const floorEl = $("bs-tenku-floor");
  const lvEl    = $("bs-reverse-lv");
  if (!floorEl || !lvEl) return;
  const lv = tenkuFloorToLv(floorEl.value.replace(/,/g, ""));
  if (lv === null) { alert("有効なフロア数を入力してください（1以上の整数）"); return; }
  lvEl.value = formatIntString(lv);
});

$("bs-scan-btn")?.addEventListener("click", () => {
  if (!Array.isArray(window.MONSTERS)) { alert("モンスターデータが読み込まれていません"); return; }
  const hero      = getHeroStats();
  const npanLimit = Math.max(1, parseInt($("bs-npan-limit")?.value || "3", 10));
  state.npanLimit = npanLimit;
  const results   = scanAllMonsters(window.MONSTERS, hero, {
    attackType: state.attackType, heroElement: state.heroElement,
    spell: state.spell, debuffWood: state.debuffWood, debuffDark: state.debuffDark, npanLimit
  });
  renderScanResults(results);
  saveSimState();
});

reverseSearchHandle = setupMonsterSearch(
  "bs-reverse-monster-search",
  "bs-reverse-monster-suggest",
  "bs-reverse-lv",
  "bs-reverse-lv-shortcuts"
);

$("bs-reverse-btn")?.addEventListener("click", () => {
  renderReverseResult();
  saveSimState();
});

$("bs-search-equip-btn")?.addEventListener("click", async () => {
  if (!lastReverseResult) return;
  const btn = $("bs-search-equip-btn");
  if (btn) btn.textContent = "分析中...";
  await loadEquipItems();
  const equipState = window.statusSimCollectState?.()?.equip || {};
  const currentFinalTotal = window.lastFinalTotal || {};
  const analysis = analyzeGlvNeeded(
    equipState, equipItemsMap,
    lastReverseResult.stat, lastReverseResult.needed, currentFinalTotal
  );
  renderGlvAnalysis(analysis, lastReverseResult.stat, lastReverseResult.needed);
  if (btn) btn.textContent = "この条件で装備を探索";
});

window.addEventListener("buildLoaded", () => {
  const scanResults = $("bs-scan-results");
  if (scanResults) scanResults.innerHTML = "";
  const reverseResult = $("bs-reverse-result");
  if (reverseResult) reverseResult.innerHTML = "";
  const equipResult = $("bs-equip-result");
  if (equipResult) equipResult.innerHTML = "";
  const searchWrap = $("bs-search-equip-wrap");
  if (searchWrap) searchWrap.hidden = true;
  lastReverseResult = null;
});

}); // DOMContentLoaded
