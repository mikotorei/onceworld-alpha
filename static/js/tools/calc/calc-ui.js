// ============================================================
// calc-ui.js  UI・状態管理・イベント処理
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

(function () {
  // --- 入力フィールドのカンマ整形 ---
  attachCommaInputBehavior("hero-atk", 0);
  attachCommaInputBehavior("hero-int", 0);
  attachCommaInputBehavior("hero-spd", 0);
  attachCommaInputBehavior("analysis-book", 0);
  attachCommaInputBehavior("analysis-book-advanced", 0);
  attachCommaInputBehavior("crystal-count", 0);
  attachCommaInputBehavior("enemy-lv", 1);
})();

(function () {
  const LS_KEY = OWStorage.KEYS.CALC;

  // --- 出力要素 ---
  const outEnemyHp     = document.getElementById("out-enemy-hp");
  const outPhyDmg      = document.getElementById("out-phy-dmg");
  const outHits        = document.getElementById("out-hits");
  const outPhyNpan     = document.getElementById("out-phy-npan");
  const outPhyOne      = document.getElementById("out-phy-one");
  const outPhyOverkill = document.getElementById("out-phy-overkill");
  const outMagDmg      = document.getElementById("out-mag-dmg");
  const outMagNpan     = document.getElementById("out-mag-npan");
  const outMagOne      = document.getElementById("out-mag-one");
  const outMagOverkill = document.getElementById("out-mag-overkill");
  const outHitLuk       = document.getElementById("out-hit-luk");
  const outHitLukStable = document.getElementById("out-hit-luk-stable");
  const outEvadeLuk     = document.getElementById("out-evade-luk");
  const outNullDef     = document.getElementById("out-null-def");
  const outNullMdef    = document.getElementById("out-null-mdef");
  const nullDefRow     = document.getElementById("null-def-row");
  const nullMdefRow    = document.getElementById("null-mdef-row");

  // --- 結果ブロック ---
  const resultPhysical = document.getElementById("result-physical");
  const resultMagic    = document.getElementById("result-magic");

  // --- 操作要素 ---
  const calcBtn        = document.getElementById("calc-btn");
  const criticalToggle = document.getElementById("critical-toggle");
  const godEyeRow      = document.getElementById("god-eye-row");
  const godEye0Btn     = document.getElementById("god-eye-0");
  const godEye1000Btn  = document.getElementById("god-eye-1000");

  const search       = document.getElementById("monster-search");
  const suggest      = document.getElementById("monster-suggest");
  const selectedBox  = document.getElementById("monster-selected");
  const selectedName = document.getElementById("monster-selected-name");

  const lvInput      = document.getElementById("enemy-lv");
  const shortcutWrap = document.getElementById("lv-shortcuts");

  const physicalPanel          = document.getElementById("physical-panel");
  const magicPanel             = document.getElementById("magic-panel");
  const analysisBookRow         = document.getElementById("analysis-book-row");
  const analysisBookAdvancedRow = document.getElementById("analysis-book-advanced-row");
  const crystalRow              = document.getElementById("crystal-row");

  const attackTypeButtons  = Array.from(document.querySelectorAll("[data-attack-type]"));
  const heroElementButtons = Array.from(document.querySelectorAll("[data-hero-element]"));
  const spellButtons       = Array.from(document.querySelectorAll("[data-spell]"));

  const debuffWoodBtn      = document.getElementById("debuff-wood");
  const debuffDarkBtn      = document.getElementById("debuff-dark");
  const debuffWoodMagicBtn = document.getElementById("debuff-wood-magic");

  // --- 状態 ---
  let picked      = null;
  let currentLv   = 1;
  let enemyScaled = null;

  const state = {
    heroElement: "fire",
    attackType:  "physical",
    spell:       "fire",
    debuffWood:  false,
    debuffDark:  false,
    critical:    false,
    godEyeCount: 0
  };

  // --- UI ヘルパー ---
  function setCalcEnabled() {
    calcBtn.disabled = !picked;
  }

  function setPressed(buttons, selectedValue, attrName) {
    buttons.forEach(btn => {
      const value = btn.getAttribute(attrName);
      btn.setAttribute("aria-pressed", value === selectedValue ? "true" : "false");
    });
  }

  function setHiddenForce(el, isHidden) {
    if (!el) return;
    el.hidden = isHidden;
    el.style.setProperty("display", isHidden ? "none" : "", isHidden ? "important" : "");
  }

  function setDebuffButtons() {
    debuffWoodBtn.setAttribute("aria-pressed",      state.debuffWood && state.attackType === "physical" ? "true" : "false");
    debuffDarkBtn.setAttribute("aria-pressed",      state.debuffDark && state.attackType === "physical" ? "true" : "false");
    debuffWoodMagicBtn.setAttribute("aria-pressed", state.debuffWood && state.attackType === "magic"    ? "true" : "false");
    criticalToggle.setAttribute("aria-pressed", state.critical ? "true" : "false");
    criticalToggle.textContent = state.critical ? "クリティカルON" : "クリティカルOFF";
    godEye0Btn.setAttribute("aria-pressed",    state.godEyeCount === 0    ? "true" : "false");
    godEye1000Btn.setAttribute("aria-pressed", state.godEyeCount === 1000 ? "true" : "false");
  }

  function applyModeUI() {
    const isMagic = state.attackType === "magic";

    setHiddenForce(physicalPanel,           isMagic);
    setHiddenForce(magicPanel,              !isMagic);
    setHiddenForce(analysisBookRow,         !isMagic);
    setHiddenForce(analysisBookAdvancedRow, !isMagic);
    setHiddenForce(crystalRow,              !isMagic);
    setHiddenForce(criticalToggle,          isMagic);
    setHiddenForce(godEyeRow, isMagic || !state.critical);
    setHiddenForce(resultPhysical,          isMagic);
    setHiddenForce(resultMagic,             !isMagic);

    setPressed(attackTypeButtons,  state.attackType,  "data-attack-type");
    setPressed(heroElementButtons, state.heroElement, "data-hero-element");
    setPressed(spellButtons,       state.spell,       "data-spell");
    setDebuffButtons();

    if (picked) {
      enemyScaled = buildEnemyScaled(picked, currentLv, state);
    }
    saveState();
  }

  // --- localStorage ---
  function saveState() {
    try {
      const hero = {
        atk:                 normalizeFormattedNonNegIntValue(document.getElementById("hero-atk").value, 0),
        int:                 normalizeFormattedNonNegIntValue(document.getElementById("hero-int").value, 0),
        spd:                 normalizeFormattedNonNegIntValue(document.getElementById("hero-spd").value, 0),
        analysisBook:         normalizeFormattedNonNegIntValue(document.getElementById("analysis-book").value, 0),
        analysisBookAdvanced: normalizeFormattedNonNegIntValue(document.getElementById("analysis-book-advanced").value, 0),
        crystalCount:         normalizeFormattedNonNegIntValue(document.getElementById("crystal-count").value, 0)
      };
      const st = { monster_id: picked ? picked.id : "", lv: currentLv, hero, state };
      OWStorage.write(LS_KEY, st);
    } catch (e) {}
  }

  function loadState() {
    try {
      const st = OWStorage.read(LS_KEY);
      if (!st) return;

      if (st?.hero) {
        const map = {
          "hero-atk":              "atk",
          "hero-int":              "int",
          "hero-spd":              "spd",
          "analysis-book":          "analysisBook",
          "analysis-book-advanced": "analysisBookAdvanced",
          "crystal-count":          "crystalCount"
        };
        Object.keys(map).forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const v = st.hero[map[id]];
          if (v !== undefined && v !== null) {
            el.value = formatIntString(v);
          }
        });
      }

      if (Number.isFinite(Number(st?.lv))) {
        currentLv = Math.max(1, Math.floor(Number(st.lv)));
      }

      if (st?.state) {
        if (["fire", "water", "wood", "light", "dark"].includes(st.state.heroElement)) {
          state.heroElement = st.state.heroElement;
        }
        if (["physical", "magic"].includes(st.state.attackType)) {
          state.attackType = st.state.attackType;
        }
        if (["fire", "water", "wood", "light", "dark", "shingan"].includes(st.state.spell)) {
          state.spell = st.state.spell;
        }
        state.debuffWood = !!st.state.debuffWood;
        state.debuffDark = !!st.state.debuffDark;
        state.critical   = state.attackType === "physical" ? !!st.state.critical : false;
        state.godEyeCount = state.critical ? (Number(st.state.godEyeCount) === 1000 ? 1000 : 0) : 0;
      }
    } catch (e) {}
  }

  // --- モンスターサジェスト ---
  function closeSuggest() {
    suggest.hidden = true;
    suggest.innerHTML = "";
  }

  function normalizeJP(s) {
    const str = (s ?? "").toString().trim().toLowerCase();
    return str.replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }

  function filterMonsters(q) {
    if (!Array.isArray(window.MONSTERS)) return [];
    const query = normalizeJP(q);
    if (query.length === 0) return [];
    return window.MONSTERS
      .filter(m => normalizeJP(m.title ?? "").includes(query))
      .slice(0, 50);
  }

  function openSuggest(items) {
    suggest.hidden = false;
    suggest.innerHTML = "";
    items.forEach(m => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = m.title;
      btn.addEventListener("click", () => {
        picked = m;
        search.value = m.title;
        applyPickedUI();
        closeSuggest();
      });
      suggest.appendChild(btn);
    });
  }

  // --- レベルショートカット ---
  function renderShortcuts(shortcuts) {
    shortcutWrap.innerHTML = "";
    const arr = Array.isArray(shortcuts) ? shortcuts : [];
    if (!picked || arr.length === 0) return;

    arr.forEach(v => {
      // A案：{lv, label} / 旧形式：数値 の両方に対応
      const lv    = Math.floor(Number(v?.lv ?? v));
      const label = v?.label ? String(v.label) : String(lv);
      if (!Number.isFinite(lv) || lv < 1) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.title = `Lv ${formatIntString(lv)}`;
      btn.addEventListener("click", () => {
        currentLv = lv;
        lvInput.value = formatIntString(lv);
        enemyScaled = buildEnemyScaled(picked, currentLv, state);
        saveState();
      });
      shortcutWrap.appendChild(btn);
    });
  }

  // --- モンスター選択 UI ---
  function applyPickedUI() {
    if (!picked) {
      selectedBox.hidden = true;
      selectedName.textContent = "";
      lvInput.disabled = true;
      lvInput.value = formatIntString(currentLv);
      shortcutWrap.innerHTML = "";
      enemyScaled = null;
      setCalcEnabled();
      return;
    }

    selectedName.textContent = picked.title;
    selectedBox.hidden = false;
    lvInput.disabled = false;
    lvInput.value = formatIntString(currentLv);

    renderShortcuts(picked.level_shortcuts);

    enemyScaled = buildEnemyScaled(picked, currentLv, state);
    saveState();
    setCalcEnabled();
  }

  function clearPicked() {
    picked = null;
    enemyScaled = null;
    selectedBox.hidden = true;
    selectedName.textContent = "";
    lvInput.disabled = true;
    lvInput.value = formatIntString(currentLv);
    shortcutWrap.innerHTML = "";
    saveState();
    setCalcEnabled();
  }

  // --- 主人公ステータス取得 ---
  function getHeroInts() {
    return {
      atk:                  Math.max(0, parseFormattedInt(document.getElementById("hero-atk"), 0)),
      int:                  Math.max(0, parseFormattedInt(document.getElementById("hero-int"), 0)),
      spd:                  Math.max(0, parseFormattedInt(document.getElementById("hero-spd"), 0)),
      analysisBook:         Math.max(0, parseFormattedInt(document.getElementById("analysis-book"), 0)),
      analysisBookAdvanced: Math.max(0, parseFormattedInt(document.getElementById("analysis-book-advanced"), 0)),
      crystalCount:         Math.max(0, parseFormattedInt(document.getElementById("crystal-count"), 0))
    };
  }

  // --- 初期化 ---
  loadState();
  lvInput.value = formatIntString(currentLv);
  applyModeUI();
  setCalcEnabled();
  initBuildImport();

  ["hero-atk", "hero-int", "hero-spd", "analysis-book", "analysis-book-advanced", "crystal-count"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", saveState);
  });

  // localStorage からモンスターを復元
  (function restorePicked() {
    try {
        const st = OWStorage.read(LS_KEY);
        if (!st) return;
      const mid = (st?.monster_id ?? "").toString();
      if (!mid || !Array.isArray(window.MONSTERS)) return;
      const found = window.MONSTERS.find(m => String(m.id) === mid);
      if (!found) return;
      picked = found;
      search.value = found.title;
      applyPickedUI();
    } catch (e) {}
  })();

  // --- イベントリスナー ---
  heroElementButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.heroElement = btn.getAttribute("data-hero-element") || "fire";
      applyModeUI();
    });
  });

  attackTypeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.attackType = btn.getAttribute("data-attack-type") || "physical";
      if (state.attackType !== "physical") {
        state.debuffDark = false;
        state.critical   = false;
      }
      applyModeUI();
    });
  });

  spellButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.spell = btn.getAttribute("data-spell") || "fire";
      applyModeUI();
    });
  });

  debuffWoodBtn.addEventListener("click", () => {
    if (state.attackType !== "physical") return;
    state.debuffWood = !state.debuffWood;
    enemyScaled = picked ? buildEnemyScaled(picked, currentLv, state) : null;
    setDebuffButtons();
    saveState();
  });

  debuffDarkBtn.addEventListener("click", () => {
    if (state.attackType !== "physical") return;
    state.debuffDark = !state.debuffDark;
    enemyScaled = picked ? buildEnemyScaled(picked, currentLv, state) : null;
    setDebuffButtons();
    saveState();
  });

  debuffWoodMagicBtn.addEventListener("click", () => {
    if (state.attackType !== "magic") return;
    state.debuffWood = !state.debuffWood;
    enemyScaled = picked ? buildEnemyScaled(picked, currentLv, state) : null;
    setDebuffButtons();
    saveState();
  });

  criticalToggle.addEventListener("click", () => {
    if (state.attackType !== "physical") return;
    state.critical = !state.critical;
    if (!state.critical) state.godEyeCount = 0;
    setHiddenForce(godEyeRow, !state.critical);
    setDebuffButtons();
    saveState();
    calcBtn.click();
  });

  godEye0Btn.addEventListener("click", () => {
    state.godEyeCount = 0;
    setDebuffButtons();
    saveState();
    calcBtn.click();
  });

  godEye1000Btn.addEventListener("click", () => {
    state.godEyeCount = 1000;
    setDebuffButtons();
    saveState();
    calcBtn.click();
  });

  search.addEventListener("input", () => {
    const q = search.value;
    if (q.trim() === "") {
      clearPicked();
      closeSuggest();
      return;
    }
    if (picked && q !== picked.title) {
      clearPicked();
    }
    const items = filterMonsters(q);
    if (items.length === 0) closeSuggest();
    else openSuggest(items);
  });

  // type="search"の×ボタン対応
  search.addEventListener("search", () => {
    if (search.value.trim() === "") {
      clearPicked();
      closeSuggest();
    }
  });

  search.addEventListener("focus", () => {
    const q = search.value || "";
    const items = q.trim() === ""
      ? (window.MONSTERS || []).slice(0, 200)
      : filterMonsters(q);
    if (items.length > 0) openSuggest(items);
  });

  // type="search"の×ボタン対応
  search.addEventListener("search", () => {
    if (search.value.trim() === "") {
      clearPicked();
      closeSuggest();
    }
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t === search || suggest.contains(t)) return;
    closeSuggest();
  });

  lvInput.addEventListener("blur", () => {
    if (!picked) return;
    currentLv = normalizeLv(lvInput);
    enemyScaled = buildEnemyScaled(picked, currentLv, state);
    saveState();
  });

  // --- 計算ボタン ---
  calcBtn.addEventListener("click", () => {
    if (!picked || !enemyScaled) return;

    const hero         = getHeroInts();
    const enemyPhysDef = enemyScaled.def  + enemyScaled.mdef * 0.1;
    const enemyMagDef  = enemyScaled.mdef + enemyScaled.def  * 0.1;
    const enemyHp      = enemyScaled.vit * 18 + 100;
    const elementModifier   = getElementModifier(state.heroElement, enemyScaled.element);
    const criticalModifier  = state.critical ? getCriticalModifier(state.godEyeCount) : 1.0;

    // 実体力
    outEnemyHp.textContent = fmt(enemyHp);

    if (state.attackType === "physical") {
      const hits = hitsFromSpd(hero.spd);
      outHits.textContent = fmt(hits);

      const touShouCount = Math.max(0, Math.min(1000, parseInt(document.getElementById("toushou-count")?.value||"0", 10)||0));
      const phy = damageRangeTotal(hero.atk, enemyPhysDef, 0, hits, elementModifier, criticalModifier, touShouCount);
      outPhyDmg.textContent = formatMinMax(phy.min, phy.max);

      // 物理 平均nパン
      const phyAvg = Math.floor((phy.min + phy.max) / 2);
      if (phyAvg > 0) {
        const phyNpan = Math.ceil(enemyHp / phyAvg);
        outPhyNpan.textContent = `${phyNpan}パン（平均ダメ: ${fmt(phyAvg)}）`;
      } else {
        outPhyNpan.textContent = "-";
      }

      const reqAtk = oneShotLineRequiredAttack(enemyPhysDef, 0, hits, enemyHp, elementModifier, criticalModifier, touShouCount);
      outPhyOne.textContent = `atk${fmt(reqAtk)}以上`;

      const reqAtkOverkill = oneShotLineRequiredAttack(enemyPhysDef, 0, 1, enemyHp * 10, elementModifier, criticalModifier, touShouCount);
      outPhyOverkill.textContent = `atk${fmt(reqAtkOverkill)}以上`;

      const mag = calcMagicDamageRange({
        heroInt: hero.int,
        analysisBook: hero.analysisBook,
        analysisBookAdvanced: hero.analysisBookAdvanced,
        crystalCount: hero.crystalCount,
        spell: state.spell,
        enemyMagDef,
        heroElement: state.heroElement,
        enemyElement: enemyScaled.element
      });

      // 魔法 平均nパン（物理モードでも参考表示）
      const magAvg = Math.floor((mag.min + mag.max) / 2);
      if (magAvg > 0) {
        const magNpan = Math.ceil(enemyHp / magAvg);
        outMagNpan.textContent = `${magNpan}パン（平均ダメ: ${fmt(magAvg)}）`;
      } else {
        outMagNpan.textContent = "-";
      }
      outMagDmg.textContent = `${formatMinMax(mag.min, mag.max)}（この範囲内）`;

      const reqInt = calcMagicOneShotRequiredInt({
        hp: enemyHp,
        analysisBook: hero.analysisBook,
        analysisBookAdvanced: hero.analysisBookAdvanced,
        crystalCount: hero.crystalCount,
        spell: state.spell,
        enemyMagDef,
        heroElement: state.heroElement,
        enemyElement: enemyScaled.element
      });
      outMagOne.textContent = `int${fmt(reqInt)}以上`;

      const reqIntOverkill = calcMagicOneShotRequiredInt({
        hp: enemyHp * 10,
        analysisBook: hero.analysisBook,
        analysisBookAdvanced: hero.analysisBookAdvanced,
        crystalCount: hero.crystalCount,
        spell: state.spell,
        enemyMagDef,
        heroElement: state.heroElement,
        enemyElement: enemyScaled.element
      });
      outMagOverkill.textContent = `int${fmt(reqIntOverkill)}以上`;

    } else {
      const mag = calcMagicDamageRange({
        heroInt: hero.int,
        analysisBook: hero.analysisBook,
        analysisBookAdvanced: hero.analysisBookAdvanced,
        crystalCount: hero.crystalCount,
        spell: state.spell,
        enemyMagDef,
        heroElement: state.heroElement,
        enemyElement: enemyScaled.element
      });

      // 魔法 平均nパン
      const magAvg = Math.floor((mag.min + mag.max) / 2);
      if (magAvg > 0) {
        const magNpan = Math.ceil(enemyHp / magAvg);
        outMagNpan.textContent = `${magNpan}パン（平均ダメ: ${fmt(magAvg)}）`;
      } else {
        outMagNpan.textContent = "-";
      }
      outMagDmg.textContent = `${formatMinMax(mag.min, mag.max)}（この範囲内）`;

      const reqInt = calcMagicOneShotRequiredInt({
        hp: enemyHp,
        analysisBook: hero.analysisBook,
        analysisBookAdvanced: hero.analysisBookAdvanced,
        crystalCount: hero.crystalCount,
        spell: state.spell,
        enemyMagDef,
        heroElement: state.heroElement,
        enemyElement: enemyScaled.element
      });
      outMagOne.textContent = `int${fmt(reqInt)}以上`;

      const reqIntOverkill = calcMagicOneShotRequiredInt({
        hp: enemyHp * 10,
        analysisBook: hero.analysisBook,
        analysisBookAdvanced: hero.analysisBookAdvanced,
        crystalCount: hero.crystalCount,
        spell: state.spell,
        enemyMagDef,
        heroElement: state.heroElement,
        enemyElement: enemyScaled.element
      });
      outMagOverkill.textContent = `int${fmt(reqIntOverkill)}以上`;
    }

    outHitLuk.textContent      = `${fmt(Math.floor(enemyScaled.luk / 2))}以上`;
    outHitLukStable.textContent = `${fmt(enemyScaled.luk)}以上`;
    outEvadeLuk.textContent    = `${fmt(Math.floor(enemyScaled.luk * 3))}以上`;

    // 無効化：敵攻撃タイプで表示切替
    const isEnemyPhysical = (picked.attack_type !== "魔法" && picked.attack_type !== "magic");
    setHiddenForce(nullDefRow,  !isEnemyPhysical);
    setHiddenForce(nullMdefRow, isEnemyPhysical);
    outNullDef.textContent  = `${fmt(requiredDefenseForNullify(enemyScaled.atk))}以上`;
    outNullMdef.textContent = `${fmt(requiredDefenseForNullify(enemyScaled.int))}以上`;
  });

  // --- ビルド引用 ---
  function initBuildImport() {
    const BUILD_STORAGE_KEY = OWStorage.KEYS.BUILD_SLOTS;
    const importSelect = document.getElementById("build-import-select");
    const importBtn    = document.getElementById("build-import-btn");
    if (!importSelect || !importBtn) return;

    function loadBuilds() {
      return OWStorage.read(BUILD_STORAGE_KEY, {}) || {};
    }

    function refreshImportSelect() {
      const builds = loadBuilds();
      const names  = Object.keys(builds).sort(function(a, b) { return a.localeCompare(b, "ja"); });
      importSelect.innerHTML = "";
      importSelect.appendChild(new Option("（未選択）", ""));
      names.forEach(function(name) { importSelect.appendChild(new Option(name, name)); });
    }

    function applyBuildToCalc(name) {
      const builds = loadBuilds();
      const build  = builds[name];
      if (!build) return;
      const ft = build.finalTotal;
      if (!ft) {
        alert("このビルドには最終ステータスが記録されていません。\nステータスシミュレーターで再保存してください。");
        return;
      }
      var atkEl = document.getElementById("hero-atk");
      var intEl = document.getElementById("hero-int");
      var spdEl = document.getElementById("hero-spd");
      if (atkEl) { atkEl.value = formatIntString(Math.round(ft.atk || 0)); }
      if (intEl) { intEl.value = formatIntString(Math.round(ft.int || 0)); }
      if (spdEl) { spdEl.value = formatIntString(Math.round(ft.spd || 0)); }
      saveState();
    }

    refreshImportSelect();
    importBtn.addEventListener("click", function() {
      const name = importSelect.value;
      if (!name) return;
      applyBuildToCalc(name);
    });

    // ステシミュ側で保存が行われたとき（別タブ等）にselectを更新
    OWStorage.onChange(BUILD_STORAGE_KEY, refreshImportSelect);
  }
})();

}); // DOMContentLoaded
