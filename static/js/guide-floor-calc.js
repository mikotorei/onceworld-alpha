/**
 * guide-floor-calc.js
 * 天空回廊 階層到達早見表ツール
 *
 * ═══════════════════════════════════════════════
 * 仕様
 * ═══════════════════════════════════════════════
 *
 * 変数定義：
 *   A = 天空像～悪魔～  所持数（0〜2000、上限は1000/2000で切替可）
 *   B = 天空像～冒険者～ 所持数（0〜2000、100の倍数制約なし）
 *
 * ── スタート地点 ──
 *   1F        : 初回に冒険者像2個を一時的に置く → 初回到達 = B F
 *   ワープ①   : 任意の1万の倍数F（最高到達-10万F）→ 初回から通常サイクル
 *   ワープ②   : 100万F固定 → 初回から通常サイクル
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
  const MAX_B      = 2000;
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
  ["ownedAdventurer", "ownedDevil"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", function () {
      var v = parseInt(String(el.value||"").replace(/,/g, ""), 10) || 0;
      if (v > 2000) el.value = (2000).toLocaleString("ja-JP");
      if (v < 0)    el.value = "0";
    });
  });

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
  let maxA      = 2000;

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
  maxABtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      maxA = parseInt(btn.getAttribute("data-max-a"), 10) || 2000;
      maxABtns.forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
    });
  });

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

    for (var b = 0; b <= limitB; b++) {
      var firstReach;
      if (startType === "normal") {
        // 1Fスタート: 冒険者像2個を一時的に置く → 到達 = B
        if (b < 2) continue;
        firstReach = b;
      } else {
        // ワープ: スタート地点そのもの
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

    var limitA = maxA;
    var limitB = MAX_B;
    var isOwnedMode = (calcMode === "owned");

    if (isOwnedMode) {
      limitB = Math.min(MAX_B, Math.max(0, getInt(inputOwnedB, 0)));
      limitA = Math.min(2000,  Math.max(0, getInt(inputOwnedA, 0)));
    }

    var combinations = findCombinations(target, startFloor, limitA, limitB);
    showResult(target, combinations, isOwnedMode);
  }

  btnCalc.addEventListener("click", onCalc);
  inputTarget.addEventListener("keydown", function (e) {
    if (e.key === "Enter") onCalc();
  });
});
