// ============================================================
// calc-logic.js  ゲーム計算ロジック（DOM非依存）
// ============================================================

// 効果素材の所持上限を返す。パンドラの箱の所持状態を自動で加味する
// pandora.js / game-data.js が未読み込みでも fallback で動く
function materialCap(materialId, fallback) {
  const fb = (fallback === undefined || fallback === null) ? 1000 : fallback;
  if (typeof OWPandora !== "undefined" && typeof OWPandora.materialCap === "function") {
    return OWPandora.materialCap(materialId, fb);
  }
  if (typeof getMaterialMax === "function") {
    const max = getMaterialMax(materialId, false);
    if (max !== null && max !== undefined) return max;
  }
  return fb;
}

// --- 装備の強化上限 ---
// 上限の定義は game-data.js の LIMITS。所持数はパンドラを加味してクランプする
function equipMaterialCounts() {
  const cap = materialCap("forbidden_lock", 1000);
  const el = forbiddenLockInput();
  const raw = el ? Math.floor(Number(String(el.value ?? "").replace(/,/g, "")) || 0) : 0;
  return { forbidden_lock: Math.max(0, Math.min(cap, raw)) };
}

// 禁域のロックの入力欄。material-ui.js が data-material="forbidden_lock" の
// 行を生成し、その中に入力欄を置く。ページに無ければ null
function forbiddenLockInput(root) {
  if (typeof document === "undefined") return null;
  const r = root || document;
  return r.querySelector('[data-material="forbidden_lock"] input');
}

// 装備の通常強化の上限（既定1100 + 禁域のロック所持数）
function getEquipEnhanceMax() {
  if (typeof getLimit !== "function") return 1100;
  const v = getLimit("equipEnhance", equipMaterialCounts());
  return (v === null || v === undefined) ? 1100 : v;
}

// 装備のG強化の上限（素材による変動なし）
function getEquipGLevelMax() {
  if (typeof getLimit !== "function") return 300;
  const v = getLimit("equipGLevel");
  return (v === null || v === undefined) ? 300 : v;
}

// 通常強化を上限まで行ったときのステータス倍率。
// 通常強化の表示・計算にのみ使う（上限が伸びれば一緒に伸びる）
function getEquipMaxEnhanceMultiplier() {
  return 1 + getEquipEnhanceMax() * 0.1;
}

// G強化の解禁しきい値。強化上限が伸びても +1100 のまま連動しない
const EQUIP_G_UNLOCK_LV = 1100;

// G強化の基準値となるステータス倍率。1 + 1100 × 0.1 の畳み込みで、
// 強化上限が伸びても +1100 固定のまま連動しない
const EQUIP_G_BASE_MULTIPLIER = 111;

// HTML側の入力欄・ラベルを現在の上限に合わせる。
//   data-equip-limit="enhance" 通常強化の入力欄
//   data-equip-limit="glevel"  G強化の入力欄
//   data-equip-limit-label="all"  「武器・防具すべて+N」ボタン
//   data-equip-limit-label="plus" 装備DBの「+N」タブ
// 上限を超えている値はパンドラと同じ方式で切り詰める。戻り値は切り詰めた欄の数
function applyEquipLimits(root) {
  if (typeof document === "undefined") return 0;
  const r = root || document;
  const lvMax = getEquipEnhanceMax();
  const gMax  = getEquipGLevelMax();
  let trimmed = 0;

  r.querySelectorAll("[data-equip-limit]").forEach(el => {
    const max = (el.getAttribute("data-equip-limit") === "glevel") ? gMax : lvMax;
    el.max = String(max);
    const cur = Math.floor(Number(String(el.value ?? "").replace(/,/g, "")) || 0);
    if (cur > max) {
      el.value = String(max);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      trimmed++;
    }
  });

  r.querySelectorAll("[data-equip-limit-label]").forEach(el => {
    el.textContent = (el.getAttribute("data-equip-limit-label") === "all")
      ? "武器・防具すべて+" + lvMax
      : "+" + lvMax;
  });

  return trimmed;
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    applyEquipLimits(document);
    // 禁域のロックを増減したら強化値の上限を追随させる。
    // 再計算は各ツール側の入力リスナーが行う
    const lock = forbiddenLockInput();
    if (lock) {
      ["input", "change"].forEach(ev =>
        lock.addEventListener(ev, () => applyEquipLimits(document)));
    }
  });
}

// パンドラの箱を外すと禁域のロックの所持数も切り詰められるため、
// material-ui.js が入力値を直した後に強化値の上限も引き直す
if (typeof OWPandora !== "undefined" && typeof OWPandora.onChange === "function") {
  OWPandora.onChange(() => applyEquipLimits(document));
}

// 0以上・上限以下の整数に丸める
function clampCount(v, max) {
  const n = Math.floor(Number(v) || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

// --- 倍率型素材 ---
// 適用先の宣言は game-data.js の MATERIALS.apply。
// ここでは所持上限（パンドラ加味）で切り詰めてから getMultiplier に渡す

// MATERIALS の ui.slots に書かれた入力欄から所持数を読む。
// ページ上に無ければ0
function readMaterialCount(material) {
  if (typeof document === "undefined") return 0;
  const slots = (material.ui && Array.isArray(material.ui.slots)) ? material.ui.slots : [];
  for (const slot of slots) {
    const el = document.getElementById(slot.inputId);
    if (el) return Math.floor(Number(String(el.value ?? "").replace(/,/g, "")) || 0);
  }
  return 0;
}

// target に紐づく素材の所持数をそろえる。
// provided に入っている素材はそのまま使い、DOMは引かない
function collectMaterialCounts(target, provided) {
  const counts = Object.assign({}, provided || {});
  if (typeof getMaterialsFor !== "function") return counts;
  getMaterialsFor(target).forEach(m => {
    if (Object.prototype.hasOwnProperty.call(counts, m.id)) return;
    counts[m.id] = readMaterialCount(m);
  });
  return counts;
}

// target に紐づく倍率型素材の倍率。各素材は現在の所持上限で切り詰める
function materialMultiplier(target, counts) {
  if (typeof getMultiplier !== "function" || typeof getMaterialsFor !== "function") return 1;
  const src = counts || {};
  const clamped = {};
  getMaterialsFor(target).forEach(m => {
    clamped[m.id] = clampCount(src[m.id], materialCap(m.id, m.baseMax));
  });
  return getMultiplier(target, clamped);
}

// 正規化テーブルは game-data.js の ELEMENT_ALIASES
function normalizeElement(value) {
  const raw = (value ?? "").toString().trim().toLowerCase();
  return ELEMENT_ALIASES[raw] || raw;
}

function hitsFromSpd(spd) {
  const s = Math.floor(Number(spd));
  if (!Number.isFinite(s)) return 1;
  if (s < 3000)       return 1;
  if (s < 9000)       return 2;
  if (s < 27000)      return 3;
  if (s < 81000)      return 4;
  if (s < 243000)     return 5;
  if (s < 729000)     return 6;
  if (s < 2187000)    return 7;
  if (s < 6561000)    return 8;
  if (s < 19683000)   return 9;
  if (s < 59049000)   return 10;
  return 11;
}


// 多段数から必要SPDを返す
function requiredSpdForHits(hits) {
  const table = [
    [1, 0], [2, 3000], [3, 9000], [4, 27000], [5, 81000],
    [6, 243000], [7, 729000], [8, 2187000], [9, 6561000],
    [10, 19683000], [11, 59049000]
  ];
  const entry = table.find(([h]) => h === hits);
  return entry ? entry[1] : 0;
}

// モンスターのステータス = floor(基礎値 × (1 + (Lv - 1) × 0.1))
// lv=0 は「基本」表示用の値なのでLv1と同じ等倍として扱う
function scaleStat(base, lv) {
  const l = Math.max(1, Math.floor(Number(lv) || 0));
  return Math.floor(Number(base) * (1 + (l - 1) * 0.1));
}

function buildEnemyScaled(monster, lv, state) {
  const wood = !!state.debuffWood;
  const dark = !!state.debuffDark;

  const defScaled = scaleStat(monster.def, lv);
  const lukScaled = scaleStat(monster.luk, lv);

  return {
    id: monster.id,
    title: monster.title,
    lv,
    vit:  scaleStat(monster.vit, lv),
    spd:  scaleStat(monster.spd, lv),
    atk:  scaleStat(monster.atk, lv),
    int:  scaleStat(monster.int, lv),
    def:  wood ? Math.floor(defScaled / 2) : defScaled,
    mdef: scaleStat(monster.mdef, lv),
    luk:  dark ? Math.floor(lukScaled / 2) : lukScaled,
    element: normalizeElement(monster.element),
    level_shortcuts: Array.isArray(monster.level_shortcuts) ? monster.level_shortcuts : []
  };
}

// 相性表は game-data.js の ELEMENT_CHART
function getElementModifier(heroElement, enemyElement) {
  const h = normalizeElement(heroElement);
  const e = normalizeElement(enemyElement);

  if (!h || !e) return ELEMENT_CHART.neutral;

  const matches = (pairs) => pairs.some(([atk, def]) => atk === h && def === e);

  if (matches(ELEMENT_CHART.advantagePairs))    return ELEMENT_CHART.advantage;
  if (matches(ELEMENT_CHART.disadvantagePairs)) return ELEMENT_CHART.disadvantage;

  return ELEMENT_CHART.neutral;
}

function getCriticalModifier(godCount) {
  const count = clampCount(godCount, materialCap("god_of_devil_eye", 1000));
  return 1 + 1.50 + count * 0.003;
}

// 会心率
// 自LUK ≤ 敵LUK → 0%, 自LUK = 敵LUK+1 → 10%, 自LUK ≥ 敵LUK×10 → 90%（間は線形補間）
function calcCritRate(heroLuk, enemyLuk) {
  const el = Math.floor(Number(enemyLuk || 0));
  const hl = Math.floor(Number(heroLuk  || 0));
  if (hl <= el) return 0;
  if (hl >= el * 10) return 90;
  return Math.floor(10 + (hl - el - 1) / (el * 10 - el - 1) * 80);
}

// 目標会心率に必要な自LUK（calcCritRate の逆関数）
function requiredLukForCritRate(enemyLuk, targetRate) {
  const el = Math.floor(Number(enemyLuk || 0));
  if (targetRate <= 0) return 0;
  if (el <= 0) return 1;
  const rate = Math.min(90, Math.max(10, targetRate));
  if (rate >= 90) return el * 10;
  return Math.ceil(el + 1 + (rate - 10) / 80 * (el * 10 - el - 1));
}

// 物理ダメージの倍率。count は闘晶立方体の所持数。
// 同じ target を持つ素材が増えたら MATERIALS の定義だけで自動的に加わる
function getTouShouMultiplier(count) {
  return materialMultiplier("physicalDamage",
    collectMaterialCounts("physicalDamage", { battle_crystal_cube: count }));
}

function damageRangeTotal(attack, defense, mdefense, hits, elementModifier, criticalModifier = 1.0, touShouCount = 0) {
  const touShou = getTouShouMultiplier(touShouCount);
  const base = (attack * 1.75 * touShou - (defense + Math.floor(mdefense / 10))) * 4;
  if (base <= 0) return { min: 0, max: 0, base };
  const modifiedBase = base * elementModifier * criticalModifier;
  const min = Math.floor(modifiedBase * 0.9 * hits);
  const max = Math.floor(modifiedBase * 1.1 * hits);
  return { min: Math.max(0, min), max: Math.max(0, max), base: modifiedBase };
}

function formatMinMax(min, max) {
  return `${fmt(min)}～${fmt(max)}`;
}

function oneShotLineRequiredAttack(defense, mdefense, hits, hp, elementModifier, criticalModifier = 1.0, touShouCount = 0) {
  const touShou = getTouShouMultiplier(touShouCount);
  const need = hp / (0.9 * hits * elementModifier * criticalModifier);
  // (ATK × 1.75 × touShou - (DEF + MDEF/10)) × 4 >= need
  // ATK >= (need/4 + DEF + MDEF/10) / (1.75 × touShou)
  const x = (need / 4 + defense + Math.floor(mdefense / 10)) / (1.75 * touShou);
  return Math.max(0, Math.ceil(x));
}

// 死刑囚の身代わり晩餐: 主人公が受けるダメージを1個につき0.09%軽減する
// 所持数の上限は materialCap 経由（通常1000 / パンドラ2000）
// 軽減率が100%を超える場合はダメージ0で底打ちする
function getDamageReductionRate(dinnerCount) {
  const n = clampCount(dinnerCount, materialCap("convict_substitute_dinner", 1000));
  return n * 0.0009;
}

// 軽減後のダメージを返す。0未満にはならない
// 0.0009 の積み重ねによる浮動小数点誤差を避けるため、
// 1万分率（0.09% = 9/10000）の整数演算で計算する
function applyDamageReduction(damage, dinnerCount) {
  const d = Number(damage) || 0;
  if (d <= 0) return 0;
  const n = clampCount(dinnerCount, materialCap("convict_substitute_dinner", 1000));
  const remain = 10000 - n * 9;          // 残存率の1万分率
  if (remain <= 0) return 0;
  return Math.floor(d * remain / 10000);
}

function requiredDefenseForNullify(enemyAttack) {
  const a = Math.floor(Number(enemyAttack));
  if (!Number.isFinite(a)) return 0;
  const x = (a * 7 - 10) / 4;
  return Math.max(0, Math.floor(x) + 1);
}

function clampAnalysisBonus(v) {
  const bookCap = materialCap("analysis_book", 1000);
  const advCap  = materialCap("analysis_of_analysis", 1000);
  const cap     = Math.floor(bookCap * (1 + advCap / 10));
  return Math.min(cap, Math.max(0, Math.floor(Number(v) || 0)));
}

// 倍率は game-data.js の SPELLS
function getSpellMultiplier(spell) {
  const s = getSpell(normalizeElement(spell));
  return s ? s.mult : 1.0;
}

function calcAnalysisBonus(bookCount, advancedBookCount) {
  const book = clampCount(bookCount, materialCap("analysis_book", 1000));
  const adv  = clampCount(advancedBookCount, materialCap("analysis_of_analysis", 1000));
  const value = book * (1 + adv / 10);
  return clampAnalysisBonus(value);
}

// 魔法ダメージの倍率。crystalCount は魔晶立方体の所持数。
// 同じ target を持つ素材が増えたら MATERIALS の定義だけで自動的に加わる
function getCrystalMultiplier(crystalCount) {
  return materialMultiplier("magicDamage",
    collectMaterialCounts("magicDamage", { magic_crystal_cube: crystalCount }));
}

function calcMagicDamageRange(params) {
  const heroInt           = Math.max(0, Math.floor(Number(params.heroInt) || 0));
  const analysisBonus     = calcAnalysisBonus(params.analysisBook, params.analysisBookAdvanced);
  const spellMultiplier   = getSpellMultiplier(params.spell);
  const crystalMultiplier = getCrystalMultiplier(params.crystalCount);
  const enemyMagDef       = Number(params.enemyMagDef) || 0;
  const elementModifier   = getElementModifier(params.heroElement, params.enemyElement);
  const criticalModifier  = 1.0;

  const preDefense   = (heroInt + analysisBonus) * 1.25 * spellMultiplier * crystalMultiplier;
  const afterDefense = preDefense - enemyMagDef;
  const base         = afterDefense * 4;
  const finalBase    = base * elementModifier * criticalModifier;

  if (finalBase <= 0) {
    return { min: 0, max: 0, analysisBonus, spellMultiplier, crystalMultiplier, elementModifier, criticalModifier, enemyMagDef, finalBase: 0 };
  }

  const min = Math.floor(finalBase * 0.9);
  const max = Math.floor(finalBase * 1.1);

  return {
    min: Math.max(0, min),
    max: Math.max(0, max),
    analysisBonus,
    spellMultiplier,
    crystalMultiplier,
    elementModifier,
    criticalModifier,
    enemyMagDef,
    finalBase
  };
}

function calcMagicOneShotRequiredInt(params) {
  const hp                = Math.max(0, Number(params.hp) || 0);
  const analysisBonus     = calcAnalysisBonus(params.analysisBook, params.analysisBookAdvanced);
  const spellMultiplier   = getSpellMultiplier(params.spell);
  const crystalMultiplier = getCrystalMultiplier(params.crystalCount);
  const enemyMagDef       = Number(params.enemyMagDef) || 0;
  const elementModifier   = getElementModifier(params.heroElement, params.enemyElement);
  const criticalModifier  = 1.0;

  const totalModifier = 0.9 * 4 * elementModifier * criticalModifier;
  if (totalModifier <= 0 || spellMultiplier <= 0 || crystalMultiplier <= 0) return 0;

  const neededAfterDefense = hp / totalModifier;
  const neededPreDefense   = neededAfterDefense + enemyMagDef;
  const neededIntPlusBook  = neededPreDefense / (1.25 * spellMultiplier * crystalMultiplier);
  const neededInt          = Math.ceil(neededIntPlusBook - analysisBonus);

  return Math.max(0, neededInt);
}

// ============================================================
// 振り分けポイント計算
// ビルドシミュ（build-sim-ui.js）とステシミュ（status-sim.js）で共用
// ============================================================

function calcTotalStatPoints(lv, tenme, hasCosmoCube, penCount, altarCount, tenshoCount, scrollCount) {
  const maxLv   = Math.min(200, Math.max(1, Math.floor(Number(lv)   || 1)));
  const t       = Math.min(30,  Math.max(0, Math.floor(Number(tenme) || 0)));
  const pen     = clampCount(penCount,    materialCap("johanne_quill",  1000));
  const altar   = clampCount(altarCount,  materialCap("johanne_altar",  1000));
  const tensho  = clampCount(tenshoCount, materialCap("status_crystal", 1000));
  const scroll  = clampCount(scrollCount, materialCap("super_scroll",   1000));

  // ① レベルによる獲得ポイント累積（Lv2からレベルアップでポイント取得）
  let lvPoints = 0;
  for (let l = 2; l <= maxLv; l++) {
    if (l % 10 !== 0) {
      lvPoints += Math.floor(l * 0.1 + 5);
    } else {
      lvPoints += Math.floor(l * 1.1 + 3);
    }
  }

  // ② 転生の極致ボーナス
  let tenmeBonus = 0;
  if (t >= 1 && t <= 9) {
    tenmeBonus = 300 * t * t;
  } else if (t >= 10) {
    tenmeBonus = Math.floor(30000 + 5000 * Math.pow(t - 9, 1.25));
  }

  // ③ 天命輪廻倍率
  let base = lvPoints * (1 + t) + tenmeBonus;

  // ④ コスモキューブ
  if (hasCosmoCube && t > 0) base += t * 10000;

  // ⑤ ヨハネ補正 + ステータス天晶
  return Math.floor((base * (1 + pen * 0.01) * (1 + altar * 0.002) + tensho * 10000) * (1 + scroll * 0.002));
}

function calcBasePointLimit(sageDrop, forbiddenBook, hasContract, tenmeCount) {
  const BASE       = 10000;
  const sage       = clampCount(sageDrop,      materialCap("sage_lost_item", 1000)) * 10;
  const forbidden  = clampCount(forbiddenBook, materialCap("forbidden_book", 1000)) * 80;
  const contract   = hasContract ? 900000 : 0;
  const tenme      = Math.max(0, Math.floor(Number(tenmeCount || 0)));
  const tenmeBonus = tenme >= 11 ? (tenme - 10) * 1000000 : 0;
  return BASE + sage + forbidden + contract + tenmeBonus;
}
