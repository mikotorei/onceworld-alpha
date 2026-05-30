// ============================================================
// tenku.js  天空回廊計算表
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

  // ============================================================
  // 設定
  // ============================================================

  // 天空に出現しないモンスターのID
  const EXCLUDED_IDS = [
    "201", "202", "203", "204", "205", "206", "207",
    "226", "227", "228", "229",
    "241", "242", "243", "244", "245", "246", "247", "248", "249"
  ];

  // 100の倍数Fのみ出現するモンスターのID（SGなど）
  const SG_IDS = ["226"];

  // 特定フロアのみ出現するモンスター { id, floor }
  const SPECIAL_IDS = [
    { id: "227", floor: 10000   },
    { id: "228", floor: 100000  },
    { id: "229", floor: 1000000 },
  ];

  // 魔法が効かないモンスターのID（魔法ワンパン表示から除外）
  const MAGIC_IMMUNE_IDS = [
    "130",
    "152",
    "223",
    "226",
  ];

  const TOP_N      = 30;
  const SAFE_MAX_F = 99999;

  const STATUS_COLUMNS = [
    { key: "vit",  label: "VIT"  },
    { key: "spd",  label: "SPD"  },
    { key: "atk",  label: "ATK"  },
    { key: "int",  label: "INT"  },
    { key: "def",  label: "DEF"  },
    { key: "mdef", label: "MDEF" },
    { key: "luk",  label: "LUK"  },
  ];

  const SINGLE_COLUMNS = [
    { key: "req_def",        label: "無効DEF",     tooltip: "物理攻撃を無効化するために必要な自分のDEF（物理型のみ）" },
    { key: "req_mdef",       label: "無効MDEF",    tooltip: "魔法攻撃を無効化するために必要な自分のMDEF" },
    { key: "evade_luk",      label: "回避LUK",     tooltip: "攻撃を回避するために必要な自分のLUK" },
    { key: "hit_min_luk",    label: "最低命中LUK", tooltip: "最低限命中するために必要な自分のLUK" },
    { key: "hit_stable_luk", label: "安定命中LUK", tooltip: "安定して命中するために必要な自分のLUK" },
  ];

  // ============================================================
  // レベル計算
  // ============================================================

  function getLv(floor) {
    const n = Math.floor(floor);
    if (n % 100 === 0) return 100 * n + 9900;
    if (n >= 10000)    return 100 * n;
    return 100 * n + 10000;
  }

  function isSgFloor(floor) {
    return Math.floor(floor) % 100 === 0;
  }

  // ============================================================
  // 計算ユーティリティ
  // ============================================================

  function scaleStat(base, lv) {
    return Math.floor(Number(base) * (1 + lv * 0.1));
  }

  function requiredDefForNullify(enemyAtk) {
    const a = Math.floor(Number(enemyAtk));
    if (!Number.isFinite(a) || a <= 0) return 0;
    return Math.floor((a * 7 - 10) / 4) + 1;
  }

  function requiredMdefForNullify(enemyInt) {
    const i = Math.floor(Number(enemyInt));
    if (!Number.isFinite(i) || i <= 0) return 0;
    return Math.floor((i * 7 - 10) / 4) + 1;
  }

  function fmt(n) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString();
  }

  // ============================================================
  // 魔法ワンパン計算
  // ============================================================

  function normalizeElement(value) {
    const raw = (value ?? "").toString().trim().toLowerCase();
    const map = {
      fire: "fire", "火": "fire",
      water: "water", "水": "water",
      wood: "wood", tree: "wood", "木": "wood",
      light: "light", "光": "light",
      dark: "dark", "闇": "dark"
    };
    return map[raw] || raw;
  }

  function getElementModifier(heroElement, enemyElement) {
    const h = normalizeElement(heroElement);
    const e = normalizeElement(enemyElement);
    if (!h || !e) return 1.0;
    if (
      (h === "fire"  && e === "wood")  ||
      (h === "wood"  && e === "water") ||
      (h === "water" && e === "fire")  ||
      (h === "light" && e === "dark")  ||
      (h === "dark"  && e === "light")
    ) return 1.3;
    if (
      (h === "fire"  && e === "water") ||
      (h === "water" && e === "wood")  ||
      (h === "wood"  && e === "fire")  ||
      (h === "light" && e === "light") ||
      (h === "dark"  && e === "dark")
    ) return 0.8;
    return 1.0;
  }

  function getSpellMultiplier(spell) {
    switch (normalizeElement(spell)) {
      case "wood":  return 1.3;
      case "dark":  return 1.4;
      case "light": return 2.0;
      default:      return 1.0;
    }
  }

  function calcAnalysisBonus(book, adv) {
    const b = Math.max(0, Math.floor(Number(book) || 0));
    const a = Math.max(0, Math.floor(Number(adv)  || 0));
    return Math.min(101000, Math.floor(b * (1 + a / 10)));
  }

  function getCrystalMultiplier(count) {
    const c = Math.max(0, Math.floor(Number(count) || 0));
    return Math.min(11.0, 1 + c * 0.01);
  }

  function calcMagicDamage(row, params) {
    const enemyMagDef     = row.mdef + Math.floor(row.def * 0.1);
    const enemyHp         = row.vit * 18 + 100;
    const analysisBonus   = calcAnalysisBonus(params.book, params.bookAdv);
    const spellMultiplier = getSpellMultiplier(params.spell);
    const crystalMult     = getCrystalMultiplier(params.crystal);
    const elementModifier = getElementModifier(params.heroElement, row.element);
    const heroInt         = Math.max(0, Math.floor(Number(params.heroInt) || 0));

    const preDefense   = (heroInt + analysisBonus) * 1.25 * spellMultiplier * crystalMult;
    const afterDefense = preDefense - enemyMagDef;
    const finalBase    = afterDefense * 4 * elementModifier;

    const avgDamage = finalBase > 0 ? Math.floor(finalBase) : 0;

    // ワンパン必要INT
    const totalMod = 0.9 * 4 * elementModifier;
    let oneshotRequired = 0;
    if (totalMod > 0 && spellMultiplier > 0 && crystalMult > 0) {
      const neededAfterDef = enemyHp / totalMod;
      const neededPreDef   = neededAfterDef + enemyMagDef;
      const neededInt      = Math.ceil(neededPreDef / (1.25 * spellMultiplier * crystalMult) - analysisBonus);
      oneshotRequired      = Math.max(0, neededInt);
    }

    // nパン（平均ダメージで割る）
    const nPan       = avgDamage > 0 ? Math.ceil(enemyHp / avgDamage) : 0;
    const canOneshot = heroInt >= oneshotRequired;

    return { oneshotRequired, canOneshot, nPan, enemyHp, enemyMagDef, avgDamage, elementModifier };
  }

  // ============================================================
  // データ計算
  // ============================================================

  function calcMonsterRow(monster, lv, debuffDark) {
    const lukScaled = debuffDark
      ? Math.floor(scaleStat(monster.luk, lv) / 2)
      : scaleStat(monster.luk, lv);

    const atkScaled = scaleStat(monster.atk, lv);
    const intScaled = scaleStat(monster.int, lv);

    return {
      id:      monster.id,
      title:   monster.title,
      element: monster.element,

      vit:  scaleStat(monster.vit,  lv),
      spd:  scaleStat(monster.spd,  lv),
      atk:  atkScaled,
      int:  intScaled,
      def:  scaleStat(monster.def,  lv),
      mdef: scaleStat(monster.mdef, lv),
      luk:  lukScaled,

      req_def:        requiredDefForNullify(atkScaled),
      req_mdef:       requiredMdefForNullify(intScaled),
      evade_luk:      Math.floor(lukScaled * 3),
      hit_min_luk:    Math.floor(lukScaled / 2),
      hit_stable_luk: lukScaled,
    };
  }

  // ============================================================
  // フィルタ
  // ============================================================

  function getMonstersForFloor(floor) {
    if (!window.MONSTERS || !Array.isArray(window.MONSTERS)) return [];
    const sgFloor = isSgFloor(floor);
    const n = Math.floor(floor);
    return window.MONSTERS.filter(m => {
      if (EXCLUDED_IDS.includes(m.id)) {
        // SGは100の倍数Fのみ
        if (SG_IDS.includes(m.id)) return sgFloor;
        // 特定フロア専用モンスター
        const special = SPECIAL_IDS.find(s => s.id === m.id);
        if (special) return n === special.floor;
        return false;
      }
      return true;
    });
  }

  function getFilteredMonstersForFloor(floor, sortKey, rangedOnly) {
    let list = getMonstersForFloor(floor);
    if (sortKey === "req_def") {
      list = list.filter(m => m.attack_type === "物理");
    } else if (sortKey === "req_mdef") {
      list = list.filter(m => m.attack_type === "魔法");
      if (rangedOnly) list = list.filter(m => m.attack_range === "遠距離");
    }
    return list;
  }

  function calcAndSort(monsters, lv, sortKey, debuffDark) {
    const rows = monsters.map(m => calcMonsterRow(m, lv, debuffDark));
    rows.sort((a, b) => b[sortKey] - a[sortKey]);
    return rows.slice(0, TOP_N);
  }

  function calcAndSortMagicOneshot(monsters, lv, debuffDark, magicParams) {
    const rows = monsters
      .filter(m => !MAGIC_IMMUNE_IDS.includes(m.id))
      .map(m => {
        const row    = calcMonsterRow(m, lv, debuffDark);
        const result = calcMagicDamage(row, magicParams);
        return { ...row, ...result };
      });
    rows.sort((a, b) => b.oneshotRequired - a.oneshotRequired);
    return rows.slice(0, TOP_N);
  }

  // ============================================================
  // 安全フロア判定
  // ============================================================

  function isFloorSafeDef(floor, heroDef) {
    const lv       = getLv(floor);
    const monsters = getMonstersForFloor(floor);
    for (const m of monsters) {
      const atk = scaleStat(m.atk, lv);
      if (heroDef <= (atk * 7 - 10) / 4) return false;
    }
    return true;
  }

  function isFloorSafeMdef(floor, heroMdef) {
    const lv       = getLv(floor);
    const monsters = getMonstersForFloor(floor);
    for (const m of monsters) {
      const int_ = scaleStat(m.int, lv);
      if (heroMdef <= (int_ * 7 - 10) / 4) return false;
    }
    return true;
  }

  function isFloorSafeLuk(floor, heroLuk) {
    const lv       = getLv(floor);
    const monsters = getMonstersForFloor(floor);
    for (const m of monsters) {
      const luk = scaleStat(m.luk, lv);
      if (heroLuk < luk * 3) return false;
    }
    return true;
  }

  function findMaxSafeFloorBy(checkFn) {
    if (!checkFn(1)) return { maxFloor: 0, reachedLimit: false };
    if (checkFn(SAFE_MAX_F)) return { maxFloor: SAFE_MAX_F, reachedLimit: true };

    let lo = 1;
    let hi = SAFE_MAX_F;
    while (lo < hi - 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (checkFn(mid)) lo = mid;
      else              hi = mid;
    }
    return { maxFloor: lo, reachedLimit: false };
  }

  // ============================================================
  // DOM参照
  // ============================================================

  const floorInput        = document.getElementById("tenku-floor");
  const lvDisplay         = document.getElementById("tenku-lv-display");
  const debuffDarkCb      = document.getElementById("debuff-dark");
  const includeRangedCb   = document.getElementById("include-ranged");
  const theadRow          = document.getElementById("tenku-thead-row");
  const tbody             = document.getElementById("tenku-tbody");
  const resultMeta        = document.getElementById("result-meta");
  const noResult          = document.getElementById("tenku-no-result");
  const groupBtns         = document.querySelectorAll("#group-select-group .col-btn");
  const sortBtns          = document.querySelectorAll("#status-sort-group .col-btn");
  const heroElementBtns   = document.querySelectorAll("[data-hero-element]");
  const spellBtns         = document.querySelectorAll("[data-spell]");
  const statusSortRow     = document.getElementById("status-sort-row");
  const mdefRangeRow      = document.getElementById("mdef-range-row");
  const magicOneshotRow   = document.getElementById("magic-oneshot-row");
  const heroIntInput      = document.getElementById("hero-int");
  const analysisBookInput = document.getElementById("analysis-book");
  const analysisAdvInput  = document.getElementById("analysis-book-adv");
  const crystalInput      = document.getElementById("crystal-count");
  const bulk1000Btn       = document.getElementById("bulk-1000-btn");

  const safeDefInput  = document.getElementById("safe-def");
  const safeMdefInput = document.getElementById("safe-mdef");
  const safeLukInput  = document.getElementById("safe-luk");
  const safeResult    = document.getElementById("safe-result");

  const tabBtns     = document.querySelectorAll(".tenku-tab");
  const tabContents = document.querySelectorAll(".tenku-tab-content");

  // ============================================================
  // UI状態取得
  // ============================================================

  function getFloor() {
    const v = parseInt(floorInput.value, 10);
    return Number.isFinite(v) && v >= 1 ? v : 1;
  }

  function getViewGroup() {
    const checked = document.querySelector('input[name="view-group"]:checked');
    return checked ? checked.value : "status";
  }

  function getStatusSortKey() {
    const checked = document.querySelector('input[name="sort-col"]:checked');
    return checked ? checked.value : "vit";
  }

  function getMagicParams() {
    const heroElement = document.querySelector('input[name="hero-element"]:checked')?.value || "fire";
    const spell       = document.querySelector('input[name="spell"]:checked')?.value || "water";
    return {
      heroElement, spell,
      heroInt: heroIntInput.value,
      book:    analysisBookInput.value,
      bookAdv: analysisAdvInput.value,
      crystal: crystalInput.value,
    };
  }

  function rankClass(i) {
    if (i === 0) return "rank-1";
    if (i === 1) return "rank-2";
    if (i === 2) return "rank-3";
    return "rank-other";
  }

  // ============================================================
  // 計算表描画
  // ============================================================

  function renderTable() {
    const floor      = getFloor();
    const lv         = getLv(floor);
    const viewGroup  = getViewGroup();
    const debuffDark = debuffDarkCb.checked;
    const rangedOnly = includeRangedCb.checked;

    lvDisplay.textContent = lv.toLocaleString();

    statusSortRow.style.display   = viewGroup === "status"        ? "" : "none";
    mdefRangeRow.style.display    = viewGroup === "req_mdef"      ? "" : "none";
    magicOneshotRow.style.display = viewGroup === "magic_oneshot" ? "" : "none";

    const sortKey  = viewGroup === "status" ? getStatusSortKey() : viewGroup;
    const monsters = getFilteredMonstersForFloor(floor, sortKey, rangedOnly);

    if (monsters.length === 0) {
      noResult.style.display = "";
      tbody.innerHTML = "";
      theadRow.innerHTML = "";
      resultMeta.textContent = "";
      return;
    }

    // ---- 魔法ワンパン表示 ----
    if (viewGroup === "magic_oneshot") {
      const magicParams = getMagicParams();
      const rows = calcAndSortMagicOneshot(monsters, lv, debuffDark, magicParams);

      noResult.style.display = "none";
      resultMeta.textContent = `${floor}階（Lv ${lv.toLocaleString()}）／ 必要INT 降順`;

      theadRow.innerHTML = "";
      ["モンスター", "HP", "必要INT", "nパン", "判定"].forEach((label, i) => {
        const th = document.createElement("th");
        th.textContent = label;
        if (i === 2) th.className = "col-highlight";
        theadRow.appendChild(th);
      });

      tbody.innerHTML = "";
      rows.forEach((row, i) => {
        const tr = document.createElement("tr");
        tr.className = rankClass(i);

        const tdName = document.createElement("td");
        const nameWrap = document.createElement("span");
        nameWrap.className = "monster-name-cell";
        const badge = document.createElement("span");
        badge.className = "rank-badge";
        badge.textContent = i + 1;
        nameWrap.appendChild(badge);
        nameWrap.appendChild(document.createTextNode(row.title));
        tdName.appendChild(nameWrap);
        tr.appendChild(tdName);

        const tdHp = document.createElement("td");
        tdHp.textContent = fmt(row.enemyHp);
        tr.appendChild(tdHp);

        const tdReq = document.createElement("td");
        tdReq.className = "col-highlight";
        tdReq.textContent = fmt(row.oneshotRequired);
        tr.appendChild(tdReq);

        const tdNpan = document.createElement("td");
        if (row.avgDamage <= 0) {
          tdNpan.textContent = "—";
        } else {
          tdNpan.textContent = row.nPan === 1 ? "ワンパン" : `${row.nPan}パン`;
          tdNpan.className   = row.nPan === 1 ? "judge-ok" : "";
        }
        tr.appendChild(tdNpan);

        const tdJudge = document.createElement("td");
        tdJudge.textContent = row.canOneshot ? "✓" : "✗";
        tdJudge.className   = row.canOneshot ? "judge-ok" : "judge-ng";
        tr.appendChild(tdJudge);

        tbody.appendChild(tr);
      });
      return;
    }

    // ---- 通常表示 ----
    const rows = calcAndSort(monsters, lv, sortKey, debuffDark);
    noResult.style.display = "none";

    let filterNote = "";
    if (sortKey === "req_def")  filterNote = "（物理型）";
    if (sortKey === "req_mdef") filterNote = rangedOnly ? "（魔法・遠距離型）" : "（魔法型）";

    const sortLabel = viewGroup === "status"
      ? STATUS_COLUMNS.find(c => c.key === sortKey)?.label || sortKey
      : SINGLE_COLUMNS.find(c => c.key === sortKey)?.label || sortKey;

    resultMeta.textContent =
      `${floor}階（Lv ${lv.toLocaleString()}）／ ${sortLabel} 上位${rows.length}体${filterNote}`;

    if (viewGroup === "status") {
      theadRow.innerHTML = "";
      const thName = document.createElement("th");
      thName.textContent = "モンスター";
      theadRow.appendChild(thName);
      STATUS_COLUMNS.forEach(col => {
        const th = document.createElement("th");
        th.textContent = col.label;
        if (col.key === sortKey) th.className = "col-highlight";
        theadRow.appendChild(th);
      });

      tbody.innerHTML = "";
      rows.forEach((row, i) => {
        const tr = document.createElement("tr");
        tr.className = rankClass(i);

        const tdName = document.createElement("td");
        const nameWrap = document.createElement("span");
        nameWrap.className = "monster-name-cell";
        const badge = document.createElement("span");
        badge.className = "rank-badge";
        badge.textContent = i + 1;
        nameWrap.appendChild(badge);
        nameWrap.appendChild(document.createTextNode(row.title));
        tdName.appendChild(nameWrap);
        tr.appendChild(tdName);

        STATUS_COLUMNS.forEach(col => {
          const td = document.createElement("td");
          td.textContent = fmt(row[col.key]);
          if (col.key === sortKey) td.className = "col-highlight";
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });

    } else {
      const colDef   = SINGLE_COLUMNS.find(c => c.key === sortKey);
      const colLabel = colDef ? colDef.label : sortKey;

      theadRow.innerHTML = "";
      const thName = document.createElement("th");
      thName.textContent = "モンスター";
      theadRow.appendChild(thName);
      const thVal = document.createElement("th");
      thVal.textContent = colLabel;
      thVal.className = "col-highlight";
      if (colDef && colDef.tooltip) thVal.title = colDef.tooltip;
      theadRow.appendChild(thVal);

      tbody.innerHTML = "";
      rows.forEach((row, i) => {
        const tr = document.createElement("tr");
        tr.className = rankClass(i);

        const tdName = document.createElement("td");
        const nameWrap = document.createElement("span");
        nameWrap.className = "monster-name-cell";
        const badge = document.createElement("span");
        badge.className = "rank-badge";
        badge.textContent = i + 1;
        nameWrap.appendChild(badge);
        nameWrap.appendChild(document.createTextNode(row.title));
        tdName.appendChild(nameWrap);
        tr.appendChild(tdName);

        const tdVal = document.createElement("td");
        tdVal.className = "col-highlight";
        tdVal.textContent = fmt(row[sortKey]);
        tr.appendChild(tdVal);

        tbody.appendChild(tr);
      });
    }
  }

  // ============================================================
  // 安全フロア判定描画
  // ============================================================

  function renderSafe() {
    const heroDef  = Math.max(0, Math.floor(Number(safeDefInput.value)  || 0));
    const heroMdef = Math.max(0, Math.floor(Number(safeMdefInput.value) || 0));
    const heroLuk  = Math.max(0, Math.floor(Number(safeLukInput.value)  || 0));

    if (heroDef === 0 && heroMdef === 0 && heroLuk === 0) {
      safeResult.innerHTML = '<div class="safe-placeholder">ステータスを入力してください</div>';
      return;
    }

    if (!window.MONSTERS || !Array.isArray(window.MONSTERS)) {
      safeResult.innerHTML = '<div class="safe-placeholder">モンスターデータが読み込まれていません</div>';
      return;
    }

    safeResult.innerHTML = '<div class="safe-placeholder">計算中...</div>';

    setTimeout(() => {
      const defResult  = heroDef  > 0 ? findMaxSafeFloorBy(f => isFloorSafeDef(f,  heroDef))  : null;
      const mdefResult = heroMdef > 0 ? findMaxSafeFloorBy(f => isFloorSafeMdef(f, heroMdef)) : null;
      const lukResult  = heroLuk  > 0 ? findMaxSafeFloorBy(f => isFloorSafeLuk(f,  heroLuk))  : null;

      function makeCard(label, result, getDangerList) {
        if (!result) return "";

        if (result.maxFloor === 0) {
          return `
            <div class="safe-stat-card safe-danger">
              <div class="safe-stat-label">${label}</div>
              <div class="safe-stat-floor">1階から安全ではありません</div>
            </div>`;
        }

        if (result.reachedLimit) {
          return `
            <div class="safe-stat-card safe-ok">
              <div class="safe-stat-label">${label}</div>
              <div class="safe-stat-floor">${SAFE_MAX_F.toLocaleString()}階まで安全</div>
              <div class="safe-stat-lv">（上限到達）</div>
            </div>`;
        }

        const dangerFloor    = result.maxFloor + 1;
        const dangerMonsters = getDangerList(dangerFloor);
        const list = dangerMonsters.slice(0, 5).map(m => `<li>${m.title}</li>`).join("");
        const more = dangerMonsters.length > 5 ? `<li>他 ${dangerMonsters.length - 5} 体...</li>` : "";

        return `
          <div class="safe-stat-card safe-ok">
            <div class="safe-stat-label">${label}</div>
            <div class="safe-stat-floor">${result.maxFloor.toLocaleString()}階まで安全</div>
            <div class="safe-stat-lv">Lv ${getLv(result.maxFloor).toLocaleString()}</div>
            <div class="safe-stat-danger">
              <span class="safe-stat-danger-title">⚠ ${dangerFloor.toLocaleString()}階（Lv ${getLv(dangerFloor).toLocaleString()}）から危険</span>
              <ul class="safe-danger-list">${list}${more}</ul>
            </div>
          </div>`;
      }

      const defCard = makeCard("DEF（物理無効化）", defResult, f => {
        const lv = getLv(f);
        return getMonstersForFloor(f).filter(m => heroDef <= (scaleStat(m.atk, lv) * 7 - 10) / 4);
      });

      const mdefCard = makeCard("MDEF（魔法無効化）", mdefResult, f => {
        const lv = getLv(f);
        return getMonstersForFloor(f).filter(m => heroMdef <= (scaleStat(m.int, lv) * 7 - 10) / 4);
      });

      const lukCard = makeCard("LUK（回避）", lukResult, f => {
        const lv = getLv(f);
        return getMonstersForFloor(f).filter(m => heroLuk < scaleStat(m.luk, lv) * 3);
      });

      safeResult.innerHTML = `<div class="safe-stat-grid">${defCard}${mdefCard}${lukCard}</div>`;
    }, 0);
  }

  // ============================================================
  // タブ切り替え
  // ============================================================

  tabBtns.forEach(btn => {
    btn.addEventListener("click", function () {
      tabBtns.forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const target = this.dataset.tab;
      tabContents.forEach(c => {
        c.style.display = c.id === `tab-${target}` ? "" : "none";
      });
    });
  });

  // ============================================================
  // イベント登録
  // ============================================================

  floorInput.addEventListener("input", renderTable);
  debuffDarkCb.addEventListener("change", renderTable);
  includeRangedCb.addEventListener("change", renderTable);
  heroIntInput.addEventListener("input", renderTable);
  analysisBookInput.addEventListener("input", renderTable);
  analysisAdvInput.addEventListener("input", renderTable);
  crystalInput.addEventListener("input", renderTable);

  bulk1000Btn.addEventListener("click", function () {
    analysisBookInput.value = 1000;
    analysisAdvInput.value  = 1000;
    crystalInput.value      = 1000;
    renderTable();
  });

  safeDefInput.addEventListener("input",  renderSafe);
  safeMdefInput.addEventListener("input", renderSafe);
  safeLukInput.addEventListener("input",  renderSafe);

  groupBtns.forEach(btn => {
    btn.addEventListener("click", function () {
      groupBtns.forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      renderTable();
    });
  });

  sortBtns.forEach(btn => {
    btn.addEventListener("click", function () {
      sortBtns.forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      renderTable();
    });
  });

  heroElementBtns.forEach(btn => {
    btn.addEventListener("click", function () {
      heroElementBtns.forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      renderTable();
    });
  });

  spellBtns.forEach(btn => {
    btn.addEventListener("click", function () {
      spellBtns.forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      renderTable();
    });
  });

  // ============================================================
  // 初期描画
  // ============================================================

  renderTable();

});
