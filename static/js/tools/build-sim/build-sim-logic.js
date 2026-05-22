// ============================================================
// build-sim-logic.js  ビルドシミュレーター ゲームロジック（DOM非依存）
// calc-logic.js の関数を前提として読み込む
// ============================================================

// --- HP計算 ---
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

// --- 討伐に必要な発数（物理）---
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

// --- 討伐に必要な発数（魔法）---
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

// --- 全モンスター討伐判定 ---
function scanAllMonsters(monsters, heroStats, options) {
  const { attackType, heroElement, spell, debuffWood, debuffDark, npanLimit } = options;
  const results = [];
  monsters.forEach(monster => {
    const shortcuts = Array.isArray(monster.level_shortcuts) && monster.level_shortcuts.length > 0
      ? monster.level_shortcuts
      : [{ lv: 0, label: "基本" }];
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

// --- 逆算：物理 ---
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

// --- 逆算：魔法 ---
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
// 装備探索ロジック
// ============================================================

// 武器・防具の強化後ステータス加算値（+1100固定）
function calcWeaponArmorStat(item, stat) {
  if (!item) return 0;
  const base = Number(item.base_add?.[stat] || 0);
  if (base === 0) return 0;
  if (item.no_enhance) return base;
  return Math.floor(base * (1 + 1100 * 0.1));
}

// アクセサリのステータス加算値（max_level使用）
function calcAccessoryStat(item, stat) {
  if (!item) return 0;
  const lv  = Math.max(1, Number(item.max_level || 1));
  const add  = Number(item.base_add?.[stat]  || 0) * (1 + (lv - 1) * 0.1);
  const rate = Number(item.base_rate?.[stat] || 0) * (1 + (lv - 1) * 0.01);
  return { add, rate };
}

// G強化で必要な個数を計算（base_addに対して必要総量から逆算）
function calcRequiredGlv(item, stat, neededFromThisSlot) {
  if (!item || item.no_enhance) return 0;
  const base = Number(item.base_add?.[stat] || 0);
  if (base === 0) return 0;
  const at1100 = Math.floor(base * (1 + 1100 * 0.1));
  if (at1100 >= neededFromThisSlot) return 0;
  // G強化式: base*111 + (base*25+10000)*glv >= needed
  // glv >= (needed - base*111) / (base*25+10000)
  const glv = Math.ceil((neededFromThisSlot - base * 111) / (base * 25 + 10000));
  return Math.max(0, Math.min(100, glv));
}

// セットボーナス判定（5部位同シリーズ → ×1.1）
function hasSetBonus(slots) {
  const series = Object.values(slots)
    .map(item => item?.series || "")
    .filter(s => s !== "");
  if (series.length < 5) return false;
  return series.every(s => s === series[0]);
}

// 装備探索メイン関数
// equipItems: equipment.jsonのitems配列
// targets: [{stat: "atk", needed: 50000}, {stat: "spd", needed: 30000}]
// currentStats: 現在のfinalTotal（装備を除いた基礎ステ＋プロテイン分）
// 戻り値: 提案ビルドの配列
function searchEquipBuild(equipItems, targets, currentStats) {
  if (!equipItems || equipItems.length === 0 || !targets || targets.length === 0) return [];

  const results = [];

  // スロット別に装備をグループ化
  const bySlot = {
    weapon:     equipItems.filter(i => i.slot === "weapon"  && !i.no_enhance),
    head:       equipItems.filter(i => i.slot === "head"),
    body:       equipItems.filter(i => i.slot === "body"),
    hands:      equipItems.filter(i => i.slot === "hands"),
    feet:       equipItems.filter(i => i.slot === "feet"),
    shield:     equipItems.filter(i => i.slot === "shield"),
    accessory:  equipItems.filter(i => i.slot === "accessory"),
  };

  // 各ターゲットステータスについて探索
  targets.forEach(({ stat, needed }) => {
    if (!needed || needed <= 0) return;

    const currentBase = Math.round(Number(currentStats?.[stat] || 0));
    const stillNeeded = Math.max(0, needed - currentBase);

    // --- 1. 武器・防具の貪欲選択 ---
    const armorSlots = ["head","body","hands","feet","shield"];
    const allPhysSlots = ["weapon", ...armorSlots];

    // 各スロットで最もstatに貢献する装備を選ぶ
    const bestBySlot = {};
    allPhysSlots.forEach(slot => {
      const candidates = bySlot[slot] || [];
      let best = null, bestVal = -1;
      candidates.forEach(item => {
        const val = calcWeaponArmorStat(item, stat);
        if (val > bestVal) { bestVal = val; best = item; }
      });
      bestBySlot[slot] = best;
    });

    // セットボーナス候補を探す
    const seriesGroups = {};
    armorSlots.forEach(slot => {
      (bySlot[slot] || []).forEach(item => {
        const s = item.series || "";
        if (!s) return;
        if (!seriesGroups[s]) seriesGroups[s] = {};
        if (!seriesGroups[s][slot] || calcWeaponArmorStat(item, stat) > calcWeaponArmorStat(seriesGroups[s][slot], stat)) {
          seriesGroups[s][slot] = item;
        }
      });
    });

    // セットボーナス込みの最大ステータスを計算
    let bestSetBonus = null;
    let bestSetBonusStat = -1;
    Object.entries(seriesGroups).forEach(([series, slots]) => {
      if (Object.keys(slots).length < 5) return;
      let sum = 0;
      armorSlots.forEach(sl => { sum += calcWeaponArmorStat(slots[sl], stat); });
      const withBonus = Math.floor(sum * 1.1);
      if (withBonus > bestSetBonusStat) {
        bestSetBonusStat = withBonus;
        bestSetBonus = { series, slots };
      }
    });

    // 通常（セットなし）の合計
    let normalSum = 0;
    allPhysSlots.forEach(slot => {
      normalSum += calcWeaponArmorStat(bestBySlot[slot], stat);
    });

    // セットあり vs なしで良い方を選ぶ
    let chosenArmorSlots = {};
    let chosenWeapon = bestBySlot["weapon"];
    let setBonus = false;

    if (bestSetBonus && (bestSetBonusStat + calcWeaponArmorStat(bestBySlot["weapon"], stat)) >= normalSum) {
      armorSlots.forEach(sl => { chosenArmorSlots[sl] = bestSetBonus.slots[sl]; });
      setBonus = true;
    } else {
      armorSlots.forEach(sl => { chosenArmorSlots[sl] = bestBySlot[sl]; });
    }

    let weaponArmorTotal = calcWeaponArmorStat(chosenWeapon, stat);
    armorSlots.forEach(sl => { weaponArmorTotal += calcWeaponArmorStat(chosenArmorSlots[sl], stat); });
    if (setBonus) weaponArmorTotal = Math.floor(weaponArmorTotal * 1.1);

    // --- 2. アクセサリ選択（add優先、次にrate）---
    const accCandidates = [...bySlot.accessory];

    // add値の高い順に4枠選ぶ（重複なし）
    accCandidates.sort((a, b) => {
      const aAcc = calcAccessoryStat(a, stat);
      const bAcc = calcAccessoryStat(b, stat);
      const aScore = (aAcc.add || 0) + (aAcc.rate || 0) * 1000;
      const bScore = (bAcc.add || 0) + (bAcc.rate || 0) * 1000;
      return bScore - aScore;
    });

    const chosenAcc = accCandidates.slice(0, 4);
    let accAddTotal = 0, accRateTotal = 0;
    chosenAcc.forEach(item => {
      const s = calcAccessoryStat(item, stat);
      accAddTotal  += s.add  || 0;
      accRateTotal += s.rate || 0;
    });

    // --- 3. 合計計算 ---
    // finalTotal ≈ (base + weaponArmor + accAdd) * (1 + accRate/100)
    const baseWithEquip = currentBase + weaponArmorTotal + accAddTotal;
    const finalEstimate = Math.floor(baseWithEquip * (1 + accRateTotal / 100));
    const achieved = finalEstimate >= needed;

    // --- 4. G強化必要数 ---
    let gNeeded = 0;
    if (!achieved) {
      const shortfall = needed - finalEstimate;
      // weaponで補う場合のG強化数
      if (chosenWeapon && !chosenWeapon.no_enhance) {
        const base = Number(chosenWeapon.base_add?.[stat] || 0);
        if (base > 0) {
          // G強化1個で得られる追加値
          const perG = base * 25 + 10000;
          gNeeded = Math.ceil(shortfall / perG);
        }
      }
    }

    results.push({
      stat,
      needed,
      currentBase,
      weapon:      chosenWeapon,
      armorSlots:  chosenArmorSlots,
      accessories: chosenAcc,
      weaponArmorTotal,
      accAddTotal,
      accRateTotal,
      finalEstimate,
      achieved,
      setBonus,
      gNeeded: achieved ? 0 : gNeeded
    });
  });

  return results;
}
