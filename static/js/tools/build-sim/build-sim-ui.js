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

// 逆算結果を保持（装備探索に渡す）
let lastReverseResult = null;
let equipItemsCache   = [];

// equipment.jsonをfetch
async function loadEquipItems() {
  if (equipItemsCache.length > 0) return equipItemsCache;
  try {
    const res  = await fetch(EQUIP_URL, { cache: "no-store" });
    const data = await res.json();
    equipItemsCache = Array.isArray(data.items) ? data.items : [];
  } catch(e) { console.error("equipment.json 読み込み失敗", e); }
  return equipItemsCache;
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

  let neededStat = null, neededVal = 0, statKey = "";

  if (state.attackType === "physical") {
    neededVal  = reversePhysicalAtk(picked, lv, hero.spd, state.heroElement, state.debuffWood, state.debuffDark, targetNpan);
    const current = calcPhysicalKillInfo(hero.atk, hero.spd, picked, lv, state.heroElement, state.debuffWood, state.debuffDark);
    statKey = "atk";
    appendResult(wrap, `目標: ${picked.title}（${lvLabel}）を${targetNpan}パン以内`);
    appendResult(wrap, `必要atk: ${fmt(neededVal)} 以上`);
    appendResult(wrap, `現在のatk(${fmt(hero.atk)})での討伐: ${current.npan != null ? current.npan + "パン" : "計算不可"}`);
    appendJudge(wrap, hero.atk >= neededVal, `あと atk ${fmt(neededVal - hero.atk)} 不足`);
  } else {
    neededVal  = reverseMagicInt(picked, lv, hero.analysisBook, hero.analysisBookAdvanced, hero.crystalCount, state.spell, state.heroElement, state.debuffWood, targetNpan);
    const current = calcMagicKillInfo(hero.int, hero.analysisBook, hero.analysisBookAdvanced, hero.crystalCount, state.spell, picked, lv, state.heroElement, state.debuffWood);
    statKey = "int";
    appendResult(wrap, `目標: ${picked.title}（${lvLabel}）を${targetNpan}パン以内`);
    appendResult(wrap, `必要int: ${fmt(neededVal)} 以上`);
    appendResult(wrap, `現在のint(${fmt(hero.int)})での討伐: ${current.npan != null ? current.npan + "パン" : "計算不可"}`);
    appendJudge(wrap, hero.int >= neededVal, `あと int ${fmt(neededVal - hero.int)} 不足`);
  }

  // 逆算結果を保存して探索ボタンを表示
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
  if (ok) {
    p.className = "bs-ok";
    p.textContent = "✅ 現在のビルドで達成可能です";
  } else {
    p.className = "bs-ng";
    p.textContent = `⚠️ ${ngText}`;
  }
  wrap.appendChild(p);
}

// --- 装備探索結果レンダリング ---
function renderEquipSearchResult(results) {
  const wrap = $("bs-equip-result");
  if (!wrap) return;
  wrap.innerHTML = "";

  if (!results || results.length === 0) {
    const p = document.createElement("p");
    p.textContent = "探索結果がありません。";
    wrap.appendChild(p);
    return;
  }

  const STAT_LABEL = { atk:"ATK", int:"INT", spd:"SPD", def:"DEF", mdef:"MDEF", vit:"VIT", luk:"LUK" };
  const SLOT_LABEL = { weapon:"武器", head:"頭", body:"体", hands:"手", feet:"脚", shield:"盾" };

  results.forEach(r => {
    const section = document.createElement("div");
    section.className = "bs-equip-result-section";

    const title = document.createElement("div");
    title.className = "bs-area-title";
    title.textContent = `${STAT_LABEL[r.stat] || r.stat} ${fmt(r.needed)} 以上を目指す装備提案`;
    section.appendChild(title);

    const statusP = document.createElement("p");
    statusP.className = r.achieved ? "bs-ok" : "bs-ng";
    statusP.textContent = r.achieved
      ? `✅ 推定 ${STAT_LABEL[r.stat] || r.stat} ${fmt(Math.floor(r.finalEstimate))} 達成可能`
      : `⚠️ 推定 ${STAT_LABEL[r.stat] || r.stat} ${fmt(Math.floor(r.finalEstimate))}（不足: ${fmt(r.needed - Math.floor(r.finalEstimate))}）`;
    section.appendChild(statusP);

    if (!r.achieved && r.gNeeded > 0) {
      const gP = document.createElement("p");
      gP.textContent = `G強化を ${r.gNeeded} 個追加することで達成できる可能性があります`;
      section.appendChild(gP);
    }

    if (r.setBonus) {
      const bonusP = document.createElement("p");
      bonusP.className = "bs-set-bonus";
      bonusP.textContent = "★ セットボーナス（×1.1）適用";
      section.appendChild(bonusP);
    }

    // 武器・防具テーブル
    const armorTitle = document.createElement("div");
    armorTitle.className = "bs-equip-subtitle";
    armorTitle.textContent = "武器・防具（+1100強化）";
    section.appendChild(armorTitle);

    const table = document.createElement("table");
    table.className = "bs-equip-table";
    const slots = ["weapon", "head", "body", "hands", "feet", "shield"];
    slots.forEach(slot => {
      const item = slot === "weapon" ? r.weapon : r.armorSlots[slot];
      const tr = document.createElement("tr");
      const tdSlot = document.createElement("td"); tdSlot.className = "bs-equip-slot"; tdSlot.textContent = SLOT_LABEL[slot] || slot;
      const tdName = document.createElement("td"); tdName.textContent = item ? item.name : "（なし）";
      const tdStat = document.createElement("td"); tdStat.className = "bs-equip-stat";
      tdStat.textContent = item ? `+${fmt(calcWeaponArmorStat(item, r.stat))}` : "-";
      tr.appendChild(tdSlot); tr.appendChild(tdName); tr.appendChild(tdStat);
      table.appendChild(tr);
    });
    section.appendChild(table);

    // アクセサリテーブル
    const accTitle = document.createElement("div");
    accTitle.className = "bs-equip-subtitle";
    accTitle.textContent = "アクセサリ（max_lv）";
    section.appendChild(accTitle);

    const accTable = document.createElement("table");
    accTable.className = "bs-equip-table";
    r.accessories.forEach((item, i) => {
      const s = calcAccessoryStat(item, r.stat);
      const tr = document.createElement("tr");
      const tdSlot = document.createElement("td"); tdSlot.className = "bs-equip-slot"; tdSlot.textContent = `アクセ${i+1}`;
      const tdName = document.createElement("td"); tdName.textContent = item.name;
      const tdStat = document.createElement("td"); tdStat.className = "bs-equip-stat";
      const parts = [];
      if (s.add  > 0) parts.push(`+${fmt(Math.floor(s.add))}`);
      if (s.rate > 0) parts.push(`+${s.rate.toFixed(1)}%`);
      tdStat.textContent = parts.join(" / ") || "-";
      tr.appendChild(tdSlot); tr.appendChild(tdName); tr.appendChild(tdStat);
      accTable.appendChild(tr);
    });
    section.appendChild(accTable);

    wrap.appendChild(section);
  });
}

// --- 天空フロア→Lv変換 ---
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

// 装備探索ボタン
$("bs-search-equip-btn")?.addEventListener("click", async () => {
  if (!lastReverseResult) return;
  const btn = $("bs-search-equip-btn");
  if (btn) btn.textContent = "探索中...";
  const items = await loadEquipItems();
  const ft    = window.lastFinalTotal || {};
  // 装備を除いた基礎ステ（プロテイン込み）を推定
  // finalTotalから現在の装備効果を引くのは複雑なので、
  // 基礎ステ＋プロテイン分だけを渡す（装備なし状態での合計として探索）
  const baseStats = {
    atk:  Math.round(Number(document.getElementById("base_atk")?.value  || 0)),
    int:  Math.round(Number(document.getElementById("base_int")?.value  || 0)),
    spd:  Math.round(Number(document.getElementById("base_spd")?.value  || 0)),
    def:  Math.round(Number(document.getElementById("base_def")?.value  || 0)),
    mdef: Math.round(Number(document.getElementById("base_mdef")?.value || 0)),
    vit:  Math.round(Number(document.getElementById("base_vit")?.value  || 0)),
    luk:  Math.round(Number(document.getElementById("base_luk")?.value  || 0)),
  };
  const results = searchEquipBuild(items, [lastReverseResult], baseStats);
  renderEquipSearchResult(results);
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
