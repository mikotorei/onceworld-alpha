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
// G強化必要数分析（複数スロット合算で目標に届くよう計算）
// ============================================================

function analyzeGlvNeeded(equipState, equipItemsMap, stat, neededTotal, currentFinalTotal) {
  const ARMOR_SLOTS = ["weapon", "head", "body", "hands", "feet", "shield"];
  const ACCESSORY_SLOTS = ["accessory1", "accessory2", "accessory3", "accessory4"];
  const SLOT_LABEL = {
    weapon:"武器", head:"頭", body:"体", hands:"手", feet:"脚", shield:"盾",
    accessory1:"アクセ1", accessory2:"アクセ2", accessory3:"アクセ3", accessory4:"アクセ4"
  };

  const currentVal = Math.round(Number(currentFinalTotal?.[stat] || 0));
  const shortfall  = Math.max(0, neededTotal - currentVal);

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

    // G100での最大値
    const maxGStatVal = canEnhance ? calcWeaponArmorStatG(item, stat, 100) : currentStatVal;
    // G0（+1100）での値
    const at1100 = canEnhance ? calcWeaponArmorStatG(item, stat, 0) : currentStatVal;
    // G1個あたりの増加量
    const perG = canEnhance ? (base * 25 + 10000) : 0;

    return {
      slot, label: SLOT_LABEL[slot], item,
      currentLv, currentGlv, base, canEnhance,
      currentStatVal, maxGStatVal, at1100, perG,
      // 後で計算するので初期値
      neededGlv: currentGlv, addedGlv: 0, newStatVal: currentStatVal
    };
  });

  if (shortfall <= 0) {
    // アクセサリ分析も作成して返す
    const accSlots = buildAccAnalysis(ACCESSORY_SLOTS, SLOT_LABEL, equipState, equipItemsMap, stat);
    return { achieved: true, shortfall: 0, slots: armorAnalysis, accSlots };
  }

  // --- 複数スロット合算でG強化を配分 ---
  // 方針: 各スロットのperG（G1個あたりの増加量）が大きいものから優先的にG強化
  // 貢献できるスロット（canEnhance かつ まだG強化の余地あり）を降順ソート
  const enhanceable = armorAnalysis
    .filter(s => s.canEnhance && s.currentGlv < 100)
    .sort((a, b) => b.perG - a.perG);

  let remaining = shortfall;

  enhanceable.forEach(s => {
    if (remaining <= 0) return;
    // このスロットで補えるG強化量
    const currentContrib = s.currentStatVal;
    const maxContrib     = s.maxGStatVal;
    const canAdd         = maxContrib - currentContrib;
    if (canAdd <= 0) return;

    if (canAdd >= remaining) {
      // このスロット単体で残りを補える
      // 必要なG強化数を逆算: base*111 + perG*glv = target
      const targetStat = currentContrib + remaining;
      let neededGlv;
      if (s.currentGlv > 0) {
        // 既にG強化済みの場合: 現在値からの差分で計算
        neededGlv = s.currentGlv + Math.ceil(remaining / s.perG);
      } else {
        // G強化なし→G強化開始: at1100との差分
        const fromAt1100 = targetStat - s.at1100;
        neededGlv = fromAt1100 > 0 ? Math.ceil(fromAt1100 / s.perG) : 0;
      }
      neededGlv = Math.min(100, Math.max(s.currentGlv, neededGlv));
      s.neededGlv  = neededGlv;
      s.addedGlv   = Math.max(0, neededGlv - s.currentGlv);
      s.newStatVal = calcWeaponArmorStatG(s.item, stat, neededGlv);
      remaining    = 0;
    } else {
      // このスロットをG100まで全振りして次へ
      s.neededGlv  = 100;
      s.addedGlv   = 100 - s.currentGlv;
      s.newStatVal = maxContrib;
      remaining   -= canAdd;
    }
  });

  // remainingが残っていれば全スロットG100でも届かない
  const stillShort = remaining > 0;

  const accSlots = buildAccAnalysis(ACCESSORY_SLOTS, SLOT_LABEL, equipState, equipItemsMap, stat);
  return { achieved: false, shortfall, stillShort, slots: armorAnalysis, accSlots };
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
