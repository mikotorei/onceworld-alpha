document.addEventListener('DOMContentLoaded', function () {

var STAT_KEYS   = ['vit', 'spd', 'atk', 'int', 'def', 'mdef', 'luk'];
var STAT_LABELS = { vit:'VIT', spd:'SPD', atk:'ATK', int:'INT', def:'DEF', mdef:'MDEF', luk:'LUK' };

var monsters = (typeof window.MONSTERS !== 'undefined')
  ? window.MONSTERS.map(function (m) {
      return {
        id:      m.id,
        title:   m.title,
        element: m.element,
        vit:     m.vit,
        spd:     m.spd,
        atk:     m.atk,
        int:     m.int,
        def:     m.def,
        mdef:    m.mdef,
        luk:     m.luk,
        mov:     m.mov || 0
      };
    })
  : [];

var selected = null;

var searchInput = document.getElementById('petMonsterSearch');
var suggestBox  = document.getElementById('petMonsterSuggest');
var lvInput     = document.getElementById('lvInput');
var sengiInput  = document.getElementById('sengiInput');
var powderGrid  = document.getElementById('powderGrid');
var kinokoInput = document.getElementById('kinokoInput');
var kneaderInput = document.getElementById('kneaderInput');
var helmetInput  = document.getElementById('helmetInput');
var lvMaxNote    = document.getElementById('lvMaxNote');
var powderMaxNote = document.getElementById('powderMaxNote');
var kinokoMaxNote = document.getElementById('kinokoMaxNote');
var powderMaxAllBtn = document.getElementById('powderMaxAllBtn');
var houseBtn    = document.getElementById('houseBtn');
var result      = document.getElementById('result');

// 粉入力欄を生成
STAT_KEYS.forEach(function (s) {
  var wrap = document.createElement('div');
  wrap.className = 'powder-item';

  var label = document.createElement('span');
  label.className = 'powder-label';
  label.textContent = STAT_LABELS[s];

  var input = document.createElement('input');
  input.type        = 'number';
  input.id          = 'powder-' + s;
  input.min         = '0';
  input.value       = '0';
  input.addEventListener('input', function () {
    var max = getPowderMax();
    var v = parseInt(input.value, 10);
    if (!isNaN(v) && v > max) input.value = max;
    if (!isNaN(v) && v < 0)   input.value = 0;
    render();
  });

  var btn = document.createElement('button');
  btn.type        = 'button';
  btn.className   = 'chip-btn powder-max-btn';
  btn.textContent = String(getPowderMax());
  btn.addEventListener('click', function () {
    input.value = getPowderMax();
    render();
  });

  wrap.appendChild(label);
  wrap.appendChild(input);
  wrap.appendChild(btn);
  powderGrid.appendChild(wrap);
});

// キノコハウス ON/OFF
houseBtn.addEventListener('click', function () {
  var on = houseBtn.getAttribute('aria-pressed') === 'true';
  houseBtn.setAttribute('aria-pressed', on ? 'false' : 'true');
  houseBtn.textContent = on ? 'キノコハウス OFF' : 'キノコハウス ON';
  render();
});

// 入力値取得
// 素材の現在の所持上限。効果素材は通常1000 / パンドラの箱所持で2000
function materialCapOf(id) {
  if (typeof OWPandora !== 'undefined' && typeof OWPandora.materialCap === 'function') {
    return OWPandora.materialCap(id, 1000);
  }
  if (typeof getMaterialMax === 'function') {
    var m = getMaterialMax(id, false);
    if (m !== null && m !== undefined) return m;
  }
  return 1000;
}

// 入力欄の所持数を 0〜所持上限 に収めて返す
function ownedCount(input, id) {
  if (!input) return 0;
  var max = materialCapOf(id);
  var v = parseInt(input.value, 10);
  if (isNaN(v) || v < 0) return 0;
  if (v > max)           return max;
  return v;
}

// ハデスの兜の所持数
function getHelmet() {
  return ownedCount(helmetInput, 'hades_helmet');
}

// 上限計算に渡す素材の所持数
function materialCounts() {
  return {
    hades_helmet: getHelmet(),
    dragon_brand_kneader: getKneader()
  };
}

// ペットの最大レベル。定義は game-data.js の LIMITS.petLevel
function getLvMax() {
  var v = (typeof getLimit === 'function') ? getLimit('petLevel', materialCounts()) : null;
  return (v === null || v === undefined) ? 1200 : v;
}

// Lv入力欄の max / placeholder を現在の上限に合わせ、超過分は切り詰める
function applyLvMax() {
  var max = getLvMax();
  if (lvInput) {
    lvInput.max = String(max);
    lvInput.placeholder = '1〜' + max;
    var v = parseInt(lvInput.value, 10);
    if (!isNaN(v) && v > max) lvInput.value = String(max);
  }
  if (lvMaxNote) {
    lvMaxNote.textContent = '最大レベル: ' + max
      + '（基本1200 + ハデスの兜' + getHelmet() + '個 / 上限2200）';
  }
}

function getLv() {
  var max = getLvMax();
  var v = parseInt(lvInput.value, 10);
  if (isNaN(v) || v < 1) return 1;
  if (v > max)           return max;
  return v;
}

function getSengi() {
  var v = parseInt(sengiInput.value, 10);
  if (isNaN(v) || v < 0) return 0;
  if (v > 30)            return 30;
  return v;
}

function getPowder(s) {
  var el = document.getElementById('powder-' + s);
  var max = getPowderMax();
  var v   = parseInt(el.value, 10);
  if (isNaN(v) || v < 0) return 0;
  if (v > max)           return max;
  return v;
}

// ドラゴン印の手ごね機の所持数
function getKneader() {
  return ownedCount(kneaderInput, 'dragon_brand_kneader');
}

// 粉の使用上限。定義は game-data.js の LIMITS.petPowder
function getPowderMax() {
  var v = (typeof getLimit === 'function') ? getLimit('petPowder', materialCounts()) : null;
  return (v === null || v === undefined) ? 100 : v;
}

// 粉入力欄の max / placeholder を現在の上限に合わせ、超過分は切り詰める
function applyPowderMax() {
  var max = getPowderMax();
  STAT_KEYS.forEach(function (s) {
    var el = document.getElementById('powder-' + s);
    if (!el) return;
    el.max = String(max);
    el.placeholder = '0〜' + max;
    var v = parseInt(el.value, 10);
    if (!isNaN(v) && v > max) el.value = String(max);
  });
  // 各行のMAXボタンの文言も現在の上限に合わせる
  if (powderGrid) {
    powderGrid.querySelectorAll('.powder-max-btn').forEach(function (b) {
      b.textContent = String(max);
    });
  }
  if (powderMaxNote) {
    powderMaxNote.textContent = '粉の使用上限: ' + max
      + '（基本100 + 手ごね機' + getKneader() + '個）';
  }
}

// キノコの所持上限
function getKinokoMax() {
  return materialCapOf('element_mushroom');
}

function getKinoko() {
  var max = getKinokoMax();
  var v = parseInt(kinokoInput.value, 10);
  if (isNaN(v) || v < 0) return 0;
  if (v > max)           return max;
  return v;
}

// キノコ入力欄の max / placeholder を現在の上限に合わせ、超過分は切り詰める
function applyKinokoMax() {
  var max = getKinokoMax();
  if (kinokoInput) {
    kinokoInput.max = String(max);
    kinokoInput.placeholder = '0〜' + max;
    var v = parseInt(kinokoInput.value, 10);
    if (!isNaN(v) && v > max) kinokoInput.value = String(max);
  }
  if (kinokoMaxNote) {
    kinokoMaxNote.textContent = 'キノコの所持上限: ' + max
      + '（パンドラの箱' + (max > 1000 ? 'あり' : 'なし') + '）';
  }
}

// 計算式
function lvBonus(lv) {
  if (lv <= 200) return (lv - 1) * 0.1;
  return 19.9 + (lv - 200) * 1.1;
}

function calcStat(base, powder, sengi, lv) {
  var kijun = base + powder;
  var sA    = sengi + 1;
  var sB    = sengi * 3;
  var lB    = lvBonus(lv);
  return Math.floor(kijun * (1 + sA * (sB + lB)));
}

function topStatKey(values) {
  var best = STAT_KEYS[0];
  STAT_KEYS.forEach(function (s) {
    if (values[s] > values[best]) best = s;
  });
  return best;
}

// 結果描画
function render() {
  if (!selected) {
    result.innerHTML = '<p class="empty-msg">モンスターを選択してください</p>';
    return;
  }

  var lv         = getLv();
  var sengi      = getSengi();
  var kinoko     = getKinoko();
  var houseOn    = houseBtn.getAttribute('aria-pressed') === 'true';
  var kinokoMult = houseOn ? 100 : 1;

  var values = {};
  STAT_KEYS.forEach(function (s) {
    values[s] = calcStat(selected[s], getPowder(s), sengi, lv);
  });

  var topKey    = topStatKey(values);
  var kinokoVal = kinoko * kinokoMult;

  var cards = STAT_KEYS.map(function (s) {
    var val     = values[s];
    var isTop   = (s === topKey);
    var display = isTop ? val + kinokoVal : val;
    var kinokoTag = (isTop && kinokoVal > 0)
      ? '<div class="stat-kinoko">+' + kinokoVal.toLocaleString() + '（キノコ）</div>'
      : '';
    return '<div class="stat-card' + (isTop ? ' stat-card--top' : '') + '">'
      + '<div class="stat-label">' + STAT_LABELS[s] + '</div>'
      + '<div class="stat-base">基礎値&nbsp;' + selected[s] + '</div>'
      + '<div class="stat-val">' + display.toLocaleString() + '</div>'
      + kinokoTag
      + '</div>';
  }).join('');

  result.innerHTML =
    '<p class="section-label">Lv.' + lv + ' / 殲儀' + sengi + '回</p>'
    + '<div class="stats-grid">' + cards + '</div>'
    + '<p class="section-label">固定ステータス</p>'
    + '<div class="fixed-row">'
    + '<div class="fixed-card">MOV<span>' + selected.mov + '</span></div>'
    + '</div>';
}

// モンスター検索（ビルドシミュと同じ方式）
function normalizeJP(s) {
  return (s || '').replace(/[\u30A1-\u30F6]/g, function(c) {
    return String.fromCharCode(c.charCodeAt(0) - 0x60);
  }).toLowerCase();
}

function openSuggest(items) {
  suggestBox.innerHTML = '';
  suggestBox.hidden = false;
  items.forEach(function (m) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = m.title;
    btn.addEventListener('click', function () {
      selected = m;
      searchInput.value = m.title;
      suggestBox.hidden = true;
      suggestBox.innerHTML = '';
      render();
    });
    suggestBox.appendChild(btn);
  });
}

function closeSuggest() {
  suggestBox.hidden = true;
  suggestBox.innerHTML = '';
}

searchInput.addEventListener('input', function () {
  var q = searchInput.value;
  if (q.trim() === '') { selected = null; closeSuggest(); render(); return; }
  if (selected && q !== selected.title) { selected = null; render(); }
  var hits = monsters.filter(function (m) {
    return normalizeJP(m.title).indexOf(normalizeJP(q)) !== -1;
  }).slice(0, 50);
  if (hits.length === 0) closeSuggest();
  else openSuggest(hits);
});

searchInput.addEventListener('focus', function () {
  var q = searchInput.value || '';
  var items = q.trim() === ''
    ? monsters.slice(0, 200)
    : monsters.filter(function (m) {
        return normalizeJP(m.title).indexOf(normalizeJP(q)) !== -1;
      }).slice(0, 200);
  if (items.length > 0) openSuggest(items);
});

searchInput.addEventListener('search', function () {
  if (searchInput.value.trim() === '') {
    selected = null;
    closeSuggest();
    render();
  }
});

document.addEventListener('click', function (e) {
  if (e.target === searchInput || suggestBox.contains(e.target)) return;
  closeSuggest();
});

// 粉の入力上限clamp（inputイベントでも即時補正）
STAT_KEYS.forEach(function (s) {
  var el = document.getElementById('powder-' + s);
  if (!el) return;
  el.addEventListener('input', function () {
    var max = getPowderMax();
    var v = parseInt(el.value, 10);
    if (!isNaN(v) && v > max) el.value = String(max);
    if (!isNaN(v) && v < 0) el.value = 0;
  });
});

if (kneaderInput) {
  kneaderInput.addEventListener('input', function () {
    applyPowderMax();
    render();
  });
}
if (helmetInput) {
  helmetInput.addEventListener('input', function () {
    applyLvMax();
    render();
  });
}
// 粉を全ステータス一括で上限にする
if (powderMaxAllBtn) {
  powderMaxAllBtn.addEventListener('click', function () {
    var max = getPowderMax();
    STAT_KEYS.forEach(function (s) {
      var el = document.getElementById('powder-' + s);
      if (el) el.value = String(max);
    });
    render();
  });
}

// パンドラの所持状態が変わると上限も変わる
if (typeof OWPandora !== 'undefined' && typeof OWPandora.onChange === 'function') {
  OWPandora.onChange(function () {
    applyPowderMax();
    applyLvMax();
    applyKinokoMax();
    render();
  });
}
applyPowderMax();
applyLvMax();
applyKinokoMax();

lvInput.addEventListener('input', render);
sengiInput.addEventListener('input', render);
kinokoInput.addEventListener('input', render);

document.addEventListener('click', function (e) {
  if (!e.target.closest('#petMonsterSuggest') && !e.target.closest('#petMonsterSearch')) {
    closeSuggest();
  }
});

});
