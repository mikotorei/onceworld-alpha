// ============================================================
// build-sim-logic.js  ビルドシミュレーター ゲームロジック（DOM非依存）
// calc-logic.js の関数を前提として読み込む
// ============================================================

function calcMonsterHp(monster, lv) {
  const vitScaled = Math.floor(Number(monster.vit) * (1 + lv * 0.1));
  return vitScaled * 18 + 100;
}

function calcEnemyPhysDef(defScaled, mdefScaled) {
  return defScaled + mdefScaled * 0.1;
}
function calcEnemyMagDef(defScaled, mdefScaled) {
  return mdefScaled + defScaled * 0.1;
}

function calcPhysicalKillInfo(heroAtk, heroSpd, monster, lv, heroElement, debuffWood, debuffDark) {
  const state = { debuffWood, debuffDark };
  const scaled = buildEnemyScaled(monster, lv, state);
  const physDef = calcEnemyPhysDef(scaled.def, scaled.mdef);
  const hp = calcMonsterHp(monster, lv);
  const hits = hitsFromSpd(heroSpd);
  const elemMod = getElementModifier(heroElement, scaled.element);
  const dmg = damageRangeTotal(heroAtk, physDef, hits, elemMod, 1.0);
  const avg = Math.floor((dmg.min + dmg.max) / 2);
  const npan = avg > 0 ? Math.ceil(hp / avg) : null;
  const oneShot = oneShotLineRequiredAttack(physDef, hits, hp, elemMod, 1.0);
  return { hp, hits, dmgMin: dmg.min, dmgMax: dmg.max, avg, npan, oneShot, element: scaled.element };
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
  const npan = avg > 0 ? Math.ceil(hp / avg) : null;
  const oneShot = calcMagicOneShotRequiredInt({
    hp, analysisBook, analysisBookAdvanced, crystalCount,
    spell, enemyMagDef: magDef,
    heroElement, enemyElement: scaled.element
  });
  return { hp, dmgMin: dmg.min, dmgMax: dmg.max, avg, npan, oneShot, element: scaled.element };
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

function reversePhysicalAtk(monster, lv, heroSpd, heroElement, debuffWood, debuffDark, targetNpan) {
  const state = { debuffWood, debuffDark };
  const scaled = buildEnemyScaled(monster, lv, state);
  const physDef = calcEnemyPhysDef(scaled.def, scaled.mdef);
  const hp = calcMonsterHp(monster, lv);
  const hits = hitsFromSpd(heroSpd);
  const elemMod = getElementModifier(heroElement, scaled.element);
  const neededAvg = hp / targetNpan;
  const neededBase = neededAvg / (hits * elemMod);
  return Math.max(0, Math.ceil((neededBase + physDef * 4) / 7));
}

function reverseMagicInt(monster, lv, analysisBook, analysisBookAdvanced, crystalCount, spell, heroElement, debuffWood, targetNpan) {
  const state = { debuffWood, debuffDark: false };
  const scaled = buildEnemyScaled(monster, lv, state);
  const magDef = calcEnemyMagDef(scaled.def, scaled.mdef);
  const hp = calcMonsterHp(monster, lv);
  const elemMod = getElementModifier(heroElement, scaled.element);
  const analysisBonus = calcAnalysisBonus(analysisBook, analysisBookAdvanced);
  const spellMul = getSpellMultiplier(spell);
  const crystalMul = getCrystalMultiplier(crystalCount);
  const totalMod = 4 * elemMod;
  if (totalMod <= 0 || spellMul <= 0 || crystalMul <= 0) return 0;
  const neededFinalBase = (hp / targetNpan) / totalMod;
  const neededPreDef = neededFinalBase + magDef;
  return Math.max(0, Math.ceil(neededPreDef / (1.25 * spellMul * crystalMul) - analysisBonus));
}

// ============================================================
// 振り分け上限計算
// ============================================================

function calcBasePointLimit(sageDrop, forbiddenBook, hasContract, tenmeCount) {
  const BASE       = 10000;
  const sage       = Math.min(10000, Math.max(0, Math.floor(Number(sageDrop      || 0)))) * 10;
  const forbidden  = Math.min(80000, Math.max(0, Math.floor(Number(forbiddenBook || 0)))) * 80;
  const contract   = hasContract ? 900000 : 0;
  const tenme      = Math.max(0, Math.floor(Number(tenmeCount || 0)));
  const tenmeBonus = tenme >= 11 ? (tenme - 10) * 1000000 : 0;
  return BASE + sage + forbidden + contract + tenmeBonus;
}

// ============================================================
// 装備計算ユーティリティ
// ============================================================

function calcWeaponArmorStat(item, stat, lv) {
  if (!item) return 0;
  const base = Number(item.base_add?.[stat] || 0);
  if (base === 0) return 0;
  if (item.no_enhance) return base;
  const useLv = (lv !== undefined) ? lv : 1100;
  return Math.floor(base * (1 + useLv * 0.1));
}

function calcWeaponArmorStatG(item, stat, glv) {
  if (!item || item.no_enhance) return calcWeaponArmorStat(item, stat, 0);
  const base = Number(item.base_add?.[stat] || 0);
  if (base === 0) return 0;
  const g = Math.max(0, Math.min(300, Math.floor(glv)));
  if (g === 0) return Math.floor(base * 111);
  return Math.floor(base * 111 + (base * 25 + 10000) * g);
}

function calcAccessoryStat(item, stat, lv) {
  if (!item) return { add: 0, rate: 0 };
  const useLv = Math.max(1, Number((lv !== undefined) ? lv : (item.max_level || 1)));
  const add  = Number(item.base_add?.[stat]  || 0) * (1 + (useLv - 1) * 0.1);
  const rate = Number(item.base_rate?.[stat] || 0) * (1 + (useLv - 1) * 0.01);
  return { add, rate };
}

// ============================================================
// 分析メイン：優先順序 ① ステ振り → ② G強化
// ============================================================

function analyzeGlvNeeded(equipState, equipItemsMap, stat, neededTotal, currentFinalTotal, simState, effectiveMultiplier, overridePointLimit) {
  const ARMOR_SLOTS     = ["weapon", "head", "body", "hands", "feet", "shield"];
  const ACCESSORY_SLOTS = ["accessory1", "accessory2", "accessory3", "accessory4"];
  const SLOT_LABEL = {
    weapon:"武器", head:"頭", body:"体", hands:"手", feet:"脚", shield:"盾",
    accessory1:"アクセ1", accessory2:"アクセ2", accessory3:"アクセ3", accessory4:"アクセ4"
  };

  const currentVal = Math.round(Number(currentFinalTotal?.[stat] || 0));
  let shortfall = Math.max(0, neededTotal - currentVal);

  // 各スロットの現状を整理（G強化計算用）
  const armorAnalysis = ARMOR_SLOTS.map(slot => {
    const picked = equipState[slot];
    const item   = picked?.id ? equipItemsMap.get(String(picked.id)) : null;
    const currentLv  = Math.max(0, Math.min(1100, Math.floor(Number(picked?.lv  || 0))));
    const currentGlv = Math.max(0, Math.min(300,  Math.floor(Number(picked?.glv || 0))));
    const base = Number(item?.base_add?.[stat] || 0);
    const canEnhance = !!(item && !item.no_enhance && base > 0);

    let currentStatVal = 0;
    if (item) {
      currentStatVal = (currentGlv > 0 && canEnhance)
        ? calcWeaponArmorStatG(item, stat, currentGlv)
        : calcWeaponArmorStat(item, stat, currentLv);
    }

    const maxGStatVal = canEnhance ? calcWeaponArmorStatG(item, stat, 300) : currentStatVal;
    const perG = canEnhance ? (base * 25 + 10000) : 0;

    return {
      slot, label: SLOT_LABEL[slot], item,
      currentLv, currentGlv, base, canEnhance,
      currentStatVal, maxGStatVal, perG,
      neededGlv: currentGlv, addedGlv: 0, newStatVal: currentStatVal
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
  const usedPoints = BASE_STATS.reduce((s, k) => s + Math.max(0, Number(simState?.base?.[k] || 0)), 0);
  const freePoints = Math.max(0, basePointTotal - usedPoints);

  let statPointResult = null;
  let remainingAfterStat = shortfall;

  if (effectiveMultiplier > 0 && freePoints > 0) {
    // 残り不足分をステポイントで何点補えるか
    const maxFinalGainByStat = freePoints * effectiveMultiplier;
    const neededBaseIncrease = Math.ceil(shortfall / effectiveMultiplier);
    const usedBasePoints     = Math.min(neededBaseIncrease, freePoints);
    const actualFinalGain    = Math.floor(usedBasePoints * effectiveMultiplier);

    remainingAfterStat = Math.max(0, shortfall - actualFinalGain);

    statPointResult = {
      neededBaseIncrease,
      usedBasePoints,
      freePoints,
      basePointTotal,
      usedPoints,
      achievable: neededBaseIncrease <= freePoints,
      partialGain: actualFinalGain
    };
  }

  // ============================================================
  // ② ステ振りで届かなかった残りをG強化で補う
  // ============================================================
  let remaining = remainingAfterStat;

  if (remaining > 0) {
    const enhanceable = armorAnalysis
      .filter(s => s.canEnhance && s.currentGlv < 300)
      .sort((a, b) => b.perG - a.perG);

    enhanceable.forEach(s => {
      if (remaining <= 0) return;
      const canAdd = s.maxGStatVal - s.currentStatVal;
      if (canAdd <= 0) return;

      if (canAdd >= remaining) {
        const targetStat = s.currentStatVal + remaining;
        let neededGlv;
        if (s.currentGlv > 0) {
          neededGlv = s.currentGlv + Math.ceil(remaining / s.perG);
        } else {
          const at1100    = calcWeaponArmorStatG(s.item, stat, 0);
          const fromAt1100 = targetStat - at1100;
          neededGlv = fromAt1100 > 0 ? Math.ceil(fromAt1100 / s.perG) : 0;
        }
        neededGlv    = Math.min(300, Math.max(s.currentGlv, neededGlv));
        s.neededGlv  = neededGlv;
        s.addedGlv   = Math.max(0, neededGlv - s.currentGlv);
        s.newStatVal = calcWeaponArmorStatG(s.item, stat, neededGlv);
        remaining    = 0;
      } else {
        s.neededGlv  = 300;
        s.addedGlv   = 300 - s.currentGlv;
        s.newStatVal = s.maxGStatVal;
        remaining   -= canAdd;
      }
    });
  }

  const stillShort = remaining > 0;
  const accSlots = buildAccAnalysis(ACCESSORY_SLOTS, SLOT_LABEL, equipState, equipItemsMap, stat);
  return { achieved: false, shortfall, stillShort, slots: armorAnalysis, accSlots, statPointResult };
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
function calcRequiredLukForHitRate(enemyLuk, rate) {
  const luk = Math.floor(Number(enemyLuk || 0));
  if (rate <= 1)  return Math.floor(luk / 2);
  if (rate >= 99) return luk;
  // 線形補間: 1%→luk/2, 99%→luk
  const min = luk / 2;
  const max = luk;
  return Math.ceil(min + (max - min) * (rate - 1) / 98);
}

// 現在のlukで何%命中するか
function calcHitRateFromLuk(heroLuk, enemyLuk) {
  const el = Math.floor(Number(enemyLuk || 0));
  const hl = Math.floor(Number(heroLuk  || 0));
  if (el <= 0) return 100;
  const min = Math.floor(el / 2);
  const max = el;
  if (hl >= max) return 99;
  if (hl <= min) return 1;
  // 線形補間で逆算
  return Math.round(1 + (hl - min) / (max - min) * 98);
}

// luk探索：G強化・ステポイントでlukを補う
// neededLuk: 必要luk
// currentFinalLuk: 現在のfinalTotal.luk
function analyzeLukNeeded(equipState, equipItemsMap, neededLuk, currentFinalLuk, simState, effectiveLukMultiplier, overridePointLimit) {
  const ARMOR_SLOTS     = ["weapon", "head", "body", "hands", "feet", "shield"];
  const ACCESSORY_SLOTS = ["accessory1", "accessory2", "accessory3", "accessory4"];
  const SLOT_LABEL = {
    weapon:"武器", head:"頭", body:"体", hands:"手", feet:"脚", shield:"盾",
    accessory1:"アクセ1", accessory2:"アクセ2", accessory3:"アクセ3", accessory4:"アクセ4"
  };
  const stat = "luk";

  const currentVal = Math.round(Number(currentFinalLuk || 0));
  let shortfall = Math.max(0, neededLuk - currentVal);

  const armorAnalysis = ARMOR_SLOTS.map(slot => {
    const picked = equipState[slot];
    const item   = picked?.id ? equipItemsMap.get(String(picked.id)) : null;
    const currentLv  = Math.max(0, Math.min(1100, Math.floor(Number(picked?.lv  || 0))));
    const currentGlv = Math.max(0, Math.min(300,  Math.floor(Number(picked?.glv || 0))));
    const base = Number(item?.base_add?.[stat] || 0);
    const canEnhance = !!(item && !item.no_enhance && base > 0);

    let currentStatVal = 0;
    if (item) {
      currentStatVal = (currentGlv > 0 && canEnhance)
        ? calcWeaponArmorStatG(item, stat, currentGlv)
        : calcWeaponArmorStat(item, stat, currentLv);
    }

    const maxGStatVal = canEnhance ? calcWeaponArmorStatG(item, stat, 300) : currentStatVal;
    const perG = canEnhance ? (base * 25 + 10000) : 0;

    return {
      slot, label: SLOT_LABEL[slot], item,
      currentLv, currentGlv, base, canEnhance,
      currentStatVal, maxGStatVal, perG,
      neededGlv: currentGlv, addedGlv: 0, newStatVal: currentStatVal
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
  const usedPoints = BASE_STATS.reduce((s, k) => s + Math.max(0, Number(simState?.base?.[k] || 0)), 0);
  const freePoints = Math.max(0, basePointTotal - usedPoints);

  let statPointResult = null;
  let remainingAfterStat = shortfall;

  if (effectiveLukMultiplier > 0 && freePoints > 0) {
    const neededBaseIncrease = Math.ceil(shortfall / effectiveLukMultiplier);
    const usedBasePoints     = Math.min(neededBaseIncrease, freePoints);
    const actualFinalGain    = Math.floor(usedBasePoints * effectiveLukMultiplier);
    remainingAfterStat = Math.max(0, shortfall - actualFinalGain);
    statPointResult = {
      neededBaseIncrease, usedBasePoints, freePoints,
      basePointTotal, usedPoints,
      achievable: neededBaseIncrease <= freePoints,
      partialGain: actualFinalGain
    };
  }

  // ② G強化で残りを補う
  let remaining = remainingAfterStat;
  if (remaining > 0) {
    const enhanceable = armorAnalysis
      .filter(s => s.canEnhance && s.currentGlv < 300)
      .sort((a, b) => b.perG - a.perG);

    enhanceable.forEach(s => {
      if (remaining <= 0) return;
      const canAdd = s.maxGStatVal - s.currentStatVal;
      if (canAdd <= 0) return;
      if (canAdd >= remaining) {
        const targetStat  = s.currentStatVal + remaining;
        let neededGlv;
        if (s.currentGlv > 0) {
          neededGlv = s.currentGlv + Math.ceil(remaining / s.perG);
        } else {
          const at1100     = calcWeaponArmorStatG(s.item, stat, 0);
          const fromAt1100 = targetStat - at1100;
          neededGlv = fromAt1100 > 0 ? Math.ceil(fromAt1100 / s.perG) : 0;
        }
        neededGlv    = Math.min(300, Math.max(s.currentGlv, neededGlv));
        s.neededGlv  = neededGlv;
        s.addedGlv   = Math.max(0, neededGlv - s.currentGlv);
        s.newStatVal = calcWeaponArmorStatG(s.item, stat, neededGlv);
        remaining    = 0;
      } else {
        s.neededGlv  = 300;
        s.addedGlv   = 300 - s.currentGlv;
        s.newStatVal = s.maxGStatVal;
        remaining   -= canAdd;
      }
    });
  }

  const stillShort = remaining > 0;
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
  const ARMOR_SLOTS     = ["weapon", "head", "body", "hands", "feet", "shield"];
  const ACCESSORY_SLOTS = ["accessory1", "accessory2", "accessory3", "accessory4"];
  const SLOT_LABEL = {
    weapon:"武器", head:"頭", body:"体", hands:"手", feet:"脚", shield:"盾",
    accessory1:"アクセ1", accessory2:"アクセ2", accessory3:"アクセ3", accessory4:"アクセ4"
  };

  const BASE_STATS = ["vit","spd","atk","int","def","mdef","luk"];
  const basePointTotal = overridePointLimit != null
    ? overridePointLimit
    : Math.max(0, Number(simState?.basePointTotal || 0));
  const usedPoints = BASE_STATS.reduce((s, k) => s + Math.max(0, Number(simState?.base?.[k] || 0)), 0);
  let freePoints = Math.max(0, basePointTotal - usedPoints);

  const currentAtk = Math.round(Number(currentFinalTotal?.atk || 0));
  const currentLuk = Math.round(Number(currentFinalTotal?.luk || 0));
  let atkShortfall = Math.max(0, neededAtk - currentAtk);
  let lukShortfall = Math.max(0, neededLuk - currentLuk);

  // 各スロットの現状（atk・luk両方）
  const makeSlotAnalysis = (stat) => ARMOR_SLOTS.map(slot => {
    const picked = equipState[slot];
    const item   = picked?.id ? equipItemsMap.get(String(picked.id)) : null;
    const currentLv  = Math.max(0, Math.min(1100, Math.floor(Number(picked?.lv  || 0))));
    const currentGlv = Math.max(0, Math.min(300,  Math.floor(Number(picked?.glv || 0))));
    const base = Number(item?.base_add?.[stat] || 0);
    const canEnhance = !!(item && !item.no_enhance && base > 0);
    let currentStatVal = 0;
    if (item) {
      currentStatVal = (currentGlv > 0 && canEnhance)
        ? calcWeaponArmorStatG(item, stat, currentGlv)
        : calcWeaponArmorStat(item, stat, currentLv);
    }
    const maxGStatVal = canEnhance ? calcWeaponArmorStatG(item, stat, 300) : currentStatVal;
    const perG = canEnhance ? (base * 25 + 10000) : 0;
    return {
      slot, label: SLOT_LABEL[slot], item,
      currentLv, currentGlv, base, canEnhance,
      currentStatVal, maxGStatVal, perG,
      neededGlv: currentGlv, addedGlv: 0, newStatVal: currentStatVal
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

  if (!atkAlreadyAchieved && effectiveAtkMultiplier > 0 && freePoints > 0) {
    const neededBaseIncrease = Math.ceil(atkShortfall / effectiveAtkMultiplier);
    const usedBasePoints     = Math.min(neededBaseIncrease, freePoints);
    const actualFinalGain    = Math.floor(usedBasePoints * effectiveAtkMultiplier);
    atkRemainingAfterStat    = Math.max(0, atkShortfall - actualFinalGain);
    freePoints              -= usedBasePoints; // 使ったポイントを消費
    atkStatPointResult = {
      neededBaseIncrease, usedBasePoints, freePoints: freePoints + usedBasePoints,
      basePointTotal, usedPoints,
      achievable: neededBaseIncrease <= (freePoints + usedBasePoints),
      partialGain: actualFinalGain
    };
  }

  // STEP2: atkをG強化で補う
  let atkRemaining = atkRemainingAfterStat;
  if (atkRemaining > 0) {
    const enhanceable = atkSlots
      .filter(s => s.canEnhance && s.currentGlv < 300)
      .sort((a, b) => b.perG - a.perG);
    enhanceable.forEach(s => {
      if (atkRemaining <= 0) return;
      const canAdd = s.maxGStatVal - s.currentStatVal;
      if (canAdd <= 0) return;
      if (canAdd >= atkRemaining) {
        const targetStat = s.currentStatVal + atkRemaining;
        let neededGlv;
        if (s.currentGlv > 0) {
          neededGlv = s.currentGlv + Math.ceil(atkRemaining / s.perG);
        } else {
          const at1100 = calcWeaponArmorStatG(s.item, "atk", 0);
          neededGlv = (targetStat - at1100) > 0 ? Math.ceil((targetStat - at1100) / s.perG) : 0;
        }
        neededGlv    = Math.min(300, Math.max(s.currentGlv, neededGlv));
        s.neededGlv  = neededGlv;
        s.addedGlv   = Math.max(0, neededGlv - s.currentGlv);
        s.newStatVal = calcWeaponArmorStatG(s.item, "atk", neededGlv);
        atkRemaining = 0;
      } else {
        s.neededGlv  = 300;
        s.addedGlv   = 300 - s.currentGlv;
        s.newStatVal = s.maxGStatVal;
        atkRemaining -= canAdd;
      }
    });
  }

  const atkStillShort = atkRemaining > 0;

  // ============================================================
  // STEP3: lukをステポイントで補う（atk消費後の残りポイントで）
  // ============================================================
  let lukStatPointResult = null;
  let lukRemainingAfterStat = lukShortfall;

  if (!lukAlreadyAchieved && effectiveLukMultiplier > 0 && freePoints > 0) {
    const neededBaseIncrease = Math.ceil(lukShortfall / effectiveLukMultiplier);
    const usedBasePoints     = Math.min(neededBaseIncrease, freePoints);
    const actualFinalGain    = Math.floor(usedBasePoints * effectiveLukMultiplier);
    lukRemainingAfterStat    = Math.max(0, lukShortfall - actualFinalGain);
    lukStatPointResult = {
      neededBaseIncrease, usedBasePoints, freePoints,
      basePointTotal, usedPoints,
      achievable: neededBaseIncrease <= freePoints,
      partialGain: actualFinalGain
    };
  }

  // STEP4: lukをG強化で補う（atkでG強化したスロットの残り枠で）
  let lukRemaining = lukRemainingAfterStat;
  if (lukRemaining > 0) {
    // atkでG強化済みのスロットは currentGlv が増えているとみなす
    lukSlots.forEach(ls => {
      const atkSlot = atkSlots.find(a => a.slot === ls.slot);
      if (atkSlot && atkSlot.addedGlv > 0) {
        // atkでG強化したスロットはすでにG強化済みの状態から
        ls.currentGlv = atkSlot.neededGlv;
        ls.currentStatVal = calcWeaponArmorStatG(ls.item, "luk", ls.currentGlv);
        ls.maxGStatVal    = ls.canEnhance ? calcWeaponArmorStatG(ls.item, "luk", 300) : ls.currentStatVal;
      }
    });

    const lukEnhanceable = lukSlots
      .filter(s => s.canEnhance && s.currentGlv < 300)
      .sort((a, b) => b.perG - a.perG);

    lukEnhanceable.forEach(s => {
      if (lukRemaining <= 0) return;
      const canAdd = s.maxGStatVal - s.currentStatVal;
      if (canAdd <= 0) return;
      if (canAdd >= lukRemaining) {
        const targetStat = s.currentStatVal + lukRemaining;
        let neededGlv;
        if (s.currentGlv > 0) {
          neededGlv = s.currentGlv + Math.ceil(lukRemaining / s.perG);
        } else {
          const at1100 = calcWeaponArmorStatG(s.item, "luk", 0);
          neededGlv = (targetStat - at1100) > 0 ? Math.ceil((targetStat - at1100) / s.perG) : 0;
        }
        neededGlv    = Math.min(300, Math.max(s.currentGlv, neededGlv));
        s.neededGlv  = neededGlv;
        s.addedGlv   = Math.max(0, neededGlv - s.currentGlv);
        s.newStatVal = calcWeaponArmorStatG(s.item, "luk", neededGlv);
        lukRemaining = 0;
      } else {
        s.neededGlv  = 300;
        s.addedGlv   = 300 - s.currentGlv;
        s.newStatVal = s.maxGStatVal;
        lukRemaining -= canAdd;
      }
    });
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
