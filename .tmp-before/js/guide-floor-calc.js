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
 * 通常サイクル（100 + B + 100×A）が必ず100の倍数になり、SGが出現し続ける。
 *
 * ── スタート地点 ──
 *   1Fスタート : 冒険者像2個を一時的に外して片側撃破
 *                初回到達 = 1 + 1 + (B-2) = B F（Bは2以上）
 *   指定ワープ : 任意の1万の倍数F（最高到達-10万F）
 *                すでに100の倍数でSGが出現するため2個置き不要
 *                初回到達 = start
 *   麒麟ワープ : 100万F固定。麒麟討伐後の移動は通常移動なので
 *                1,000,001 + B に進み100の倍数から外れる。
 *                1Fスタートと同じく2個置きで調整する
 *                初回到達 = 1,000,000 + 2B F（Bは2以上）
 *
 * ── 1回の移動 ──
 *   移動は2種類あり、現在地がボスフロアかどうかで切り替わる。
 *
 *   通常サイクル（現在地がボスフロア以外）:
 *     片側撃破  : +1F
 *     冒険者B個 : +B F
 *     SG撃破    : +99F（100の倍数Fで発生）
 *     悪魔A個   : +100×A F
 *     ─────────────────────────
 *     計        : 100 + B + 100×A F
 *
 *   ボスサイクル（現在地が1万・10万・100万・1000万の倍数）:
 *     ボス討伐後の移動は通常移動でSGが出ないため、悪魔像の効果が乗らない。
 *     100の倍数から外れるので1Fスタートと同じく2個置きで調整する。
 *     ボス討伐後 : +1 + B F
 *     2個置き    : +1 + (B-2) F
 *     ─────────────────────────
 *     計         : 2B F
 *
 *   初回到達地点はボスフロア判定の対象外とする。
 *   ワープで降り立ったボスフロアは通常エリア扱いのため。
 *   （1Fスタートの初回到達 B と麒麟ワープの初回到達 1,000,000 + 2B は
 *     2B < 10,000 なのでそもそもボスフロアにならない）
 *
 *   ボスフロアの間隔は1万Fで、ボスサイクルの 2B は1万F未満のため、
 *   ボスサイクルが2回続くことはない。
 *   B = 0 のときボスサイクルは0Fで進めないため、その場で不成立とする。
 *
 * ── 判定方法 ──
 *   初回到達地点から1回ずつ進めるシミュレートで判定する。
 *   目標にちょうど乗れば成立、飛び越えたら不成立。
 *   打ち切り回数は (A,B) ごとの移動回数の理論上限から求める（boundMoves）。
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
  const BOSS_SPAN   = 10000;  // ボスフロアの最小間隔

  // シミュレートの打ち切り。
  // 実質の上限は (A,B) ごとの理論上限 boundMoves() で決まるため、
  // この2つは非現実的な目標階層を入力されたときの保険として働く
  const MAX_MOVES      = 100000;    // 1組み合わせあたりの移動回数の上限
  const MAX_TOTAL_ITER = 30000000;  // 探索全体のループ回数の上限
  const MAX_ROWS       = 200;       // 全組み合わせ一覧モードの表示件数

  /* ── DOM 参照 ── */
  const inputTarget   = document.getElementById("targetFloor");
  const btnCalc       = document.getElementById("calcFloorBtn");
  const resultEl      = document.getElementById("floorResult");
  const titleEl       = document.getElementById("floorResultTitle");
  const bodyEl        = document.getElementById("floorResultBody");
  const noResultEl    = document.getElementById("floorNoResult");
  const noteEl        = document.getElementById("floorResultNote");
  const tableWrapEl   = document.querySelector(".floor-tool__table-wrap");

  const startTypeBtns = document.querySelectorAll("[data-start-type]");
  const inputWarpF    = document.getElementById("warpFloor");
  const warpRow       = document.getElementById("warpFloorRow");

  const modeBtns      = document.querySelectorAll("[data-calc-mode]");
  const ownedRow      = document.getElementById("ownedRow");
  const inputOwnedB   = document.getElementById("ownedAdventurer");
  const inputOwnedA   = document.getElementById("ownedDevil");

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
   * 移動回数の理論上限
   * 「通常サイクルだけで進んだ場合の回数」＋「ボスフロアの最大通過数」＋端数の余裕。
   * ボスサイクルは連続しないため、通過数は distance / BOSS_SPAN で抑えられる。
   * この回数まで進めて目標に届かなければ、それ以上進めても成立しない。
   * @param {number} distance   - 初回到達地点から目標までの距離
   * @param {number} normalStep - 通常サイクル1回の進行F
   * @returns {number} 打ち切ってよい移動回数
   */
  function boundMoves(distance, normalStep) {
    return Math.ceil(distance / normalStep) + Math.ceil(distance / BOSS_SPAN) + 2;
  }

  /**
   * 初回到達地点から1回ずつ進めて、目標にちょうど乗るか調べる
   * @param {number} firstReach - 初回到達地点
   * @param {number} target     - 目標階層
   * @param {number} b          - 冒険者像の所持数
   * @param {number} a          - 悪魔像の所持数
   * @param {number} cap        - 打ち切る移動回数
   * @param {object} counter    - ループ回数の積算用 { iter: number }
   * @returns {number|null} 成立なら総移動回数、不成立なら null
   */
  function simulate(firstReach, target, b, a, cap, counter) {
    var normalStep = 100 + b + 100 * a;
    var bossStep   = 2 * b;
    var cur        = firstReach;
    var moves      = 0;

    while (cur < target) {
      // moves === 0 の初回到達地点はボスフロア判定の対象外
      if (moves > 0 && isBossFloor(cur)) {
        if (bossStep === 0) { counter.iter += moves; return null; }  // B=0 では進めない
        cur += bossStep;
      } else {
        cur += normalStep;
      }
      moves++;
      if (moves > cap) { counter.iter += moves; return null; }
    }

    counter.iter += moves;
    return (cur === target) ? moves : null;
  }

  /**
   * 到達可能な組み合わせを列挙
   * @returns {{results: Array, truncated: boolean}}
   *   truncated = 探索量の上限に達して一部を調べていない
   */
  function findCombinations(target, startFloor, limitA, limitB) {
    var results = [];
    var counter = { iter: 0 };
    var skipped = 0;
    var aborted = false;

    // Bは100の倍数のみ探索する。
    // 通常サイクル（100 + B + 100×A）が100の倍数になり、SGが出現し続ける。
    // 100の倍数から外れるとSGを踏めず、そこでサイクルが破綻する
    for (var b = 0; b <= limitB; b += 100) {
      if (aborted) break;

      var firstReach;
      if (startType === "normal") {
        // 1Fスタート: 冒険者像2個を一時的に外して片側撃破
        //   1 + 1 + (B-2) = B
        if (b < 2) continue;
        firstReach = b;
      } else if (startType === "warp2") {
        // 麒麟ワープ: 麒麟討伐後は通常移動なので 1,000,001 + B に進み、
        // 100の倍数から外れる。1Fスタートと同じく2個置きで調整する
        //   1,000,000 → 1,000,001 + B → 2個置き → 1,000,000 + 2B
        if (b < 2) continue;
        firstReach = startFloor + 2 * b;
      } else {
        // 指定ワープ: 開始地点が1万の倍数のためすでに100の倍数。2個置き不要
        firstReach = startFloor;
      }

      if (firstReach > target) continue;

      var distance = target - firstReach;

      // 初回到達だけでちょうど到達
      if (distance === 0) {
        results.push({ a: 0, b: b, moves: 0, firstReach: firstReach });
        continue;
      }

      for (var a = 0; a <= limitA; a++) {
        if (counter.iter > MAX_TOTAL_ITER) { aborted = true; break; }

        // 理論上限が保険の上限を超える (A,B) は、進めずにスキップする
        var bound = boundMoves(distance, 100 + b + 100 * a);
        if (bound > MAX_MOVES) { skipped++; continue; }

        var moves = simulate(firstReach, target, b, a, bound, counter);
        if (moves === null) continue;

        results.push({ a: a, b: b, moves: moves, firstReach: firstReach });
      }
    }

    return { results: results, truncated: (skipped > 0 || aborted) };
  }

  /* ── 表示 ── */
  function showResult(target, combinations, isOwnedMode, truncated) {
    resultEl.hidden = false;

    var startLabel = "";
    if (startType === "normal") startLabel = "1Fスタート";
    else if (startType === "warp1") startLabel = getInt(inputWarpF, 0).toLocaleString() + "Fスタート";
    else startLabel = "1,000,000Fスタート";

    titleEl.innerHTML =
      "<strong>" + target.toLocaleString() + "F</strong>" +
      " に到達できる組み合わせ（" + startLabel + "）";

    bodyEl.innerHTML = "";
    if (noteEl) { noteEl.hidden = true; noteEl.textContent = ""; }

    // ヘッダーの調整。0件で早期returnしても前回モードの見出しが残らないよう先に行う
    var thead = document.querySelector("#floorResultTable thead tr");
    if (thead) {
      thead.innerHTML = (isOwnedMode ? "<th>評価</th>" : "") +
        "<th>冒険者像（個）</th><th>悪魔像（個）</th><th>総移動回数</th>";
    }

    if (combinations.length === 0) {
      noResultEl.hidden         = false;
      tableWrapEl.style.display = "none";
      if (noteEl && truncated) {
        noteEl.hidden      = false;
        noteEl.textContent = "探索量の上限に達したため、一部の組み合わせは調べていません。";
      }
      return;
    }

    noResultEl.hidden         = true;
    tableWrapEl.style.display = "";

    // 総移動回数の少ない順。同数なら素材の合計が少ない順、さらに同数なら冒険者像の少ない順
    var sorted = combinations.slice().sort(function (x, y) {
      if (x.moves !== y.moves) return x.moves - y.moves;
      var sx = x.a + x.b, sy = y.a + y.b;
      if (sx !== sy) return sx - sy;
      return x.b - y.b;
    });

    var total = sorted.length;
    var show  = isOwnedMode ? sorted.slice(0, 3) : sorted.slice(0, MAX_ROWS);

    var rank = ["最適", "準適切", "準々適切"];

    show.forEach(function (combo, i) {
      var tr = document.createElement("tr");

      if (isOwnedMode) {
        var tdRank = document.createElement("td");
        tdRank.textContent = rank[i] || "";
        tdRank.style.fontWeight = "bold";
        tr.appendChild(tdRank);
      }

      var tdB     = document.createElement("td");
      var tdA     = document.createElement("td");
      var tdMoves = document.createElement("td");

      tdB.textContent = combo.b.toLocaleString() + " 個";
      tdA.textContent = combo.a.toLocaleString() + " 個";
      tdMoves.textContent = (combo.moves === 0)
        ? "0 回（初回到達のみ）"
        : combo.moves.toLocaleString() + " 回";

      tr.appendChild(tdB);
      tr.appendChild(tdA);
      tr.appendChild(tdMoves);
      bodyEl.appendChild(tr);
    });

    // 表示を絞った場合と、探索を打ち切った場合は明示する
    if (noteEl) {
      var notes = [];
      if (show.length < total) {
        notes.push("全 " + total.toLocaleString() + " 件中、総移動回数の少ない " +
                   show.length.toLocaleString() + " 件を表示しています。");
      }
      if (truncated) {
        notes.push("探索量の上限に達したため、一部の組み合わせは調べていません。");
      }
      if (notes.length) {
        noteEl.hidden      = false;
        noteEl.textContent = notes.join(" ");
      }
    }
  }

  function showError(msg) {
    resultEl.hidden           = false;
    titleEl.innerHTML         = msg;
    bodyEl.innerHTML          = "";
    noResultEl.hidden         = true;
    tableWrapEl.style.display = "none";
    if (noteEl) { noteEl.hidden = true; noteEl.textContent = ""; }
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

    var found = findCombinations(target, startFloor, limitA, limitB);
    showResult(target, found.results, isOwnedMode, found.truncated);
  }

  btnCalc.addEventListener("click", onCalc);
  inputTarget.addEventListener("keydown", function (e) {
    if (e.key === "Enter") onCalc();
  });
});
