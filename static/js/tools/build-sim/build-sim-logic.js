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

// +lv強化後のstat加算値
function calcWeaponArmorStat(item, stat, lv) {
  if (!item) return 0;
  const base = Number(item.base_add?.[stat] || 0);
  if (base === 0) return 0;
  if (item.no_enhance) return base;
  const useLv = (lv !== undefined) ? lv : 1100;
  return Math.floor(base * (1 + useLv * 0.1));
}

// G強化後のstat加算値
function calcWeaponArmorStatG(item, stat, glv) {
  if (!item || item.no_enhance) return calcWeaponArmorStat(item, stat, 0);
  const base = Number(item.base_add?.[stat] || 0);
  if (base === 0) return 0;
  const g = Math.max(0, Math.min(100, Math.floor(glv)));
  if (g === 0) return Math.floor(base * 111);
  return Math.floor(base * 111 + (base * 25 + 10000) * g);
}

// アクセサリのstat値（lv指定）
function calcAccessoryStat(item, stat, lv) {
  if (!item) return { add: 0, rate: 0 };
  const useLv = Math.max(1, Number((lv !== undefined) ? lv : (item.max_level || 1)));
  const add  = Number(item.base_add?.[stat]  || 0) * (1 + (useLv - 1) * 0.1);
  const rate = Number(item.base_rate?.[stat] || 0) * (1 + (useLv - 1) * 0.01);
  return { add, rate };
}

// セットボーナス判定
function hasSetBonus(armorItems) {
  const series = armorItems.map(i => i?.series || "").filter(s => s !== "");
  if (series.length < 5) return false;
  return series.every(s => s === series[0]);
}

// ============================================================
// G強化必要数分析（現在の装備を維持した上で）
// ============================================================

// 現在の装備状態から目標ステータスまでに必要なG強化を各スロット別に計算
// equipState: collectState().equip
// equipItemsMap: Map<id, item>
// stat: "atk" など
// neededTotal: 目標最終ステータス（finalTotal相当）
// currentFinalTotal: 現在のfinalTotal
// 戻り値: [{slot, item, currentGlv, neededGlv, addedGlv, currentStat, newStat}]
function analyzeGlvNeeded(equipState, equipItemsMap, stat, neededTotal, currentFinalTotal) {
  const ARMOR_SLOTS = ["weapon", "head", "body", "hands", "feet", "shield"];
  const ACCESSORY_SLOTS = ["accessory1", "accessory2", "accessory3", "accessory4"];
  const SLOT_LABEL = { weapon:"武器", head:"頭", body:"体", hands:"手", feet:"脚", shield:"盾",
    accessory1:"アクセ1", accessory2:"アクセ2", accessory3:"アクセ3", accessory4:"アクセ4" };

  const currentVal = Math.round(Number(currentFinalTotal?.[stat] || 0));
  const shortfall  = Math.max(0, neededTotal - currentVal);

  if (shortfall <= 0) {
    // 既に達成済み
    return { achieved: true, shortfall: 0, slots: [], accSlots: [] };
  }

  // 各スロットの現状を整理
  const armorAnalysis = ARMOR_SLOTS.map(slot => {
    const picked = equipState[slot];
    const item   = picked?.id ? equipItemsMap.get(String(picked.id)) : null;
    const currentLv  = Math.max(0, Math.min(1100, Math.floor(Number(picked?.lv  || 0))));
    const currentGlv = Math.max(0, Math.min(100,  Math.floor(Number(picked?.glv || 0))));

    let currentStatVal = 0;
    if (item) {
      if (currentGlv > 0 && !item.no_enhance) {
        currentStatVal = calcWeaponArmorStatG(item, stat, currentGlv);
      } else {
        currentStatVal = calcWeaponArmorStat(item, stat, currentLv);
      }
    }

    // G強化を追加した場合の最大貢献量（G100まで）
    const maxGStatVal = item && !item.no_enhance
      ? calcWeaponArmorStatG(item, stat, 100)
      : currentStatVal;

    // 必要G強化数（現在のGlvから追加で何個必要か）
    // G強化済みの場合はそこから追加計算
    let neededGlv = currentGlv;
    const base = Number(item?.base_add?.[stat] || 0);
    if (base > 0 && !item?.no_enhance && shortfall > 0) {
      // shortfallをこのスロットで全て補う場合に必要なGlv
      const targetStatForThisSlot = currentStatVal + shortfall;
      if (targetStatForThisSlot <= maxGStatVal) {
        // G強化式: base*111 + (base*25+10000)*glv = target
        const rawGlv = (targetStatForThisSlot - base * 111) / (base * 25 + 10000);
        neededGlv = Math.max(currentGlv, Math.ceil(rawGlv));
        neededGlv = Math.min(100, neededGlv);
      } else {
        neededGlv = 100;
      }
    }

    return {
      slot,
      label: SLOT_LABEL[slot],
      item,
      currentLv,
      currentGlv,
      neededGlv,
      addedGlv: Math.max(0, neededGlv - currentGlv),
      currentStatVal,
      maxGStatVal,
      base,
      canEnhance: !!(item && !item.no_enhance && base > 0)
    };
  });

  // アクセサリは強化レベルがあるが今回はG強化なし → 現状表示のみ
  const accAnalysis = ACCESSORY_SLOTS.map(slot => {
    const picked = equipState[slot];
    const item   = picked?.id ? equipItemsMap.get(String(picked.id)) : null;
    const currentLv = Math.max(1, Math.floor(Number(picked?.lv || 1)));
    const maxLv     = Math.max(1, Number(item?.max_level || 1));
    const s = item ? calcAccessoryStat(item, stat, currentLv) : { add: 0, rate: 0 };
    const sMax = item ? calcAccessoryStat(item, stat, maxLv) : { add: 0, rate: 0 };
    return {
      slot,
      label: SLOT_LABEL[slot],
      item,
      currentLv,
      maxLv,
      currentAdd:  s.add  || 0,
      currentRate: s.rate || 0,
      maxAdd:  sMax.add  || 0,
      maxRate: sMax.rate || 0,
      canLevelUp: item && currentLv < maxLv
    };
  });

  return { achieved: false, shortfall, slots: armorAnalysis, accSlots: accAnalysis };
}
