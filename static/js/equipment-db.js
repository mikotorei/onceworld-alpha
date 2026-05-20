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
  };

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

  // ========== 強化計算 ==========

  function calcStat(baseVal, stat, mode, gLv, isFixed) {
    if (baseVal === 0) return 0;
    // MOVは全モードで補正なし
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

  function formatStat(val) {
    if (val === 0) return "";
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
  }

  // 必要G計算（基礎値合計 / 10 × 1億）
  function calcRequiredG(item) {
    const total = statList.reduce((sum, stat) => {
      return sum + Number(item.base_add?.[stat] ?? 0);
    }, 0);
    return Math.floor(total / 10 * 100000000);
  }

  function formatRequiredG(val) {
    if (val >= 100000000) {
      return (val / 100000000).toFixed(2) + "億G";
    } else if (val >= 10000) {
      return (val / 10000).toFixed(2) + "万G";
    }
    return val.toLocaleString() + "G";
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

  // G強化モード時のテーブルヘッダー管理
  function updateTableHeaders() {
    const isG = enhanceMode === "genhance";

    const weaponGTh = document.getElementById("weaponGCostTh");
    if (weaponGTh) weaponGTh.style.display = isG ? "" : "none";

    const armorGTh = document.getElementById("armorGCostTh");
    if (armorGTh) armorGTh.style.display = isG ? "" : "none";
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
      updateTableHeaders();
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

    allItems.forEach((item) => {
      if (item.category === "weapon") {
        appendWeaponRow(item);
      } else if (item.category === "armor") {
        appendArmorRow(item);
      }
    });
  }

  function appendWeaponRow(item) {
    const tr = document.createElement("tr");
    const isFixed = item.id === "bare_hands";
    const isG = enhanceMode === "genhance";

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

    const gCostTd = document.createElement("td");
    gCostTd.className = "g-cost";
    gCostTd.style.display = isG ? "" : "none";
    if (!isFixed) {
      gCostTd.textContent = formatRequiredG(calcRequiredG(item));
    }
    tr.appendChild(gCostTd);

    weaponBody?.appendChild(tr);
  }

  function appendArmorRow(item) {
    const tr = document.createElement("tr");
    const isG = enhanceMode === "genhance";

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
      const val = calcStat(base, stat, enhanceMode, gLevel, false);
      td.textContent = formatStat(val);
      tr.appendChild(td);
    });

    const gCostTd = document.createElement("td");
    gCostTd.className = "g-cost";
    gCostTd.style.display = isG ? "" : "none";
    gCostTd.textContent = formatRequiredG(calcRequiredG(item));
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

    allItems.forEach((item) => {
      if (item.category === "weapon") {
        appendWeaponRow(item);
      } else if (item.category === "armor") {
        appendArmorRow(item);
      } else if (item.category === "accessory") {
        appendAccessoryRow(item);
      }
    });
  } catch (e) {
    console.error("装備DB読み込み失敗", e);
  }
});
