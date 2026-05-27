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
  attackType:      "physical",
  heroElement:     "fire",
  spell:           "fire",
  debuffWood:      false,
  debuffDark:      false,
  npanLimit:       3,
  hasContract:     false,
  hasCosmoCube:    false,
  reverseHitRate:  0,
  useMinRandom:    false,
  calcMode:        "damage",
  nullifyTarget:   "auto"
};

let lastReverseResult = null;
let equipItemsCache   = [];
let equipItemsMap     = new Map();

async function loadEquipItems() {
  if (equipItemsCache.length > 0) return;
  try {
    const res  = await fetch(EQUIP_URL, { cache: "default" });
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
    analysisBook:         Math.max(0, parseInt($("bs-analysis-book")?.value         || "0", 10) || 0),
    analysisBookAdvanced: Math.max(0, parseInt($("bs-analysis-book-advanced")?.value || "0", 10) || 0),
    crystalCount:         Math.max(0, parseInt($("bs-crystal-count")?.value          || "0", 10) || 0)
  };
}

// --- 振り分け上限計算 ---
function getPointLimitInputs() {
  const sageDrop     = Math.max(0, parseInt(($("bs-sage-drop")?.value     || "0").replace(/,/g, ""), 10) || 0);
  const forbiddenBook = Math.max(0, parseInt(($("bs-forbidden-book")?.value || "0").replace(/,/g, ""), 10) || 0);
  const tenmeCount   = Math.max(0, parseInt(($("bs-tenme-count")?.value   || "0").replace(/,/g, ""), 10) || 0);
  return { sageDrop, forbiddenBook, hasContract: state.hasContract, tenmeCount };
}

function getStatPointInputs() {
  return {
    lv:          Math.max(1, Math.min(200, parseInt($("bs-chara-lv")?.value         || "200", 10) || 200)),
    tenme:       Math.max(0, Math.min(30,  parseInt($("bs-sp-tenme-count")?.value   || "0",   10) || 0)),
    hasCosmoCube: state.hasCosmoCube,
    penCount:    Math.max(0, parseInt($("bs-pen-count")?.value    || "0", 10) || 0),
    altarCount:  Math.max(0, parseInt($("bs-altar-count")?.value  || "0", 10) || 0),
    tenshoCount: Math.max(0, parseInt($("bs-tensho-count")?.value || "0", 10) || 0),
  };
}

function updateStatPointDisplay() {
  const { lv, tenme, hasCosmoCube, penCount, altarCount, tenshoCount } = getStatPointInputs();
  const pts = calcTotalStatPoints(lv, tenme, hasCosmoCube, penCount, altarCount, tenshoCount);
  const el = $("bs-stat-point-display");
  if (el) el.textContent = pts.toLocaleString("ja-JP");
  return pts;
}

function updatePointLimitDisplay() {
  const { sageDrop, forbiddenBook, hasContract, tenmeCount } = getPointLimitInputs();
  const limit = calcBasePointLimit(sageDrop, forbiddenBook, hasContract, tenmeCount);
  const el = $("bs-point-limit-display");
  if (el) el.textContent = limit.toLocaleString("ja-JP");
  return limit;
}

function estimateBasePointMultiplier(simState, stat) {
  // status-sim.jsの正確な実効倍率計算を使用
  if (window.statusSimGetEffectiveMul) {
    return window.statusSimGetEffectiveMul(stat);
  }
  // フォールバック：旧計算（精度低）
  const ft = window.lastFinalTotal || {};
  const finalVal = Math.round(Number(ft?.[stat] || 0));
  if (finalVal <= 0) return 1;
  const shaker     = Math.max(0, Number(simState?.shaker || 0));
  const baseVal    = Math.max(0, Number(simState?.base?.[stat]    || 0));
  const proteinVal = Math.max(0, Number(simState?.protein?.[stat] || 0));
  const basePlusProtein = baseVal + proteinVal * (1 + shaker * 0.01);
  if (basePlusProtein <= 0) return 1;
  return Math.max(1, finalVal / basePlusProtein);
}

function saveSimState() {
  try {
    const inputs = getPointLimitInputs();
    const spInputs = getStatPointInputs();
    localStorage.setItem(SIM_STATE_KEY, JSON.stringify({
      state,
      pointLimit: inputs,
      statPoint: spInputs
    }));
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
      state.debuffWood     = !!d.state.debuffWood;
      state.debuffDark     = !!d.state.debuffDark;
      state.hasContract    = !!d.state.hasContract;
      state.reverseHitRate = [0,1,50,99].includes(Number(d.state.reverseHitRate)) ? Number(d.state.reverseHitRate) : 0;
      if (["damage","nullify"].includes(d.state.calcMode)) state.calcMode = d.state.calcMode;
      state.useMinRandom = !!d.state.useMinRandom;
      if (Number.isFinite(Number(d.state.npanLimit))) state.npanLimit = Math.max(1, Number(d.state.npanLimit));
    }
    if (d.pointLimit) {
      if ($("bs-sage-drop"))      $("bs-sage-drop").value      = String(d.pointLimit.sageDrop      || 0);
      if ($("bs-forbidden-book")) $("bs-forbidden-book").value = String(d.pointLimit.forbiddenBook || 0);
      if ($("bs-tenme-count"))    $("bs-tenme-count").value    = String(d.pointLimit.tenmeCount    || 0);
    }
    if (d.statPoint) {
      if ($("bs-chara-lv"))       $("bs-chara-lv").value       = String(d.statPoint.lv         || 200);
      if ($("bs-sp-tenme-count")) $("bs-sp-tenme-count").value = String(d.statPoint.tenme       || 0);
      if ($("bs-pen-count"))      $("bs-pen-count").value      = String(d.statPoint.penCount    || 0);
      if ($("bs-altar-count"))    $("bs-altar-count").value    = String(d.statPoint.altarCount  || 0);
      if ($("bs-tensho-count"))   $("bs-tensho-count").value   = String(d.statPoint.tenshoCount || 0);
      state.hasCosmoCube = !!d.statPoint.hasCosmoCube;
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

  // 乱数ボタン
  document.querySelectorAll(".bs-random-btn").forEach(b => {
    b.setAttribute("aria-pressed", b.getAttribute("data-random") === (state.useMinRandom ? "min" : "avg") ? "true" : "false");
  });

  // 逆算タブ命中ボタン
  document.querySelectorAll(".bs-reverse-hit-btn").forEach(b => {
    b.setAttribute("aria-pressed", b.getAttribute("data-rate") === String(state.reverseHitRate) ? "true" : "false");
  });

  // 逆算モード切り替え
  document.querySelectorAll(".bs-calc-mode-btn").forEach(b => {
    b.setAttribute("aria-pressed", b.getAttribute("data-mode") === state.calcMode ? "true" : "false");
  });
  document.querySelectorAll(".bs-damage-mode").forEach(el => {
    el.hidden = state.calcMode !== "damage";
  });
  document.querySelectorAll(".bs-nullify-mode").forEach(el => {
    el.hidden = state.calcMode !== "nullify";
  });



  // コスモキューブボタン
  document.querySelectorAll(".bs-cosmocube-btn").forEach(b => {
    b.setAttribute("aria-pressed", b.getAttribute("data-val") === (state.hasCosmoCube ? "1" : "0") ? "true" : "false");
  });

  // 超越の契約書ボタン
  document.querySelectorAll(".bs-contract-btn").forEach(btn => {
    btn.setAttribute("aria-pressed", String(btn.getAttribute("data-val") === "1") === String(state.hasContract) ? "true" : "false");
  });
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

function setupMonsterSearch(searchId, suggestId, lvInputId, shortcutWrapId, onSelect) {
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
         if (onSelect) onSelect(m);
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
    const q = search.value || "";
    const items = Array.isArray(window.MONSTERS)
      ? (q.trim() === ""
          ? window.MONSTERS.slice(0, 200)
          : window.MONSTERS.filter(m => normalizeJP(m.title).includes(normalizeJP(q))).slice(0, 200))
      : [];
    if (items.length > 0) openSuggest(items);
  });

  document.addEventListener("click", e => {
    if (e.target === search || suggest.contains(e.target)) return;
    closeSuggest();
  });

  return { getPicked: () => picked, clear: function() { picked = null; search.value = ""; closeSuggest(); if (lvInput) lvInput.value = ""; if (scWrap) scWrap.innerHTML = ""; } };
}

let reverseSearchHandle = null;
let hitSearchHandle     = null;
let lastHitResult       = null;
const hitState = { rate: 50 };

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
  const lvLabel    = lv > 0 ? "Lv" + fmt(lv) : "基本";

  // 無効化モード
  if (state.calcMode === "nullify") {
    renderNullifyResult(wrap, picked, lv, lvLabel, hero);
    return;
  }

  // 多段数SPD不足チェック更新・表示
  updateSpdShortage();
  const hitsEl = $("bs-reverse-hits");
  const targetHits = hitsEl ? Math.min(11, Math.max(1, parseInt(hitsEl.value, 10) || 1)) : 1;
  const neededSpd  = typeof requiredSpdForHits === "function" ? requiredSpdForHits(targetHits) : 0;
  const heroSpd    = Math.round(Number(window.lastFinalTotal?.spd || 0));
  const spdShortfall = Math.max(0, neededSpd - heroSpd);

  let neededVal = 0, statKey = "";

  if (state.attackType === "physical") {
    neededVal = reversePhysicalAtk(picked, lv, hero.spd, state.heroElement, state.debuffWood, state.debuffDark, targetNpan, state.useMinRandom);
    const current = calcPhysicalKillInfo(hero.atk, hero.spd, picked, lv, state.heroElement, state.debuffWood, state.debuffDark);
    statKey = "atk";
    const randomLabel = state.useMinRandom ? "（最低乱数）" : "（平均）";
    appendResult(wrap, "目標: " + picked.title + "（" + lvLabel + "）を" + targetNpan + "パン以内" + randomLabel);
    appendResult(wrap, "必要atk: " + fmt(neededVal) + " 以上");
    const currentNpan = state.useMinRandom ? current.npanMin : current.npan;
    appendResult(wrap, "現在のatk(" + fmt(hero.atk) + ")での討伐: " + (currentNpan != null ? currentNpan + "パン" : "計算不可"));
    appendJudge(wrap, hero.atk >= neededVal, "あと atk " + fmt(neededVal - hero.atk) + " 不足");

    // 命中も同時計算
    let neededLuk = 0;
    if (state.reverseHitRate > 0) {
      const scaled   = buildEnemyScaled(picked, lv, { debuffWood: state.debuffWood, debuffDark: state.debuffDark });
      neededLuk = calcRequiredLukForHitRate(scaled.luk, state.reverseHitRate);
      const ft = window.lastFinalTotal || {};
      const heroLuk = Math.max(0, Math.round(ft.luk || 0));
      const currentRate = calcHitRateFromLuk(heroLuk, scaled.luk);
      const sep = document.createElement("hr");
      sep.style.margin = "10px 0";
      wrap.appendChild(sep);
      appendResult(wrap, "命中" + state.reverseHitRate + "% 必要luk: " + fmt(neededLuk) + " 以上");
      appendResult(wrap, "現在のluk(" + fmt(heroLuk) + ")での命中率: 約" + currentRate + "%");
      appendJudge(wrap, heroLuk >= neededLuk, "あと luk " + fmt(neededLuk - heroLuk) + " 不足");
    }

    // SPD不足表示（命中の有無に関わらず）
    if (targetHits > 1 && spdShortfall > 0) {
      const sepSpd = document.createElement("hr"); sepSpd.style.margin = "8px 0"; wrap.appendChild(sepSpd);
      appendResult(wrap, "【多段×" + targetHits + " 達成（SPD " + fmt(neededSpd) + " 以上）】");
      appendResult(wrap, "現在のSPD: " + fmt(heroSpd));
      appendJudge(wrap, false, "あと SPD " + fmt(spdShortfall) + " 不足");
    } else if (targetHits > 1) {
      const sepSpd = document.createElement("hr"); sepSpd.style.margin = "8px 0"; wrap.appendChild(sepSpd);
      appendResult(wrap, "【多段×" + targetHits + "】 ✅ SPD達成済み（" + fmt(heroSpd) + "）");
    }

    // 会心率計算
    const critRateEl = $("bs-reverse-crit");
    const targetCritRate = critRateEl ? Math.min(90, Math.max(0, parseInt(critRateEl.value, 10) || 0)) : 0;
    let neededLukForCrit = 0;
    if (targetCritRate > 0) {
      const scaledForCrit = buildEnemyScaled(picked, lv, { debuffWood: state.debuffWood, debuffDark: state.debuffDark });
      const enemyLukForCrit = scaledForCrit.luk;
      const heroLukForCrit  = Math.round(Number(window.lastFinalTotal?.luk || 0));
      const currentCritRate = calcCritRate(heroLukForCrit, enemyLukForCrit);
      neededLukForCrit = requiredLukForCritRate(enemyLukForCrit, targetCritRate);
      const critShortfall = Math.max(0, neededLukForCrit - heroLukForCrit);
      const sepCrit = document.createElement("hr"); sepCrit.style.margin = "8px 0"; wrap.appendChild(sepCrit);
      appendResult(wrap, "【会心率" + targetCritRate + "% 達成（必要LUK " + fmt(neededLukForCrit) + " 以上）】");
      appendResult(wrap, "現在のLUK(" + fmt(heroLukForCrit) + ")での会心率: " + currentCritRate + "%");
      if (critShortfall > 0) {
        appendJudge(wrap, false, "あと LUK " + fmt(critShortfall) + " 不足");
      } else {
        appendJudge(wrap, true, "");
      }
    }

    lastReverseResult = {
      stat: statKey, needed: neededVal,
      neededLuk: state.reverseHitRate === 1 ? 0 : neededLuk,
      hitRate: state.reverseHitRate === 1 ? 0 : state.reverseHitRate,
      neededSpd: spdShortfall > 0 ? neededSpd : 0,
      spdShortfall,
      neededLukForCrit: targetCritRate > 0 ? neededLukForCrit : 0,
      targetCritRate
    };
  } else {
    neededVal = reverseMagicInt(picked, lv, hero.analysisBook, hero.analysisBookAdvanced, hero.crystalCount, state.spell, state.heroElement, state.debuffWood, targetNpan, state.useMinRandom);
    const current = calcMagicKillInfo(hero.int, hero.analysisBook, hero.analysisBookAdvanced, hero.crystalCount, state.spell, picked, lv, state.heroElement, state.debuffWood);
    statKey = "int";
    const randomLabelMag = state.useMinRandom ? "（最低乱数）" : "（平均）";
    appendResult(wrap, "目標: " + picked.title + "（" + lvLabel + "）を" + targetNpan + "パン以内" + randomLabelMag);
    appendResult(wrap, "必要int: " + fmt(neededVal) + " 以上");
    const currentNpanMag = state.useMinRandom ? current.npanMin : current.npan;
    appendResult(wrap, "現在のint(" + fmt(hero.int) + ")での討伐: " + (currentNpanMag != null ? currentNpanMag + "パン" : "計算不可"));
    appendJudge(wrap, hero.int >= neededVal, "あと int " + fmt(neededVal - hero.int) + " 不足");
    lastReverseResult = { stat: statKey, needed: neededVal, neededLuk: 0, hitRate: 0, neededSpd: 0, spdShortfall: 0 };
  }

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

function renderGlvAnalysis(analysis, stat, needed, appendMode, customTitle, hideAcc) {
  const wrap = $("bs-equip-result");
  if (!wrap) return;
  if (!appendMode) wrap.innerHTML = "";

  // 追記モードの場合はセパレータを追加
  if (appendMode && wrap.children.length > 0) {
    const sep = document.createElement("hr");
    sep.className = "bs-section-divider";
    wrap.appendChild(sep);
  }

  const STAT_LABEL = { atk:"ATK", int:"INT", spd:"SPD", def:"DEF", mdef:"MDEF", vit:"VIT", luk:"LUK" };
  const STAT_COLOR  = { atk:"title-atk", int:"title-int", spd:"title-spd", def:"title-def", mdef:"title-mdef", vit:"title-vit", luk:"title-luk" };

  // customTitleがある場合はそれを使い、内部タイトルは出さない
  const header = document.createElement("div");
  header.className = "bs-area-title " + (STAT_COLOR[stat] || "");
  header.textContent = customTitle || `現在の装備で ${STAT_LABEL[stat]||stat} ${fmt(needed)} 達成するためのステポイント・G強化分析`;
  wrap.appendChild(header);

  if (analysis.achieved) {
    const p = document.createElement("p");
    p.className = "bs-ok";
    p.textContent = "✅ 現在の装備・強化レベルで既に達成しています";
    wrap.appendChild(p);
    return;
  }

  // ① ステポイント分析を先に表示
  if (analysis.statPointResult) {
    const sp = analysis.statPointResult;
    const spTitle = document.createElement("div");
    spTitle.className = "bs-equip-subtitle";
    spTitle.textContent = "① ステポイントで補う";
    wrap.appendChild(spTitle);

    const spBox = document.createElement("div");
    spBox.className = "bs-statpoint-box";

    const rows = [
      { label: `必要な${STAT_LABEL[stat]||stat}ポイント追加`, value: `${fmt(sp.neededBaseIncrease)} ポイント` },
      { label: "振り分け上限",    value: `${fmt(sp.basePointTotal)} ポイント` },
      { label: "現在の使用済み",  value: `${fmt(sp.usedPoints)} ポイント` },
      { label: "残り振り分け可能", value: `${fmt(sp.freePoints)} ポイント` },
    ];

    rows.forEach(row => {
      const div = document.createElement("div");
      div.className = "bs-statpoint-row";
      const label = document.createElement("span");
      label.className = "bs-statpoint-label";
      label.textContent = row.label;
      const val = document.createElement("span");
      val.className = "bs-statpoint-val";
      val.textContent = row.value;
      div.appendChild(label);
      div.appendChild(val);
      spBox.appendChild(div);
    });

    if (sp.achievable) {
      const judgeP = document.createElement("p");
      judgeP.className = "bs-ok";
      judgeP.textContent = `✅ ${STAT_LABEL[stat]||stat} に ${fmt(sp.neededBaseIncrease)} ポイント振り分けることで達成可能です（G強化不要）`;
      spBox.appendChild(judgeP);
      wrap.appendChild(spBox);
      return;
    } else {
      const partialP = document.createElement("p");
      partialP.className = "bs-ng";
      partialP.textContent = `⚠️ 振り分け上限 ${fmt(sp.basePointTotal)} ポイントを全振りしても不足（${fmt(sp.partialGain)} 分補填） → 残りをG強化で補います`;
      spBox.appendChild(partialP);
      wrap.appendChild(spBox);
    }
  }

  // ② 素材強化テーブル
  const matSlots = analysis.slots.filter(s => s.item && s.addedLv > 0);
  if (matSlots.length > 0) {
    const matTitle = document.createElement("div");
    matTitle.className = "bs-equip-subtitle";
    matTitle.textContent = "② 素材強化で補う（+lv追加）";
    wrap.appendChild(matTitle);
    const matTable = document.createElement("table");
    matTable.className = "bs-equip-table";
    const matThead = document.createElement("tr");
    ["スロット","装備名","現在+lv","推奨+lv","追加lv数","現在値","強化後"].forEach(h => {
      const th = document.createElement("th");
      th.textContent = h;
      th.style.cssText = "padding:6px 8px;font-size:12px;color:#666;border-bottom:1px solid #ddd;white-space:nowrap;text-align:left;";
      matThead.appendChild(th);
    });
    matTable.appendChild(matThead);
    matSlots.forEach(s => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #eee";
      [
        { text: s.label, cls: "bs-equip-slot" },
        { text: s.item.name },
        { text: "+" + s.currentLv },
        { text: "+" + s.neededLv },
        { text: "+" + s.addedLv + "lv", cls: "bs-glv-needed" },
        { text: fmt(s.currentStatVal) },
        { text: fmt(s.newLvStatVal), cls: "bs-glv-needed" },
      ].forEach(c => {
        const td = document.createElement("td");
        td.textContent = c.text;
        td.style.cssText = "padding:6px 8px;font-size:14px;";
        if (c.cls) td.className = c.cls;
        tr.appendChild(td);
      });
      matTable.appendChild(tr);
    });
    wrap.appendChild(matTable);
  }

  // ② G強化テーブル
  const armorTitle = document.createElement("div");
  armorTitle.className = "bs-equip-subtitle";
  armorTitle.textContent = "③ G強化で残りを補う（perG効率順に割り振り）";
  wrap.appendChild(armorTitle);

  if (analysis.noEnhanceable) {
    const noEnhP = document.createElement("p");
    noEnhP.className = "bs-ng";
    noEnhP.textContent = "⚠️ G強化可能な装備がありません（素材強化+1100が必要です）。";
    wrap.appendChild(noEnhP);
    return;
  }

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

  let totalAddedG = 0;
  analysis.slots.forEach(s => {
    if (!s.item) return;
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";
    const isChanged = s.addedGlv > 0;
    const isMax     = s.neededGlv >= 100 && isChanged;
    totalAddedG += s.addedGlv;

    const addedText = isChanged
      ? `+${s.addedGlv}回（G${s.currentGlv}→G${s.neededGlv}）`
      : (s.canEnhance ? "変更不要" : "-");

    [
      { text: s.label,   cls: "bs-equip-slot" },
      { text: s.item.name },
      { text: `G${s.currentGlv}` },
      { text: s.canEnhance ? `G${s.neededGlv}` : "-" },
      { text: addedText, cls: isChanged ? "bs-glv-needed" : "bs-glv-ok" },
      { text: fmt(s.currentStatVal) },
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

  if (totalAddedG > 0) {
    const totalCost = calcTotalGCost(analysis.slots);
    const sumTr = document.createElement("tr");
    sumTr.style.cssText = "border-top:2px solid #ccc;font-weight:700;";
    ["合計", "", "", "", `+${totalAddedG}回`, "", `推定費用: ${fmtGCost(totalCost)}`].forEach(t => {
      const td = document.createElement("td");
      td.textContent = t;
      td.style.cssText = "padding:6px 8px;font-size:14px;";
      sumTr.appendChild(td);
    });
    table.appendChild(sumTr);
  }
  wrap.appendChild(table);

  if (analysis.stillShort) {
    const maxStat1 = analysis.slots.reduce((s2, s) => {
      if (!s.item) return s2;
      return s2 + (s.canEnhance ? calcWeaponArmorStatG(s.item, stat, 300) : (s.newLvStatVal !== undefined ? s.newLvStatVal : s.currentStatVal));
    }, 0);
    const em1 = (typeof window.statusSimGetEffectiveMul==="function") ? window.statusSimGetEffectiveMul(stat) : 1;
    const sf1 = Math.max(0, needed - Math.round(maxStat1 * em1));
    const p = document.createElement("p");
    p.className = "bs-ng";
    p.textContent = "⚠️ ステポイント全振り＋全スロットG300でも不足します。あと " + fmt(sf1) + " 不足。装備の見直しが必要です。";
    wrap.appendChild(p);
  }

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
      { text: s.label, cls: "bs-equip-slot" },
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

// --- 命中計算UI ---
function setupHitMonsterSearch() {
  hitSearchHandle = setupMonsterSearch(
    "bs-hit-monster-search",
    "bs-hit-monster-suggest",
    "bs-hit-lv",
    "bs-hit-lv-shortcuts"
  );
}

function renderHitResult() {
  const wrap = $("bs-hit-result");
  if (!wrap) return;
  wrap.innerHTML = "";
  const picked = hitSearchHandle?.getPicked();
  if (!picked) { wrap.textContent = "モンスターを選択してください。"; return; }
  const lvEl  = $("bs-hit-lv");
  const lv    = Math.max(0, parseFormattedInt(lvEl, 0));
  const ft    = window.lastFinalTotal || {};
  const heroLuk = Math.max(0, Math.round(ft.luk || 0));
  const scaled  = buildEnemyScaled(picked, lv, { debuffWood: state.debuffWood, debuffDark: state.debuffDark });
  const enemyLuk = scaled.luk;
  const lvLabel  = lv > 0 ? "Lv" + fmt(lv) : "基本";
  const luk1  = calcRequiredLukForHitRate(enemyLuk, 1);
  const luk50 = calcRequiredLukForHitRate(enemyLuk, 50);
  const luk99 = calcRequiredLukForHitRate(enemyLuk, 99);
  const currentRate = calcHitRateFromLuk(heroLuk, enemyLuk);
  appendResult(wrap, "目標: " + picked.title + "（" + lvLabel + "）");
  appendResult(wrap, "敵luk（スケール済）: " + fmt(enemyLuk));
  const table = document.createElement("table");
  table.className = "bs-equip-table";
  table.style.marginTop = "10px";
  const thead = document.createElement("tr");
  ["命中確率", "必要luk", "判定"].forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    th.style.cssText = "padding:6px 8px;font-size:12px;color:#666;border-bottom:1px solid #ddd;text-align:left;";
    thead.appendChild(th);
  });
  table.appendChild(thead);
  [
    { label: "1%（最低）",  neededLuk: luk1  },
    { label: "50%",          neededLuk: luk50 },
    { label: "99%（安定）", neededLuk: luk99 },
  ].forEach(row => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";
    const ok = heroLuk >= row.neededLuk;
    [
      { text: row.label },
      { text: fmt(row.neededLuk) + " 以上" },
      { text: ok ? "✅ 達成" : "⚠️ あと " + fmt(row.neededLuk - heroLuk) + " 不足", cls: ok ? "bs-glv-ok" : "bs-glv-needed" },
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
  const rateP = document.createElement("p");
  rateP.style.marginTop = "10px";
  rateP.textContent = "現在のluk（" + fmt(heroLuk) + "）での命中率: 約" + currentRate + "%";
  wrap.appendChild(rateP);
  const selectedLuk = hitState.rate === 1 ? luk1 : hitState.rate === 99 ? luk99 : luk50;
  lastHitResult = { neededLuk: selectedLuk, rate: hitState.rate };
  const searchWrap = $("bs-hit-search-wrap");
  if (searchWrap) searchWrap.hidden = false;
  const equipResult = $("bs-hit-equip-result");
  if (equipResult) equipResult.innerHTML = "";
}

function renderHitEquipResult(analysis) {
  const wrap = $("bs-hit-equip-result");
  if (!wrap) return;
  wrap.innerHTML = "";
  const header = document.createElement("div");
   header.className = "bs-area-title title-hit";
  header.textContent = "命中" + (lastHitResult?.rate || 50) + "% 達成のための LUK " + fmt(lastHitResult?.neededLuk || 0) + " 探索";
  wrap.appendChild(header);
  if (analysis.achieved) {
    const p = document.createElement("p");
    p.className = "bs-ok";
    p.textContent = "✅ 現在のlukで達成しています";
    wrap.appendChild(p);
    return;
  }
  if (analysis.statPointResult) {
    const sp = analysis.statPointResult;
    const spTitle = document.createElement("div");
    spTitle.className = "bs-equip-subtitle";
    spTitle.textContent = "① ステポイントで補う";
    wrap.appendChild(spTitle);
    const spBox = document.createElement("div");
    spBox.className = "bs-statpoint-box";
    [
      { label: "必要LUKポイント追加", value: fmt(sp.neededBaseIncrease) + " ポイント" },
      { label: "振り分け上限",        value: fmt(sp.basePointTotal) + " ポイント" },
      { label: "現在の使用済み",       value: fmt(sp.usedPoints) + " ポイント" },
      { label: "残り振り分け可能",     value: fmt(sp.freePoints) + " ポイント" },
    ].forEach(row => {
      const div = document.createElement("div"); div.className = "bs-statpoint-row";
      const label = document.createElement("span"); label.className = "bs-statpoint-label"; label.textContent = row.label;
      const val   = document.createElement("span"); val.className   = "bs-statpoint-val";   val.textContent   = row.value;
      div.appendChild(label); div.appendChild(val); spBox.appendChild(div);
    });
    const judgeP = document.createElement("p");
    if (sp.achievable) {
      judgeP.className = "bs-ok";
      judgeP.textContent = "✅ LUK に " + fmt(sp.neededBaseIncrease) + " ポイント振り分けることで達成可能です（G強化不要）";
      spBox.appendChild(judgeP); wrap.appendChild(spBox);
      return;
    } else {
      judgeP.className = "bs-ng";
      judgeP.textContent = "⚠️ 振り分け上限 " + fmt(sp.basePointTotal) + " ポイントを全振りしても不足 → 残りをG強化で補います";
      spBox.appendChild(judgeP); wrap.appendChild(spBox);
    }
  }
  const armorTitle = document.createElement("div");
  armorTitle.className = "bs-equip-subtitle";
  armorTitle.textContent = "② G強化で残りを補う（perG効率順）";
  wrap.appendChild(armorTitle);
  const table = document.createElement("table");
  table.className = "bs-equip-table";
  const thead = document.createElement("tr");
  ["スロット","装備名","現在G","推奨G","追加G数","現在値","強化後"].forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    th.style.cssText = "padding:6px 8px;font-size:12px;color:#666;border-bottom:1px solid #ddd;white-space:nowrap;text-align:left;";
    thead.appendChild(th);
  });
  table.appendChild(thead);
  let totalAddedG = 0;
  analysis.slots.forEach(s => {
    if (!s.item) return;
    const isChanged = s.addedGlv > 0;
    const isMax     = s.neededGlv >= 100 && isChanged;
    totalAddedG += s.addedGlv;
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";
    [
      { text: s.label, cls: "bs-equip-slot" },
      { text: s.item.name },
      { text: "G" + s.currentGlv },
      { text: s.canEnhance ? "G" + s.neededGlv : "-" },
      { text: isChanged ? ("+" + s.addedGlv + "回（G" + s.currentGlv + "→G" + s.neededGlv + "）") : (s.canEnhance ? "変更不要" : "-"), cls: isChanged ? "bs-glv-needed" : "bs-glv-ok" },
      { text: fmt(s.currentStatVal) },
      { text: s.canEnhance ? fmt(calcWeaponArmorStatG(s.item, "luk", s.neededGlv)) : fmt(s.currentStatVal), cls: isChanged ? "bs-glv-needed" : "" },
    ].forEach(c => {
      const td = document.createElement("td");
      td.textContent = c.text;
      td.style.cssText = "padding:6px 8px;font-size:14px;";
      if (c.cls) td.className = c.cls;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  if (totalAddedG > 0) {
    const totalCostHit = calcTotalGCost(analysis.slots);
    const sumTr = document.createElement("tr");
    sumTr.style.cssText = "border-top:2px solid #ccc;font-weight:700;";
    ["合計","","","","+" + totalAddedG + "回","","推定費用: " + fmtGCost(totalCostHit)].forEach(t => {
      const td = document.createElement("td"); td.textContent = t;
      td.style.cssText = "padding:6px 8px;font-size:14px;"; sumTr.appendChild(td);
    });
    table.appendChild(sumTr);
  }
  wrap.appendChild(table);
  if (analysis.stillShort) {
    const maxStat2 = analysis.slots.reduce((s2, s) => {
      if (!s.item) return s2;
      return s2 + (s.canEnhance ? calcWeaponArmorStatG(s.item, "luk", 300) : (s.newLvStatVal !== undefined ? s.newLvStatVal : s.currentStatVal));
    }, 0);
    const em2 = (typeof window.statusSimGetEffectiveMul==="function") ? window.statusSimGetEffectiveMul("luk") : 1;
    const sf2 = Math.max(0, (lastHitResult?.neededLuk||0) - Math.round(maxStat2 * em2));
    const p = document.createElement("p"); p.className = "bs-ng";
    p.textContent = "⚠️ ステポイント全振り＋全スロットG300でも不足します。あと " + fmt(sf2) + " 不足。装備の見直しが必要です。";
    wrap.appendChild(p);
  }
}

function renderAtkLukAnalysis(analysis, neededAtk, neededLuk, hitRate) {
  const wrap = $("bs-equip-result");
  if (!wrap) return;
  wrap.innerHTML = "";

  const header = document.createElement("div");
   header.className = "bs-area-title title-atk";
  header.textContent = "ATK " + fmt(neededAtk) + " ＋ 命中" + hitRate + "%(LUK " + fmt(neededLuk) + ") 同時達成分析";
  wrap.appendChild(header);

  function makeStatSection(title, slots, statPointResult, stillShort, stat, alreadyAchieved, needed) {
    const sec = document.createElement("div");
    sec.style.marginBottom = "20px";

    const secTitle = document.createElement("div");
    const STAT_COLOR_SEC = { atk:"title-atk", int:"title-int", spd:"title-spd", def:"title-def", mdef:"title-mdef", vit:"title-vit", luk:"title-hit" };
    secTitle.className = "bs-area-title " + (STAT_COLOR_SEC[stat] || "");
    secTitle.style.fontSize = "14px";
    secTitle.textContent = title;
    sec.appendChild(secTitle);

    if (alreadyAchieved) {
      const p = document.createElement("p"); p.className = "bs-ok";
      p.textContent = "✅ 現在の" + (stat === "atk" ? "atk" : "luk") + "で達成しています";
      sec.appendChild(p);
      return sec;
    }

    // ステポイント
    if (statPointResult) {
      const sp = statPointResult;
      const spTitle = document.createElement("div");
      spTitle.className = "bs-equip-subtitle";
      spTitle.textContent = "① ステポイントで補う";
      sec.appendChild(spTitle);
      const spBox = document.createElement("div");
      spBox.className = "bs-statpoint-box";
      [
        { label: "必要" + stat.toUpperCase() + "ポイント追加", value: fmt(sp.neededBaseIncrease) + " ポイント" },
        { label: "残り振り分け可能", value: fmt(sp.freePoints) + " ポイント" },
      ].forEach(row => {
        const div = document.createElement("div"); div.className = "bs-statpoint-row";
        const label = document.createElement("span"); label.className = "bs-statpoint-label"; label.textContent = row.label;
        const val   = document.createElement("span"); val.className   = "bs-statpoint-val";   val.textContent   = row.value;
        div.appendChild(label); div.appendChild(val); spBox.appendChild(div);
      });
      const judgeP = document.createElement("p");
      if (sp.achievable) {
        judgeP.className = "bs-ok";
        judgeP.textContent = "✅ " + stat.toUpperCase() + " に " + fmt(sp.neededBaseIncrease) + " ポイント振り分けで達成可能（G強化不要）";
        spBox.appendChild(judgeP); sec.appendChild(spBox);
        return sec;
      } else {
        judgeP.className = "bs-ng";
        judgeP.textContent = "⚠️ 振り分け上限 " + fmt(sp.basePointTotal) + " ポイントを全振りしても不足 → G強化で補います";
        spBox.appendChild(judgeP); sec.appendChild(spBox);
      }
    }

     // ② 素材強化テーブル
     const matSlotsInSec = slots.filter(s => s.item && s.addedLv > 0);
     if (matSlotsInSec.length > 0) {
       const matTitleEl = document.createElement("div");
       matTitleEl.className = "bs-equip-subtitle";
       matTitleEl.textContent = "② 素材強化で補う（+lv追加）";
       sec.appendChild(matTitleEl);
       const matTbl = document.createElement("table");
       matTbl.className = "bs-equip-table";
       const matThead = document.createElement("tr");
       ["スロット","装備名","現在+lv","推奨+lv","追加lv数","現在値","強化後"].forEach(h => {
         const th = document.createElement("th");
         th.textContent = h;
         th.style.cssText = "padding:6px 8px;font-size:12px;color:#666;border-bottom:1px solid #ddd;white-space:nowrap;text-align:left;";
         matThead.appendChild(th);
       });
       matTbl.appendChild(matThead);
       matSlotsInSec.forEach(s => {
         const tr = document.createElement("tr");
         tr.style.borderBottom = "1px solid #eee";
         [
           { text: s.label, cls: "bs-equip-slot" },
           { text: s.item.name },
           { text: "+" + s.currentLv },
           { text: "+" + s.neededLv },
           { text: "+" + s.addedLv + "lv", cls: "bs-glv-needed" },
           { text: fmt(s.currentStatVal) },
           { text: fmt(s.newLvStatVal), cls: "bs-glv-needed" },
         ].forEach(c => {
           const td = document.createElement("td");
           td.textContent = c.text;
           td.style.cssText = "padding:6px 8px;font-size:14px;";
           if (c.cls) td.className = c.cls;
           tr.appendChild(td);
         });
         matTbl.appendChild(tr);
       });
       sec.appendChild(matTbl);
     }

    // G強化テーブル
    const armorTitle = document.createElement("div");
    armorTitle.className = "bs-equip-subtitle";
    armorTitle.textContent = "② G強化で残りを補う";
    sec.appendChild(armorTitle);

    const table = document.createElement("table");
    table.className = "bs-equip-table";
    const thead = document.createElement("tr");
    ["スロット","装備名","現在G","推奨G","追加G数","現在値","強化後"].forEach(h => {
      const th = document.createElement("th");
      th.textContent = h;
      th.style.cssText = "padding:6px 8px;font-size:12px;color:#666;border-bottom:1px solid #ddd;white-space:nowrap;text-align:left;";
      thead.appendChild(th);
    });
    table.appendChild(thead);

    let totalAddedG = 0;
    slots.forEach(s => {
      if (!s.item) return;
      const isChanged = s.addedGlv > 0;
      const isMax     = s.neededGlv >= 100 && isChanged;
      totalAddedG += s.addedGlv;
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #eee";
      [
        { text: s.label, cls: "bs-equip-slot" },
        { text: s.item.name },
        { text: "G" + s.currentGlv },
        { text: s.canEnhance ? "G" + s.neededGlv : "-" },
        { text: isChanged ? ("+" + s.addedGlv + "回（G" + s.currentGlv + "→G" + s.neededGlv + "）") : (s.canEnhance ? "変更不要" : "-"), cls: isChanged ? "bs-glv-needed" : "bs-glv-ok" },
        { text: fmt(s.currentStatVal) },
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
    if (totalAddedG > 0) {
      const sectionCost = calcTotalGCost(slots);
      const sumTr = document.createElement("tr");
      sumTr.style.cssText = "border-top:2px solid #ccc;font-weight:700;";
      ["合計","","","","+" + totalAddedG + "回","","推定費用: " + fmtGCost(sectionCost)].forEach(t => {
        const td = document.createElement("td"); td.textContent = t;
        td.style.cssText = "padding:6px 8px;font-size:14px;"; sumTr.appendChild(td);
      });
      table.appendChild(sumTr);
    }
    sec.appendChild(table);

    if (stillShort) {
      let shortfallTxt = "";
      if (needed != null) {
        const maxStatSec = slots.reduce((s2, s) => {
          if (!s.item) return s2;
          return s2 + (s.canEnhance ? calcWeaponArmorStatG(s.item, stat, 300) : (s.newLvStatVal !== undefined ? s.newLvStatVal : s.currentStatVal));
        }, 0);
        const emSec = (typeof window.statusSimGetEffectiveMul === "function") ? window.statusSimGetEffectiveMul(stat) : 1;
        const sfSec = Math.max(0, needed - Math.round(maxStatSec * emSec));
        shortfallTxt = "あと " + fmt(sfSec) + " 不足。";
      }
      const p = document.createElement("p"); p.className = "bs-ng";
      p.textContent = "⚠️ ステポイント全振り＋全スロットG300でも不足します。" + shortfallTxt + "装備の見直しが必要です。";
      sec.appendChild(p);
    }
    return sec;
  }

  wrap.appendChild(makeStatSection(
    "【ATK " + fmt(neededAtk) + " を達成するためには】",
    analysis.atkSlots, analysis.atkStatPointResult, analysis.atkStillShort, "atk", analysis.atkAlreadyAchieved, neededAtk
  ));

  const divider = document.createElement("hr");
  divider.style.margin = "16px 0";
  wrap.appendChild(divider);

  wrap.appendChild(makeStatSection(
    "【命中" + hitRate + "% (LUK " + fmt(neededLuk) + ") を達成するためには】",
    analysis.lukSlots, analysis.lukStatPointResult, analysis.lukStillShort, "luk", analysis.lukAlreadyAchieved, neededLuk
  ));

}

function renderNullifyResult(wrap, picked, lv, lvLabel, hero) {
  const scaled = buildEnemyScaled(picked, lv, { debuffWood: false, debuffDark: false });
  const attackType = picked.attack_type || "";
  const isPhys  = attackType.includes("物理");
  const isMagic = attackType.includes("魔法");

  // 攻撃タイプに応じて表示対象を決定（両方含む場合は両方）
  const showDef  = isPhys  || (!isPhys && !isMagic);
  const showMdef = isMagic || (!isPhys && !isMagic);

  appendResult(wrap, "目標: " + picked.title + "（" + lvLabel + "）");
  appendResult(wrap, "敵の攻撃タイプ: " + (attackType || "不明"));

  const currentDef  = Math.round(Number((window.lastFinalTotal || {}).def  || 0));
  const currentMdef = Math.round(Number((window.lastFinalTotal || {}).mdef || 0));

  if (showDef) {
    const neededDef = requiredStatForNullify(scaled.atk);
    const dmg = calcReceivedDamage(currentDef, scaled.atk, getElementModifier(state.heroElement, scaled.element));
    const sep = document.createElement("hr"); sep.style.margin = "8px 0"; wrap.appendChild(sep);
    appendResult(wrap, "【物理無効化】");
    appendResult(wrap, "必要DEF: " + fmt(neededDef) + " 以上");
    appendResult(wrap, "現在のDEF(" + fmt(currentDef) + ")での被ダメ: " +
      (dmg.nullified ? "無効化済み✅" : fmt(dmg.min) + "〜" + fmt(dmg.max)));
    appendJudge(wrap, dmg.nullified || currentDef >= neededDef,
      "あと DEF " + fmt(Math.max(0, neededDef - currentDef)) + " 不足");
  }

  if (showMdef) {
    const neededMdef = requiredStatForNullify(scaled.int);
    const dmg = calcReceivedDamage(currentMdef, scaled.int, getElementModifier(state.heroElement, scaled.element));
    const sep = document.createElement("hr"); sep.style.margin = "8px 0"; wrap.appendChild(sep);
    appendResult(wrap, "【魔法無効化】");
    appendResult(wrap, "必要MDEF: " + fmt(neededMdef) + " 以上");
    appendResult(wrap, "現在のMDEF(" + fmt(currentMdef) + ")での被ダメ: " +
      (dmg.nullified ? "無効化済み✅" : fmt(dmg.min) + "〜" + fmt(dmg.max)));
    appendJudge(wrap, dmg.nullified || currentMdef >= neededMdef,
      "あと MDEF " + fmt(Math.max(0, neededMdef - currentMdef)) + " 不足");
  }

  // 探索ボタン表示
  lastReverseResult = {
    stat: isMagic ? "mdef" : "def",
    needed: 0,
    neededDef:  showDef  ? requiredStatForNullify(scaled.atk) : 0,
    neededMdef: showMdef ? requiredStatForNullify(scaled.int) : 0,
    neededLuk: 0, hitRate: 0,
    isNullify: true,
    showDef, showMdef
  };
  const searchWrap = $("bs-search-equip-wrap");
  if (searchWrap) searchWrap.hidden = false;
  const equipResult = $("bs-equip-result");
  if (equipResult) equipResult.innerHTML = "";
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
setupHitMonsterSearch();

["bs-reverse-lv", "bs-reverse-npan", "bs-tenku-floor"].forEach(id => attachCommaInputBehavior(id, 0));

// 振り分けポイント計算入力
["bs-chara-lv", "bs-sp-tenme-count", "bs-pen-count", "bs-altar-count", "bs-tensho-count"].forEach(id => {
  $(id)?.addEventListener("input", () => { updateStatPointDisplay(); saveSimState(); });
  $(id)?.addEventListener("blur",  () => { updateStatPointDisplay(); saveSimState(); });
});

// コスモキューブボタン
document.querySelectorAll(".bs-cosmocube-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.hasCosmoCube = btn.getAttribute("data-val") === "1";
    document.querySelectorAll(".bs-cosmocube-btn").forEach(b => {
      b.setAttribute("aria-pressed", b.getAttribute("data-val") === (state.hasCosmoCube ? "1" : "0") ? "true" : "false");
    });
    updateStatPointDisplay();
    saveSimState();
  });
});

// 振り分けポイントをビルド入力の合計に反映
$("bs-apply-stat-point-btn")?.addEventListener("click", () => {
  const pts = updateStatPointDisplay();
  const el  = document.getElementById("basePointTotal");
  if (el) {
    el.value = String(pts);
    el.dispatchEvent(new Event("input"));
  }
});

// 振り分け上限入力→リアルタイム計算
["bs-sage-drop", "bs-forbidden-book", "bs-tenme-count"].forEach(id => {
  $(id)?.addEventListener("input", () => { updatePointLimitDisplay(); saveSimState(); });
  $(id)?.addEventListener("blur",  () => { updatePointLimitDisplay(); saveSimState(); });
});

// 超越の契約書ボタン
document.querySelectorAll(".bs-contract-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.hasContract = btn.getAttribute("data-val") === "1";
    document.querySelectorAll(".bs-contract-btn").forEach(b => {
      b.setAttribute("aria-pressed", b.getAttribute("data-val") === (state.hasContract ? "1" : "0") ? "true" : "false");
    });
    updatePointLimitDisplay();
    saveSimState();
  });
});

// 初期表示を更新
updatePointLimitDisplay();
updateStatPointDisplay();

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

// 逆算モード切り替え
document.querySelectorAll(".bs-calc-mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.calcMode = btn.getAttribute("data-mode");
    applyModeUI();
    saveSimState();
    // 結果をクリア
    const rr = $("bs-reverse-result"); if (rr) rr.innerHTML = "";
    const sw = $("bs-search-equip-wrap"); if (sw) sw.hidden = true;
    lastReverseResult = null;
  });
});

// 多段数入力 → SPD不足表示
function updateSpdShortage() {
  const hitsEl = $("bs-reverse-hits");
  const noteEl = $("bs-spd-shortage");
  if (!hitsEl || !noteEl) return;
  const targetHits = Math.min(11, Math.max(1, parseInt(hitsEl.value, 10) || 1));
  const neededSpd  = typeof requiredSpdForHits === "function" ? requiredSpdForHits(targetHits) : 0;
  const heroSpd    = Math.round(Number(window.lastFinalTotal?.spd || 0));
  if (targetHits <= 1 || neededSpd === 0) {
    noteEl.textContent = "";
  } else if (heroSpd >= neededSpd) {
    noteEl.textContent = "✅ 達成済み（×" + targetHits + "）";
    noteEl.style.color = "#2a2";
  } else {
    noteEl.textContent = "あと SPD " + (neededSpd - heroSpd).toLocaleString("ja-JP") + " 不足";
    noteEl.style.color = "#d44";
  }
}

$("bs-reverse-hits")?.addEventListener("input", updateSpdShortage);

// 乱数ボタン
document.querySelectorAll(".bs-random-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.useMinRandom = btn.getAttribute("data-random") === "min";
    document.querySelectorAll(".bs-random-btn").forEach(b => {
      b.setAttribute("aria-pressed", b.getAttribute("data-random") === (state.useMinRandom ? "min" : "avg") ? "true" : "false");
    });
    saveSimState();
  });
});

// 逆算タブ：命中確率選択ボタン
document.querySelectorAll(".bs-reverse-hit-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.reverseHitRate = Number(btn.getAttribute("data-rate"));
    document.querySelectorAll(".bs-reverse-hit-btn").forEach(b => {
      b.setAttribute("aria-pressed", b.getAttribute("data-rate") === String(state.reverseHitRate) ? "true" : "false");
    });
    saveSimState();
  });
});

// 素材強化1100一括
$("enhance1100AllBtn")?.addEventListener("click", () => {
  const armorKeys = ["weapon","head","body","hands","feet","shield"];
  armorKeys.forEach(k => {
    const el = document.getElementById("level_" + k);
    if (el) { el.value = "1100"; el.dispatchEvent(new Event("input")); }
  });
  window.statusSimRecalc?.();
});

// 検索欄クリア（×ボタン）
document.querySelectorAll("[data-clear-search]").forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.getAttribute("data-clear-search");
    const equipInput = document.getElementById("equip_search_" + key);
    const petInput   = document.getElementById("pet_search_"   + key);
    if (equipInput) { equipInput.value = ""; equipInput.dispatchEvent(new Event("input")); }
    if (petInput)   { petInput.value   = ""; petInput.dispatchEvent(new Event("input")); }
    const select = document.getElementById("select_" + key);
    if (select) select.value = "";
    window.statusSimRecalc?.();
    saveSimState();
  });
});

// 魔法アイテムALL1000
$("bs-magic-all1000-btn")?.addEventListener("click", () => {
  const ids = ["bs-analysis-book", "bs-analysis-book-advanced", "bs-crystal-count"];
  ids.forEach(id => { const el = $(id); if (el) el.value = "1000"; });
});

// 命中タブ：天空フロア
$("bs-hit-tenku-apply")?.addEventListener("click", () => {
  const floorEl = $("bs-hit-tenku-floor");
  const lvEl    = $("bs-hit-lv");
  if (!floorEl || !lvEl) return;
  const lv = tenkuFloorToLv(floorEl.value.replace(/,/g, ""));
  if (lv === null) { alert("有効なフロア数を入力してください（1以上の整数）"); return; }
  lvEl.value = formatIntString(lv);
});

// 命中確率ボタン
document.querySelectorAll(".bs-hit-rate-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    hitState.rate = Number(btn.getAttribute("data-rate"));
    document.querySelectorAll(".bs-hit-rate-btn").forEach(b => {
      b.setAttribute("aria-pressed", b.getAttribute("data-rate") === String(hitState.rate) ? "true" : "false");
    });
  });
});

// 命中計算ボタン
$("bs-hit-calc-btn")?.addEventListener("click", () => {
  renderHitResult();
});

// 必要luk装備探索ボタン
$("bs-hit-search-btn")?.addEventListener("click", async () => {
  if (!lastHitResult) return;
  const btn = $("bs-hit-search-btn");
  if (btn) btn.textContent = "分析中...";
  await loadEquipItems();
  const simState = window.statusSimCollectState?.() || {};
  const equipState = simState.equip || {};
  const overridePointLimit = updatePointLimitDisplay();
  const ft2 = window.lastFinalTotal || {};
  const finalLuk = Math.round(Number(ft2?.luk || 0));
  const shaker   = Math.max(0, Number(simState?.shaker || 0));
  const baseLuk  = Math.max(0, Number(simState?.base?.luk    || 0));
  const protLuk  = Math.max(0, Number(simState?.protein?.luk || 0));
  const basePlusProteinLuk = baseLuk + protLuk * (1 + shaker * 0.01);
  const effectiveLukMul = basePlusProteinLuk > 0 ? Math.max(1, finalLuk / basePlusProteinLuk) : 1;
  const analysis = analyzeLukNeeded(
    equipState, equipItemsMap,
    lastHitResult.neededLuk, finalLuk,
    simState, effectiveLukMul, overridePointLimit
  );
  renderHitEquipResult(analysis);
  if (btn) btn.textContent = "必要lukの装備を探索";
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

 $("bs-reverse-monster-clear")?.addEventListener("click", () => {
   reverseSearchHandle?.clear();
   const rr = $("bs-reverse-result"); if (rr) rr.innerHTML = "";
   const sw = $("bs-search-equip-wrap"); if (sw) sw.hidden = true;
   lastReverseResult = null;
 });

$("bs-reverse-btn")?.addEventListener("click", () => {
  renderReverseResult();
  saveSimState();
});

$("bs-search-equip-btn")?.addEventListener("click", async () => {
  if (!lastReverseResult) return;
  const btn = $("bs-search-equip-btn");
  if (btn) btn.textContent = "分析中...";
  try {
    await loadEquipItems();

    const simState = window.statusSimCollectState?.() || {};
    const equipState = simState.equip || {};
    const currentFinalTotal = window.lastFinalTotal || {};
    const overridePointLimit = updatePointLimitDisplay();

    // 無効化モード探索
    if (lastReverseResult?.isNullify) {
      const wrapN = $("bs-equip-result");
      if (wrapN) wrapN.innerHTML = "";

      if (lastReverseResult.showDef && lastReverseResult.neededDef > 0) {
        const headerD = document.createElement("div");
        headerD.className = "bs-area-title title-def";
        headerD.textContent = "【物理無効化 DEF " + fmt(lastReverseResult.neededDef) + " 達成のための探索】";
        const effMulD = estimateBasePointMultiplier(simState, "def");
        const analysisD = analyzeGlvNeeded(equipState, equipItemsMap, "def", lastReverseResult.neededDef, currentFinalTotal, simState, effMulD, overridePointLimit);
        renderGlvAnalysis(analysisD, "def", lastReverseResult.neededDef, false, headerD.textContent);
      }

      if (lastReverseResult.showMdef && lastReverseResult.neededMdef > 0) {
        const wrapM = $("bs-equip-result");
        if (wrapM && lastReverseResult.showDef) {
          const divider = document.createElement("hr"); divider.className = "bs-section-divider"; wrapM.appendChild(divider);
          const headerM = document.createElement("div"); headerM.className = "bs-area-title title-mdef";
          headerM.textContent = "【魔法無効化 MDEF " + fmt(lastReverseResult.neededMdef) + " 達成のための探索】";
        }
        const effMulM = estimateBasePointMultiplier(simState, "mdef");
        const analysisM = analyzeGlvNeeded(equipState, equipItemsMap, "mdef", lastReverseResult.neededMdef, currentFinalTotal, simState, effMulM, overridePointLimit);
        renderGlvAnalysis(analysisM, "mdef", lastReverseResult.neededMdef, true, headerM.textContent);
      }
    } else {
       // ① ATK探索（独立）
       if (lastReverseResult.needed > 0) {
         const effectiveMultiplier = estimateBasePointMultiplier(simState, lastReverseResult.stat);
         const analysis = analyzeGlvNeeded(
           equipState, equipItemsMap,
           lastReverseResult.stat, lastReverseResult.needed,
           currentFinalTotal, simState, effectiveMultiplier, overridePointLimit
         );
         renderGlvAnalysis(analysis, lastReverseResult.stat, lastReverseResult.needed);
       }

       // ② 命中LUK探索（独立）
       if (lastReverseResult.neededLuk > 0 && lastReverseResult.hitRate > 0) {
         const hitTitle = "【命中" + lastReverseResult.hitRate + "% (LUK " + fmt(lastReverseResult.neededLuk) + ") を達成するためには】";
         const effMulHit = estimateBasePointMultiplier(simState, "luk");
         const analysisHit = analyzeGlvNeeded(equipState, equipItemsMap, "luk", lastReverseResult.neededLuk, currentFinalTotal, simState, effMulHit, overridePointLimit);
         renderGlvAnalysis(analysisHit, "luk", lastReverseResult.neededLuk, true, hitTitle);
       }

      // ② SPD探索（多段数不足の場合）
      if (lastReverseResult?.spdShortfall > 0 && lastReverseResult?.neededSpd > 0) {
        const wrapSpd = $("bs-equip-result");
        const spdTitle = "【多段×" + ($("bs-reverse-hits")?.value || "?") + " SPD " + fmt(lastReverseResult.neededSpd) + " 達成のための探索】";
        const effMulSpd = estimateBasePointMultiplier(simState, "spd");
        const analysisSpd = analyzeGlvNeeded(equipState, equipItemsMap, "spd", lastReverseResult.neededSpd, currentFinalTotal, simState, effMulSpd, overridePointLimit);
        renderGlvAnalysis(analysisSpd, "spd", lastReverseResult.neededSpd, true, spdTitle);
      }

      // ③ 会心率LUK探索（目標会心率が設定されている場合）
      if (lastReverseResult?.neededLukForCrit > 0) {
        const wrapCrit = $("bs-equip-result");
        const critTitle = "【会心率" + lastReverseResult.targetCritRate + "% LUK " + fmt(lastReverseResult.neededLukForCrit) + " 達成のための探索】";
        const effMulCrit = estimateBasePointMultiplier(simState, "luk");
        const analysisCrit = analyzeGlvNeeded(equipState, equipItemsMap, "luk", lastReverseResult.neededLukForCrit, currentFinalTotal, simState, effMulCrit, overridePointLimit);
        renderGlvAnalysis(analysisCrit, "luk", lastReverseResult.neededLukForCrit, true, critTitle);
      }

      // 全探索完了後にアクセサリーを1回だけ表示
      // 最後に実行された探索のaccSlotsを使用
      {
        const wrapAcc = $("bs-equip-result");
        if (wrapAcc) {
          // 最後の探索結果からaccSlotsを取得して表示
          const lastStat = lastReverseResult?.neededLukForCrit > 0 ? "luk"
            : lastReverseResult?.spdShortfall > 0 ? "spd"
            : lastReverseResult?.neededLuk > 0 ? "luk"
            : (lastReverseResult?.stat || "atk");
          const effMulAcc = estimateBasePointMultiplier(simState, lastStat);
          const analysisAcc = analyzeGlvNeeded(equipState, equipItemsMap, lastStat,
            lastReverseResult?.neededLukForCrit > 0 ? lastReverseResult.neededLukForCrit
            : lastReverseResult?.spdShortfall > 0 ? lastReverseResult.neededSpd
            : lastReverseResult?.neededLuk > 0 ? lastReverseResult.neededLuk
            : lastReverseResult?.needed || 0,
            currentFinalTotal, simState, effMulAcc, overridePointLimit);
          if (analysisAcc?.accSlots) {
            const sep = document.createElement("hr"); sep.className = "bs-section-divider"; wrapAcc.appendChild(sep);
            renderAccTable(wrapAcc, analysisAcc.accSlots, lastStat);
          }
        }
      }

    } // end else (非無効化モード)
  } catch(e) {
    console.error("探索エラー:", e);
    const wrap = $("bs-equip-result");
    if (wrap) wrap.textContent = "エラー: " + (e?.message || String(e));
  } finally {
    if (btn) btn.textContent = "この条件で装備を探索";
  }
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
  const hitResult = $("bs-hit-result");
  if (hitResult) hitResult.innerHTML = "";
  const hitEquipResult = $("bs-hit-equip-result");
  if (hitEquipResult) hitEquipResult.innerHTML = "";
  const hitSearchWrap = $("bs-hit-search-wrap");
  if (hitSearchWrap) hitSearchWrap.hidden = true;
  lastHitResult = null;
});

}); // DOMContentLoaded
