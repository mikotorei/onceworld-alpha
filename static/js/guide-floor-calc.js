/**
 * guide-floor-calc.js
 * 天空回廊 階層到達早見表ツール
 *
 * ═══════════════════════════════════════════════
 * 仕様
 * ═══════════════════════════════════════════════
 *
 * 変数定義：
 *   A = 天空像～悪魔～  所持数（上限はパンドラの箱に連動: 1000 / 2000）
 *   B = 天空像～冒険者～ 所持数（上限はパンドラの箱に連動: 1000 / 2000）
 *
 * Bは100の倍数のみ探索する。
 * 1サイクル（100 + B + 100×A）が必ず100の倍数になり、SGが出現し続ける。
 *
 * ── スタート地点 ──
 *   1F        : 冒険者像2個を一時的に外して片側撃破
 *               初回到達 = 1 + 1 + (B-2) = B F（Bは2以上）
 *   ワープ①   : 任意の1万の倍数F（最高到達-10万F）
 *               すでに100の倍数でSGが出現するため2個置き不要
 *               初回到達 = start
 *   ワープ②   : 100万F固定。麒麟討伐後の移動は通常移動なので
 *               1,000,001 + B に進み100の倍数から外れる。
 *               1Fスタートと同じく2個置きで調整する
 *               初回到達 = 1,000,000 + 2B F（Bは2以上）
 *
 * ── 1サイクルの進行 ──
 *   片側撃破 : +1F
 *   冒険者B個: +B F
 *   SG撃破   : +99F（100の倍数Fで発生）
 *   悪魔A個  : +100×A F
 *   ─────────────────────────
 *   1サイクル: 100 + B + 100×A F
 *
 * ── ボスフロア回避 ──
 *   1万・10万・100万・1000万の倍数は中間通過点で踏まない
 *   （目標F自体・スタート地点は除外判定）
 */

document.addEventListener("DOMContentLoaded", function () {

  /* ── 定数 ── */
  // 天空像の所持上限。パンドラの箱の所持で 1000 -> 2000 になる
  // 変数名の A / B は入力欄の対応が逆になっている点に注意
  //   limitA = 悪魔像（ownedDevil） / limitB = 冒険者像（ownedAdventurer）
  function capAdventurer() {
    return (typeof OWPandora !== "undefined")
      ? OWPandora.materialCap("sky_statue_adventurer", 1000) : 1000;
  }
  function capDevil() {
    return (typeof OWPandora !== "undefined")
      ? OWPandora.materialCap("sky_statue_devil", 1000) : 1000;
  }
  const BOSS_FLOORS = [10000, 100000, 1000000, 10000000];

  /* ── DOM 参照 ── */
  const inputTarget   = document.getElementById("targetFloor");
  const btnCalc       = document.getElementById("calcFloorBtn");
  const resultEl      = document.getElementById("floorResult");
  const titleEl       = document.getElementById("floorResultTitle");
  const bodyEl        = document.getElementById("floorResultBody");
  const noResultEl    = document.getElementById("floorNoResult");
  const tableWrapEl   = document.querySelector(".floor-tool__table-wrap");

  const startTypeBtns = document.querySelectorAll("[data-start-type]");
  const inputWarpF    = document.getElementById("warpFloor");
  const warpRow       = document.getElementById("warpFloorRow");

  const modeBtns      = document.querySelectorAll("[data-calc-mode]");
  const ownedRow      = document.getElementById("ownedRow");
  const inputOwnedB   = document.getElementById("ownedAdventurer");
  const inputOwnedA   = document.getElementById("ownedDevil");

  const maxABtns      = document.querySelectorAll("[data-max-a]");
  const maxARow       = document.getElementById("maxARow");

  if (!btnCalc || !inputTarget) return;

  /* ── カンマ区切り入力の適用 ── */
  if (typeof attachCommaInputBehavior === "function") {
    attachCommaInputBehavior("targetFloor", 0);
    attachCommaInputBehavior("warpFloor", 0);
    attachCommaInputBehavior("ownedAdventurer", 0);
    attachCommaInputBehavior("ownedDevil", 0);
  }

  /* ── 所持数の上限clamp ── */
  [["ownedAdventurer", capAdventurer], ["ownedDevil", capDevil]].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (!el) return;
    el.addEventListener("blur", function () {
      var max = pair[1]();
      var v = parseInt(String(el.value||"").replace(/,/g, ""), 10) || 0;
      if (v > max) el.value = max.toLocaleString("ja-JP");
      if (v < 0)   el.value = "0";
    });
  });

  /* ── パンドラの状態が変わったら所持数を上限に合わせて切り詰める ── */
  if (typeof OWPandora !== "undefined" && typeof OWPandora.onChange === "function") {
    OWPandora.onChange(function () {
      [["ownedAdventurer", capAdventurer], ["ownedDevil", capDevil]].forEach(function (pair) {
        var el = document.getElementById(pair[0]);
        if (!el) return;
        var max = pair[1]();
        var v = parseInt(String(el.value||"").replace(/,/g, ""), 10) || 0;
        if (v > max) el.value = max.toLocaleString("ja-JP");
      });
    });
  }

  /* ── カンマを除去して整数取得 ── */
  function getInt(el, fallback) {
    if (!el) return fallback || 0;
    var v = String(el.value || "").replace(/,/g, "").trim();
    var n = parseInt(v, 10);
    return isNaN(n) ? (fallback || 0) : n;
  }

  /* ── 状態 ── */
  let startType = "normal";  // normal | warp1 | warp2
  let calcMode  = "list";    // list | owned


  /* ── スタート地点切替 ── */
  startTypeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      startType = btn.getAttribute("data-start-type");
      startTypeBtns.forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      if (warpRow) warpRow.style.display = (startType === "warp1") ? "" : "none";
    });
  });

  /* ── モード切替 ── */
  modeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      calcMode = btn.getAttribute("data-calc-mode");
      modeBtns.forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      if (ownedRow) ownedRow.style.display = (calcMode === "owned") ? "" : "none";
      if (maxARow)  maxARow.style.display  = (calcMode === "list")  ? "" : "none";
    });
  });

  /* ── 悪魔像上限切替 ── */
  /* 天空像の上限はパンドラの箱に連動する（手動切替は廃止） */

  /**
   * ボスフロアかどうか判定
   */
  function isBossFloor(f) {
    for (var i = 0; i < BOSS_FLOORS.length; i++) {
      if (f % BOSS_FLOORS[i] === 0) return true;
    }
    return false;
  }

  /**
   * 中間通過点にボスフロアが含まれないかチェック
   * @param {number} start    - スタート到達点
   * @param {number} perCycle - 1サイクルの進行F
   * @param {number} cycles   - 総サイクル数
   * @returns {boolean} true = 安全
   */
  function isSafe(start, perCycle, cycles, isWarpStart) {
    // 1Fスタート時のみ、初回到達点のボスフロア判定を行う
    // （ワープの場合はボスフロアに降りても通常エリア扱いのため除外）
    if (!isWarpStart && cycles > 0 && isBossFloor(start)) return false;
    // 中間通過点: start + k×perCycle (k=1〜cycles-1)
    for (var k = 1; k < cycles; k++) {
      var f = start + k * perCycle;
      if (isBossFloor(f)) return false;
    }
    return true;
  }

  /**
   * 到達可能な組み合わせを列挙
   */
  function findCombinations(target, startFloor, limitA, limitB) {
    var results = [];

    // Bは100の倍数のみ探索する。
    // 1サイクル（100 + B + 100×A）が100の倍数になり、SGが出現し続ける。
    // 100の倍数から外れるとSGを踏めず、そこでサイクルが破綻する
    for (var b = 0; b <= limitB; b += 100) {
      var firstReach;
      if (startType === "normal") {
        // 1Fスタート: 冒険者像2個を一時的に外して片側撃破
        //   1 + 1 + (B-2) = B
        if (b < 2) continue;
        firstReach = b;
      } else if (startType === "warp2") {
        // ワープ②: 麒麟討伐後は通常移動なので 1,000,001 + B に進み、
        // 100の倍数から外れる。1Fスタートと同じく2個置きで調整する
        //   1,000,000 → 1,000,001 + B → 2個置き → 1,000,000 + 2B
        if (b < 2) continue;
        firstReach = startFloor + 2 * b;
      } else {
        // ワープ①: 開始地点が1万の倍数のためすでに100の倍数。そのまま通常サイクル
        firstReach = startFloor;
      }

      var remaining = target - firstReach;

      // 初回だけでちょうど到達
      if (remaining === 0) {
        results.push({ a: 0, b: b, cycles: 0, perCycle: 0, firstReach: firstReach });
        continue;
      }
      if (remaining < 0) continue;

      for (var a = 0; a <= limitA; a++) {
        var perCycle = 100 + b + 100 * a;
        if (perCycle <= 0) continue;
        if (remaining % perCycle !== 0) continue;

        var cycles = remaining / perCycle;
        if (!isSafe(firstReach, perCycle, cycles, startType !== "normal")) continue;

        results.push({ a: a, b: b, cycles: cycles, perCycle: perCycle, firstReach: firstReach });
      }
    }

    return results;
  }

  /* ── 表示 ── */
  function showResult(target, combinations, isOwnedMode) {
    resultEl.hidden = false;

    var startLabel = "";
    if (startType === "normal") startLabel = "1Fスタート";
    else if (startType === "warp1") startLabel = getInt(inputWarpF, 0).toLocaleString() + "Fスタート";
    else startLabel = "1,000,000Fスタート";

    titleEl.innerHTML =
      "<strong>" + target.toLocaleString() + "F</strong>" +
      " に到達できる組み合わせ（" + startLabel + "）";

    bodyEl.innerHTML = "";

    if (combinations.length === 0) {
      noResultEl.hidden         = false;
      tableWrapEl.style.display = "none";
      return;
    }

    noResultEl.hidden         = true;
    tableWrapEl.style.display = "";

    var show = combinations;
    if (isOwnedMode) {
      // サイクル数が少ない順 → 上位3件
      show = combinations.slice().sort(function (x, y) {
        if (x.cycles !== y.cycles) return x.cycles - y.cycles;
        return (x.a + x.b) - (y.a + y.b);
      }).slice(0, 3);
    } else {
      // 悪魔像の多い順
      show = combinations.slice().sort(function (x, y) {
        if (y.a !== x.a) return y.a - x.a;
        return x.b - y.b;
      });
    }

    var rank = ["最適", "準適切", "準々適切"];

    show.forEach(function (combo, i) {
      var tr = document.createElement("tr");

      if (isOwnedMode) {
        var tdRank = document.createElement("td");
        tdRank.textContent = rank[i] || "";
        tdRank.style.fontWeight = "bold";
        tr.appendChild(tdRank);
      }

      var tdB      = document.createElement("td");
      var tdA      = document.createElement("td");
      var tdCycles = document.createElement("td");
      var tdPer    = document.createElement("td");

      tdB.textContent = combo.b.toLocaleString() + " 個";
      tdA.textContent = combo.a.toLocaleString() + " 個";

      if (combo.cycles === 0) {
        tdCycles.textContent = "初回のみ";
        tdPer.textContent    = "—";
      } else {
        tdCycles.textContent = combo.cycles.toLocaleString() + " 回";
        tdPer.textContent    = combo.perCycle.toLocaleString() + " F/サイクル";
      }

      tr.appendChild(tdB);
      tr.appendChild(tdA);
      tr.appendChild(tdCycles);
      tr.appendChild(tdPer);
      bodyEl.appendChild(tr);
    });

    // ヘッダーの調整
    var thead = document.querySelector("#floorResultTable thead tr");
    if (thead) {
      thead.innerHTML = (isOwnedMode ? "<th>評価</th>" : "") +
        "<th>冒険者像（個）</th><th>悪魔像（個）</th><th>サイクル数</th><th>1サイクルの進行</th>";
    }
  }

  function showError(msg) {
    resultEl.hidden           = false;
    titleEl.innerHTML         = msg;
    bodyEl.innerHTML          = "";
    noResultEl.hidden         = true;
    tableWrapEl.style.display = "none";
  }

  /* ── メイン処理 ── */
  function onCalc() {
    var raw    = String(inputTarget.value || "").replace(/,/g, "").trim();
    var target = parseInt(raw, 10);

    if (!raw || isNaN(target) || target < 1) {
      showError("1以上の整数を入力してください。");
      return;
    }

    // スタート地点の決定
    var startFloor = 1;
    if (startType === "warp1") {
      var w = getInt(inputWarpF, 0);
      if (w < 10000 || w % 10000 !== 0) {
        showError("ワープ先は<strong>1万の倍数</strong>で入力してください。");
        return;
      }
      startFloor = w;
    } else if (startType === "warp2") {
      startFloor = 1000000;
    }

    if (startType !== "normal" && target <= startFloor) {
      showError("目標階層はスタート地点より大きい値を入力してください。");
      return;
    }

    var maxAdventurer = capAdventurer();
    var maxDevil      = capDevil();
    var limitA = maxDevil;
    var limitB = maxAdventurer;
    var isOwnedMode = (calcMode === "owned");

    if (isOwnedMode) {
      limitB = Math.min(maxAdventurer, Math.max(0, getInt(inputOwnedB, 0)));
      limitA = Math.min(maxDevil,      Math.max(0, getInt(inputOwnedA, 0)));
    }

    var combinations = findCombinations(target, startFloor, limitA, limitB);
    showResult(target, combinations, isOwnedMode);
  }

  btnCalc.addEventListener("click", onCalc);
  inputTarget.addEventListener("keydown", function (e) {
    if (e.key === "Enter") onCalc();
  });
});
