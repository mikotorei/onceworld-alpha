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
    if (stat === "mov") return baseVal;
    if (isFixed) return baseVal;

    if (mode === "base") {
      return baseVal;
    } else if (mode === "plus1100") {
      return baseVal * 111;
    } else if (mode === "genhance") {
      const at1100 = baseVal * 111;
      if (gLv === 0) return at1100;
      return at1100 + (at1100 * 25 + 10000) * gLv;
    }
    return baseVal;
  }

  function formatStat(val) {
    if (val === 0) return "";
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
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
      refreshTables();
    });
  });

  if (gInput) {
    gInput.addEventListener("input", () => {
      let v = parseInt(gInput.value, 10);
      if (isNaN(v)) v = 0;
      v = Math.min(100, Math.max(0, v));
      gLevel = v;
      if (gSlider) gSlider.value = v;
      if (gDisplay) gDisplay.textContent = v;
      refreshTables();
    });
  }

  if (gSlider) {
    gSlider.addEventListener("input", () => {
      gLevel = parseInt(gSlider.value, 10);
      if (gInput) gInput.value = gLevel;
      if (gDisplay) gDisplay.textContent = gLevel;
      refreshTables();
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

    weaponBody?.appendChild(tr);
  }

  function appendArmorRow(item) {
    const tr = document.createElement("tr");

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
