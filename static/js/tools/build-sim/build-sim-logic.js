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
  const g = Math.max(0, Math.min(100, Math.floor(glv)));
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
// ステポイント1点あたりのfinalTotal寄与倍率を計算
// （setBonus × accRate乗算 × petMul乗算 × petFinal乗算）
// simState: collectState()の戻り値
// equipItemsMap: Map<id, item>
// stat: "atk" など
// ============================================================
function calcBasePointMultiplier(simState, equipItemsMap, stat) {
  // セットボーナス判定
  const ARMOR_SLOTS = ["head","body","hands","feet","shield"];
  const armorItems = ARMOR_SLOTS.map(k => {
    const id = simState.equip?.[k]?.id || "";
    return id ? equipItemsMap.get(String(id)) : null;
  }).filter(Boolean);
  const armorSeries = armorItems.map(i => i?.series || "").filter(s => s !== "");
  const hasSet = armorSeries.length === 5 && armorSeries.every(s => s === armorSeries[0]);
  const setMul = hasSet ? 1.1 : 1.0;

  // アクセサリ乗算合計（accRate）
  const ACC_SLOTS = ["accessory1","accessory2","accessory3","accessory4"];
  let totalAccRate = 0;
  ACC_SLOTS.forEach(k => {
    const id = simState.equip?.[k]?.id || "";
    const lv = Math.max(1, Number(simState.equip?.[k]?.lv || 1));
    if (!id) return;
    const item = equipItemsMap.get(String(id));
    if (!item) return;
    const s = calcAccessoryStat(item, stat, lv);
    totalAccRate += s.rate || 0;
  });

  // ペット乗算合計（petMul, petFinal）
  // ※ petSkillMapはstatus-sim.js内にあり直接参照不可なので
  //    window.lastFinalTotalとbaseから逆算する方式を取る
  // → 代わりにsimStateのpetsからstage情報を取り、
  //   window.statusSimCollectState経由で現在の倍率を推定する
  // ここでは簡易的に finalTotal / (base + equipContrib) から実効倍率を推定
  // → この値はUI側で渡す

  // 返すのはsetMulとaccRateのみ（petMulはUI側で計算）
  return { setMul, totalAccRate };
}

// ============================================================
// G強化必要数 + ステポイント必要数 分析（複数スロット合算）
// ============================================================

function analyzeGlvNeeded(equipState, equipItemsMap, stat, neededTotal, currentFinalTotal, simState, effectiveMultiplier) {
  const ARMOR_SLOTS = ["weapon", "head", "body", "hands", "feet", "shield"];
  const ACCESSORY_SLOTS = ["accessory1", "accessory2", "accessory3", "accessory4"];
  const SLOT_LABEL = {
    weapon:"武器", head:"頭", body:"体", hands:"手", feet:"脚", shield:"盾",
    accessory1:"アクセ1", accessory2:"アクセ2", accessory3:"アクセ3", accessory4:"アクセ4"
  };

  const currentVal = Math.round(Number(currentFinalTotal?.[stat] || 0));
  let shortfall = Math.max(0, neededTotal - currentVal);

  // 各スロットの現状を整理
  const armorAnalysis = ARMOR_SLOTS.map(slot => {
    const picked = equipState[slot];
    const item   = picked?.id ? equipItemsMap.get(String(picked.id)) : null;
    const currentLv  = Math.max(0, Math.min(1100, Math.floor(Number(picked?.lv  || 0))));
    const currentGlv = Math.max(0, Math.min(100,  Math.floor(Number(picked?.glv || 0))));
    const base = Number(item?.base_add?.[stat] || 0);
    const canEnhance = !!(item && !item.no_enhance && base > 0);

    let currentStatVal = 0;
    if (item) {
      currentStatVal = (currentGlv > 0 && canEnhance)
        ? calcWeaponArmorStatG(item, stat, currentGlv)
        : calcWeaponArmorStat(item, stat, currentLv);
    }

    const maxGStatVal = canEnhance ? calcWeaponArmorStatG(item, stat, 100) : currentStatVal;
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

  // G強化を効率順に配分
  const enhanceable = armorAnalysis
    .filter(s => s.canEnhance && s.currentGlv < 100)
    .sort((a, b) => b.perG - a.perG);

  let remaining = shortfall;
  enhanceable.forEach(s => {
    if (remaining <= 0) return;
    const currentContrib = s.currentStatVal;
    const maxContrib     = s.maxGStatVal;
    const canAdd         = maxContrib - currentContrib;
    if (canAdd <= 0) return;

    if (canAdd >= remaining) {
      const targetStat = currentContrib + remaining;
      let neededGlv;
      if (s.currentGlv > 0) {
        neededGlv = s.currentGlv + Math.ceil(remaining / s.perG);
      } else {
        const at1100 = calcWeaponArmorStatG(s.item, stat, 0);
        const fromAt1100 = targetStat - at1100;
        neededGlv = fromAt1100 > 0 ? Math.ceil(fromAt1100 / s.perG) : 0;
      }
      neededGlv = Math.min(100, Math.max(s.currentGlv, neededGlv));
      s.neededGlv  = neededGlv;
      s.addedGlv   = Math.max(0, neededGlv - s.currentGlv);
      s.newStatVal = calcWeaponArmorStatG(s.item, stat, neededGlv);
      remaining    = 0;
    } else {
      s.neededGlv  = 100;
      s.addedGlv   = 100 - s.currentGlv;
      s.newStatVal = maxContrib;
      remaining   -= canAdd;
    }
  });

  // G強化で届かなかった残りをステポイントで補う
  let statPointResult = null;
  if (remaining > 0 && effectiveMultiplier > 0) {
    // ステポイント → finalTotal の換算
    // finalTotal に remaining 追加するために必要な base 増加量
    // remaining = baseIncrease * effectiveMultiplier
    const neededBaseIncrease = Math.ceil(remaining / effectiveMultiplier);

    // 現在の使用済みポイントと残りポイントを計算
    const BASE_STATS = ["vit","spd","atk","int","def","mdef","luk"];
    const basePointTotal = Math.max(0, Number(simState?.basePointTotal || 0));
    const usedPoints = BASE_STATS.reduce((s, k) => s + Math.max(0, Number(simState?.base?.[k] || 0)), 0);
    const freePoints = Math.max(0, basePointTotal - usedPoints);
    const currentBaseForStat = Math.max(0, Number(simState?.base?.[stat] || 0));

    statPointResult = {
      neededBaseIncrease,
      freePoints,
      basePointTotal,
      usedPoints,
      currentBaseForStat,
      achievable: neededBaseIncrease <= freePoints,
      stillShortAfterAll: neededBaseIncrease > freePoints
    };
    remaining = Math.max(0, remaining - neededBaseIncrease * effectiveMultiplier);
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
