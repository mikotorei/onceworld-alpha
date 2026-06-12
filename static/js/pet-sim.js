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
  input.max         = '1100';
  input.value       = '0';
  input.placeholder = '0〜1100';
  input.addEventListener('input', render);

  var btn = document.createElement('button');
  btn.type        = 'button';
  btn.className   = 'chip-btn powder-max-btn';
  btn.textContent = '100';
  btn.addEventListener('click', function () {
    input.value = 100;
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
function getLv() {
  var v = parseInt(lvInput.value, 10);
  if (isNaN(v) || v < 1) return 1;
  if (v > 1200)          return 1200;
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
  var v  = parseInt(el.value, 10);
  if (isNaN(v) || v < 0) return 0;
  if (v > 1100)          return 1100;
  return v;
}

function getKinoko() {
  var v = parseInt(kinokoInput.value, 10);
  if (isNaN(v) || v < 0) return 0;
  if (v > 1000)          return 1000;
  return v;
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

// モンスター検索
function showSuggest(query) {
  var q    = (query || '').trim().toLowerCase();
  var hits = q
    ? monsters.filter(function (m) {
        return m.title.toLowerCase().indexOf(q) !== -1 || m.id.indexOf(q) !== -1;
      })
    : monsters.slice();

  suggestBox.innerHTML = '';

  if (!hits.length) {
    var empty = document.createElement('button');
    empty.type      = 'button';
    empty.textContent = '見つかりません';
    empty.disabled  = true;
    suggestBox.appendChild(empty);
  } else {
    hits.forEach(function (m) {
      var btn = document.createElement('button');
      btn.type        = 'button';
      btn.textContent = '[' + m.id + '] ' + m.title + ' ' + m.element;
      btn.addEventListener('click', function () {
        selectMonster(m.id);
      });
      suggestBox.appendChild(btn);
    });
  }
  suggestBox.hidden = false;
}

function hideSuggest() {
  suggestBox.hidden = true;
}

function selectMonster(id) {
  selected = monsters.find(function (m) { return m.id === id; });
  if (!selected) return;
  searchInput.value = '[' + selected.id + '] ' + selected.title;
  hideSuggest();
  render();
}

searchInput.addEventListener('input', function () {
  showSuggest(searchInput.value);
});
searchInput.addEventListener('focus', function () {
  showSuggest(searchInput.value);
});

lvInput.addEventListener('input', render);
sengiInput.addEventListener('input', render);
kinokoInput.addEventListener('input', render);

document.addEventListener('click', function (e) {
  if (!e.target.closest('#petMonsterSuggest') && !e.target.closest('#petMonsterSearch')) {
    hideSuggest();
  }
});

});
