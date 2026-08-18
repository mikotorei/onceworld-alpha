// ============================================================
// detail-calc-ui.js  詳細計算機 UI・状態管理・イベント処理
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

(function () {
  // --- カンマ整形 ---
  const heroInputIds = [
    "detail-hero-vit", "detail-hero-spd", "detail-hero-atk",
    "detail-hero-int", "detail-hero-def", "detail-hero-mdef", "detail-hero-luk",
    "detail-analysis-book", "detail-analysis-book-advanced", "detail-crystal-count"
  ];
  const enemyInputIds = [
    "detail-enemy-vit", "detail-enemy-spd", "detail-enemy-atk",
    "detail-enemy-int", "detail-enemy-def", "detail-enemy-mdef", "detail-enemy-luk",
    "detail-enemy-lv"
  ];
  heroInputIds.forEach(id => attachCommaInputBehavior(id, 0));
  enemyInputIds.forEach(id => attachCommaInputBehavior(id, 0));
})();

(function () {
  const LS_KEY = OWStorage.KEYS.DETAIL_CALC;
  const BUILD_STORAGE_KEY = OWStorage.KEYS.BUILD_SLOTS;

  // --- 出力要素 ---
  const outEnemyHp      = document.getElementById("detail-out-enemy-hp");
  const outPhyDmg       = document.getElementById("detail-out-phy-dmg");
  const outHits         = document.getElementById("detail-out-hits");
  const outPhyMinAtk    = document.getElementById("detail-out-phy-min-atk");
  const outPhyNpan      = document.getElementById("detail-out-phy-npan");
  const outPhyOne       = document.getElementById("detail-out-phy-one");
  const outPhyOverkill  = document.getElementById("detail-out-phy-overkill");
  const outCriticalRate = document.getElementById("detail-out-critical-rate");
  const outMagDmg       = document.getElementById("detail-out-mag-dmg");
  const outMagMinInt    = document.getElementById("detail-out-mag-min-int");
  const outMagNpan      = document.getElementById("detail-out-mag-npan");
  const outMagOne       = document.getElementById("detail-out-mag-one");
  const outMagOverkill  = document.getElementById("detail-out-mag-overkill");
  const outHitLuk       = document.getElementById("detail-out-hit-luk");
  const outHitLukStable = document.getElementById("detail-out-hit-luk-stable");
  const outEvadeLuk     = document.getElementById("detail-out-evade-luk");
  const outNullDef      = document.getElementById("detail-out-null-def");
  const outNullMdef     = document.getElementById("detail-out-null-mdef");
  const outRecvDmg      = document.getElementById("detail-out-recv-dmg");
  const nullDefRow      = document.getElementById("detail-null-def-row");
  const nullMdefRow     = document.getElementById("detail-null-mdef-row");

  // --- 結果ブロック ---
  const resultPhysical = document.getElementById("detail-result-physical");
  const resultMagic    = document.getElementById("detail-result-magic");

  // --- 操作要素 ---
  const calcBtn         = document.getElementById("detail-calc-btn");
  const criticalToggle  = document.getElementById("detail-critical-toggle");
  const godEyeRow       = document.getElementById("detail-god-eye-row");
  const godEye0Btn      = document.getElementById("detail-god-eye-0");
  const godEye1000Btn   = document.getElementById("detail-god-eye-1000");

  const physicalPanel          = document.getElementById("detail-physical-panel");
  const magicPanel             = document.getElementById("detail-magic-panel");
  const analysisBookRow        = document.getElementById("detail-analysis-book-row");
  const analysisBookAdvancedRow = document.getElementById("detail-analysis-book-advanced-row");
  const crystalRow             = document.getElementById("detail-crystal-row");

  const search       = document.getElementById("detail-monster-search");
  const suggest      = document.getElementById("detail-monster-suggest");
  const selectedBox  = document.getElementById("detail-monster-selected");
  const selectedName = document.getElementById("detail-monster-selected-name");
  const lvInput      = document.getElementById("detail-enemy-lv");

  const attackTypeButtons      = Array.from(document.querySelectorAll("[data-detail-attack-type]"));
  const heroElementButtons     = Array.from(document.querySelectorAll("[data-detail-hero-element]"));
  const spellButtons           = Array.from(document.querySelectorAll("[data-detail-spell]"));
  const enemyElementButtons    = Array.from(document.querySelectorAll("[data-detail-enemy-element]"));
  const enemyAttackTypeButtons = Array.from(document.querySelectorAll("[data-detail-enemy-attack-type]"));

  const debuffWoodBtn      = document.getElementById("detail-debuff-wood");
  const debuffDarkBtn      = document.getElementById("detail-debuff-dark");
  const debuffWoodMagicBtn = document.getElementById("detail-debuff-wood-magic");

  // --- 状態 ---
  let pickedMonster = null;

  const state = {
    heroElement:      "fire",
    attackType:       "physical",
    spell:            "fire",
    enemyElement:     "",
    enemyAttackType:  "physical",
    debuffWood:       false,
    debuffDark:       false,
    critical:         false,
    godEyeCount:      0
  };

  // --- UI ヘルパー ---
  function setHiddenForce(el, isHidden) {
    if (!el) return;
    el.hidden = isHidden;
    el.style.setProperty("display", isHidden ? "none" : "", isHidden ? "important" : "");
  }

  function setPressed(buttons, selectedValue, attrName) {
    buttons.forEach(btn => {
      btn.setAttribute("aria-pressed", btn.getAttribute(attrName) === selectedValue ? "true" : "false");
    });
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
    setHiddenForce(physicalPanel,            isMagic);
    setHiddenForce(magicPanel,               !isMagic);
    setHiddenForce(analysisBookRow,          !isMagic);
    setHiddenForce(analysisBookAdvancedRow,  !isMagic);
    setHiddenForce(crystalRow,               !isMagic);
    setHiddenForce(criticalToggle,           isMagic);
    setHiddenForce(godEyeRow,                isMagic || !state.critical);
    setHiddenForce(resultPhysical,           isMagic);
    setHiddenForce(resultMagic,              !isMagic);

    setPressed(attackTypeButtons,   state.attackType,   "data-detail-attack-type");
    setPressed(heroElementButtons,  state.heroElement,  "data-detail-hero-element");
    setPressed(spellButtons,        state.spell,        "data-detail-spell");
    setPressed(enemyElementButtons, state.enemyElement, "data-detail-enemy-element");
    setDebuffButtons();
    saveState();
  }

  // --- 敵ステータス入力欄の読み取り ---
  function getEnemyInputs() {
    return {
      vit:  Math.max(0, parseFormattedInt(document.getElementById("detail-enemy-vit"), 0)),
      spd:  Math.max(0, parseFormattedInt(document.getElementById("detail-enemy-spd"), 0)),
      atk:  Math.max(0, parseFormattedInt(document.getElementById("detail-enemy-atk"), 0)),
      int:  Math.max(0, parseFormattedInt(document.getElementById("detail-enemy-int"), 0)),
      def:  Math.max(0, parseFormattedInt(document.getElementById("detail-enemy-def"), 0)),
      mdef: Math.max(0, parseFormattedInt(document.getElementById("detail-enemy-mdef"), 0)),
      luk:  Math.max(0, parseFormattedInt(document.getElementById("detail-enemy-luk"), 0))
    };
  }

  // --- 主人公ステータス入力欄の読み取り ---
  function getHeroInputs() {
    return {
      vit:                 Math.max(0, parseFormattedInt(document.getElementById("detail-hero-vit"), 0)),
      spd:                 Math.max(0, parseFormattedInt(document.getElementById("detail-hero-spd"), 0)),
      atk:                 Math.max(0, parseFormattedInt(document.getElementById("detail-hero-atk"), 0)),
      int:                 Math.max(0, parseFormattedInt(document.getElementById("detail-hero-int"), 0)),
      def:                 Math.max(0, parseFormattedInt(document.getElementById("detail-hero-def"), 0)),
      mdef:                Math.max(0, parseFormattedInt(document.getElementById("detail-hero-mdef"), 0)),
      luk:                 Math.max(0, parseFormattedInt(document.getElementById("detail-hero-luk"), 0)),
      analysisBook:        Math.max(0, parseFormattedInt(document.getElementById("detail-analysis-book"), 0)),
      analysisBookAdvanced: Math.max(0, parseFormattedInt(document.getElementById("detail-analysis-book-advanced"), 0)),
      crystalCount:        Math.max(0, parseFormattedInt(document.getElementById("detail-crystal-count"), 0))
    };
  }

  // 会心率は common/calc-logic.js の calcCritRate を使用する

  // --- 補正後ステータス表示 ---
  const scaledSpans = {
    vit:  document.getElementById("detail-enemy-vit-scaled"),
    spd:  document.getElementById("detail-enemy-spd-scaled"),
    atk:  document.getElementById("detail-enemy-atk-scaled"),
    int:  document.getElementById("detail-enemy-int-scaled"),
    def:  document.getElementById("detail-enemy-def-scaled"),
    mdef: document.getElementById("detail-enemy-mdef-scaled"),
    luk:  document.getElementById("detail-enemy-luk-scaled")
  };

  function updateScaledDisplay() {
    const lv = Math.max(1, parseFormattedInt(lvInput, 1));

    // ヘッダーのLv表記を更新
    const header = document.getElementById("detail-scaled-header");
    if (header) header.textContent = `Lv${fmt(lv)}でのステータス`;
    const statIds = {
      vit:  "detail-enemy-vit",
      spd:  "detail-enemy-spd",
      atk:  "detail-enemy-atk",
      int:  "detail-enemy-int",
      def:  "detail-enemy-def",
      mdef: "detail-enemy-mdef",
      luk:  "detail-enemy-luk"
    };
    Object.keys(statIds).forEach(key => {
      const base   = parseFormattedInt(document.getElementById(statIds[key]), 0);
      const scaled = lv === 1 ? base : scaleStat(base, lv);
      if (scaledSpans[key]) scaledSpans[key].textContent = `→ ${fmt(scaled)}`;
    });
  }
  function setEnemyInputs(vals) {
    const map = {
      "detail-enemy-vit":  "vit",
      "detail-enemy-spd":  "spd",
      "detail-enemy-atk":  "atk",
      "detail-enemy-int":  "int",
      "detail-enemy-def":  "def",
      "detail-enemy-mdef": "mdef",
      "detail-enemy-luk":  "luk"
    };
    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      if (el && vals[map[id]] !== undefined) {
        el.value = formatIntString(vals[map[id]]);
      }
    });
  }

  // --- モンスターサジェスト ---
  function closeSuggest() {
    suggest.hidden = true;
    suggest.innerHTML = "";
  }

  function normalizeJP(s) {
    return (s ?? "").toString().trim().toLowerCase()
      .replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }

  function filterMonsters(q) {
    if (!Array.isArray(window.MONSTERS)) return [];
    const query = normalizeJP(q);
    if (query.length === 0) return [];
    return window.MONSTERS.filter(m => normalizeJP(m.title ?? "").includes(query)).slice(0, 50);
  }

  function applyMonsterToInputs(m, lv) {
    setEnemyInputs({ vit: m.vit, spd: m.spd, atk: m.atk, int: m.int, def: m.def, mdef: m.mdef, luk: m.luk });
    lvInput.value = formatIntString(lv);

    // 属性を反映
    const el = normalizeElement(m.element);
    state.enemyElement = el;
    setPressed(enemyElementButtons, el, "data-detail-enemy-element");

    // 攻撃タイプを反映
    const at = (m.attack_type === "魔法" || m.attack_type === "magic") ? "magic" : "physical";
    state.enemyAttackType = at;
    setPressed(enemyAttackTypeButtons, at, "data-detail-enemy-attack-type");

    updateScaledDisplay();
  }

  function openSuggest(items) {
    suggest.hidden = false;
    suggest.innerHTML = "";
    items.forEach(m => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = m.title;
      btn.addEventListener("click", () => {
        pickedMonster = m;
        search.value = m.title;
        selectedName.textContent = m.title;
        selectedBox.hidden = false;
        const lv = Math.max(1, parseFormattedInt(lvInput, 1));
        applyMonsterToInputs(m, lv);
        closeSuggest();
        saveState();
      });
      suggest.appendChild(btn);
    });
  }

  // --- localStorage ---
  function saveState() {
    try {
      const hero  = getHeroInputs();
      const enemy = getEnemyInputs();
      const lv    = parseFormattedInt(lvInput, 1);
      const st = {
        hero, enemy, lv,
        monster_id: pickedMonster ? pickedMonster.id : "",
        state
      };
      OWStorage.write(LS_KEY, st);
    } catch (e) {}
  }

  function loadState() {
    try {
      const st = OWStorage.read(LS_KEY);
      if (!st) return;

      if (st?.hero) {
        const heroMap = {
          "detail-hero-vit":                "vit",
          "detail-hero-spd":                "spd",
          "detail-hero-atk":                "atk",
          "detail-hero-int":                "int",
          "detail-hero-def":                "def",
          "detail-hero-mdef":               "mdef",
          "detail-hero-luk":                "luk",
          "detail-analysis-book":           "analysisBook",
          "detail-analysis-book-advanced":  "analysisBookAdvanced",
          "detail-crystal-count":           "crystalCount"
        };
        Object.keys(heroMap).forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const v = st.hero[heroMap[id]];
          if (v !== undefined) el.value = formatIntString(v);
        });
      }

      if (st?.enemy) {
        setEnemyInputs(st.enemy);
      }

      if (Number.isFinite(Number(st?.lv))) {
        lvInput.value = formatIntString(Math.max(1, Math.floor(Number(st.lv))));
      }

      if (st?.state) {
        if (["fire","water","wood","light","dark"].includes(st.state.heroElement))  state.heroElement  = st.state.heroElement;
        if (["physical","magic"].includes(st.state.attackType))                     state.attackType   = st.state.attackType;
        if (["fire","water","wood","light","dark","shingan"].includes(st.state.spell))        state.spell        = st.state.spell;
        if (["fire","water","wood","light","dark",""].includes(st.state.enemyElement)) state.enemyElement = st.state.enemyElement;
        if (["physical","magic"].includes(st.state.enemyAttackType)) state.enemyAttackType = st.state.enemyAttackType;
        state.debuffWood  = !!st.state.debuffWood;
        state.debuffDark  = !!st.state.debuffDark;
        state.critical    = state.attackType === "physical" ? !!st.state.critical : false;
        state.godEyeCount = state.critical ? (Number(st.state.godEyeCount) === 1000 ? 1000 : 0) : 0;
      }

      if (st?.monster_id && Array.isArray(window.MONSTERS)) {
        const found = window.MONSTERS.find(m => String(m.id) === String(st.monster_id));
        if (found) {
          pickedMonster = found;
          search.value = found.title;
          selectedName.textContent = found.title;
          selectedBox.hidden = false;
        }
      }
    } catch (e) {}
  }

  // --- ビルド引用 ---
  function initBuildImport() {
    const importSelect = document.getElementById("detail-build-import-select");
    const importBtn    = document.getElementById("detail-build-import-btn");
    if (!importSelect || !importBtn) return;

    function loadBuilds() {
      return OWStorage.read(BUILD_STORAGE_KEY, {}) || {};
    }

    function refreshSelect() {
      const builds = loadBuilds();
      const names  = Object.keys(builds).sort((a, b) => a.localeCompare(b, "ja"));
      importSelect.innerHTML = "";
      importSelect.appendChild(new Option("（未選択）", ""));
      names.forEach(name => importSelect.appendChild(new Option(name, name)));
    }

    importBtn.addEventListener("click", () => {
      const name = importSelect.value;
      if (!name) return;
      const builds = loadBuilds();
      const build  = builds[name];
      if (!build) return;
      const ft = build.finalTotal;
      if (!ft) {
        alert("このビルドには最終ステータスが記録されていません。\nステータスシミュレーターで再保存してください。");
        return;
      }
      const map = {
        "detail-hero-vit":  "vit",
        "detail-hero-spd":  "spd",
        "detail-hero-atk":  "atk",
        "detail-hero-int":  "int",
        "detail-hero-def":  "def",
        "detail-hero-mdef": "mdef",
        "detail-hero-luk":  "luk"
      };
      Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = formatIntString(Math.round(ft[map[id]] || 0));
      });
      saveState();
    });

    refreshSelect();
    OWStorage.onChange(BUILD_STORAGE_KEY, refreshSelect);
  }

  // --- 初期化 ---
  loadState();
  applyModeUI();
  updateScaledDisplay();
  initBuildImport();

  // blurでsaveState
  const allInputIds = [
    "detail-hero-vit", "detail-hero-spd", "detail-hero-atk",
    "detail-hero-int", "detail-hero-def", "detail-hero-mdef", "detail-hero-luk",
    "detail-analysis-book", "detail-analysis-book-advanced", "detail-crystal-count",
    "detail-enemy-vit", "detail-enemy-spd", "detail-enemy-atk",
    "detail-enemy-int", "detail-enemy-def", "detail-enemy-mdef", "detail-enemy-luk"
  ];
  allInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("blur", saveState);
  });

  // 敵ステータス入力欄の変更で補正後表示を更新
  ["detail-enemy-vit", "detail-enemy-spd", "detail-enemy-atk",
   "detail-enemy-int", "detail-enemy-def", "detail-enemy-mdef", "detail-enemy-luk"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateScaledDisplay);
  });

  // --- イベントリスナー ---
  attackTypeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.attackType = btn.getAttribute("data-detail-attack-type") || "physical";
      if (state.attackType !== "physical") {
        state.debuffDark = false;
        state.critical   = false;
        state.godEyeCount = 0;
      }
      applyModeUI();
    });
  });

  heroElementButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.heroElement = btn.getAttribute("data-detail-hero-element") || "fire";
      applyModeUI();
    });
  });

  spellButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.spell = btn.getAttribute("data-detail-spell") || "fire";
      applyModeUI();
    });
  });

  enemyElementButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.enemyElement = btn.getAttribute("data-detail-enemy-element") ?? "";
      setPressed(enemyElementButtons, state.enemyElement, "data-detail-enemy-element");
      saveState();
    });
  });

  enemyAttackTypeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.enemyAttackType = btn.getAttribute("data-detail-enemy-attack-type") || "physical";
      setPressed(enemyAttackTypeButtons, state.enemyAttackType, "data-detail-enemy-attack-type");
      saveState();
    });
  });

  debuffWoodBtn.addEventListener("click", () => {
    if (state.attackType !== "physical") return;
    state.debuffWood = !state.debuffWood;
    setDebuffButtons();
    saveState();
  });

  debuffDarkBtn.addEventListener("click", () => {
    if (state.attackType !== "physical") return;
    state.debuffDark = !state.debuffDark;
    setDebuffButtons();
    saveState();
  });

  debuffWoodMagicBtn.addEventListener("click", () => {
    if (state.attackType !== "magic") return;
    state.debuffWood = !state.debuffWood;
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

  // --- クリアボタン ---
  document.getElementById("detail-hero-clear").addEventListener("click", () => {
    ["detail-hero-vit", "detail-hero-spd", "detail-hero-atk",
     "detail-hero-int", "detail-hero-def", "detail-hero-mdef", "detail-hero-luk"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "0";
    });
    saveState();
  });

  document.getElementById("detail-enemy-clear").addEventListener("click", () => {
    ["detail-enemy-vit", "detail-enemy-spd", "detail-enemy-atk",
     "detail-enemy-int", "detail-enemy-def", "detail-enemy-mdef", "detail-enemy-luk"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "0";
    });
    updateScaledDisplay();
    saveState();
  });

  // モンスター検索
  search.addEventListener("input", () => {
    const q = search.value;
    if (q.trim() === "") {
      pickedMonster = null;
      selectedBox.hidden = true;
      selectedName.textContent = "";
      closeSuggest();
      return;
    }
    if (pickedMonster && q !== pickedMonster.title) {
      pickedMonster = null;
      selectedBox.hidden = true;
    }
    const items = filterMonsters(q);
    if (items.length === 0) closeSuggest();
    else openSuggest(items);
  });

  search.addEventListener("search", () => {
    if (search.value.trim() === "") {
      pickedMonster = null;
      suggest.hidden = true;
      suggest.innerHTML = "";
      search.value = "";
      saveState();
    }
  });

  search.addEventListener("focus", () => {
    const q = search.value || "";
    const items = q.trim() === ""
      ? (window.MONSTERS || []).slice(0, 200)
      : filterMonsters(q);
    if (items.length > 0) openSuggest(items);
  });

  document.addEventListener("click", e => {
    if (e.target === search || suggest.contains(e.target)) return;
    closeSuggest();
  });

  // Lv変更で敵ステータス再適用
  lvInput.addEventListener("blur", () => {
    const lv = Math.max(1, parseFormattedInt(lvInput, 1));
    lvInput.value = formatIntString(lv);
    if (pickedMonster) {
      applyMonsterToInputs(pickedMonster, lv);
    }
    updateScaledDisplay();
    saveState();
  });

  // --- 計算ボタン ---
  calcBtn.addEventListener("click", () => {
    const hero  = getHeroInputs();
    const base  = getEnemyInputs();
    const lv    = Math.max(1, parseFormattedInt(lvInput, 1));

    // レベル補正後の値を使用（Lv1はスケールなし）
    const enemy = {
      vit:  lv === 1 ? base.vit  : scaleStat(base.vit,  lv),
      spd:  lv === 1 ? base.spd  : scaleStat(base.spd,  lv),
      atk:  lv === 1 ? base.atk  : scaleStat(base.atk,  lv),
      int:  lv === 1 ? base.int  : scaleStat(base.int,  lv),
      def:  lv === 1 ? base.def  : scaleStat(base.def,  lv),
      mdef: lv === 1 ? base.mdef : scaleStat(base.mdef, lv),
      luk:  lv === 1 ? base.luk  : scaleStat(base.luk,  lv)
    };

    // デバフ適用
    const enemyDef  = state.debuffWood ? Math.floor(enemy.def  / 2) : enemy.def;
    const enemyLuk  = state.debuffDark ? Math.floor(enemy.luk  / 2) : enemy.luk;

    const enemyPhysDef = enemyDef + enemy.mdef * 0.1;
    const enemyMagDef  = enemy.mdef + enemyDef * 0.1;
    const enemyHp      = enemy.vit * 18 + 100;

    const elementModifier  = getElementModifier(state.heroElement, state.enemyElement);
    const criticalModifier = state.critical ? getCriticalModifier(state.godEyeCount) : 1.0;

    outEnemyHp.textContent = fmt(enemyHp);

    if (state.attackType === "physical") {
      const hits = hitsFromSpd(hero.spd);
      outHits.textContent = fmt(hits);

      const touShouCount = Math.max(0, Math.min(1000, parseInt(document.getElementById("detail-toushou-count")?.value||"0", 10)||0));
      const phy = damageRangeTotal(hero.atk, enemyPhysDef, 0, hits, elementModifier, criticalModifier, touShouCount);
      outPhyDmg.textContent = formatMinMax(phy.min, phy.max);

      // 最小atk（ダメージ1以上になる最小値）
      const minAtk = Math.floor(enemyPhysDef * 4 / 7) + 1;
      outPhyMinAtk.textContent = `atk${fmt(minAtk)}以上`;

      const phyAvg = Math.floor((phy.min + phy.max) / 2);
      outPhyNpan.textContent = phyAvg > 0
        ? `${Math.ceil(enemyHp / phyAvg)}パン（平均ダメ: ${fmt(phyAvg)}）`
        : "-";

      outPhyOne.textContent = `atk${fmt(oneShotLineRequiredAttack(enemyPhysDef, 0, hits, enemyHp, elementModifier, criticalModifier, touShouCount))}以上`;
      outPhyOverkill.textContent = `atk${fmt(oneShotLineRequiredAttack(enemyPhysDef, 0, 1, enemyHp * 10, elementModifier, criticalModifier, touShouCount))}以上`;

      // クリティカル発生率
      const critRate = calcCritRate(hero.luk, enemyLuk);
      outCriticalRate.textContent = critRate === 0
        ? `0%（主人公luk不足）`
        : `約${critRate}%（主人公luk: ${fmt(hero.luk)} / 敵luk: ${fmt(enemyLuk)}）`;

    } else {
      const mag = calcMagicDamageRange({
        heroInt: hero.int,
        analysisBook: hero.analysisBook,
        analysisBookAdvanced: hero.analysisBookAdvanced,
        crystalCount: hero.crystalCount,
        spell: state.spell,
        enemyMagDef,
        heroElement: state.heroElement,
        enemyElement: state.enemyElement
      });

      const magAvg = Math.floor((mag.min + mag.max) / 2);
      outMagNpan.textContent = magAvg > 0
        ? `${Math.ceil(enemyHp / magAvg)}パン（平均ダメ: ${fmt(magAvg)}）`
        : "-";
      outMagDmg.textContent = `${formatMinMax(mag.min, mag.max)}（この範囲内）`;

      // 最小int（ダメージ1以上になる最小値）
      const analysisBonus    = calcAnalysisBonus(hero.analysisBook, hero.analysisBookAdvanced);
      const spellMult        = getSpellMultiplier(state.spell);
      const crystalMult      = getCrystalMultiplier(hero.crystalCount);
      const minInt = Math.max(0, Math.ceil(enemyMagDef / (1.25 * spellMult * crystalMult) - analysisBonus));
      outMagMinInt.textContent = `int${fmt(minInt)}以上`;

      outMagOne.textContent = `int${fmt(calcMagicOneShotRequiredInt({
        hp: enemyHp,
        analysisBook: hero.analysisBook,
        analysisBookAdvanced: hero.analysisBookAdvanced,
        crystalCount: hero.crystalCount,
        spell: state.spell,
        enemyMagDef,
        heroElement: state.heroElement,
        enemyElement: state.enemyElement
      }))}以上`;

      outMagOverkill.textContent = `int${fmt(calcMagicOneShotRequiredInt({
        hp: enemyHp * 10,
        analysisBook: hero.analysisBook,
        analysisBookAdvanced: hero.analysisBookAdvanced,
        crystalCount: hero.crystalCount,
        spell: state.spell,
        enemyMagDef,
        heroElement: state.heroElement,
        enemyElement: state.enemyElement
      }))}以上`;
    }

    outHitLuk.textContent       = `${fmt(Math.floor(enemyLuk / 2))}以上`;
    outHitLukStable.textContent = `${fmt(enemyLuk)}以上`;
    outEvadeLuk.textContent     = `${fmt(Math.floor(enemyLuk * 3))}以上`;

    // 防御ブロック：敵攻撃タイプで表示切替
    const isEnemyPhysical = state.enemyAttackType === "physical";
    setHiddenForce(nullDefRow,  !isEnemyPhysical);
    setHiddenForce(nullMdefRow, isEnemyPhysical);

    if (isEnemyPhysical) {
      outNullDef.textContent = `${fmt(requiredDefenseForNullify(enemy.atk))}以上`;

      // 被ダメ（敵物理→主人公）
      const heroPhysDef = hero.def + hero.mdef * 0.1;
      const enemyHits   = hitsFromSpd(enemy.spd);
      const recvElemMod = getElementModifier(state.enemyElement, state.heroElement);
      const recv        = damageRangeTotal(enemy.atk, heroPhysDef, enemyHits, recvElemMod, 1.0);
      outRecvDmg.textContent = recv.min > 0
        ? `${formatMinMax(recv.min, recv.max)}（多段: ${fmt(enemyHits)}）`
        : "0（無効化）";
    } else {
      outNullMdef.textContent = `${fmt(requiredDefenseForNullify(enemy.int))}以上`;

      // 被ダメ（敵魔法→主人公）
      const heroMagDef  = hero.mdef + hero.def * 0.1;
      const recvElemMod = getElementModifier(state.enemyElement, state.heroElement);
      const recvMag     = calcMagicDamageRange({
        heroInt: enemy.int,
        analysisBook: 0,
        analysisBookAdvanced: 0,
        crystalCount: 0,
        spell: state.enemyElement || "fire",
        enemyMagDef: heroMagDef,
        heroElement: state.enemyElement,
        enemyElement: state.heroElement
      });
      outRecvDmg.textContent = recvMag.min > 0
        ? `${formatMinMax(recvMag.min, recvMag.max)}`
        : "0（無効化）";
    }
  });

})();

}); // DOMContentLoaded
