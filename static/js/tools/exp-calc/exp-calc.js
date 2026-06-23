// ============================================================
// exp-calc.js  必要経験値計算機
// ============================================================

document.addEventListener("DOMContentLoaded", function() {

function $(id) { return document.getElementById(id); }
function fmt(v) { return Math.floor(Number(v)||0).toLocaleString("ja-JP"); }

// ============================================================
// タブ切り替え
// ============================================================
var currentTab = "hero";
var tabBtns = document.querySelectorAll(".exp-tab-btn");
tabBtns.forEach(function(btn) {
  btn.addEventListener("click", function() {
    currentTab = btn.getAttribute("data-tab");
    tabBtns.forEach(function(b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-tab") === currentTab ? "true" : "false");
    });
    document.querySelectorAll(".exp-panel").forEach(function(p) {
      p.style.display = p.getAttribute("data-panel") === currentTab ? "" : "none";
    });
    clearResult();
  });
});

// ============================================================
// 天命・殲儀倍率計算
// ============================================================
function calcMultiplier(tenme, tilapia) {
  var t = Math.max(0, Math.floor(Number(tenme)||0));
  var til = Math.max(0, Math.floor(Number(tilapia)||0));
  return 1.05 + Math.max(t * 0.01 - til * 0.00005, 0);
}

// ============================================================
// 主人公の経験値計算
// ============================================================
function calcHeroExp(fromLv, toLv, tenme, tilapia) {
  fromLv = Math.max(1, Math.floor(fromLv));
  toLv   = Math.max(fromLv + 1, Math.floor(toLv));
  var mult = calcMultiplier(tenme, tilapia);

  // Lv1→2の必要経験値 = 100
  // Lv.N→N+1 = 前回 × mult + N × 5
  var details = [];
  var prevExp = 100; // Lv1→2

  // fromLvまでの経験値を計算（使わないが倍率の基準として必要）
  for (var lv = 2; lv < fromLv; lv++) {
    prevExp = prevExp * mult + lv * 5;
  }

  var total = 0;
  for (var lv = fromLv; lv < toLv; lv++) {
    var exp;
    if (lv === 1) {
      exp = 100;
    } else {
      exp = prevExp * mult + lv * 5;
    }
    exp = Math.floor(exp);
    details.push({ lv: lv, exp: exp });
    total += exp;
    prevExp = exp;
  }

  return { total: total, details: details, mult: mult };
}

// ============================================================
// ペットの経験値計算
// ============================================================
function calcPetBaseExp(monster) {
  // MOVを除く基礎ステータス合計 + 50
  var keys = ["vit","spd","atk","int","def","mdef","luk"];
  var sum = 0;
  keys.forEach(function(k) { sum += Math.floor(Number(monster[k])||0); });
  return sum + 50;
}

function calcPetExp(fromLv, toLv, tenme, tilapia, monster) {
  fromLv = Math.max(1, Math.floor(fromLv));
  toLv   = Math.max(fromLv + 1, Math.floor(toLv));
  var mult = calcMultiplier(tenme, tilapia);
  var baseExp = calcPetBaseExp(monster);

  // Lv200→201以降は固定（Lv199→200の必要経験値）
  var maxCalcLv = 200;

  // Lv199→200の必要経験値を計算
  var prevExp = baseExp;
  for (var lv = 2; lv <= 199; lv++) {
    prevExp = Math.floor(prevExp * mult + lv * 5);
  }
  var lv200Exp = Math.floor(prevExp * mult + 199 * 5);

  // fromLvまでの経験値を再計算
  prevExp = baseExp;
  for (var lv = 2; lv < fromLv && lv <= maxCalcLv; lv++) {
    prevExp = Math.floor(prevExp * mult + lv * 5);
  }

  var details = [];
  var total = 0;

  for (var lv = fromLv; lv < toLv; lv++) {
    var exp;
    if (lv >= 200) {
      exp = lv200Exp; // Lv200以降は固定
    } else if (lv === 1) {
      exp = baseExp;
    } else {
      exp = Math.floor(prevExp * mult + lv * 5);
    }
    details.push({ lv: lv, exp: exp });
    total += exp;
    prevExp = exp;
  }

  return { total: total, details: details, mult: mult, baseExp: baseExp };
}

// ============================================================
// ペットモンスター検索
// ============================================================
var selectedMonster = null;
var petSearch  = $("petMonsterSearch");
var petSuggest = $("petMonsterSuggest");

function normalizeJP(s) {
  return (s||"").replace(/[\u30A1-\u30F6]/g, function(c) {
    return String.fromCharCode(c.charCodeAt(0) - 0x60);
  }).toLowerCase();
}

function openPetSuggest(items) {
  if (!petSuggest) return;
  petSuggest.innerHTML = "";
  petSuggest.hidden = false;
  items.forEach(function(m) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = m.title;
    btn.addEventListener("click", function() {
      selectedMonster = m;
      petSearch.value = m.title;
      petSuggest.hidden = true;
      petSuggest.innerHTML = "";
      clearResult();
    });
    petSuggest.appendChild(btn);
  });
}

if (petSearch) {
  petSearch.addEventListener("input", function() {
    var q = petSearch.value;
    selectedMonster = null;
    if (q.trim() === "") { petSuggest.hidden = true; return; }
    var hits = (window.MONSTERS||[]).filter(function(m) {
      return normalizeJP(m.title).indexOf(normalizeJP(q)) !== -1;
    }).slice(0, 50);
    if (hits.length === 0) { petSuggest.hidden = true; return; }
    openPetSuggest(hits);
  });

  petSearch.addEventListener("focus", function() {
    var q = petSearch.value || "";
    var items = q.trim() === ""
      ? (window.MONSTERS||[]).slice(0, 200)
      : (window.MONSTERS||[]).filter(function(m) {
          return normalizeJP(m.title).indexOf(normalizeJP(q)) !== -1;
        }).slice(0, 200);
    if (items.length > 0) openPetSuggest(items);
  });

  petSearch.addEventListener("search", function() {
    if (petSearch.value.trim() === "") {
      selectedMonster = null;
      petSuggest.hidden = true;
    }
  });
}

document.addEventListener("click", function(e) {
  if (petSearch && petSuggest) {
    if (e.target === petSearch || petSuggest.contains(e.target)) return;
    petSuggest.hidden = true;
  }
});

// ============================================================
// 結果表示
// ============================================================
function clearResult() {
  var r = $("expResult");
  if (r) r.style.display = "none";
}

function showResult(result, isHero) {
  var r = $("expResult");
  if (!r) return;
  r.style.display = "";

  $("expResultValue").textContent = fmt(result.total) + " EXP";
  $("expResultMult").textContent = "天命・殲儀倍率: " + result.mult.toFixed(5);

  if (isHero === false) {
    $("expResultBaseExp") && ($("expResultBaseExp").textContent = "Lv1→2基礎経験値: " + fmt(result.baseExp));
  }

  var tbody = $("expResultTableBody");
  if (tbody) {
    tbody.innerHTML = "";
    // 最大20行表示
    var showAll = result.details.length <= 20;
    var rows = showAll ? result.details : result.details.slice(0, 10).concat(result.details.slice(-10));
    var prev = null;
    rows.forEach(function(d, i) {
      if (!showAll && i === 10) {
        var tr = document.createElement("tr");
        tr.innerHTML = '<td colspan="2" style="text-align:center;color:#888">... 中略 ...</td>';
        tbody.appendChild(tr);
      }
      var tr = document.createElement("tr");
      tr.innerHTML = '<td>Lv' + d.lv + '→' + (d.lv+1) + '</td><td>' + fmt(d.exp) + '</td>';
      tbody.appendChild(tr);
    });
  }
}

// ============================================================
// 計算実行
// ============================================================
$("expCalcBtn")?.addEventListener("click", function() {
  var err = $("expError");
  if (err) err.textContent = "";

  if (currentTab === "hero") {
    var fromLv = parseInt($("heroFromLv")?.value||"1", 10);
    var toLv   = parseInt($("heroToLv")?.value||"2", 10);
    var tenme  = parseInt($("heroTenme")?.value||"0", 10);
    var til    = parseInt($("heroTilapia")?.value||"0", 10);

    fromLv = Math.min(199, Math.max(1, fromLv));
    toLv   = Math.min(200, Math.max(2, toLv));
    if (isNaN(fromLv) || isNaN(toLv) || fromLv < 1 || toLv <= fromLv) {
      if (err) err.textContent = "Lvの入力値を確認してください";
      return;
    }
    var result = calcHeroExp(fromLv, toLv, tenme, til);
    showResult(result, true);

  } else {
    if (!selectedMonster) {
      if (err) err.textContent = "ペットのモンスターを選択してください";
      return;
    }
    var fromLv = parseInt($("petFromLv")?.value||"1", 10);
    var toLv   = parseInt($("petToLv")?.value||"2", 10);
    var tenme  = parseInt($("petTenme")?.value||"0", 10);
    var til    = parseInt($("petTilapia")?.value||"0", 10);

    fromLv = Math.min(199, Math.max(1, fromLv));
    toLv   = Math.min(200, Math.max(2, toLv));
    if (isNaN(fromLv) || isNaN(toLv) || fromLv < 1 || toLv <= fromLv) {
      if (err) err.textContent = "Lvの入力値を確認してください";
      return;
    }
    var result = calcPetExp(fromLv, toLv, tenme, til, selectedMonster);
    showResult(result, false);
  }
});

// 初期表示
clearResult();

});
