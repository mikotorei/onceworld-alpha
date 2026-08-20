// ============================================================
// build-sim-logic.js  ビルドシミュレーター ゲームロジック（DOM非依存）
// calc-logic.js の関数を前提として読み込む
// ============================================================

function calcMonsterHp(monster, lv) {
  // Lv補正は calc-logic.js の scaleStat に統一する
  return scaleStat(monster.vit, lv) * 18 + 100;
}

function calcEnemyPhysDef(defScaled, mdefScaled) {
  return defScaled + mdefScaled * 0.1;
}
function calcEnemyMagDef(defScaled, mdefScaled) {
  return mdefScaled + defScaled * 0.1;
}

function calcPhysicalKillInfo(heroAtk, heroSpd, monster, lv, heroElement, debuffWood, debuffDark, touShouCount = 0, criticalModifier = 1.0) {
  const state = { debuffWood, debuffDark };
  const scaled = buildEnemyScaled(monster, lv, state);
  const physDef = calcEnemyPhysDef(scaled.def, scaled.mdef);
  const hp = calcMonsterHp(monster, lv);
  const hits = hitsFromSpd(heroSpd);
  const elemMod = getElementModifier(heroElement, scaled.element);
  const dmg = damageRangeTotal(heroAtk, physDef, 0, hits, elemMod, criticalModifier, touShouCount);
  const avg = Math.floor((dmg.min + dmg.max) / 2);
  const npan = avg > 0 ? Math.ceil(hp / avg) : null;
  const npanMin = dmg.min > 0 ? Math.ceil(hp / dmg.min) : null;
  const oneShot = oneShotLineRequiredAttack(physDef, 0, hits, hp, elemMod, criticalModifier, touShouCount);
  return { hp, hits, dmgMin: dmg.min, dmgMax: dmg.max, avg, npan, npanMin, oneShot, element: scaled.element };
}

function calcMagicKillInfo(heroInt, analysisBook, analysisBookAdvanced, crystalCount, spell, monster, lv, heroElement, debuffWood) {
  const state = { debuffWood, debuffDark: false };
  const scaled = buildEnemyScaled(monster, lv, state);
  const magDef = calcEnemyMagDef(scaled.def, scaled.mdef);
  const hp = calcMonsterHp(monster, lv);
  const dmg = calcMagicDamageRange({
    heroInt, analysisBook, analysisBookAdvanced, crystalCount,
    spell, enemyMagDef: magDef,
    heroElement, enemyElement: scaled.element
  });
  const avg = Math.floor((dmg.min + dmg.max) / 2);
  const npan    = avg     > 0 ? Math.ceil(hp / avg)     : null;
  const npanMin = dmg.min > 0 ? Math.ceil(hp / dmg.min) : null;
  const oneShot = calcMagicOneShotRequiredInt({
    hp, analysisBook, analysisBookAdvanced, crystalCount,
    spell, enemyMagDef: magDef,
    heroElement, enemyElement: scaled.element
  });
  return { hp, dmgMin: dmg.min, dmgMax: dmg.max, avg, npan, npanMin, oneShot, element: scaled.element };
}

function scanAllMonsters(monsters, heroStats, options) {
  const { attackType, heroElement, spell, debuffWood, debuffDark, npanLimit } = options;
  const results = [];
  monsters.forEach(monster => {
    const shortcuts = Array.isArray(monster.level_shortcuts) && monster.level_shortcuts.length > 0
      ? monster.level_shortcuts : [{ lv: 0, label: "基本" }];
    shortcuts.forEach(sc => {
      const lv = Math.floor(Number(sc?.lv ?? sc ?? 0));
      const label = sc?.label ? String(sc.label) : String(lv);
      let npan = null, oneShot = null;
      if (attackType === "physical") {
        const info = calcPhysicalKillInfo(heroStats.atk, heroStats.spd, monster, lv, heroElement, debuffWood, debuffDark);
        npan = info.npan; oneShot = info.oneShot;
      } else {
        const info = calcMagicKillInfo(heroStats.int, heroStats.analysisBook, heroStats.analysisBookAdvanced, heroStats.crystalCount, spell, monster, lv, heroElement, debuffWood);
        npan = info.npan; oneShot = info.oneShot;
      }
      results.push({ monster, lv, label, npan, oneShot, killable: npan !== null && npan <= (npanLimit || 9999) });
    });
  });
  return results;
}

function reversePhysicalAtk(monster, lv, heroSpd, heroElement, debuffWood, debuffDark, targetNpan, useMinRandom, useAssassinClaw, touShouCount = 0, criticalModifier = 1.0) {
  const state = { debuffWood, debuffDark };
  const scaled = buildEnemyScaled(monster, lv, state);
  // 暗殺者のカギ爪：DEF無視（physDef=0）、ダメージ1/10
  const physDef = useAssassinClaw ? 0 : calcEnemyPhysDef(scaled.def, scaled.mdef);
  const touShou = getTouShouMultiplier(touShouCount);
  const hp = calcMonsterHp(monster, lv);
  const hits = hitsFromSpd(heroSpd);
  const elemMod = getElementModifier(heroElement, scaled.element);
  // 最低乱数の場合は0.9倍で割り戻す
  const randomMod = useMinRandom ? 0.9 : 1.0;
  // 暗殺者のカギ爪：最終ダメージが1/10になるため必要ダメージを10倍で逆算
  const clawMod = useAssassinClaw ? 10 : 1;
  const neededDmg = (hp / targetNpan) * clawMod;
  // (ATK × 1.75 × touShou - physDef) × 4 × elemMod × randomMod × hits = neededDmg
  // ATK = (neededDmg / (4 × elemMod × randomMod × hits) + physDef) / (1.75 × touShou)
  const critMod = Number(criticalModifier) > 0 ? Number(criticalModifier) : 1.0;
  const neededBase = neededDmg / (4 * elemMod * randomMod * hits * critMod);
  return Math.max(0, Math.ceil((neededBase + physDef) / (1.75 * touShou)));
}

function reverseMagicInt(monster, lv, analysisBook, analysisBookAdvanced, crystalCount, spell, heroElement, debuffWood, targetNpan, useMinRandom) {
  const state = { debuffWood, debuffDark: false };
  const scaled = buildEnemyScaled(monster, lv, state);
  const magDef = calcEnemyMagDef(scaled.def, scaled.mdef);
  const hp = calcMonsterHp(monster, lv);
  const elemMod = getElementModifier(heroElement, scaled.element);
  const analysisBonus = calcAnalysisBonus(analysisBook, analysisBookAdvanced);
  const spellMul = getSpellMultiplier(spell);
  const crystalMul = getCrystalMultiplier(crystalCount);
  if (elemMod <= 0 || spellMul <= 0 || crystalMul <= 0) return 0;
  // 最低乱数の場合は0.9で割り戻す
  const randomMod = useMinRandom ? 0.9 : 1.0;
  // 仕様式: ((HP÷回数÷相性÷乱数÷4) + magDef) ÷ (1.25×呪文×魔晶) - 解析書
  const neededBase    = (hp / targetNpan) / (elemMod * randomMod) / 4;
  const neededWithDef = neededBase + magDef;
  return Math.max(0, Math.ceil(neededWithDef / (1.25 * spellMul * crystalMul) - analysisBonus));
}

// ============================================================
// 振り分けポイント計算・振り分け上限計算は common/calc-logic.js の
// calcTotalStatPoints / calcBasePointLimit を使用する
// ============================================================

// ============================================================
// 装備計算ユーティリティ
// ============================================================




// ============================================================
// 会心率計算は common/calc-logic.js の
// calcCritRate / requiredLukForCritRate を使用する
// ============================================================

// ============================================================
// 無効化逆算
// ============================================================

// 敵攻撃無効化に必要なdef/mdef
function requiredStatForNullify(enemyAttack) {
  const a = Math.floor(Number(enemyAttack || 0));
  if (a <= 0) return 0;
  const x = (a * 7 - 10) / 4;
  return Math.max(0, Math.floor(x) + 1);
}

// 現在のdef/mdefで何ダメージ受けるか（min〜max）
function calcReceivedDamage(heroStat, enemyAttack, elementModifier, dinnerCount = 0) {
  const a = Math.floor(Number(enemyAttack || 0));
  const d = Math.floor(Number(heroStat   || 0));
  const em = Number(elementModifier || 1);
  const base = (a * 7) - (d * 4);
  if (base <= 0) return { min: 0, max: 0, nullified: true };
  const modified = base * em;
  // 死刑囚の身代わり晩餐で軽減する
  const min = applyDamageReduction(Math.floor(modified * 0.9), dinnerCount);
  const max = applyDamageReduction(Math.floor(modified * 1.1), dinnerCount);
  return { min, max, nullified: max <= 0 };
}

// ============================================================
// G強化コスト計算
// ============================================================

// 装備のbase_add全ステ合計（mov含む）
function calcEquipStatSum(item) {
  if (!item || !item.base_add) return 0;
  return Object.values(item.base_add).reduce((s, v) => s + Math.max(0, Number(v) || 0), 0);
}

// G強化1回あたりのコスト（G段階に応じて変わる）
// fromGlv: 現在のG段階（0始まり）, toGlv: 強化後のG段階
function calcGCostRange(item, fromGlv, toGlv) {
  const S = calcEquipStatSum(item);
  const baseCost = S * 10000000; // S × 1,000万G
  let total = 0;
  for (let g = fromGlv + 1; g <= toGlv; g++) {
    if (g <= 100)      total += baseCost;
    else if (g <= 200) total += baseCost + 10000000000;   // +100億G
    else               total += baseCost + 50000000000;   // +500億G
  }
  return total;
}

// 複数スロットのG強化コスト合計
function calcTotalGCost(slots) {
  return slots.reduce((sum, s) => {
    if (!s.item || s.addedGlv <= 0) return sum;
    return sum + calcGCostRange(s.item, s.currentGlv, s.neededGlv);
  }, 0);
}

// コスト表示用フォーマット（億G単位）
function fmtGCost(gold) {
  if (gold >= 1000000000000) return (gold / 1000000000000).toFixed(1) + "兆G";
  if (gold >= 100000000)     return Math.floor(gold / 100000000) + "億G";
  if (gold >= 10000)         return Math.floor(gold / 10000) + "万G";
  return gold + "G";
}

function calcWeaponArmorStat(item, stat, lv) {
  if (!item) return 0;
  const base = Number(item.base_add?.[stat] || 0);
  if (base === 0) return 0;
  if (item.no_enhance) return base;
  const useLv = (lv !== undefined) ? lv : getEquipEnhanceMax();
  return Math.floor(base * (1 + useLv * 0.1));
}

function calcWeaponArmorStatG(item, stat, glv) {
  if (!item || item.no_enhance) return calcWeaponArmorStat(item, stat, 0);
  const base = Number(item.base_add?.[stat] || 0);
  if (base === 0) return 0;
  const g = Math.max(0, Math.min(getEquipGLevelMax(), Math.floor(glv)));
  const atG0 = EQUIP_G_BASE_MULTIPLIER;
  if (g === 0) return Math.floor(base * atG0);
  return Math.floor(base * atG0 + (base * 25 + 10000) * g);
}

// 1レベルごとの上昇量は装備ごとに違う。
// base_add_step / base_rate_step があればそれを使う（無ければ既定値）
function calcAccessoryStat(item, stat, lv) {
  if (!item) return { add: 0, rate: 0 };
  const useLv = Math.max(1, Number((lv !== undefined) ? lv : (item.max_level || 1)));
  const step = (v, def) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : def; };
  const add  = Number(item.base_add?.[stat]  || 0) * (1 + (useLv - 1) * step(item.base_add_step,  0.1));
  const rate = Number(item.base_rate?.[stat] || 0) * (1 + (useLv - 1) * step(item.base_rate_step, 0.01));
  return { add, rate };
}

// ============================================================
// 分析メイン：優先順序 ① ステ振り → ② G強化
// ============================================================


// ============================================================
// レンジベースG強化最適化（共通関数）
// armorSlots: 各スロットの情報（canEnhance, perG, currentGlv, item等）
// stat: "atk" / "luk" など
// remainingFinal: finalTotal換算の不足値
// effectiveMul: ステポイント1ptあたりのfinalTotal寄与倍率
// ============================================================

// ============================================================
// 素材強化最適化（共通関数）
// currentLv → 強化上限 までの範囲で stat を補う
// armorSlots: 各スロットの情報
// stat: "atk" / "luk" など
// remainingFinal: finalTotal換算の不足値
// effectiveMul: 実効倍率
// 戻り値: 補填後の残り不足値（finalTotal換算）
// ============================================================
function applyOptimalMatEnhancement(armorSlots, stat, remainingFinal, effectiveMul) {
  const mul = (effectiveMul > 0) ? effectiveMul : 1;
  let remaining = Math.ceil(remainingFinal / mul);
  if (remaining <= 0) return 0;

  const lvMax = getEquipEnhanceMax();

  // 各スロットで「現在lv → 強化上限」で得られるstat増加量と効率を計算
  // 1lv追加でのstat増加 = base_add × 0.1（切り捨て）
  const candidates = [];
  armorSlots.forEach(s => {
    if (!s.item || s.item.no_enhance) return;
    const base = Number(s.item.base_add?.[stat] || 0);
    if (base === 0) return;
    const currentLv = s.currentLv;
    if (currentLv >= lvMax) return; // 既に上限達成済み
    const maxAddableLv = lvMax - currentLv;
    const statPer1Lv   = base * 0.1; // 1lv追加あたりのstat増加（小数のまま）
    const totalStat    = Math.floor(base * (1 + lvMax * 0.1)) - Math.floor(base * (1 + currentLv * 0.1));
    candidates.push({ slot: s, base, currentLv, maxAddableLv, statPer1Lv, totalStat });
  });

  // 効率順（statPer1Lv降順）でソート
  candidates.sort((a, b) => b.statPer1Lv - a.statPer1Lv);

  for (const c of candidates) {
    if (remaining <= 0) break;
    const s = c.slot;
    if (c.totalStat <= remaining) {
      // このスロットを上限まで全部使う
      remaining         -= c.totalStat;
      s.neededLv         = lvMax;
      s.addedLv          = lvMax - c.currentLv;
      s.newLvStatVal     = Math.floor(c.base * (1 + lvMax * 0.1));
    } else {
      // 一部使う: 必要なlv数を逆算
      const neededLv = Math.ceil(remaining / c.statPer1Lv);
      const targetLv = Math.min(lvMax, c.currentLv + neededLv);
      s.neededLv         = targetLv;
      s.addedLv          = targetLv - c.currentLv;
      s.newLvStatVal     = Math.floor(c.base * (1 + targetLv * 0.1));
      remaining          = 0;
    }
    // canEnhanceをtrue（+1100で達成可能）にマーク
    // G解禁は強化上限とは連動せず +1100 固定
    if (s.neededLv >= EQUIP_G_UNLOCK_LV) s.canEnhanceAfterMat = true;
  }

  return remaining * mul; // finalTotal換算で返す
}

function applyOptimalGEnhancement(armorSlots, stat, remainingFinal, effectiveMul) {
  const mul = (effectiveMul > 0) ? effectiveMul : 1;
  let remaining = Math.ceil(remainingFinal / mul);
  if (remaining <= 0) return false;

  const allRanges = [];
  armorSlots.filter(s => s.canEnhance && s.perG > 0).forEach(s => {
    const segments = [
      { from: 0,   to: 100, addCost: 0 },
      { from: 100, to: 200, addCost: 10000000000 },
      { from: 200, to: 300, addCost: 50000000000 },
    ];
    segments.forEach(seg => {
      const from = Math.max(s.currentGlv, seg.from);
      const to   = seg.to;
      if (from >= to) return;
      const statSum  = calcEquipStatSum(s.item);
      const costPerG = statSum * 10000000 + seg.addCost;
      allRanges.push({
        slot: s, from, to,
        costPerStat: costPerG / s.perG,
        totalStat:   (to - from) * s.perG,
      });
    });
  });

  allRanges.sort((a, b) => a.costPerStat - b.costPerStat);

  for (const r of allRanges) {
    if (remaining <= 0) break;
    const s = r.slot;
    if (r.totalStat <= remaining) {
      remaining   -= r.totalStat;
      s.neededGlv  = r.to;
      s.addedGlv   = Math.max(0, r.to - s.currentGlv);
      s.newStatVal = calcWeaponArmorStatG(s.item, stat, r.to);
    } else {
      const neededG = Math.ceil(remaining / s.perG);
      const fromG   = Math.max(s.currentGlv, r.from);
      const toG     = Math.min(getEquipGLevelMax(), fromG + neededG);
      s.neededGlv   = toG;
      s.addedGlv    = Math.max(0, toG - s.currentGlv);
      s.newStatVal  = calcWeaponArmorStatG(s.item, stat, toG);
      remaining     = 0;
    }
  }
  return remaining > 0;
}

function analyzeGlvNeeded(equipState, equipItemsMap, stat, neededTotal, currentFinalTotal, simState, effectiveMultiplier, overridePointLimit) {
  const ARMOR_SLOTS     = slotKeys(ARMOR_SLOTS_DEF);
  const ACCESSORY_SLOTS = slotKeys(ACCESSORY_SLOTS_DEF);
  const SLOT_LABEL      = slotLabelMap(ARMOR_SLOTS_DEF, ACCESSORY_SLOTS_DEF);

  const currentVal = Math.round(Number(currentFinalTotal?.[stat] || 0));
  let shortfall = Math.max(0, neededTotal - currentVal);

  // 各スロットの現状を整理（G強化計算用）
  const armorAnalysis = ARMOR_SLOTS.map(slot => {
    const picked = equipState[slot];
    const item   = picked?.id ? equipItemsMap.get(String(picked.id)) : null;
    const currentLv  = Math.max(0, Math.min(getEquipEnhanceMax(), Math.floor(Number(picked?.lv  || 0))));
    const currentGlv = Math.max(0, Math.min(getEquipGLevelMax(),  Math.floor(Number(picked?.glv || 0))));
    const base = Number(item?.base_add?.[stat] || 0);
    const canEnhance = !!(item && !item.no_enhance && base > 0);

    let currentStatVal = 0;
    if (item) {
      currentStatVal = (currentGlv > 0 && canEnhance)
        ? calcWeaponArmorStatG(item, stat, currentGlv)
        : calcWeaponArmorStat(item, stat, currentLv);
    }

    const maxGStatVal = canEnhance ? calcWeaponArmorStatG(item, stat, getEquipGLevelMax()) : currentStatVal;
    const perG = canEnhance ? (base * 25 + 10000) : 0;

    return {
      slot, label: SLOT_LABEL[slot], item,
      currentLv, currentGlv, base, canEnhance,
      currentStatVal, maxGStatVal, perG,
      neededGlv: currentGlv, addedGlv: 0, newStatVal: currentStatVal,
      neededLv: currentLv, addedLv: 0, newLvStatVal: Math.floor((base || 0) * (1 + currentLv * 0.1))
    };
  });

  if (shortfall <= 0) {
    const accSlots = buildAccAnalysis(ACCESSORY_SLOTS, SLOT_LABEL, equipState, equipItemsMap, stat);
    return { achieved: true, shortfall: 0, slots: armorAnalysis, accSlots, statPointResult: null };
  }

  // ============================================================
  // ① ステ振りで先に補う
  // ============================================================
  const BASE_STATS = ["vit","spd","atk","int","def","mdef","luk"];
  const basePointTotal = overridePointLimit != null
    ? overridePointLimit
    : Math.max(0, Number(simState?.basePointTotal || 0));
  // 振り分け上限は各ステータス独立 → そのステに既に振り分けた分のみ差し引く
  const usedThisStat  = Math.max(0, Number(simState?.base?.[stat] || 0));
  const usedPoints    = BASE_STATS.reduce((s, k) => s + Math.max(0, Number(simState?.base?.[k] || 0)), 0);
  const ownedPts      = Math.max(0, Number(simState?.statPointTotal || 0));
  // このステに使える = min(上限 - 既振り分け, 所持残り)
  const ownedRem      = Math.max(0, ownedPts - usedPoints);
  const freePoints    = Math.min(Math.max(0, basePointTotal - usedThisStat), ownedRem + usedThisStat - usedThisStat);
  // ↑ = min(上限 - usedThisStat, 所持残り)
  const freePointsActual = Math.min(Math.max(0, basePointTotal - usedThisStat), ownedRem);

  let statPointResult = null;
  let remainingAfterStat = shortfall;

  if (effectiveMultiplier > 0 && freePointsActual > 0) {
    // floorStats処理による誤差を考慮して+1で安全マージンを確保
    let neededBaseIncrease = Math.ceil((shortfall + 1) / effectiveMultiplier);
    while (Math.floor(neededBaseIncrease * effectiveMultiplier) < shortfall) neededBaseIncrease++;
    const usedBasePoints     = Math.min(neededBaseIncrease, freePointsActual);
    const actualFinalGain    = Math.floor(usedBasePoints * effectiveMultiplier);

    remainingAfterStat = Math.max(0, shortfall - actualFinalGain);

    // 表示用の残りは「所持ポイント - 全ステ合計使用済み」
    const displayFreePoints = ownedRem;
    statPointResult = {
      neededBaseIncrease,
      usedBasePoints,
      freePoints: displayFreePoints,
      basePointTotal,
      usedPoints,
      achievable: neededBaseIncrease <= freePointsActual,
      partialGain: actualFinalGain
    };
  }

  // ============================================================
  // ② 素材強化で補う（currentLv → +1100）
  // ============================================================
  let remainingAfterMat = remainingAfterStat;
  const effectiveMulForG = (effectiveMultiplier > 0) ? effectiveMultiplier : 1;
  const hasNonMaxLvSlots = armorAnalysis.some(s =>
    s.item && !s.item.no_enhance && Number(s.item.base_add?.[stat] || 0) > 0 && s.currentLv < getEquipEnhanceMax()
  );
  if (hasNonMaxLvSlots && remainingAfterMat > 0) {
    remainingAfterMat = applyOptimalMatEnhancement(armorAnalysis, stat, remainingAfterMat, effectiveMulForG);
  }

  // ③ G強化で残りを補う（+1100達成済みのスロットのみ）
  // 素材強化で1100になったスロットもG強化対象に
  armorAnalysis.forEach(s => { if (s.canEnhanceAfterMat) s.canEnhance = true; });
  const noEnhanceable = armorAnalysis.filter(s => s.canEnhance).length === 0;
  const stillShort    = noEnhanceable
    ? remainingAfterMat > 0
    : applyOptimalGEnhancement(armorAnalysis, stat, remainingAfterMat, effectiveMulForG);
  const accSlots = buildAccAnalysis(ACCESSORY_SLOTS, SLOT_LABEL, equipState, equipItemsMap, stat);
  return { achieved: false, shortfall, stillShort, noEnhanceable, slots: armorAnalysis, accSlots, statPointResult };
}


function buildAccAnalysis(ACCESSORY_SLOTS, SLOT_LABEL, equipState, equipItemsMap, stat) {
  return ACCESSORY_SLOTS.map(slot => {
    const picked = equipState[slot];
    const item   = picked?.id ? equipItemsMap.get(String(picked.id)) : null;
    const currentLv = Math.max(1, Math.floor(Number(picked?.lv || 1)));
    const maxLv     = Math.max(1, Number(item?.max_level || 1));
    const s    = item ? calcAccessoryStat(item, stat, currentLv) : { add: 0, rate: 0 };
    const sMax = item ? calcAccessoryStat(item, stat, maxLv)     : { add: 0, rate: 0 };
    return {
      slot, label: SLOT_LABEL[slot], item,
      currentLv, maxLv,
      currentAdd: s.add || 0, currentRate: s.rate || 0,
      maxAdd: sMax.add || 0,  maxRate: sMax.rate || 0,
      canLevelUp: !!(item && currentLv < maxLv)
    };
  });
}

// ============================================================
// 命中計算ロジック
// ============================================================

// 命中に必要なlukを計算
// rate: 1, 50, 99
// enemyLuk: スケール済み敵luk（buildEnemyScaledのluk）
// 命中率計算（wiki仕様）
// 等倍以上→約99%, 1/2→約50%, 1/3→約5%, 1/4以下→約1%
// 区間ごとに対数線形補間
// 区間1: ratio 0.25〜0.5 → hitRate 1〜50%  (log線形)
// 区間2: ratio 0.5〜1.0  → hitRate 50〜99% (log線形)
const _HIT_A1 = (Math.log(50) - Math.log(1))  / (0.5  - 0.25);
const _HIT_B1 = Math.log(1)  - _HIT_A1 * 0.25;
const _HIT_A2 = (Math.log(99) - Math.log(50)) / (1.0  - 0.5);
const _HIT_B2 = Math.log(50) - _HIT_A2 * 0.5;

function calcHitRateFromRatio(ratio) {
  if (ratio >= 1.0)  return 99;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return Math.min(99, Math.max(1, Math.round(Math.exp(_HIT_A1 * ratio + _HIT_B1))));
  return Math.min(99, Math.max(1, Math.round(Math.exp(_HIT_A2 * ratio + _HIT_B2))));
}

function calcRequiredLukForHitRate(enemyLuk, rate) {
  const luk = Math.floor(Number(enemyLuk || 0));
  if (luk <= 0) return 0;
  if (rate >= 99) return luk;
  if (rate <= 1)  return Math.floor(luk * 0.25);
  // 目標ratioをニュートン法で逆算
  let lo = 0.25, hi = 1.0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (calcHitRateFromRatio(mid) < rate) lo = mid; else hi = mid;
  }
  return Math.ceil((lo + hi) / 2 * luk);
}

function calcHitRateFromLuk(heroLuk, enemyLuk) {
  const el = Math.floor(Number(enemyLuk || 0));
  const hl = Math.floor(Number(heroLuk  || 0));
  if (el <= 0) return 100;
  return calcHitRateFromRatio(hl / el);
}

// luk探索：G強化・ステポイントでlukを補う
// neededLuk: 必要luk
// currentFinalLuk: 現在のfinalTotal.luk
function analyzeLukNeeded(equipState, equipItemsMap, neededLuk, currentFinalLuk, simState, effectiveLukMultiplier, overridePointLimit) {
  const ARMOR_SLOTS     = slotKeys(ARMOR_SLOTS_DEF);
  const ACCESSORY_SLOTS = slotKeys(ACCESSORY_SLOTS_DEF);
  const SLOT_LABEL      = slotLabelMap(ARMOR_SLOTS_DEF, ACCESSORY_SLOTS_DEF);
  const stat = "luk";

  const currentVal = Math.round(Number(currentFinalLuk || 0));
  let shortfall = Math.max(0, neededLuk - currentVal);

  const armorAnalysis = ARMOR_SLOTS.map(slot => {
    const picked = equipState[slot];
    const item   = picked?.id ? equipItemsMap.get(String(picked.id)) : null;
    const currentLv  = Math.max(0, Math.min(getEquipEnhanceMax(), Math.floor(Number(picked?.lv  || 0))));
    const currentGlv = Math.max(0, Math.min(getEquipGLevelMax(),  Math.floor(Number(picked?.glv || 0))));
    const base = Number(item?.base_add?.[stat] || 0);
    const canEnhance = !!(item && !item.no_enhance && base > 0);

    let currentStatVal = 0;
    if (item) {
      currentStatVal = (currentGlv > 0 && canEnhance)
        ? calcWeaponArmorStatG(item, stat, currentGlv)
        : calcWeaponArmorStat(item, stat, currentLv);
    }

    const maxGStatVal = canEnhance ? calcWeaponArmorStatG(item, stat, getEquipGLevelMax()) : currentStatVal;
    const perG = canEnhance ? (base * 25 + 10000) : 0;

    return {
      slot, label: SLOT_LABEL[slot], item,
      currentLv, currentGlv, base, canEnhance,
      currentStatVal, maxGStatVal, perG,
      neededGlv: currentGlv, addedGlv: 0, newStatVal: currentStatVal,
      neededLv: currentLv, addedLv: 0, newLvStatVal: Math.floor((base || 0) * (1 + currentLv * 0.1))
    };
  });

  if (shortfall <= 0) {
    const accSlots = buildAccAnalysis(ACCESSORY_SLOTS, SLOT_LABEL, equipState, equipItemsMap, stat);
    return { achieved: true, shortfall: 0, slots: armorAnalysis, accSlots, statPointResult: null };
  }

  // ① ステポイントで先に補う
  const BASE_STATS = ["vit","spd","atk","int","def","mdef","luk"];
  const basePointTotal = overridePointLimit != null
    ? overridePointLimit
    : Math.max(0, Number(simState?.basePointTotal || 0));
  // lukに既に振り分けた分のみ差し引く（各ステ独立上限）
  const usedLukStat   = Math.max(0, Number(simState?.base?.["luk"] || 0));
  const usedPoints    = BASE_STATS.reduce((s, k) => s + Math.max(0, Number(simState?.base?.[k] || 0)), 0);
  const ownedPtsLuk   = Math.max(0, Number(simState?.statPointTotal || 0));
  const ownedRemLuk   = Math.max(0, ownedPtsLuk - usedPoints);
  const freePoints    = Math.min(Math.max(0, basePointTotal - usedLukStat), ownedRemLuk);

  let statPointResult = null;
  let remainingAfterStat = shortfall;

  if (effectiveLukMultiplier > 0 && freePoints > 0) {
    let neededBaseIncrease = Math.ceil(shortfall / effectiveLukMultiplier);
    while (Math.floor(neededBaseIncrease * effectiveLukMultiplier) < shortfall) neededBaseIncrease++;
    const usedBasePoints     = Math.min(neededBaseIncrease, freePoints);
    const actualFinalGain    = Math.floor(usedBasePoints * effectiveLukMultiplier);
    remainingAfterStat = Math.max(0, shortfall - actualFinalGain);
    const displayFreePoints = ownedRemLuk;
    statPointResult = {
      neededBaseIncrease, usedBasePoints, freePoints: displayFreePoints,
      basePointTotal, usedPoints,
      achievable: neededBaseIncrease <= freePoints,
      partialGain: actualFinalGain
    };
  }

  // ② G強化で残りを補う（レンジベース最適化）
  const stillShort = applyOptimalGEnhancement(armorAnalysis, stat, remainingAfterStat, effectiveLukMultiplier);
  const accSlots = buildAccAnalysis(ACCESSORY_SLOTS, SLOT_LABEL, equipState, equipItemsMap, stat);
  return { achieved: false, shortfall, stillShort, slots: armorAnalysis, accSlots, statPointResult };
}

// ============================================================
// atk・luk 同時探索ロジック（atk優先）
// ============================================================

// atk満足後、残りスロット・ステポイントでlukを補う
function analyzeAtkAndLukNeeded(
  equipState, equipItemsMap,
  neededAtk, neededLuk,
  currentFinalTotal, simState,
  effectiveAtkMultiplier, effectiveLukMultiplier,
  overridePointLimit
) {
  const ARMOR_SLOTS     = slotKeys(ARMOR_SLOTS_DEF);
  const ACCESSORY_SLOTS = slotKeys(ACCESSORY_SLOTS_DEF);
  const SLOT_LABEL      = slotLabelMap(ARMOR_SLOTS_DEF, ACCESSORY_SLOTS_DEF);

  const BASE_STATS = ["vit","spd","atk","int","def","mdef","luk"];
  const basePointTotal = overridePointLimit != null
    ? overridePointLimit
    : Math.max(0, Number(simState?.basePointTotal || 0));
  const usedPoints    = BASE_STATS.reduce((s, k) => s + Math.max(0, Number(simState?.base?.[k] || 0)), 0);
  const ownedPoints   = Math.max(0, Number(simState?.statPointTotal || 0));
  const usedAtkStat   = Math.max(0, Number(simState?.base?.["atk"] || 0));
  const usedLukStat2  = Math.max(0, Number(simState?.base?.["luk"] || 0));
  const ownedRemaining  = Math.max(0, ownedPoints - usedPoints);
  let   atkFreePoints   = Math.min(Math.max(0, basePointTotal - usedAtkStat), ownedRemaining);
  let   freePoints      = atkFreePoints;
  const currentAtk = Math.round(Number(currentFinalTotal?.atk || 0));
  const currentLuk = Math.round(Number(currentFinalTotal?.luk || 0));
  let atkShortfall = Math.max(0, neededAtk - currentAtk);
  let lukShortfall = Math.max(0, neededLuk - currentLuk);

  // 各スロットの現状（atk・luk両方）
  const makeSlotAnalysis = (stat) => ARMOR_SLOTS.map(slot => {
    const picked = equipState[slot];
    const item   = picked?.id ? equipItemsMap.get(String(picked.id)) : null;
    const currentLv  = Math.max(0, Math.min(getEquipEnhanceMax(), Math.floor(Number(picked?.lv  || 0))));
    const currentGlv = Math.max(0, Math.min(getEquipGLevelMax(),  Math.floor(Number(picked?.glv || 0))));
    const base = Number(item?.base_add?.[stat] || 0);
    const canEnhance = !!(item && !item.no_enhance && base > 0);
    let currentStatVal = 0;
    if (item) {
      currentStatVal = (currentGlv > 0 && canEnhance)
        ? calcWeaponArmorStatG(item, stat, currentGlv)
        : calcWeaponArmorStat(item, stat, currentLv);
    }
    const maxGStatVal = canEnhance ? calcWeaponArmorStatG(item, stat, getEquipGLevelMax()) : currentStatVal;
    const perG = canEnhance ? (base * 25 + 10000) : 0;
    return {
      slot, label: SLOT_LABEL[slot], item,
      currentLv, currentGlv, base, canEnhance,
      currentStatVal, maxGStatVal, perG,
      neededGlv: currentGlv, addedGlv: 0, newStatVal: currentStatVal,
      neededLv: currentLv, addedLv: 0, newLvStatVal: Math.floor((base || 0) * (1 + currentLv * 0.1))
    };
  });

  const atkSlots = makeSlotAnalysis("atk");
  const lukSlots = makeSlotAnalysis("luk");

  // atkShortfallが0なら既にatk達成済み
  const atkAlreadyAchieved = atkShortfall <= 0;
  const lukAlreadyAchieved = lukShortfall <= 0;

  // ============================================================
  // STEP1: atkをステポイントで補う
  // ============================================================
  let atkStatPointResult = null;
  let atkRemainingAfterStat = atkShortfall;

  if (!atkAlreadyAchieved && effectiveAtkMultiplier > 0 && atkFreePoints > 0) {
    let neededBaseIncrease = Math.ceil(atkShortfall / effectiveAtkMultiplier);
    while (Math.floor(neededBaseIncrease * effectiveAtkMultiplier) < atkShortfall) neededBaseIncrease++;
    const usedBasePoints     = Math.min(neededBaseIncrease, atkFreePoints);
    const actualFinalGain    = Math.floor(usedBasePoints * effectiveAtkMultiplier);
    atkRemainingAfterStat    = Math.max(0, atkShortfall - actualFinalGain);
    // 表示用: 所持ポイント残り（全ステ使用済みを引く）
    const atkDisplayFree = ownedRemaining;
    atkStatPointResult = {
      neededBaseIncrease, usedBasePoints, freePoints: atkDisplayFree,
      basePointTotal, usedPoints,
      achievable: neededBaseIncrease <= atkFreePoints,
      partialGain: actualFinalGain
    };
  }

  // STEP2: atk素材強化で補う → G強化で補う
  const atkEffMulG = (effectiveAtkMultiplier > 0) ? effectiveAtkMultiplier : 1;
  let atkRemainingAfterMat = atkRemainingAfterStat;
  const atkHasNonMaxLv = atkSlots.some(s =>
    s.item && !s.item.no_enhance && Number(s.item.base_add?.["atk"] || 0) > 0 && s.currentLv < getEquipEnhanceMax()
  );
  if (atkHasNonMaxLv && atkRemainingAfterMat > 0) {
    atkRemainingAfterMat = applyOptimalMatEnhancement(atkSlots, "atk", atkRemainingAfterMat, atkEffMulG);
  }
  atkSlots.forEach(s => { if (s.canEnhanceAfterMat) s.canEnhance = true; });
  const atkStillShort = applyOptimalGEnhancement(atkSlots, "atk", atkRemainingAfterMat, atkEffMulG);

  // ============================================================
  // STEP3: lukをステポイントで補う（atk消費後の残りポイントで）
  // ============================================================
  // LUKに使える = min(上限 - base.luk, 所持残り - atk実際消費)
  const atkActuallyUsed = atkStatPointResult ? atkStatPointResult.usedBasePoints : 0;
  const ownedAfterAtk   = Math.max(0, ownedRemaining - atkActuallyUsed);
  const lukFreePoints   = Math.min(Math.max(0, basePointTotal - usedLukStat2), ownedAfterAtk);

  let lukStatPointResult = null;
  let lukRemainingAfterStat = lukShortfall;

  if (!lukAlreadyAchieved && effectiveLukMultiplier > 0 && lukFreePoints > 0) {
    let neededBaseIncrease = Math.ceil(lukShortfall / effectiveLukMultiplier);
    while (Math.floor(neededBaseIncrease * effectiveLukMultiplier) < lukShortfall) neededBaseIncrease++;
    const usedBasePoints     = Math.min(neededBaseIncrease, lukFreePoints);
    const actualFinalGain    = Math.floor(usedBasePoints * effectiveLukMultiplier);
    lukRemainingAfterStat    = Math.max(0, lukShortfall - actualFinalGain);
    // 表示用: atk消費後の所持残り
    const lukDisplayFree = ownedAfterAtk;
    lukStatPointResult = {
      neededBaseIncrease, usedBasePoints, freePoints: lukDisplayFree,
      basePointTotal, usedPoints,
      achievable: neededBaseIncrease <= lukFreePoints,
      partialGain: actualFinalGain
    };
  }

  // STEP4: luk素材強化→G強化で補う
  const lukEffMulG = (effectiveLukMultiplier > 0) ? effectiveLukMultiplier : 1;
  let lukRemaining = lukRemainingAfterStat;
  if (lukRemaining > 0) {
    // atkでG強化・素材強化したスロットの状態をlukSlotに反映
    lukSlots.forEach(ls => {
      const atkSlot = atkSlots.find(a => a.slot === ls.slot);
      if (atkSlot) {
        if (atkSlot.addedGlv > 0) {
          ls.currentGlv     = atkSlot.neededGlv;
          ls.currentStatVal = calcWeaponArmorStatG(ls.item, "luk", ls.currentGlv);
          ls.maxGStatVal    = ls.canEnhance ? calcWeaponArmorStatG(ls.item, "luk", getEquipGLevelMax()) : ls.currentStatVal;
        }
        if (atkSlot.addedLv > 0) {
          ls.currentLv      = atkSlot.neededLv;
          ls.currentStatVal = calcWeaponArmorStat(ls.item, "luk", ls.currentLv);
          if (ls.currentLv >= EQUIP_G_UNLOCK_LV) ls.canEnhance = true;
        }
      }
    });

    // luk素材強化
    const lukHasNonMaxLv = lukSlots.some(s =>
      s.item && !s.item.no_enhance && Number(s.item.base_add?.["luk"] || 0) > 0 && s.currentLv < getEquipEnhanceMax()
    );
    if (lukHasNonMaxLv) {
      lukRemaining = applyOptimalMatEnhancement(lukSlots, "luk", lukRemaining, lukEffMulG);
    }
    lukSlots.forEach(s => { if (s.canEnhanceAfterMat) s.canEnhance = true; });

    // luk G強化
    const _lukGStillShort = applyOptimalGEnhancement(lukSlots, "luk", lukRemaining, lukEffMulG);
    lukRemaining = _lukGStillShort ? 1 : 0;
  }

  const lukStillShort = lukRemaining > 0;
  const accSlots = buildAccAnalysis(ACCESSORY_SLOTS, SLOT_LABEL, equipState, equipItemsMap, "luk");

  return {
    atkAlreadyAchieved, lukAlreadyAchieved,
    atkShortfall, lukShortfall,
    atkSlots, lukSlots,
    atkStatPointResult, lukStatPointResult,
    atkStillShort, lukStillShort,
    accSlots
  };
}
