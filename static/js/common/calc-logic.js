// ============================================================
// calc-logic.js  ゲーム計算ロジック（DOM非依存）
// ============================================================

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
  const count = Math.max(0, Math.min(1000, Math.floor(Number(godCount) || 0)));
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

function getTouShouMultiplier(count) {
  const c = Math.min(1000, Math.max(0, Math.floor(Number(count) || 0)));
  return 1 + c * 0.01;
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

function requiredDefenseForNullify(enemyAttack) {
  const a = Math.floor(Number(enemyAttack));
  if (!Number.isFinite(a)) return 0;
  const x = (a * 7 - 10) / 4;
  return Math.max(0, Math.floor(x) + 1);
}

function clampAnalysisBonus(v) {
  return Math.min(101000, Math.max(0, Math.floor(Number(v) || 0)));
}

// 倍率は game-data.js の SPELLS
function getSpellMultiplier(spell) {
  const s = getSpell(normalizeElement(spell));
  return s ? s.mult : 1.0;
}

function calcAnalysisBonus(bookCount, advancedBookCount) {
  const book = Math.max(0, Math.floor(Number(bookCount) || 0));
  const adv  = Math.max(0, Math.floor(Number(advancedBookCount) || 0));
  const value = book * (1 + adv / 10);
  return clampAnalysisBonus(value);
}

function getCrystalMultiplier(crystalCount) {
  const count = Math.max(0, Math.floor(Number(crystalCount) || 0));
  return Math.min(11.0, 1 + count * 0.01);
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
