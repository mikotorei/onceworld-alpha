document.addEventListener("DOMContentLoaded", async () => {
  const statList = ["vit", "spd", "atk", "int", "def", "mdef", "luk", "mov"];

  const weaponBody = document.getElementById("weaponBody");
  const armorBody = document.getElementById("armorBody");
  const accessoryBody = document.getElementById("accessoryBody");

  const tabs = document.querySelectorAll(".equip-tab");
  const tables = document.querySelectorAll(".equip-table");
  const enhanceTabs = document.querySelectorAll(".enhance-tab");
  const enhanceTabsWrapper = document.getElementById("enhanceTabs");
  const gEnhanceControl = document.getElementById("gEnhanceControl");
  const gInput = document.getElementById("gLevelInput");
  const gSlider = document.getElementById("gLevelSlider");
  const gDisplay = document.getElementById("gLevelDisplay");

  const slotLabelMap = {
    head: "頭",
    body: "体",
    hands: "手",
    feet: "脚",
    shield: "盾"
  };

  const seriesLabelMap = {
    cloth: "布",
    leather: "皮",
    metal: "メタル",
    platinum: "白金",
    mage: "魔道士",
    inferno: "獄炎",
    dragon: "ドラゴン",
    tyrant: "暴君",
    demon: "悪魔",
  };

  const seriesOrder = ["cloth", "leather", "metal", "platinum", "mage", "inferno", "dragon", "tyrant", "demon"];

  const statLabelMap = {
    vit: "VIT",
    spd: "SPD",
    atk: "ATK",
    int: "INT",
    def: "DEF",
    mdef: "MDEF",
    luk: "LUK",
    mov: "MOV",
    exp: "EXP",
    drop: "ドロップ",
    capture: "捕獲",
    recovery: "回復"
  };

  let enhanceMode = "base";
  let gLevel = 0;
  let currentTab = "weapon";

  // dir: null=通常 / "asc"=昇順 / "desc"=降順
  let weaponSort = { key: null, dir: null };
  let armorSort = { key: null, dir: null };

  // ========== 強化計算 ==========

  function calcStat(baseVal, stat, mode, gLv, isFixed) {
    if (baseVal === 0) return 0;
    if (stat === "mov") return baseVal;
    if (isFixed) return baseVal;

    if (mode === "base") {
      return baseVal;
    } else if (mode === "plus1100") {
      return baseVal * 111;
    } else if (mode === "genhance") {
      const at1100 = baseVal * 111;
      if (gLv === 0) return at1100;
      return at1100 + (baseVal * 25 + 10000) * gLv;
    }
    return baseVal;
  }

  function calcTotalPower(item, mode, gLv, isFixed) {
    return statList.reduce((sum, stat) => {
      const base = Number(item.base_add?.[stat] ?? 0);
      return sum + calcStat(base, stat, mode, gLv, isFixed);
    }, 0);
  }

  function formatStat(val) {
    if (val === 0) return "";
    return val.toLocaleString("ja-JP");
  }

  // 1強化あたりの必要G（基礎値合計ベース・固定）
  function calcRequiredGPerLevel(item) {
    const total = statList.reduce((sum, stat) => {
      return sum + Number(item.base_add?.[stat] ?? 0);
    }, 0);
    return Math.floor(total / 10 * 100000000);
  }

  // N回分の合計必要G
  function calcTotalRequiredG(item, gLv) {
    if (gLv === 0) return 0;
    return calcRequiredGPerLevel(item) * gLv;
  }

  function formatRequiredG(val) {
    if (val === 0) return "0G";
    if (val >= 100000000) {
      return (val / 100000000).toFixed(2) + "億G";
    } else if (val >= 10000) {
      return (val / 10000).toFixed(2) + "万G";
    }
    return val.toLocaleString("ja-JP") + "G";
  }

  // ========== ソート ==========

  function getSortValue(item, key, mode, gLv, isFixed) {
    if (key === "name") return item.name || "";
    if (key === "slot") return item.slot || "";
    if (key === "series") {
      const idx = seriesOrder.indexOf(item.series);
      return idx === -1 ? 999 : idx;
    }
    if (key === "gcost") return calcTotalRequiredG(item, gLv);
    if (key === "power") return calcTotalPower(item, mode, gLv, isFixed);
    if (statList.includes(key)) {
      const base = Number(item.base_add?.[key] ?? 0);
      return calcStat(base, key, mode, gLv, isFixed);
    }
    return 0;
  }

  function sortItems(items, sortState, mode, gLv, isFixedFn) {
    if (!sortState.key || !sortState.dir) return items;
    return [...items].sort((a, b) => {
      const va = getSortValue(a, sortState.key, mode, gLv, isFixedFn(a));
      const vb = getSortValue(b, sortState.key, mode, gLv, isFixedFn(b));
      if (typeof va === "string" && typeof vb === "string") {
        return sortState.dir === "asc" ? va.localeCompare(vb, "ja") : vb.localeCompare(va, "ja");
      }
      return sortState.dir === "asc" ? va - vb : vb - va;
    });
  }

  function updateSortIndicators(theadId, sortState) {
    const thead = document.getElementById(theadId);
    if (!thead) return;
    thead.querySelectorAll("th[data-sort]").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.sort === sortState.key && sortState.dir) {
        th.classList.add(sortState.dir === "asc" ? "sort-asc" : "sort-desc");
      }
    });
  }

  function bindSortHeaders(theadId, sortState, callback) {
    const thead = document.getElementById(theadId);
    if (!thead) return;
    thead.querySelectorAll("th[data-sort]").forEach((th) => {
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (sortState.key !== key) {
          // 別の列をクリック → 昇順から開始
          sortState.key = key;
          sortState.dir = "asc";
        } else if (sortState.dir === "asc") {
          sortState.dir = "desc";
        } else if (sortState.dir === "desc") {
          // 降順の次は通常に戻す
          sortState.key = null;
          sortState.dir = null;
        }
        updateSortIndicators(theadId, sortState);
        callback();
      });
    });
  }

  // ========== 強化UI表示制御 ==========

  function updateEnhanceUI() {
    if (!enhanceTabsWrapper) return;
    const isAccessory = currentTab === "accessory";
    enhanceTabsWrapper.style.display = isAccessory ? "none" : "";
    if (gEnhanceControl) {
      gEnhanceControl.style.display = (!isAccessory && enhanceMode === "genhance") ? "flex" : "none";
    }
  }

  function updateGCostVisibility() {
    const isG = enhanceMode === "genhance";
    document.querySelectorAll(".g-cost-col").forEach((el) => {
      el.style.display = isG ? "" : "none";
    });
  }

  // ========== カテゴリタブ切り替え ==========

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tables.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      document.getElementById("tab-" + currentTab)?.classList.add("active");
      updateEnhanceUI();
    });
  });

  // ========== 強化モード切り替え ==========

  enhanceTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      enhanceTabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      enhanceMode = btn.dataset.enhance;
      updateEnhanceUI();
      updateGCostVisibility();
      refreshTables();
    });
  });

  function applyGLevel(v) {
    v = Math.min(100, Math.max(0, isNaN(v) ? 0 : v));
    gLevel = v;
    if (gInput) gInput.value = v;
    if (gSlider) gSlider.value = v;
    if (gDisplay) gDisplay.textContent = v;
    refreshTables();
  }

  if (gInput) {
    gInput.addEventListener("change", () => {
      applyGLevel(parseInt(gInput.value, 10));
    });
    gInput.addEventListener("input", () => {
      const v = parseInt(gInput.value, 10);
      if (!isNaN(v)) applyGLevel(v);
    });
  }

  if (gSlider) {
    gSlider.addEventListener("input", () => {
      applyGLevel(parseInt(gSlider.value, 10));
    });
  }

  // ========== テーブル描画 ==========

  let allItems = [];

  function refreshTables() {
    if (weaponBody) weaponBody.innerHTML = "";
    if (armorBody) armorBody.innerHTML = "";

    const isG = enhanceMode === "genhance";

    const weapons = allItems.filter((i) => i.category === "weapon");
    const sortedWeapons = sortItems(weapons, weaponSort, enhanceMode, gLevel, (i) => i.id === "bare_hands");
    sortedWeapons.forEach((item) => appendWeaponRow(item, isG));

    const armors = allItems.filter((i) => i.category === "armor");
    sortArmors(armors).forEach((item) => appendArmorRow(item, isG));
  }

  function sortArmors(items) {
    const seriesBased = [...items].sort((a, b) => {
      const ia = seriesOrder.indexOf(a.series);
      const ib = seriesOrder.indexOf(b.series);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    if (!armorSort.key || armorSort.key === "series") return seriesBased;
    return sortItems(seriesBased, armorSort, enhanceMode, gLevel, (i) => i.no_enhance === true);
  }

  function appendWeaponRow(item, isG) {
    const tr = document.createElement("tr");
    const isFixed = item.id === "bare_hands" || item.no_enhance === true;

    const nameTd = document.createElement("td");
    nameTd.textContent = item.name || "";
    tr.appendChild(nameTd);

    statList.forEach((stat) => {
      const td = document.createElement("td");
      const base = Number(item.base_add?.[stat] ?? 0);
      const val = calcStat(base, stat, enhanceMode, gLevel, isFixed);
      td.textContent = formatStat(val);
      tr.appendChild(td);
    });

    const powerTd = document.createElement("td");
    powerTd.className = "power-col";
    powerTd.textContent = calcTotalPower(item, enhanceMode, gLevel, isFixed).toLocaleString("ja-JP");
    tr.appendChild(powerTd);

    const gCostTd = document.createElement("td");
    gCostTd.className = "g-cost-col";
    gCostTd.style.display = isG ? "" : "none";
    gCostTd.textContent = isFixed ? "" : formatRequiredG(calcTotalRequiredG(item, gLevel));
    tr.appendChild(gCostTd);

    weaponBody?.appendChild(tr);
  }

  function appendArmorRow(item, isG) {
    const tr = document.createElement("tr");
    const isFixed = item.no_enhance === true;

    const nameTd = document.createElement("td");
    nameTd.textContent = item.name || "";
    tr.appendChild(nameTd);

    const slotTd = document.createElement("td");
    slotTd.textContent = slotLabelMap[item.slot] || item.slot || "";
    tr.appendChild(slotTd);

    const seriesTd = document.createElement("td");
    seriesTd.textContent = seriesLabelMap[item.series] || "";
    tr.appendChild(seriesTd);

    statList.forEach((stat) => {
      const td = document.createElement("td");
      const base = Number(item.base_add?.[stat] ?? 0);
      const val = calcStat(base, stat, enhanceMode, gLevel, isFixed);
      td.textContent = formatStat(val);
      tr.appendChild(td);
    });

    const powerTd = document.createElement("td");
    powerTd.className = "power-col";
    powerTd.textContent = calcTotalPower(item, enhanceMode, gLevel, isFixed).toLocaleString("ja-JP");
    tr.appendChild(powerTd);

    const gCostTd = document.createElement("td");
    gCostTd.className = "g-cost-col";
    gCostTd.style.display = isG ? "" : "none";
    gCostTd.textContent = isFixed ? "" : formatRequiredG(calcTotalRequiredG(item, gLevel));
    tr.appendChild(gCostTd);

    armorBody?.appendChild(tr);
  }

  function buildAccessoryLines(item) {
    const effects = Array.isArray(item.display_effects) ? item.display_effects : [];
    const effectNames = [];
    const effectValues = [];

    if (effects.length > 0) {
      effects.forEach((ef) => {
        const target = statLabelMap[String(ef.target || "").toLowerCase()] || String(ef.target || "");
        if (ef.type === "flat") {
          effectNames.push(target);
          effectValues.push(`${ef.initial} → ${ef.max}`);
        } else if (ef.type === "rate") {
          effectNames.push(`*${target}`);
          effectValues.push(`${ef.initial} → ${ef.max}`);
        } else if (ef.type === "special") {
          effectNames.push(target);
          effectValues.push(`${ef.initial} → ${ef.max}`);
        } else if (ef.type === "special_rate") {
          effectNames.push(`*${target}`);
          effectValues.push(`${ef.initial} → ${ef.max}`);
        }
      });
      return { names: effectNames, values: effectValues };
    }

    statList.forEach((stat) => {
      const add = Number(item.base_add?.[stat] ?? 0);
      const rate = Number(item.base_rate?.[stat] ?? 0);
      if (add !== 0) {
        effectNames.push(statLabelMap[stat]);
        effectValues.push(String(add));
      }
      if (rate !== 0) {
        effectNames.push(`*${statLabelMap[stat]}`);
        effectValues.push(`${rate}%`);
      }
    });

    return { names: effectNames, values: effectValues };
  }

  function appendAccessoryRow(item) {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.className = "acc-name";
    nameTd.textContent = item.name || "";

    const effectTd = document.createElement("td");
    effectTd.className = "acc-effect";

    const valueTd = document.createElement("td");
    valueTd.className = "acc-value";

    const levelTd = document.createElement("td");
    levelTd.className = "acc-level";
    levelTd.textContent = item.max_level ? `Lv.${item.max_level}` : "";

    const lines = buildAccessoryLines(item);
    effectTd.innerHTML = lines.names.map(v => `<div>${v}</div>`).join("");
    valueTd.innerHTML = lines.values.map(v => `<div>${v}</div>`).join("");

    tr.appendChild(nameTd);
    tr.appendChild(effectTd);
    tr.appendChild(valueTd);
    tr.appendChild(levelTd);

    accessoryBody?.appendChild(tr);
  }

  // ========== データ読み込み ==========

  function getBaseUrl() {
    return window.location.origin + window.location.pathname.split("/equipment")[0];
  }

  try {
    const url = getBaseUrl() + "/db/equipment.json";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    allItems = Array.isArray(data.items) ? data.items : [];

    bindSortHeaders("weaponThead", weaponSort, () => refreshTables());
    bindSortHeaders("armorThead", armorSort, () => refreshTables());

    const isG = enhanceMode === "genhance";

    const weapons = allItems.filter((i) => i.category === "weapon");
    weapons.forEach((item) => appendWeaponRow(item, isG));

    const armors = allItems.filter((i) => i.category === "armor");
    sortArmors(armors).forEach((item) => appendArmorRow(item, isG));

    allItems.filter((i) => i.category === "accessory").forEach((item) => appendAccessoryRow(item));

  } catch (e) {
    console.error("装備DB読み込み失敗", e);
  }
});
