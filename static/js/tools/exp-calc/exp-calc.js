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
var lastCalcTotal = 0;
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

  // Lv199→200の必要経験値を計算（Lv201以降はこの値で固定）
  var prevExp = baseExp;
  for (var lv = 2; lv <= 199; lv++) {
    prevExp = Math.floor(prevExp * mult + lv * 5);
  }
  var lv200Exp = Math.floor(prevExp * mult + 199 * 5);

  // fromLvまでのprevExpを計算（Lv200以降は固定値）
  if (fromLv <= 200) {
    prevExp = baseExp;
    for (var lv = 2; lv < fromLv; lv++) {
      prevExp = Math.floor(prevExp * mult + lv * 5);
    }
  } else {
    prevExp = lv200Exp;
  }

  var details = [];
  var total = 0;

  for (var lv = fromLv; lv < toLv; lv++) {
    var exp;
    if (lv === 1) {
      exp = baseExp;
    } else if (lv >= 200) {
      exp = lv200Exp; // Lv200以降は固定
    } else {
      exp = Math.floor(prevExp * mult + lv * 5);
    }
    details.push({ lv: lv, exp: exp });
    total += exp;
    prevExp = lv < 200 ? exp : lv200Exp;
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
  var huntCalc = $("huntCalc");
  if (huntCalc) huntCalc.style.display = "none";
  lastCalcTotal = 0;
}

function showResult(result, isHero) {
  var r = $("expResult");
  if (!r) return;
  r.style.display = "";
  lastCalcTotal = result.total;

  // 討伐数計算セクションを表示
  var huntCalc = $("huntCalc");
  if (huntCalc) huntCalc.style.display = "";
  // ペットタブのみジパング・キノコ行を表示
  var petHuntRows = $("petHuntRows");
  if (petHuntRows) petHuntRows.style.display = isHero ? "none" : "";
  // 討伐結果をリセット
  var huntResult = $("huntResult");
  if (huntResult) huntResult.style.display = "none";

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

    fromLv = Math.min(200, Math.max(1, fromLv));
    toLv   = Math.min(200, Math.max(2, toLv));
    tenme  = Math.min(30,  Math.max(0, tenme));
    til    = Math.min(1000,Math.max(0, til));
    if ($("heroFromLv")) $("heroFromLv").value = fromLv;
    if ($("heroToLv"))   $("heroToLv").value   = toLv;
    if ($("heroTenme"))  $("heroTenme").value  = tenme;
    if ($("heroTilapia"))$("heroTilapia").value = til;
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

    fromLv = Math.min(1200, Math.max(1, fromLv));
    toLv   = Math.min(1200, Math.max(2, toLv));
    tenme  = Math.min(30,   Math.max(0, tenme));
    til    = Math.min(1000, Math.max(0, til));
    if ($("petFromLv"))  $("petFromLv").value  = fromLv;
    if ($("petToLv"))    $("petToLv").value    = toLv;
    if ($("petTenme"))   $("petTenme").value   = tenme;
    if ($("petTilapia")) $("petTilapia").value  = til;
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


// ============================================================
// 討伐数計算
// ============================================================
var HUNT_STORAGE_KEY = "exp_calc_hunt_v1";

function saveHuntSettings() {
  try {
    localStorage.setItem(HUNT_STORAGE_KEY, JSON.stringify({
      kigen:    $("hasKigenOn")?.getAttribute("aria-pressed") === "true",
      medal:    parseInt($("medalCount")?.value||"0", 10)||0,
      zipang:   parseInt($("zipangCount")?.value||"0", 10)||0,
      luminous: parseInt($("luminousCount")?.value||"0", 10)||0,
      house:    $("hasHouse")?.getAttribute("aria-pressed") === "true",
    }));
  } catch(e) {}
}

function loadHuntSettings() {
  try {
    var raw = localStorage.getItem(HUNT_STORAGE_KEY);
    if (!raw) return;
    var d = JSON.parse(raw);
    if ($("hasKigenOn")) $("hasKigenOn").setAttribute("aria-pressed", d.kigen ? "true" : "false");
    if ($("hasKigen"))   $("hasKigen").setAttribute("aria-pressed",   d.kigen ? "false" : "true");
    if ($("medalCount"))   $("medalCount").value   = d.medal   || 0;
    if ($("zipangCount"))  $("zipangCount").value  = d.zipang  || 0;
    if ($("luminousCount"))$("luminousCount").value = d.luminous|| 0;
    if ($("hasHouse")) $("hasHouse").setAttribute("aria-pressed",  d.house ? "true" : "false");
    if ($("noHouse"))  $("noHouse").setAttribute("aria-pressed",   d.house ? "false" : "true");
  } catch(e) {}
}

// 経験の起源トグル
[$("hasKigen"), $("hasKigenOn")].forEach(function(btn) {
  if (!btn) return;
  btn.addEventListener("click", function() {
    var isOn = btn.getAttribute("data-val") === "1";
    $("hasKigenOn")?.setAttribute("aria-pressed", isOn ? "true" : "false");
    $("hasKigen")?.setAttribute("aria-pressed",   isOn ? "false" : "true");
    saveHuntSettings();
  });
});

// キノコハウストグル
[$("noHouse"), $("hasHouse")].forEach(function(btn) {
  if (!btn) return;
  btn.addEventListener("click", function() {
    var isHouse = btn.id === "hasHouse";
    $("hasHouse")?.setAttribute("aria-pressed", isHouse ? "true" : "false");
    $("noHouse")?.setAttribute("aria-pressed",  isHouse ? "false" : "true");
    saveHuntSettings();
  });
});

// 数値入力の保存
["medalCount","zipangCount","luminousCount"].forEach(function(id) {
  $(id)?.addEventListener("input", saveHuntSettings);
});

// 討伐数計算ボタン
$("huntCalcBtn")?.addEventListener("click", function() {
  var baseExp    = Math.max(1, parseInt($("monsterBaseExp")?.value||"1", 10)||1);
  var kigen      = $("hasKigenOn")?.getAttribute("aria-pressed") === "true" ? 2 : 1;
  var medal      = Math.min(1000, Math.max(0, parseInt($("medalCount")?.value||"0", 10)||0));
  var zipang     = Math.min(1000, Math.max(0, parseInt($("zipangCount")?.value||"0", 10)||0));
  var luminous   = Math.min(1000, Math.max(0, parseInt($("luminousCount")?.value||"0", 10)||0));
  var house      = $("hasHouse")?.getAttribute("aria-pressed") === "true" ? 100 : 1;

  // 経験値基準値 = 基礎経験値 × 起源 × (Lv^1.1×0.2切捨て 最低1) + メダル×10
  // ※ここでは討伐モンスターのLvが不明なため基礎経験値をそのまま使用
  var kijun = Math.floor(baseExp * kigen) + medal * 10;

  var expPerKill;
  if (currentTab === "pet") {
    // ペット: 基準値 × (1+ジパング補正) × (1+キノコ補正×ハウス補正)
    var zipangMult   = 1 + zipang   * 0.1;
    var luminousMult = 1 + luminous * 0.1 * house;
    expPerKill = Math.floor(kijun * zipangMult * luminousMult);
  } else {
    // 主人公: 基準値のみ（ジパング・キノコは主人公に適用されない）
    expPerKill = kijun;
  }

  var totalExp = lastCalcTotal || 0;
  var killCount = totalExp > 0 ? Math.ceil(totalExp / expPerKill) : 0;

  var huntResult = $("huntResult");
  if (huntResult) huntResult.style.display = "";
  if ($("huntExpPerKill")) $("huntExpPerKill").textContent = fmt(expPerKill) + " EXP";
  if ($("huntKillCount"))  $("huntKillCount").textContent  = fmt(killCount)  + " 体";
});

// 討伐数計算の初期化
loadHuntSettings();


});
