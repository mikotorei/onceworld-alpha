document.addEventListener("DOMContentLoaded", async () => {
const STATS = ["vit", "spd", "atk", "int", "def", "mdef", "luk", "mov"];
const BASE_STATS = ["vit", "spd", "atk", "int", "def", "mdef", "luk"];
const EQUIP_KEYS = ["weapon", "head", "body", "hands", "feet", "shield", "accessory1", "accessory2", "accessory3", "accessory4"];
const ACCESSORY_KEYS = ["accessory1", "accessory2", "accessory3", "accessory4"];
const PET_KEYS = ["pet1", "pet2", "pet3"];
const AUTO_STORAGE_KEY  = "status_sim_inline_v7";
const BUILD_STORAGE_KEY = "status_sim_build_slots_v1";
const SLOT_LABEL = { weapon:"武器", head:"頭", body:"体", hands:"手", feet:"脚", shield:"盾", accessory1:"アクセ1", accessory2:"アクセ2", accessory3:"アクセ3", accessory4:"アクセ4" };

const pathParts = window.location.pathname.split("/tools/")[0];
const base = window.location.origin + pathParts;
const EQUIP_URL      = base + "/db/equipment.json";
const PET_SKILLS_URL = base + "/db/pet-skills.json";
const PET_NAMES_URL  = base + "/pet-names/index.json";

const equipmentMap = new Map();
const petSkillMap  = new Map();
const petNameMap   = new Map();

// ステータス絞り込みフィルタ（複数選択可・OR条件）
const statFilter = new Set(); // 空=全て表示

function isStatFilterActive() { return statFilter.size > 0; }

function matchesStatFilter(stats) {
  if (!isStatFilterActive()) return true;
  return [...statFilter].some(s => stats.has(s));
}

function updateStatFilterButtons() {
  document.querySelectorAll(".stat-filter-btn").forEach(btn => {
    const s = btn.getAttribute("data-stat");
    if (s === "all") {
      btn.setAttribute("aria-pressed", statFilter.size === 0 ? "true" : "false");
    } else {
      btn.setAttribute("aria-pressed", statFilter.has(s) ? "true" : "false");
    }
  });
}
const equipNameMap = new Map();
const equipItemsCacheBySlot = new Map();
let petItemsCache = [];
let lastFinalTotal = null;
let dataReady = false;

function $(id) { return document.getElementById(id); }
function n(v, fb = 0) { const x = Number(v); return Number.isFinite(x) ? x : fb; }
function clamp0(v)     { return Math.max(0, n(v, 0)); }
function clampLv(v)    { return Math.max(0, Math.min(1100, Math.floor(n(v, 0)))); }
function clamp1(v)     { return Math.max(1, n(v, 1)); }
function clampStage(v) { return Math.max(0, Math.min(4, n(v, 0))); }
function clampG(v)     { return Math.max(0, Math.min(300, Math.floor(Number(v) || 0))); }
function floorSafe(x)  { return Math.floor((Number(x) || 0) + 1e-6); }
function floorStats(s) { const o = zeroStats(); STATS.forEach(k => { o[k] = k === "mov" ? (s?.[k]||0) : floorSafe(s?.[k]||0); }); return o; }
function roundSafe(x)  { return Math.round((Number(x) || 0) + 1e-6); }

function fmtSafe(x) {
  const num = Number(x);
  if (!Number.isFinite(num)) return "0";
  if (Number.isInteger(num)) return num.toLocaleString("ja-JP");
  return num.toLocaleString("ja-JP", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function fmtRate(v) {
  const num = Number(v) || 0;
  if (Math.abs(num - Math.round(num)) < 1e-9) return `${Math.round(num)}%`;
  return `${num.toFixed(2).replace(/\.?0+$/, "")}%`;
}
function normalizeJP(s) {
  return String(s || "").trim().toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
function zeroStats() { return { vit:0, spd:0, atk:0, int:0, def:0, mdef:0, luk:0, mov:0 }; }
function addStats(a, b) { const o = zeroStats(); STATS.forEach(k => { o[k] = (a?.[k]||0)+(b?.[k]||0); }); return o; }
function mulStats(a, m) { const o = zeroStats(); STATS.forEach(k => { o[k] = (a?.[k]||0)*m; }); return o; }
function applyRate(s, r) { const o = zeroStats(); STATS.forEach(k => { o[k] = (s?.[k]||0)*(1+(r?.[k]||0)/100); }); return o; }
function roundStats(s) { const o = zeroStats(); STATS.forEach(k => { o[k] = roundSafe(s?.[k]||0); }); return o; }
function normalizeStatKey(k) { return String(k||"").toLowerCase() === "luck" ? "luk" : String(k||"").toLowerCase(); }
function getStatLabel(k) { return {vit:"VIT",spd:"SPD",atk:"ATK",int:"INT",def:"DEF",mdef:"MDEF",luk:"LUK",mov:"MOV"}[k] || String(k).toUpperCase(); }

function buildTable() {
  const tbody = $("statsTbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  STATS.forEach(stat => {
    const tr = document.createElement("tr");
    tr.dataset.stat = stat;
    const td1 = document.createElement("td"); td1.textContent = stat;
    const td2 = document.createElement("td"); td2.className = "num"; td2.dataset.col = "base";
    const td3 = document.createElement("td"); td3.className = "num"; td3.dataset.col = "equip";
    const td4 = document.createElement("td"); td4.className = "num"; td4.dataset.col = "total";
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
    tbody.appendChild(tr);
  });
}

function renderTable(baseStats, equipStats, totalStats) {
  const tbody = $("statsTbody");
  if (!tbody) return;
  Array.from(tbody.querySelectorAll("tr")).forEach(tr => {
    const stat = tr.dataset.stat;
    tr.querySelector('[data-col="base"]').textContent  = fmtSafe(floorSafe(baseStats?.[stat]  || 0));
    tr.querySelector('[data-col="equip"]').textContent = fmtSafe(floorSafe(equipStats?.[stat] || 0));
    tr.querySelector('[data-col="total"]').textContent = fmtSafe(totalStats?.[stat] || 0);
  });
}

function setErr(text) {
  const box = $("errBox");
  if (!box) return;
  const msg = String(text || "").trim();
  box.textContent = msg;
  box.classList.toggle("is-visible", msg.length > 0);
}

function fillSelect(select, items) {
  if (!select) return;
  select.innerHTML = "";
  select.appendChild(new Option("（なし）", ""));
  items.forEach(item => select.appendChild(new Option(item.name, String(item.id))));
}

function scaleEquipBaseAdd(baseAdd, lv) {
  const mul = 1 + clamp0(lv) * 0.1;
  const o = zeroStats();
  STATS.forEach(k => { o[k] = k === "mov" ? Number(baseAdd?.[k]||0) : floorSafe((baseAdd?.[k]||0)*mul); });
  return o;
}
function scaleEquipBaseAddG(baseAdd, glv, canUpgrade) {
  const o = zeroStats();
  if (!canUpgrade) { STATS.forEach(k => { o[k] = Number(baseAdd?.[k]||0); }); return o; }
  const g = clampG(glv);
  STATS.forEach(k => {
    if (k === "mov") { o[k] = Number(baseAdd?.[k]||0); return; }
    const base = Number(baseAdd?.[k]||0);
    if (base === 0) return;
    o[k] = g === 0 ? floorSafe(base*111) : floorSafe(base*111 + (base*25+10000)*g);
  });
  return o;
}
function scaleAccessoryBaseAdd(baseAdd, lv) {
  const mul = 1 + (clamp1(lv)-1) * 0.1;
  const o = zeroStats();
  STATS.forEach(k => { o[k] = (baseAdd?.[k]||0)*mul; });
  return o;
}
function scaleAccessoryBaseRate(baseRate, lv) {
  const mul = 1 + (clamp1(lv)-1) * 0.01;
  const o = zeroStats();
  STATS.forEach(k => { o[k] = (baseRate?.[k]||0)*mul; });
  return o;
}

function buildAccessoryEffectPreview(item, lv) {
  if (!item) return "-";
  const addN  = scaleAccessoryBaseAdd(item.base_add   || {}, lv);
  const rateN = scaleAccessoryBaseRate(item.base_rate || {}, lv);
  const parts = [];
  STATS.forEach(k => {
    const add  = addN[k]  || 0;
    const rate = rateN[k] || 0;
    if (add  !== 0) parts.push(Number.isInteger(add) ? `${getStatLabel(k)}+${add}` : `${getStatLabel(k)}+${Number(add).toFixed(2).replace(/\.?0+$/,"")}`);
    if (rate !== 0) parts.push(`${getStatLabel(k)}+${fmtRate(rate)}`);
  });
  return parts.length ? parts.join(" / ") : "-";
}

function updateAccessoryEffectDisplays() {
  ACCESSORY_KEYS.forEach(key => {
    const box = $("effect_" + key);
    if (!box) return;
    const id = $("select_" + key)?.value || "";
    const lv = clamp1($("level_" + key)?.value);
    if (!id) { box.textContent = "-"; return; }
    box.textContent = buildAccessoryEffectPreview(equipmentMap.get(String(id)), lv);
  });
}

function convertPetStageList(rawStages) {
  const stages = [{ add:{}, mul:{}, final_mul:{} }];
  (Array.isArray(rawStages) ? rawStages : []).forEach(stage => {
    const add={}, mul={}, finalMul={};
    Object.entries(stage?.add||{}).forEach(([k,v])=>{ const key=normalizeStatKey(k); if(STATS.includes(key)) add[key]=Number(v)||0; });
    Object.entries(stage?.mul||{}).forEach(([k,v])=>{ const key=normalizeStatKey(k); if(STATS.includes(key)) mul[key]=Number(v)||0; });
    Object.entries(stage?.final_mul||{}).forEach(([k,v])=>{ const key=normalizeStatKey(k); if(STATS.includes(key)) finalMul[key]=Number(v)||0; });
    stages.push({ add, mul, final_mul: finalMul });
  });
  return stages;
}

function sumPetUpToStage(id, stageValue) {
  const outAdd=zeroStats(), outMul=zeroStats(), outFinal=zeroStats();
  const stage  = clampStage(stageValue);
  const stages = petSkillMap.get(String(id)) || [];
  for (let i=1; i<=stage; i++) {
    const s = stages[i] || {};
    STATS.forEach(k => {
      outAdd[k]   += Number(s.add?.[k]       || 0);
      outMul[k]   += Number(s.mul?.[k]       || 0);
      outFinal[k] += Number(s.final_mul?.[k] || 0);
    });
  }
  return { add: outAdd, mul: outMul, final: outFinal };
}

function getArmorSetSeries(equipState) {
  const keys = ["head","body","hands","feet","shield"];
  let series = null;
  for (const key of keys) {
    const picked = equipState[key];
    if (!picked?.id) return "";
    const item = equipmentMap.get(String(picked.id));
    if (!item) return "";
    const s = String(item.series||"").trim();
    if (!s) return "";
    if (series === null) series = s;
    if (series !== s) return "";
  }
  return series || "";
}

function applyArmorSetBonus(sumStats, enabled) {
  if (!enabled) return { ...sumStats };
  const o = zeroStats();
  STATS.forEach(k => { o[k] = k==="mov" ? sumStats?.[k]||0 : floorSafe((sumStats?.[k]||0)*1.1); });
  return o;
}


// シリーズ別防具5部位マッピング（5部位完備のもの）
const SERIES_ARMOR_MAP = {
  demon:    { head:"demon_helm",      body:"demon_armor",   hands:"demon_gauntlets", feet:"demon_shoes",    shield:"demon_shield"    },
  dragon:   { head:"dragon_head",     body:"dragon_armor",  hands:"dragon_bracer",   feet:"dragon_leg",     shield:"dragon_shield"   },
  inferno:  { head:"inferno_helm",    body:"inferno_armor", hands:"inferno_arm",     feet:"inferno_boots",  shield:"inferno_shield"  },
  leather:  { head:"leather_cap",     body:"leather_clothes",hands:"leather_gloves", feet:"leather_shoes",  shield:"leather_shield"  },
  mage:     { head:"mage_hood",       body:"mage_robe",     hands:"mage_gauntlet",   feet:"mage_shoes",     shield:"mage_shield"     },
  metal:    { head:"metal_helm",      body:"iron_armor",    hands:"iron_gauntlets",  feet:"iron_boots",     shield:"iron_shield"     },
  platinum: { head:"platinum_helm",   body:"platinum_armor",hands:"platinum_arm",    feet:"platinum_boots", shield:"platinum_shield" },
  tyrant:   { head:"tyrant_helm",     body:"tyrant_jacket", hands:"tyrant_arm",      feet:"tyrant_shoes",   shield:"tyrant_shield"   },
};

const SERIES_LABEL = {
  demon:"悪魔", dragon:"ドラゴン", inferno:"獄炎", leather:"皮",
  mage:"魔道士", metal:"鉄", platinum:"白金", tyrant:"暴君"
};

function applySeriesArmor(seriesKey) {
  const map = SERIES_ARMOR_MAP[seriesKey];
  if (!map) return;
  const armorSlots = ["head","body","hands","feet","shield"];
  armorSlots.forEach(slot => {
    const id = map[slot];
    if (!id) return;
    const select = $("select_" + slot);
    const lvInput = $("level_" + slot);
    const glvInput = $("glevel_" + slot);
    if (select) select.value = id;
    if (lvInput) lvInput.value = "0";
    if (glvInput) glvInput.value = "0";
    setEquipInputFromSelected(slot, id);
  });
  recalc();
}

function equipSearchId(key)  { return "equip_search_" + key; }
function equipSuggestId(key) { return "equip_suggest_" + key; }
function closeEquipSuggest(key) { const s=$(equipSuggestId(key)); if(!s)return; s.hidden=true; s.innerHTML=""; }
function closeAllEquipSuggests() { EQUIP_KEYS.forEach(k=>closeEquipSuggest(k)); }
function setEquipInputFromSelected(key, id) { const el=$(equipSearchId(key)); if(el) el.value = id?(equipNameMap.get(String(id))||""):""; }

function selectEquipById(key, id) {
  const select = $("select_" + key);
  if (!select) return;
  select.value = String(id||"");
  setEquipInputFromSelected(key, id);
  closeEquipSuggest(key);
  updateAccessoryMaxLvBtn(key);
  // アクセサリー変更時はレベルを1に初期化
  if (key.startsWith("accessory")) {
    const lvInput = $("level_" + key);
    if (lvInput) lvInput.value = "1";
  }
  // no_enhance装備の場合、素材強化・G強化入力を無効化
  const item = id ? equipmentMap.get(String(id)) : null;
  const lvInput  = $("level_"  + key);
  const glvInput = $("glevel_" + key);
  if (lvInput && glvInput) {
    const noEnhance = !!(item?.no_enhance);
    lvInput.disabled  = noEnhance;
    glvInput.disabled = noEnhance;
    if (noEnhance) {
      lvInput.value  = "0";
      glvInput.value = "0";
    }
  }
  recalc();
}

function updateAccessoryMaxLvBtn(key) {
  if (!key.startsWith("accessory")) return;
  const btn = $("maxlv_btn_" + key);
  if (!btn) return;
  const id   = $("select_" + key)?.value || "";
  const item = id ? equipmentMap.get(String(id)) : null;
  const maxLv = item?.max_level || null;
  if (maxLv && maxLv > 1) {
    btn.textContent = "Lv.max";
    btn.hidden = false;
  } else {
    btn.hidden = true;
  }
}

const STAT_KEYS = ["vit","spd","atk","int","def","mdef","luk"];
function filterEquipItems(key, query) {
  const q = normalizeJP(query);
  const isAcc = key.startsWith("accessory");
  const pool = (equipItemsCacheBySlot.get(key)||[]).filter(i => {
    // statフィルタ（アクセのみ）
    if (isAcc && isStatFilterActive()) {
      if (!matchesStatFilter(i.statSet || new Set())) return false;
    }
    return true;
  });
  if (!q) return pool.slice(0, 200);
  return pool.filter(i => {
    if (normalizeJP(i.name).includes(q)) return true;
    if (isAcc) {
      return STAT_KEYS.some(stat => {
        if (!normalizeJP(stat).includes(q)) return false;
        return (i.base_add?.[stat] || 0) !== 0 || (i.base_rate?.[stat] || 0) !== 0;
      });
    }
    return false;
  }).slice(0, 200);
}

function openEquipSuggest(key, items) {
  const suggest = $(equipSuggestId(key));
  if (!suggest) return;
  suggest.hidden = false;
  suggest.innerHTML = "";
  items.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.name;
    btn.addEventListener("click", () => selectEquipById(key, item.id));
    suggest.appendChild(btn);
  });
}

function wireEquipSearch(key) {
  const input  = $(equipSearchId(key));
  const select = $("select_" + key);
  if (!input || !select) return;
  input.addEventListener("input", () => {
    const q = input.value || "";
    if (q.trim() === "") { select.value=""; closeEquipSuggest(key); recalc(); return; }
    if (select.value && q !== (equipNameMap.get(String(select.value))||"")) { select.value=""; recalc(); }
    const items = filterEquipItems(key, q);
    if (items.length === 0) closeEquipSuggest(key);
    else { closeAllEquipSuggests(); closeAllPetSuggests(); openEquipSuggest(key, items); }
  });
  input.addEventListener("focus", () => {
    const q = input.value || "";
    const items = filterEquipItems(key, q);
    if (items.length === 0) closeEquipSuggest(key);
    else { closeAllEquipSuggests(); closeAllPetSuggests(); openEquipSuggest(key, items); }
  });
}

function petInputId(key)   { return "pet_search_" + key; }
function petSuggestId(key) { return "pet_suggest_" + key; }
function closePetSuggest(key) { const s=$(petSuggestId(key)); if(!s)return; s.hidden=true; s.innerHTML=""; }
function closeAllPetSuggests() { PET_KEYS.forEach(k=>closePetSuggest(k)); }
function setPetInputFromSelected(key, id) { const el=$(petInputId(key)); if(el) el.value = id?(petNameMap.get(String(id))||""):""; }

function selectPetById(key, id) {
  const select = $("select_" + key);
  if (!select) return;
  select.value = String(id||"");
  setPetInputFromSelected(key, id);
  closePetSuggest(key);
  recalc();
}

function filterPetItems(query) {
  const q = normalizeJP(query);
  const pool = petItemsCache.filter(i => {
    if (isStatFilterActive()) {
      if (!matchesStatFilter(i.statSet || new Set())) return false;
    }
    return true;
  });
  if (!q) return pool.slice(0, 200);
  return pool.filter(i =>
    normalizeJP(i.name).includes(q) || normalizeJP(i.search||"").includes(q)
  ).slice(0, 200);
}

function openPetSuggest(key, items) {
  const suggest = $(petSuggestId(key));
  if (!suggest) return;
  suggest.hidden = false;
  suggest.innerHTML = "";
  items.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.name;
    btn.addEventListener("click", () => selectPetById(key, item.id));
    suggest.appendChild(btn);
  });
}

function wirePetSearch(key) {
  const input  = $(petInputId(key));
  const select = $("select_" + key);
  if (!input || !select) return;
  input.addEventListener("input", () => {
    const q = input.value || "";
    if (q.trim() === "") { select.value=""; closePetSuggest(key); recalc(); return; }
    if (select.value && q !== (petNameMap.get(String(select.value))||"")) { select.value=""; recalc(); }
    const items = filterPetItems(q);
    if (items.length === 0) closePetSuggest(key);
    else { closeAllPetSuggests(); closeAllEquipSuggests(); openPetSuggest(key, items); }
  });
  input.addEventListener("focus", () => {
    const q = input.value || "";
    const items = filterPetItems(q);
    if (items.length === 0) closePetSuggest(key);
    else { closeAllPetSuggests(); closeAllEquipSuggests(); openPetSuggest(key, items); }
  });
}

function collectState() {
  // 振り分けポイント（所持）をbs-stat-point-displayから取得
  const statPtEl = $("bs-stat-point-display");
  const statPointTotal = statPtEl
    ? Math.max(0, parseInt(statPtEl.textContent.replace(/,/g, "") || "0", 10) || 0)
    : clamp0($("basePointTotal")?.value);
  return {
    basePointTotal: clamp0($("basePointTotal")?.value),
    statPointTotal,
    base:    Object.fromEntries(BASE_STATS.map(k=>[k, clamp0($("base_"   +k)?.value)])),
    shaker:  clamp0($("shakerCount")?.value),
    protein: Object.fromEntries(BASE_STATS.map(k=>[k, clamp0($("protein_"+k)?.value)])),
    equip: {
      weapon:     { id: $("select_weapon")?.value     ||"", lv: clampLv($("level_weapon")?.value),     glv: clampG($("glevel_weapon")?.value) },
      head:       { id: $("select_head")?.value       ||"", lv: clampLv($("level_head")?.value),       glv: clampG($("glevel_head")?.value) },
      body:       { id: $("select_body")?.value       ||"", lv: clampLv($("level_body")?.value),       glv: clampG($("glevel_body")?.value) },
      hands:      { id: $("select_hands")?.value      ||"", lv: clampLv($("level_hands")?.value),      glv: clampG($("glevel_hands")?.value) },
      feet:       { id: $("select_feet")?.value       ||"", lv: clampLv($("level_feet")?.value),       glv: clampG($("glevel_feet")?.value) },
      shield:     { id: $("select_shield")?.value     ||"", lv: clampLv($("level_shield")?.value),     glv: clampG($("glevel_shield")?.value) },
      accessory1: { id: $("select_accessory1")?.value ||"", lv: clamp1($("level_accessory1")?.value) },
      accessory2: { id: $("select_accessory2")?.value ||"", lv: clamp1($("level_accessory2")?.value) },
      accessory3: { id: $("select_accessory3")?.value ||"", lv: clamp1($("level_accessory3")?.value) },
      accessory4: { id: $("select_accessory4")?.value ||"", lv: clamp1($("level_accessory4")?.value) },
    },
    pets: {
      pet1: { id: $("select_pet1")?.value||"", stage: clampStage($("stage_pet1")?.value) },
      pet2: { id: $("select_pet2")?.value||"", stage: clampStage($("stage_pet2")?.value) },
      pet3: { id: $("select_pet3")?.value||"", stage: clampStage($("stage_pet3")?.value) },
    },
    ssCalc: {
      charaLv:       $("ss-chara-lv")?.value       || "200",
      spTenme:       $("ss-sp-tenme-count")?.value  || "0",
      penCount:      $("ss-pen-count")?.value        || "0",
      altarCount:    $("ss-altar-count")?.value      || "0",
      tenshoCount:   $("ss-tensho-count")?.value     || "0",
      hasCosmoCube:  ssHasCosmoCube,
      sageDrop:      $("ss-sage-drop")?.value        || "0",
      forbiddenBook: $("ss-forbidden-book")?.value   || "0",
      tenmeCount:    $("ss-tenme-count")?.value      || "0",
      hasContract:   ssHasContract,
    }
  };
}

function applyState(saved) {
  if (!saved) return;
  if ($("basePointTotal")) $("basePointTotal").value = String(clamp0(saved.basePointTotal||0));
  BASE_STATS.forEach(k => {
    if ($("base_"   +k)) $("base_"   +k).value = String(clamp0(saved.base?.[k]   ||0));
    if ($("protein_"+k)) $("protein_"+k).value = String(clamp0(saved.protein?.[k]||0));
  });
  if ($("shakerCount")) $("shakerCount").value = String(clamp0(saved.shaker||0));
  Object.entries(saved.equip||{}).forEach(([k,v]) => {
    if ($("select_"+k)) $("select_"+k).value = String(v?.id||"");
    setEquipInputFromSelected(k, v?.id||"");
    updateAccessoryMaxLvBtn(k);
    // no_enhance装備の場合は強化値を無効化
    const item = v?.id ? equipmentMap.get(String(v.id)) : null;
    const lvInput  = $("level_"  + k);
    const glvInput = $("glevel_" + k);
    const noEnhance = !!(item?.no_enhance);
    if (lvInput)  { lvInput.disabled  = noEnhance; lvInput.value  = noEnhance ? "0" : String(k.startsWith("accessory") ? clamp1(v?.lv||1) : clampLv(v?.lv||0)); }
    if (glvInput) { glvInput.disabled = noEnhance; glvInput.value = noEnhance ? "0" : String(clampG(v?.glv||0)); }
  });
  Object.entries(saved.pets||{}).forEach(([k,v]) => {
    if ($("select_"+k)) $("select_"+k).value = String(v?.id||"");
    if ($("stage_" +k)) $("stage_" +k).value = String(clampStage(v?.stage||0));
    setPetInputFromSelected(k, v?.id||"");
  });
}

function saveAutoState(state) { localStorage.setItem(AUTO_STORAGE_KEY,  JSON.stringify(state)); }
function loadAutoState()       { try { return JSON.parse(localStorage.getItem(AUTO_STORAGE_KEY)||"{}"); } catch { return {}; } }
function clearAutoState()      { localStorage.removeItem(AUTO_STORAGE_KEY); }
function loadBuildSlots()      { try { return JSON.parse(localStorage.getItem(BUILD_STORAGE_KEY)||"{}"); } catch { return {}; } }
function saveBuildSlots(data)  { localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify(data)); }

function refreshBuildSelect() {
  const select = $("buildSlotSelect");
  if (!select) return;
  const builds = loadBuildSlots();
  const names  = Object.keys(builds).sort((a,b)=>a.localeCompare(b,"ja"));
  select.innerHTML = "";
  select.appendChild(new Option("（未選択）",""));
  names.forEach(name => select.appendChild(new Option(name, name)));
}

function renderBuildPreview(name) {
  const box = $("buildPreview");
  if (!box) return;
  if (!name) { box.hidden=true; box.innerHTML=""; return; }
  const builds = loadBuildSlots();
  const state  = builds[name];
  if (!state)  { box.hidden=true; box.innerHTML=""; return; }
  const equipLines = EQUIP_KEYS.map(k => {
    const id  = state.equip?.[k]?.id||"";
    const lv  = state.equip?.[k]?.lv ?? (k.startsWith("accessory")?1:0);
    const label = id?(equipNameMap.get(String(id))||"ID:"+id):"（なし）";
    return (SLOT_LABEL[k]||k) + "：" + label + (id?"  +"+ lv:"");
  }).join("\n");
  const petLines = PET_KEYS.map((k,i) => {
    const id    = state.pets?.[k]?.id||"";
    const stage = state.pets?.[k]?.stage??0;
    const label = id?(petNameMap.get(String(id))||"ID:"+id):"（なし）";
    return "ペット"+(i+1)+"："+label+(id?"  段階"+stage:"");
  }).join("\n");
  const dl  = document.createElement("dl");
  const dt1 = document.createElement("dt"); dt1.textContent = "装備";
  const dd1 = document.createElement("dd");
  const pr1 = document.createElement("pre"); pr1.style.cssText="margin:0;font:inherit;white-space:pre-wrap"; pr1.textContent=equipLines;
  dd1.appendChild(pr1);
  const dt2 = document.createElement("dt"); dt2.textContent = "ペット";
  const dd2 = document.createElement("dd");
  const pr2 = document.createElement("pre"); pr2.style.cssText="margin:0;font:inherit;white-space:pre-wrap"; pr2.textContent=petLines;
  dd2.appendChild(pr2);
  dl.appendChild(dt1); dl.appendChild(dd1); dl.appendChild(dt2); dl.appendChild(dd2);
  box.innerHTML=""; box.appendChild(dl); box.hidden=false;
}

function saveNamedBuild() {
  const input = $("buildNameInput");
  if (!input) return;
  const name = String(input.value||"").trim();
  if (!name) { setErr("保存名を入力してください"); return; }
  const builds = loadBuildSlots();
  if (builds[name] && !window.confirm(`「${name}」は既に存在します。上書きしますか？`)) return;
  const snap = collectState();
  snap.finalTotal = lastFinalTotal ? Object.assign({}, lastFinalTotal) : null;
  builds[name] = snap;
  saveBuildSlots(builds);
  refreshBuildSelect();
  $("buildSlotSelect").value = name;
  setErr(`ビルド「${name}」を保存しました`);
  window.setTimeout(() => setErr(""), 1200);
}

function loadNamedBuild() {
  const select = $("buildSlotSelect");
  if (!select) return;
  const name = String(select.value||"").trim();
  if (!name) { setErr("読込するビルドを選択してください"); return; }
  const builds = loadBuildSlots();
  const saved  = builds[name];
  if (!saved)  { setErr("ビルドが見つかりません"); return; }
  if ($("buildNameInput")) $("buildNameInput").value = name;
  if (!dataReady) {
    setErr("データ読み込み中です。しばらくお待ちください。");
    return;
  }
  applyState(saved);
  recalc();
  window.dispatchEvent(new CustomEvent("buildLoaded"));
  setErr(`ビルド「${name}」を読込みました`);
  window.setTimeout(() => setErr(""), 1200);
}

function deleteNamedBuild() {
  const select = $("buildSlotSelect");
  if (!select) return;
  const name = String(select.value||"").trim();
  if (!name)          { setErr("削除するビルドを選択してください"); return; }
  const builds = loadBuildSlots();
  if (!builds[name])  { setErr("ビルドが見つかりません"); return; }
  if (!window.confirm(`「${name}」を削除しますか？`)) return;
  delete builds[name];
  saveBuildSlots(builds);
  refreshBuildSelect();
  renderBuildPreview("");
  setErr(`ビルド「${name}」を削除しました`);
  window.setTimeout(() => setErr(""), 1200);
}

function recalc() {
  const err   = [];
  const state = collectState();
  const baseStats = zeroStats();
  BASE_STATS.forEach(k => { baseStats[k] = state.base[k]||0; });
  baseStats.mov = 6;
  const proteinRaw     = zeroStats();
  BASE_STATS.forEach(k => { proteinRaw[k] = state.protein[k]||0; });
  const proteinApplied  = floorStats(mulStats(proteinRaw, 1 + state.shaker * 0.01));
  const basePlusProtein = addStats(baseStats, proteinApplied);
  let weaponArmorSum = zeroStats();
  ["weapon","head","body","hands","feet","shield"].forEach(key => {
    const picked = state.equip[key];
    if (!picked?.id) return;
    const item = equipmentMap.get(String(picked.id));
    if (!item) return;
    const canUpgrade = !item.no_upgrade;
    const glv = picked.glv ?? 0;
    if (glv > 0 && canUpgrade) weaponArmorSum = addStats(weaponArmorSum, scaleEquipBaseAddG(item.base_add||{}, glv, canUpgrade));
    else                       weaponArmorSum = addStats(weaponArmorSum, scaleEquipBaseAdd(item.base_add||{}, picked.lv));
  });
  const armorSetSeries = getArmorSetSeries(state.equip);
  const sumBeforeSet   = addStats(basePlusProtein, weaponArmorSum);
  const sumAfterSet    = applyArmorSetBonus(sumBeforeSet, !!armorSetSeries);
  let accessoryFlat = zeroStats();
  let accessoryRate = zeroStats();
  ACCESSORY_KEYS.forEach(key => {
    const picked = state.equip[key];
    if (!picked?.id) return;
    const item = equipmentMap.get(String(picked.id));
    if (!item) return;
    accessoryFlat = addStats(accessoryFlat, scaleAccessoryBaseAdd(item.base_add   ||{}, picked.lv));
    accessoryRate = addStats(accessoryRate, scaleAccessoryBaseRate(item.base_rate ||{}, picked.lv));
  });
  let petAdd=zeroStats(), petMul=zeroStats(), petFinal=zeroStats();
  PET_KEYS.forEach(key => {
    const picked = state.pets[key];
    if (!picked?.id || picked.stage <= 0) return;
    const summed = sumPetUpToStage(picked.id, picked.stage);
    petAdd   = addStats(petAdd,   summed.add);
    petMul   = addStats(petMul,   summed.mul);
    petFinal = addStats(petFinal, summed.final);
  });
  const equipDisplay = addStats(addStats(weaponArmorSum, accessoryFlat), petAdd);
  const sumAfterFlat = addStats(sumAfterSet, addStats(accessoryFlat, petAdd));
  const afterRate    = applyRate(sumAfterFlat, addStats(accessoryRate, petMul));
  const finalTotal   = roundStats(applyRate(afterRate, petFinal));
  const used   = BASE_STATS.reduce((s,k)=>s+(state.base[k]||0), 0);
  const remain = state.basePointTotal - used;
  if ($("basePointInfo")) {
    $("basePointInfo").textContent = armorSetSeries
      ? `使用 ${fmtSafe(used)} / 残り ${fmtSafe(remain)}（シリーズ補正ON）`
      : `使用 ${fmtSafe(used)} / 残り ${fmtSafe(remain)}`;
  }
  if (remain < 0) err.push(`ポイント超過：残り ${remain}`);
  updateAccessoryEffectDisplays();
  renderTable(basePlusProtein, equipDisplay, finalTotal);
  setErr(err.join("\n"));
  lastFinalTotal = finalTotal;
  window.lastFinalTotal = finalTotal;
  saveAutoState(state);
}

function setProteinAll1000() {
  if ($("shakerCount")) $("shakerCount").value = "1000";
  BASE_STATS.forEach(k => { if ($("protein_"+k)) $("protein_"+k).value = "1000"; });
  recalc();
}

buildTable();

try {
  const equipRes  = await fetch(EQUIP_URL, { cache:"no-store" });
  if (!equipRes.ok) throw new Error(`HTTP ${equipRes.status}`);
  const equipData = await equipRes.json();
  const items     = Array.isArray(equipData.items) ? equipData.items : [];
  items.forEach(item => { equipmentMap.set(String(item.id), item); equipNameMap.set(String(item.id), item.name); });
  const slotDefs = [
    { key:"weapon",  filter: i => i.category==="weapon" },
    { key:"head",    filter: i => i.category==="armor" && i.slot==="head" },
    { key:"body",    filter: i => i.category==="armor" && i.slot==="body" },
    { key:"hands",   filter: i => i.category==="armor" && i.slot==="hands" },
    { key:"feet",    filter: i => i.category==="armor" && i.slot==="feet" },
    { key:"shield",  filter: i => i.category==="armor" && i.slot==="shield" },
  ];
  const STAT_KEYS_FILTER = ["vit","spd","atk","int","def","mdef","luk"];
  const accessoryItems = items.filter(i =>
    i.category === "accessory" && (
      Object.values(i.base_add  || {}).some(v => v !== 0) ||
      Object.values(i.base_rate || {}).some(v => v !== 0)
    )
  ).map(i => {
    const stats = new Set();
    STAT_KEYS_FILTER.forEach(s => {
      if ((i.base_add?.[s] || 0) !== 0 || (i.base_rate?.[s] || 0) !== 0) stats.add(s);
    });
    return { ...i, statSet: stats };
  });
  slotDefs.forEach(({ key, filter }) => {
    const filtered = items.filter(filter);
    equipItemsCacheBySlot.set(key, filtered.map(i=>({ id:String(i.id), name:i.name })));
    fillSelect($("select_"+key), filtered);
    wireEquipSearch(key);
  });
  ACCESSORY_KEYS.forEach(key => {
    equipItemsCacheBySlot.set(key, accessoryItems.map(i=>({ id:String(i.id), name:i.name, statSet:i.statSet||new Set() })));
    fillSelect($("select_"+key), accessoryItems);
    wireEquipSearch(key);
  });
} catch(e) { console.error("equipment.json 読み込み失敗", e); }

try {
  const namesRes  = await fetch(PET_NAMES_URL, { cache:"no-store" });
  if (!namesRes.ok) throw new Error(`HTTP ${namesRes.status}`);
  const namesData = await namesRes.json();
  const nameItems = Array.isArray(namesData.items) ? namesData.items : [];
  const skillsRes  = await fetch(PET_SKILLS_URL, { cache:"no-store" });
  if (!skillsRes.ok) throw new Error(`HTTP ${skillsRes.status}`);
  const skillsData = await skillsRes.json();
  Object.entries(skillsData||{}).forEach(([id, stageList]) => { petSkillMap.set(String(id), convertPetStageList(stageList)); });
  const validIds = new Set(Object.keys(skillsData||{}));
  const petItems = nameItems
    .filter(item => validIds.has(String(item.id)))
    .map(item => ({ id:String(item.id), name:item.title, search:item.search||item.title }))
    .sort((a,b) => String(a.id).localeCompare(String(b.id),"ja"));
  // ペットのstatSetを付加（pet-skills.jsonから）
  const STAT_KEYS_FILTER = ["vit","spd","atk","int","def","mdef","luk"];
  try {
    const skillsRes = await fetch(PET_SKILLS_URL, { cache: "default" });
    const skillsData = await skillsRes.json();
    petItems.forEach(item => {
      const stages = skillsData[String(item.id)] || [];
      const stats = new Set();
      stages.forEach(stage => {
        ["add","mul","final_mul"].forEach(t => {
          if (stage[t]) Object.keys(stage[t]).forEach(k => { if (STAT_KEYS_FILTER.includes(k)) stats.add(k); });
        });
      });
      item.statSet = stats;
    });
  } catch(e) {}
  petItemsCache = petItems;
  petItems.forEach(item => petNameMap.set(String(item.id), item.name));
  PET_KEYS.forEach(k => { fillSelect($("select_"+k), petItems); wirePetSearch(k); });
} catch(e) { console.error("pet 読み込み失敗", e); }

// fetch完了フラグを立ててから自動復元・初期化完了イベント発火
dataReady = true;
window.statusSimRecalc = recalc;
// ============================================================
// 振り分けポイント・上限計算（ステシミュ用）
// ============================================================
const SS_CALC_KEY = "status_sim_ss_calc_v1";

function saveSsCalc() {
  try {
    localStorage.setItem(SS_CALC_KEY, JSON.stringify({
      charaLv:       $("ss-chara-lv")?.value       || "200",
      spTenme:       $("ss-sp-tenme-count")?.value  || "0",
      penCount:      $("ss-pen-count")?.value        || "0",
      altarCount:    $("ss-altar-count")?.value      || "0",
      tenshoCount:   $("ss-tensho-count")?.value     || "0",
      hasCosmoCube:  ssHasCosmoCube,
      sageDrop:      $("ss-sage-drop")?.value        || "0",
      forbiddenBook: $("ss-forbidden-book")?.value   || "0",
      tenmeCount:    $("ss-tenme-count")?.value      || "0",
      hasContract:   ssHasContract,
    }));
  } catch(e) {}
}

function loadSsCalc() {
  try {
    const raw = localStorage.getItem(SS_CALC_KEY);
    if (!raw) return;
    const sc = JSON.parse(raw);
    if ($("ss-chara-lv"))       $("ss-chara-lv").value        = sc.charaLv       || "200";
    if ($("ss-sp-tenme-count")) $("ss-sp-tenme-count").value  = sc.spTenme       || "0";
    if ($("ss-pen-count"))      $("ss-pen-count").value       = sc.penCount      || "0";
    if ($("ss-altar-count"))    $("ss-altar-count").value     = sc.altarCount    || "0";
    if ($("ss-tensho-count"))   $("ss-tensho-count").value    = sc.tenshoCount   || "0";
    if ($("ss-sage-drop"))      $("ss-sage-drop").value       = sc.sageDrop      || "0";
    if ($("ss-forbidden-book")) $("ss-forbidden-book").value  = sc.forbiddenBook || "0";
    if ($("ss-tenme-count"))    $("ss-tenme-count").value     = sc.tenmeCount    || "0";
    ssHasCosmoCube = !!sc.hasCosmoCube;
    ssHasContract  = !!sc.hasContract;
    document.querySelectorAll(".ss-cosmocube-btn").forEach(b => {
      b.setAttribute("aria-pressed", b.getAttribute("data-val") === (ssHasCosmoCube ? "1" : "0") ? "true" : "false");
    });
    document.querySelectorAll(".ss-contract-btn").forEach(b => {
      b.setAttribute("aria-pressed", b.getAttribute("data-val") === (ssHasContract ? "1" : "0") ? "true" : "false");
    });
  } catch(e) {}
}

function ssTotalStatPoints(lv, tenme, hasCosmoCube, penCount, altarCount, tenshoCount) {
  const maxLv  = Math.min(200, Math.max(1, Math.floor(Number(lv) || 1)));
  const t      = Math.min(30, Math.max(0, Math.floor(Number(tenme) || 0)));
  const pen    = Math.max(0, Math.floor(Number(penCount || 0)));
  const altar  = Math.max(0, Math.floor(Number(altarCount || 0)));
  const tensho = Math.max(0, Math.floor(Number(tenshoCount || 0)));
  let lvPoints = 0;
  for (let l = 2; l <= maxLv; l++) {
    if (l % 10 !== 0) lvPoints += Math.floor(l * 0.1 + 5);
    else              lvPoints += Math.floor(l * 1.1 + 3);
  }
  let tenmeBonus = 0;
  if (t >= 1 && t <= 9)  tenmeBonus = 300 * t * t;
  else if (t >= 10)      tenmeBonus = Math.floor(30000 + 5000 * Math.pow(t - 9, 1.25));
  let base = lvPoints * (1 + t) + tenmeBonus;
  if (hasCosmoCube && t > 0) base += t * 10000;
  return Math.floor(base * (1 + pen * 0.01) * (1 + altar * 0.002)) + tensho * 10000;
}

function ssBasePointLimit(sageDrop, forbiddenBook, hasContract, tenmeCount) {
  const BASE      = 10000;
  const sage      = Math.min(10000, Math.max(0, Math.floor(Number(sageDrop || 0)))) * 10;
  const forbidden = Math.min(80000, Math.max(0, Math.floor(Number(forbiddenBook || 0)))) * 80;
  const contract  = hasContract ? 900000 : 0;
  const tenme     = Math.max(0, Math.floor(Number(tenmeCount || 0)));
  const tenmeBonus = tenme >= 11 ? (tenme - 10) * 1000000 : 0;
  return BASE + sage + forbidden + contract + tenmeBonus;
}

let ssHasCosmoCube = false;
let ssHasContract  = false;

function ssUpdateStatPointDisplay() {
  const lv          = Math.max(1, Math.min(200, parseInt($("ss-chara-lv")?.value || "200", 10) || 200));
  const tenme       = Math.max(0, Math.min(30, parseInt($("ss-sp-tenme-count")?.value || "0", 10) || 0));
  const penCount    = Math.max(0, parseInt($("ss-pen-count")?.value || "0", 10) || 0);
  const altarCount  = Math.max(0, parseInt($("ss-altar-count")?.value || "0", 10) || 0);
  const tenshoCount = Math.max(0, parseInt($("ss-tensho-count")?.value || "0", 10) || 0);
  const pts = ssTotalStatPoints(lv, tenme, ssHasCosmoCube, penCount, altarCount, tenshoCount);
  const el = $("bs-stat-point-display");
  if (el) el.textContent = pts.toLocaleString("ja-JP");
  saveSsCalc();
}

function ssUpdatePointLimitDisplay() {
  const sageDrop      = Math.max(0, parseInt($("ss-sage-drop")?.value || "0", 10) || 0);
  const forbiddenBook = Math.max(0, parseInt($("ss-forbidden-book")?.value || "0", 10) || 0);
  const tenmeCount    = Math.max(0, parseInt($("ss-tenme-count")?.value || "0", 10) || 0);
  const limit = ssBasePointLimit(sageDrop, forbiddenBook, ssHasContract, tenmeCount);
  const el = $("bs-point-limit-display");
  if (el) el.textContent = limit.toLocaleString("ja-JP");
  saveSsCalc();
}

// 振り分けポイント計算のイベント登録
["ss-chara-lv", "ss-sp-tenme-count", "ss-pen-count", "ss-altar-count", "ss-tensho-count"].forEach(id => {
  $(id)?.addEventListener("input", () => { ssUpdateStatPointDisplay(); saveSsCalc(); });
  $(id)?.addEventListener("blur",  () => { ssUpdateStatPointDisplay(); saveSsCalc(); });
});

document.querySelectorAll(".ss-cosmocube-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    ssHasCosmoCube = btn.getAttribute("data-val") === "1";
    document.querySelectorAll(".ss-cosmocube-btn").forEach(b => {
      b.setAttribute("aria-pressed", b.getAttribute("data-val") === (ssHasCosmoCube ? "1" : "0") ? "true" : "false");
    });
    ssUpdateStatPointDisplay();
  });
});

$("ss-apply-stat-point-btn")?.addEventListener("click", () => {
  const el = $("bs-stat-point-display");
  const pts = el ? parseInt(el.textContent.replace(/,/g, ""), 10) || 0 : 0;
  if ($("basePointTotal")) {
    $("basePointTotal").value = String(pts);
    $("basePointTotal").dispatchEvent(new Event("input"));
  }
});

// 振り分け上限計算のイベント登録
["ss-sage-drop", "ss-forbidden-book", "ss-tenme-count"].forEach(id => {
  $(id)?.addEventListener("input", () => { ssUpdatePointLimitDisplay(); saveSsCalc(); });
  $(id)?.addEventListener("blur",  () => { ssUpdatePointLimitDisplay(); saveSsCalc(); });
});

document.querySelectorAll(".ss-contract-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    ssHasContract = btn.getAttribute("data-val") === "1";
    document.querySelectorAll(".ss-contract-btn").forEach(b => {
      b.setAttribute("aria-pressed", b.getAttribute("data-val") === (ssHasContract ? "1" : "0") ? "true" : "false");
    });
    ssUpdatePointLimitDisplay();
  });
});

// 初期表示（ステシミュページのみ実行）
if ($("ss-chara-lv")) {
  ssUpdateStatPointDisplay();
  ssUpdatePointLimitDisplay();
}

window.statusSimCollectState = collectState;
window.equipmentMapGlobal = equipmentMap;

// ステポイント1pt追加時のfinalTotal増加量（実効倍率）を計算して公開
// stat: "atk" / "int" / "luk" など
window.statusSimGetEffectiveMul = function(stat) {
  const state = collectState();

  // セットボーナス
  const armorSetSeries = getArmorSetSeries(state.equip);
  const setMul = armorSetSeries ? 1.1 : 1.0;

  // アクセサリ乗算合計
  let totalAccRate = 0;
  ACCESSORY_KEYS.forEach(key => {
    const picked = state.equip[key];
    if (!picked?.id) return;
    const item = equipmentMap.get(String(picked.id));
    if (!item) return;
    const s = scaleAccessoryBaseRate(item.base_rate || {}, picked.lv);
    totalAccRate += s?.[stat] || 0;
  });

  // ペット乗算合計（petMul, petFinal）
  let totalPetMul = 0, totalPetFinal = 0;
  PET_KEYS.forEach(key => {
    const picked = state.pets[key];
    if (!picked?.id || picked.stage <= 0) return;
    const summed = sumPetUpToStage(picked.id, picked.stage);
    totalPetMul   += summed.mul?.[stat]   || 0;
    totalPetFinal += summed.final?.[stat] || 0;
  });

  // 実効倍率 = setMul × (1 + accRate/100 + petMul/100) × (1 + petFinal/100)
  const mul = setMul
    * (1 + (totalAccRate + totalPetMul) / 100)
    * (1 + totalPetFinal / 100);

  return Math.max(1, mul);
};
refreshBuildSelect();
applyState(loadAutoState());
// 振り分けポイント計算セクションの復元
if ($("ss-chara-lv")) {
  loadSsCalc();
  ssUpdateStatPointDisplay();
  ssUpdatePointLimitDisplay();
}
recalc();
// 初期状態でmaxLvボタンを更新
["accessory1","accessory2","accessory3","accessory4"].forEach(k => updateAccessoryMaxLvBtn(k));
window.dispatchEvent(new CustomEvent("statusSimReady"));

// アクセサリ maxLv ボタン
["accessory1","accessory2","accessory3","accessory4"].forEach(key => {
  const btn = $("maxlv_btn_" + key);
  if (!btn) return;
  btn.addEventListener("click", () => {
    const id   = $("select_" + key)?.value || "";
    const item = id ? equipmentMap.get(String(id)) : null;
    const maxLv = item?.max_level || null;
    if (!maxLv) return;
    const lvInput = $("level_" + key);
    if (lvInput) {
      lvInput.value = String(maxLv);
      lvInput.dispatchEvent(new Event("input"));
    }
    recalc();
  });
});

document.querySelectorAll("input[type=number], select:not([hidden])").forEach(el => {
  ["input","change"].forEach(ev => {
    el.addEventListener(ev, () => {
      if (el.type==="number" && el.max!=="" && el.value!=="") {
        const max=Number(el.max), val=Number(el.value);
        if (Number.isFinite(val) && Number.isFinite(max) && val>max) el.value=String(max);
      }
      recalc();
    });
  });
});

document.addEventListener("click", e => {
  let inside = false;
  EQUIP_KEYS.forEach(key => {
    const input=$(equipSearchId(key)), suggest=$(equipSuggestId(key));
    if (e.target===input || (suggest&&suggest.contains(e.target))) inside=true;
  });
  PET_KEYS.forEach(key => {
    const input=$(petInputId(key)), suggest=$(petSuggestId(key));
    if (e.target===input || (suggest&&suggest.contains(e.target))) inside=true;
  });
  if (!inside) { closeAllEquipSuggests(); closeAllPetSuggests(); }
});

// シリーズ一括選択ボタン
document.querySelectorAll("[data-series]").forEach(btn => {
  btn.addEventListener("click", () => {
    applySeriesArmor(btn.getAttribute("data-series"));
  });
});

// 振り分けmax ボタン
document.querySelectorAll(".base-max-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const stat = btn.getAttribute("data-stat");
    const BASE_STATS_ALL = ["vit","spd","atk","int","def","mdef","luk"];
    // 振り分け可能ポイント（bs-stat-point-display）
    const statPtEl = $("bs-stat-point-display");
    const ownedPt = statPtEl && statPtEl.textContent.trim() !== ""
      ? Math.max(0, parseInt(statPtEl.textContent.replace(/,/g, ""), 10) || 0)
      : Math.max(0, parseInt($("basePointTotal")?.value || "0", 10) || 0);
    // 振り分け上限（bs-point-limit-display）
    const limitEl = $("bs-point-limit-display");
    const upperLimit = limitEl
      ? Math.max(0, parseInt(limitEl.textContent.replace(/,/g, "") || "0", 10) || 0)
      : 0;
    // 他ステータスの使用済みポイント
    const usedOther = BASE_STATS_ALL
      .filter(k => k !== stat)
      .reduce((s, k) => s + Math.max(0, parseInt($("base_" + k)?.value || "0", 10) || 0), 0);
    // 残りポイント
    const remaining = Math.max(0, ownedPt - usedOther);
    // 引いた量 = min(上限, 残りポイント)
    const val = Math.min(upperLimit, remaining);
    const el = $("base_" + stat);
    if (el) {
      el.value = String(val);
      el.dispatchEvent(new Event("input"));
    }
    recalc();
  });
});

// ステータス絞り込みボタン
document.querySelectorAll(".stat-filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const s = btn.getAttribute("data-stat");
    if (s === "all") {
      statFilter.clear();
    } else {
      if (statFilter.has(s)) statFilter.delete(s);
      else statFilter.add(s);
    }
    updateStatFilterButtons();
    // 開いているサジェストを全て閉じる（次回foucusで再フィルタ）
    closeAllEquipSuggests();
    closeAllPetSuggests();
  });
});

// 素材強化1100一括
$("enhance1100AllBtn")?.addEventListener("click", () => {
  const armorKeys = ["weapon","head","body","hands","feet","shield"];
  armorKeys.forEach(k => {
    const el = $("level_" + k);
    if (!el) return;
    const selectEl = $("select_" + k);
    const selectedId = selectEl ? selectEl.value : "";
    const item = selectedId ? equipmentMap.get(String(selectedId)) : null;
    if (item?.no_enhance) return;
    el.value = "1100";
    el.dispatchEvent(new Event("input"));
  });
  recalc();
});

// 検索欄クリアボタン（×）
document.querySelectorAll("[data-clear-search]").forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.getAttribute("data-clear-search");
    const input = $(equipSearchId(key)) || $(petInputId(key));
    if (input) { input.value = ""; input.dispatchEvent(new Event("input")); }
    const select = $("select_" + key);
    if (select) { select.value = ""; }
    closeEquipSuggest(key);
    closePetSuggest(key);
    recalc();
  });
});

if ($("recalcBtn"))         $("recalcBtn").addEventListener("click", recalc);
if ($("proteinAll1000Btn")) $("proteinAll1000Btn").addEventListener("click", setProteinAll1000);
if ($("saveBuildBtn"))      $("saveBuildBtn").addEventListener("click", saveNamedBuild);
if ($("loadBuildBtn"))      $("loadBuildBtn").addEventListener("click", loadNamedBuild);
if ($("deleteBuildBtn"))    $("deleteBuildBtn").addEventListener("click", deleteNamedBuild);
if ($("buildSlotSelect"))   $("buildSlotSelect").addEventListener("change", () => renderBuildPreview($("buildSlotSelect").value||""));
if ($("resetBtn")) {
  $("resetBtn").addEventListener("click", () => {
    if ($("basePointTotal")) $("basePointTotal").value="0";
    BASE_STATS.forEach(k => {
      if ($("base_"+k)) $("base_"+k).value="0";
    });
    recalc();
  });
}
if ($("clearSaveBtn")) {
  $("clearSaveBtn").addEventListener("click", () => {
    clearAutoState();
    setErr("自動保存をクリアしました");
    window.setTimeout(() => setErr(""), 1000);
  });
}

});
