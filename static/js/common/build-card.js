// ============================================================
// build-card.js  ビルド画像生成
// ============================================================

(function() {

function $(id) { return document.getElementById(id); }

function getEquipName(id) {
  if (!id || !window.equipmentMapGlobal) return "（なし）";
  const item = window.equipmentMapGlobal.get(String(id));
  return item ? item.name : "（なし）";
}

function getPetName(id) {
  if (!id) return "（なし）";
  if (window.petNameMapGlobal) {
    const name = window.petNameMapGlobal.get(String(id));
    if (name) return name;
  }
  if (window.MONSTERS) {
    const m = window.MONSTERS.find(function(m) { return String(m.id) === String(id); });
    if (m) return m.title;
  }
  return "（なし）";
}

function fmt(v) {
  if (v == null) return "0";
  return Number(v).toLocaleString("ja-JP");
}

function getVal(id) {
  const el = $(id);
  return el ? el.value : "";
}

function buildCardHTML() {
  const equipSlots = [
    { key: "weapon",     label: "武器" },
    { key: "head",       label: "頭" },
    { key: "body",       label: "体" },
    { key: "hands",      label: "手" },
    { key: "feet",       label: "脚" },
    { key: "shield",     label: "盾" },
  ];
  const rightSlots = [
    { key: "accessory1", label: "AC1" },
    { key: "accessory2", label: "AC2" },
    { key: "accessory3", label: "AC3" },
    { key: "accessory4", label: "AC4" },
    { key: "pet1",       label: "P1", isPet: true },
    { key: "pet2",       label: "P2", isPet: true },
    { key: "pet3",       label: "P3", isPet: true },
  ];

  function equipRow(label, key, isPet) {
    const id = $("select_"+key) ? $("select_"+key).value : "";
    const name = isPet ? getPetName(id) : getEquipName(id);
    var enhance = "";
    if (!isPet && id) {
      const lv  = parseInt($("level_" +key)?.value  || "0", 10) || 0;
      const glv = parseInt($("glevel_"+key)?.value || "0", 10) || 0;
      var parts = [];
      if (lv  > 0) parts.push("+" + lv);
      if (glv > 0) parts.push("G" + glv);
      if (parts.length > 0) enhance = ' <span class="bc-enhance">' + parts.join(" ") + '</span>';
    }
    return '<div class="bc-row"><span class="bc-label">' + label + '</span><span class="bc-val">' + name + enhance + '</span></div>';
  }

  const ft = window.lastFinalTotal || {};
  const stats = ["vit","spd","atk","int","def","mdef","luk"];
  const statLabels = { vit:"VIT", spd:"SPD", atk:"ATK", int:"INT", def:"DEF", mdef:"MDEF", luk:"LUK" };

  const baseStats = {};
  stats.forEach(function(s) {
    const el = $("base_"+s);
    baseStats[s] = el ? parseInt(el.value||"0",10)||0 : 0;
  });

  const hasContract = $("ss-contract-btn") ? 
    Array.from(document.querySelectorAll(".ss-contract-btn")).some(function(b) {
      return b.getAttribute("data-val")==="1" && b.getAttribute("aria-pressed")==="true";
    }) : false;

  const hasCosmoCube = $("ss-cosmocube-btn") ?
    Array.from(document.querySelectorAll(".ss-cosmocube-btn")).some(function(b) {
      return b.getAttribute("data-val")==="1" && b.getAttribute("aria-pressed")==="true";
    }) : false;

  var html = '<div class="bc-wrap">';
  html += '<div class="bc-header">みこ攻ビルドシミュ</div>';

  // 装備2列
  html += '<div class="bc-equip-grid">';
  html += '<div class="bc-col">';
  equipSlots.forEach(function(s) { html += equipRow(s.label, s.key, false); });
  html += '</div>';
  html += '<div class="bc-col">';
  rightSlots.forEach(function(s) { html += equipRow(s.label, s.key, s.isPet); });
  html += '</div>';
  html += '</div>';

  // 振り分け＋最終ステータス統合表示
  html += '<div class="bc-section">';
  html += '<div class="bc-stat-table">';
  html += '<div class="bc-stat-header"><span></span><span>振り分け</span><span>最終</span></div>';
  ["vit","spd","atk","int","def","mdef","luk"].forEach(function(s) {
    html += '<div class="bc-stat-row">';
    html += '<span class="bc-stat-key">' + statLabels[s] + '</span>';
    html += '<span class="bc-stat-num">' + fmt(baseStats[s]) + '</span>';
    html += '<span class="bc-stat-num">' + fmt(ft[s]||0) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  html += '</div>';

  // その他データ
  html += '<div class="bc-section"><div class="bc-section-title">その他データ</div>';
  html += '<div class="bc-data-grid">';
  html += '<div class="bc-data-row"><span>Lv:</span><span>' + (getVal("ss-chara-lv")||"–") + '</span></div>';
  html += '<div class="bc-data-row"><span>天命輪廻:</span><span>' + (getVal("ss-sp-tenme-count")||"0") + '</span></div>';
  html += '<div class="bc-data-row"><span>コスモキューブ:</span><span>' + (hasCosmoCube?"所持":"未所持") + '</span></div>';
  html += '<div class="bc-data-row"><span>羽ペン:</span><span>' + (getVal("ss-pen-count")||"0") + '</span></div>';
  html += '<div class="bc-data-row"><span>祭壇:</span><span>' + (getVal("ss-altar-count")||"0") + '</span></div>';
  html += '<div class="bc-data-row"><span>天晶:</span><span>' + (getVal("ss-tensho-count")||"0") + '</span></div>';
  html += '<div class="bc-data-row"><span>スーパースクロール:</span><span>' + (getVal("ss-scroll-count")||"0") + '</span></div>';
  html += '<div class="bc-data-row"><span>賢者:</span><span>' + (getVal("ss-sage-drop")||"0") + '</span></div>';
  html += '<div class="bc-data-row"><span>書物:</span><span>' + (getVal("ss-forbidden-book")||"0") + '</span></div>';
  html += '<div class="bc-data-row"><span>契約書:</span><span>' + (hasContract?"所持":"未所持") + '</span></div>';
  html += '</div></div>';

  html += '</div>';
  return html;
}

function showBuildCard() {
  var overlay = document.getElementById("bcOverlay");
  var modal   = document.getElementById("bcModal");
  var preview = document.getElementById("bcPreview");

  if (!overlay || !modal || !preview) return;

  preview.innerHTML = buildCardHTML();
  overlay.style.display = '';
  modal.style.display = '';
}

function saveBuildCard() {
  var preview = document.getElementById("bcPreview");
  if (!preview || typeof html2canvas === "undefined") {
    alert("画像生成ライブラリが読み込まれていません");
    return;
  }

  var saveBtn = document.getElementById("bcSaveBtn");
  if (saveBtn) saveBtn.textContent = "生成中...";

  html2canvas(preview.firstElementChild, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
  }).then(function(canvas) {
    var link = document.createElement("a");
    link.download = "build.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    if (saveBtn) saveBtn.textContent = "保存";
  }).catch(function(e) {
    alert("画像生成に失敗しました");
    if (saveBtn) saveBtn.textContent = "保存";
  });
}

document.addEventListener("DOMContentLoaded", function() {
  var btn = document.getElementById("bcOpenBtn");
  if (btn) btn.addEventListener("click", showBuildCard);

  var closeBtn = document.getElementById("bcCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", function() {
    document.getElementById("bcOverlay").style.display = "none";
    document.getElementById("bcModal").style.display = "none";
  });

  var overlay = document.getElementById("bcOverlay");
  if (overlay) overlay.addEventListener("click", function() {
    overlay.style.display = "none";
    document.getElementById("bcModal").style.display = "none";
  });

  var saveBtn = document.getElementById("bcSaveBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveBuildCard);
});

})();
