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
  recalc();
}

function filterEquipItems(key, query) {
  const q = normalizeJP(query);
  if (!q) return [];
  return (equipItemsCacheBySlot.get(key)||[]).filter(i=>normalizeJP(i.name).includes(q)).slice(0,50);
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
    const items = q.trim() === ""
      ? (equipItemsCacheBySlot.get(key) || []).map(i => ({ id: String(i.id), name: i.name })).slice(0, 200)
      : filterEquipItems(key, q);
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
  if (!q) return [];
  return petItemsCache.filter(i=>{
    return normalizeJP(i.name).includes(q) || normalizeJP(i.search||"").includes(q);
  }).slice(0,50);
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
    const items = q.trim() === ""
      ? petItemsCache.slice(0, 200)
      : filterPetItems(q);
    if (items.length === 0) closePetSuggest(key);
    else { closeAllPetSuggests(); closeAllEquipSuggests(); openPetSuggest(key, items); }
  });
}

function collectState() {
  return {
    basePointTotal: clamp0($("basePointTotal")?.value),
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
    if ($("level_" +k)) $("level_" +k).value = String(k.startsWith("accessory") ? clamp1(v?.lv||1) : clampLv(v?.lv||0));
    if ($("glevel_"+k)) $("glevel_"+k).value = String(clampG(v?.glv||0));
    setEquipInputFromSelected(k, v?.id||"");
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
  const accessoryItems = items.filter(i => i.category==="accessory");
  slotDefs.forEach(({ key, filter }) => {
    const filtered = items.filter(filter);
    equipItemsCacheBySlot.set(key, filtered.map(i=>({ id:String(i.id), name:i.name })));
    fillSelect($("select_"+key), filtered);
    wireEquipSearch(key);
  });
  ACCESSORY_KEYS.forEach(key => {
    equipItemsCacheBySlot.set(key, accessoryItems.map(i=>({ id:String(i.id), name:i.name })));
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
  petItemsCache = petItems;
  petItems.forEach(item => petNameMap.set(String(item.id), item.name));
  PET_KEYS.forEach(k => { fillSelect($("select_"+k), petItems); wirePetSearch(k); });
} catch(e) { console.error("pet 読み込み失敗", e); }

// fetch完了フラグを立ててから自動復元・初期化完了イベント発火
dataReady = true;
window.statusSimRecalc = recalc;
window.statusSimCollectState = collectState;
refreshBuildSelect();
applyState(loadAutoState());
recalc();
window.dispatchEvent(new CustomEvent("statusSimReady"));

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

if ($("recalcBtn"))         $("recalcBtn").addEventListener("click", recalc);
if ($("proteinAll1000Btn")) $("proteinAll1000Btn").addEventListener("click", setProteinAll1000);
if ($("saveBuildBtn"))      $("saveBuildBtn").addEventListener("click", saveNamedBuild);
if ($("loadBuildBtn"))      $("loadBuildBtn").addEventListener("click", loadNamedBuild);
if ($("deleteBuildBtn"))    $("deleteBuildBtn").addEventListener("click", deleteNamedBuild);
if ($("buildSlotSelect"))   $("buildSlotSelect").addEventListener("change", () => renderBuildPreview($("buildSlotSelect").value||""));
if ($("resetBtn")) {
  $("resetBtn").addEventListener("click", () => {
    if ($("basePointTotal")) $("basePointTotal").value="0";
    if ($("shakerCount"))    $("shakerCount").value="0";
    BASE_STATS.forEach(k => {
      if ($("base_"   +k)) $("base_"   +k).value="0";
      if ($("protein_"+k)) $("protein_"+k).value="0";
    });
    EQUIP_KEYS.forEach(k => {
      if ($("select_"+k)) $("select_"+k).value="";
      if ($("level_" +k)) $("level_" +k).value=k.startsWith("accessory")?"1":"0";
      if ($("glevel_"+k)) $("glevel_"+k).value="0";
      if ($("effect_"+k)) $("effect_"+k).textContent="-";
      const input=$(equipSearchId(k)); if(input) input.value="";
      closeEquipSuggest(k);
    });
    PET_KEYS.forEach(k => {
      if ($("select_"+k)) $("select_"+k).value="";
      if ($("stage_" +k)) $("stage_" +k).value="0";
      const input=$(petInputId(k)); if(input) input.value="";
      closePetSuggest(k);
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
