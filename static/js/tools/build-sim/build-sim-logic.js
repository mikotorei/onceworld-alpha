// ============================================================
// build-sim-logic.js  ビルドシミュレーター ゲームロジック（DOM非依存）
// calc-logic.js の関数を前提として読み込む
// ============================================================

// --- HP計算 ---
function calcMonsterHp(monster, lv) {
  const vitScaled = Math.floor(Number(monster.vit) * (1 + lv * 0.1));
  return vitScaled * 18 + 100;
}

// --- 物理防御（混合）---
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
      let npan = null;
      let oneShot = null;
      if (attackType === "physical") {
        const info = calcPhysicalKillInfo(heroStats.atk, heroStats.spd, monster, lv, heroElement, debuffWood, debuffDark);
        npan = info.npan;
        oneShot = info.oneShot;
      } else {
        const info = calcMagicKillInfo(heroStats.int, heroStats.analysisBook, heroStats.analysisBookAdvanced, heroStats.crystalCount, spell, monster, lv, heroElement, debuffWood);
        npan = info.npan;
        oneShot = info.oneShot;
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
  const neededAtk = Math.ceil((neededBase + physDef * 4) / 7);
  return Math.max(0, neededAtk);
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
  const neededIntPlusBook = neededPreDef / (1.25 * spellMul * crystalMul);
  return Math.max(0, Math.ceil(neededIntPlusBook - analysisBonus));
}
