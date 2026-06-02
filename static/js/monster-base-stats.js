(() => {
  const search = document.getElementById("mbsSearch");
  const tbody = document.getElementById("mbsBody");
  const table = document.getElementById("mbsTable");
  const sortStatus = document.getElementById("mbsSortStatus");

  const wrap = document.getElementById("mbsWrap");
  const compactToggle = document.getElementById("mbsCompactToggle");

  const filterToggleBtn = document.getElementById("mbsFilterToggle");
  const filterToggleIcon = document.getElementById("mbsFilterToggleIcon");
  const filtersBox = document.getElementById("mbsFilters");
  const filterClearBtn = document.getElementById("mbsFilterClear");

  const filterElementBox = document.getElementById("mbsFilterElement");
  const filterAttackTypeBox = document.getElementById("mbsFilterAttackType");
  const filterAttackRangeBox = document.getElementById("mbsFilterAttackRange");

  // オプションパネル
  const optionToggleBtn = document.getElementById("mbsOptionToggle");
  const optionToggleIcon = document.getElementById("mbsOptionToggleIcon");
  const optionsBox = document.getElementById("mbsOptions");
  const levelInput = document.getElementById("mbsLevelInput");
  const levelResetBtn = document.getElementById("mbsLevelReset");

  if (!tbody || !table) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));
  const headers = Array.from(table.querySelectorAll("thead th.sort"));

  // レベルスケール対象の列キー
  const SCALE_KEYS = ["vit", "spd", "atk", "int", "def", "mdef", "luk"];

  // ヘッダーに矢印
  headers.forEach(h => {
    if (!h.querySelector(".arrow")) {
      const s = document.createElement("span");
      s.className = "arrow";
      s.textContent = "↕";
      h.appendChild(s);
    }
  });

  let sortState = { key: "id", dir: 1 };
  let currentLevel = 0;
  let currentSpdMult = 1;

  const selected = {
    element: new Set(),
    attack_type: new Set(),
    attack_range: new Set(),
  };

  // ---- レベルスケール ----

  function scaleValue(base, level) {
    return Math.floor(base * (1 + level * 0.1));
  }

  function applyLevelScale() {
    const level = currentLevel;

    rows.forEach(r => {
      SCALE_KEYS.forEach(key => {
        const cell = r.querySelector(`td[data-col="${key}"]`);
        if (!cell) return;
        const base = Number(r.dataset[key]) || 0;
        let scaled = level === 0 ? base : scaleValue(base, level);
        if (key === "spd" && currentSpdMult > 1) scaled = Math.floor(scaled * currentSpdMult);
        cell.textContent = scaled;
        // ソート用にdata属性も一時更新（data-*はbaseのまま保持、scaled値は別属性で持つ）
        r.dataset[`scaled_${key}`] = scaled;
      });
    });
  }

  // ---- ソート ----

  function getValue(row, key) {
    // スケール対象キーはscaled値を優先して使う
    if (currentLevel !== 0 && SCALE_KEYS.includes(key)) {
      const sv = row.dataset[`scaled_${key}`];
      if (sv != null) {
        const n = Number(sv);
        if (Number.isFinite(n)) return n;
      }
    }
    const v = row.dataset[key];
    if (v == null) return "";
    const n = Number(v);
    if (Number.isFinite(n) && String(v).trim() !== "") return n;
    return String(v);
  }

  function setSortUI() {
    if (sortStatus) sortStatus.textContent = `${sortState.key} ${sortState.dir === 1 ? "↑" : "↓"}`;

    headers.forEach(h => {
      h.classList.remove("is-active");
      const arrow = h.querySelector(".arrow");
      if (!arrow) return;

      if (h.dataset.key === sortState.key) {
        h.classList.add("is-active");
        arrow.textContent = sortState.dir === 1 ? "▲" : "▼";
      } else {
        arrow.textContent = "↕";
      }
    });
  }

  function updateRanks() {
    let rank = 0;
    rows.forEach(r => {
      const cell = r.querySelector(".mbs-rank");
      if (!cell) return;

      if (r.style.display === "none") {
        cell.textContent = "";
        return;
      }
      rank += 1;
      cell.textContent = rank;
    });
  }

  function applySort() {
    rows.sort((a, b) => {
      const va = getValue(a, sortState.key);
      const vb = getValue(b, sortState.key);

      const na = typeof va === "number";
      const nb = typeof vb === "number";

      if (na && nb) return (va - vb) * sortState.dir;
      return String(va).localeCompare(String(vb), "ja") * sortState.dir;
    });

    const frag = document.createDocumentFragment();
    rows.forEach(r => frag.appendChild(r));
    tbody.appendChild(frag);

    setSortUI();
    updateRanks();
  }

  function handleSort(key) {
    if (sortState.key === key) sortState.dir *= -1;
    else sortState = { key, dir: 1 };
    applySort();
  }

  headers.forEach(h => {
    h.addEventListener("click", () => handleSort(h.dataset.key));
    h.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSort(h.dataset.key);
      }
    });
  });

  // ---- フィルター ----

  function matchesMulti(row, key, set) {
    if (!set || set.size === 0) return true;
    const v = (row.dataset[key] || "").toLowerCase();
    return set.has(v);
  }

  function applyFilter() {
    const q = (search?.value || "").trim().toLowerCase();

    rows.forEach(r => {
      const hay =
        (r.dataset.name || "") + " " +
        (r.dataset.element || "") + " " +
        (r.dataset.attack_type || "") + " " +
        (r.dataset.attack_range || "");

      const okSearch = !q || hay.includes(q);
      const okElement = matchesMulti(r, "element", selected.element);
      const okType = matchesMulti(r, "attack_type", selected.attack_type);
      const okRange = matchesMulti(r, "attack_range", selected.attack_range);

      r.style.display = (okSearch && okElement && okType && okRange) ? "" : "none";
    });

    updateRanks();
  }

  if (search) search.addEventListener("input", applyFilter);

  function uniqValues(key) {
    const s = new Set();
    rows.forEach(r => {
      const v = (r.dataset[key] || "").toLowerCase();
      if (v) s.add(v);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ja"));
  }

  const ELEMENT_ORDER = ["fire", "water", "wood", "light", "dark"];

  function sortedValues(key) {
    const vals = uniqValues(key);
    if (key === "element") {
      return [
        ...ELEMENT_ORDER.filter(e => vals.includes(e)),
        ...vals.filter(v => !ELEMENT_ORDER.includes(v))
      ];
    }
    return vals;
  }

  function renderChecks(container, key, setRef) {
    if (!container) return;
    container.innerHTML = "";

    sortedValues(key).forEach(v => {
      const id = `mbs-${key}-${v}`.replace(/[^a-z0-9\-_]/gi, "_");

      const label = document.createElement("label");
      label.className = "mbs-check";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = v;
      input.id = id;

      input.addEventListener("change", () => {
        if (input.checked) setRef.add(v);
        else setRef.delete(v);
        applyFilter();
      });

      const text = document.createElement("span");
      text.textContent = v;

      label.appendChild(input);
      label.appendChild(text);
      container.appendChild(label);
    });
  }

  renderChecks(filterElementBox, "element", selected.element);
  renderChecks(filterAttackTypeBox, "attack_type", selected.attack_type);
  renderChecks(filterAttackRangeBox, "attack_range", selected.attack_range);

  if (filterToggleBtn && filtersBox) {
    filterToggleBtn.addEventListener("click", () => {
      const closed = filtersBox.classList.toggle("is-closed");
      if (filterToggleIcon) filterToggleIcon.textContent = closed ? "開く" : "閉じる";
    });
  }

  if (filterClearBtn) {
    filterClearBtn.addEventListener("click", () => {
      selected.element.clear();
      selected.attack_type.clear();
      selected.attack_range.clear();

      document.querySelectorAll("#mbsFilters input[type='checkbox']").forEach(cb => {
        cb.checked = false;
      });

      applyFilter();
    });
  }

  // ---- オプションパネル ----

  if (optionToggleBtn && optionsBox) {
    optionToggleBtn.addEventListener("click", () => {
      const closed = optionsBox.classList.toggle("is-closed");
      if (optionToggleIcon) optionToggleIcon.textContent = closed ? "開く" : "閉じる";
    });
  }

  if (levelInput) {
    levelInput.addEventListener("input", () => {
      const val = parseInt(levelInput.value, 10);
      currentLevel = Number.isFinite(val) && val >= 0 ? val : 0;
      applyLevelScale();
      applySort();
    });
  }

  if (levelResetBtn) {
    levelResetBtn.addEventListener("click", () => {
      levelInput.value = 0;
      currentLevel = 0;
      applyLevelScale();
      applySort();
    });
  }

  // SPD倍率ボタン
  const spdMinusBtn = document.getElementById("mbsSpdMinus");
  const spdPlusBtn  = document.getElementById("mbsSpdPlus");
  const spdDisplay  = document.getElementById("mbsSpdMultDisplay");

  function updateSpdMult(val) {
    currentSpdMult = Math.min(10, Math.max(1, val));
    if (spdDisplay) spdDisplay.textContent = currentSpdMult;
    applyLevelScale();
    applySort();
  }

  // グローバルに公開（onclick属性から呼び出す）
  window.mbsUpdateSpdMult = (delta) => updateSpdMult(currentSpdMult + delta);

  // ---- コンパクト ----

  if (compactToggle && wrap) {
    const sync = () => wrap.classList.toggle("mbs-compact-on", !!compactToggle.checked);
    compactToggle.addEventListener("change", sync);
    sync();
  }

  // ---- 初期化 ----
  applyLevelScale();
  setSortUI();
  applyFilter();
  applySort();
})();
