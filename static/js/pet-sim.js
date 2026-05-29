(function () {

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

  // --- DOM refs ---
  var searchInput  = document.getElementById('petMonsterSearch');
  var suggestEl    = document.getElementById('petMonsterSuggest');
  var lvInput      = document.getElementById('lvInput');
  var sengiInput   = document.getElementById('sengiInput');
  var powderGrid   = document.getElementById('powderGrid');
  var kinokoInput  = document.getElementById('kinokoInput');
  var houseBtn     = document.getElementById('houseBtn');
  var result       = document.getElementById('result');

  // --- 粉入力欄を生成 ---
  STAT_KEYS.forEach(function (s) {
    var wrap = document.createElement('div');
    wrap.className = 'powder-item';

    var label = document.createElement('span');
    label.className = 'powder-label';
    label.textContent = STAT_LABELS[s];

    var input = document.createElement('input');
    input.type = 'number';
    input.id   = 'powder-' + s;
    input.min  = '0';
    input.max  = '100';
    input.value = '0';
    input.placeholder = '0〜100';
    input.addEventListener('input', render);
    input.addEventListener('change', function() { clampInput(input, 0, 100); render(); });

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn powder-max-btn';
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

  // --- キノコハウス ON/OFF ---
  houseBtn.addEventListener('click', function () {
    var on = houseBtn.getAttribute('aria-pressed') === 'true';
    houseBtn.setAttribute('aria-pressed', on ? 'false' : 'true');
    houseBtn.textContent = on ? 'キノコハウス OFF' : 'キノコハウス ON';
    render();
  });

  // --- 計算関数 ---
  function getLv() {
    var v = parseInt(lvInput.value, 10);
    if (isNaN(v) || v < 1)  return 1;
    if (v > 1200)            return 1200;
    return v;
  }

  function getSengi() {
    var v = parseInt(sengiInput.value, 10);
    if (isNaN(v) || v < 0)  return 0;
    if (v > 30)              return 30;
    return v;
  }

  function getPowder(s) {
    var el = document.getElementById('powder-' + s);
    var v  = parseInt(el.value, 10);
    if (isNaN(v) || v < 0)  return 0;
    if (v > 100)             return 100;
    return v;
  }

  function getKinoko() {
    var v = parseInt(kinokoInput.value, 10);
    if (isNaN(v) || v < 0)  return 0;
    if (v > 1000)            return 1000;
    return v;
  }

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

  // --- 最高ステータスのインデックスを返す（vit優先順） ---
  function topStatKey(values) {
    var best = STAT_KEYS[0];
    STAT_KEYS.forEach(function (s) {
      if (values[s] > values[best]) best = s;
    });
    return best;
  }

  // --- 描画 ---
  function render() {
    if (!selected) {
      result.innerHTML = '<p class="empty-msg">モンスターを選択してください</p>';
      return;
    }

    var lv      = getLv();
    var sengi   = getSengi();
    var kinoko  = getKinoko();
    var houseOn = houseBtn.getAttribute('aria-pressed') === 'true';
    var kinokoMult = houseOn ? 100 : 1;

    // 各ステータスを計算（キノコ前）
    var values = {};
    STAT_KEYS.forEach(function (s) {
      values[s] = calcStat(selected[s], getPowder(s), sengi, lv);
    });

    // キノコ補正：同属性のみ、最高ステータス1つに加算
    var topKey     = topStatKey(values);
    var kinokoVal  = kinoko * kinokoMult;

    var cards = STAT_KEYS.map(function (s) {
      var val     = values[s];
      var isTop   = (s === topKey);
      var display = isTop ? val + kinokoVal : val;
      var kinokoTag = (isTop && kinokoVal > 0)
        ? '<div class="stat-kinoko">+' + kinokoVal.toLocaleString() + ' (キノコ)</div>'
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

   // --- 検索（ビルドシミュと同じ方式）---
   function normalizeJP(s) {
     return (s || '').replace(/[\u30A1-\u30F6]/g, function(c) {
       return String.fromCharCode(c.charCodeAt(0) - 0x60);
     }).toLowerCase();
   }

   function closeSuggest() {
     if (suggestEl) { suggestEl.hidden = true; suggestEl.innerHTML = ''; }
   }

   function openSuggest(items) {
     if (!suggestEl) return;
     suggestEl.hidden = false;
     suggestEl.innerHTML = '';
     items.forEach(function(m) {
       var btn = document.createElement('button');
       btn.type = 'button';
       btn.textContent = m.title;
       btn.addEventListener('click', function() {
         selected = m;
         searchInput.value = m.title;
         closeSuggest();
         render();
       });
       suggestEl.appendChild(btn);
     });
   }

   searchInput.addEventListener('input', function() {
     var q = searchInput.value;
     if (q.trim() === '') { selected = null; closeSuggest(); render(); return; }
     if (selected && q !== selected.title) { selected = null; render(); }
     var items = monsters.filter(function(m) {
       return normalizeJP(m.title).indexOf(normalizeJP(q)) !== -1;
     }).slice(0, 50);
     if (items.length === 0) closeSuggest();
     else openSuggest(items);
   });

   searchInput.addEventListener('focus', function() {
     var q = searchInput.value || '';
     var items = q.trim() === ''
       ? monsters.slice(0, 200)
       : monsters.filter(function(m) {
           return normalizeJP(m.title).indexOf(normalizeJP(q)) !== -1;
         }).slice(0, 200);
     if (items.length > 0) openSuggest(items);
   });

   searchInput.addEventListener('search', function() {
     if (searchInput.value.trim() === '') {
       selected = null;
       closeSuggest();
       render();
     }
   });

   document.addEventListener('click', function(e) {
     if (e.target === searchInput || (suggestEl && suggestEl.contains(e.target))) return;
     closeSuggest();
   });

  // 入力上限clamp
  function clampInput(el, min, max) {
    var v = parseInt(el.value, 10);
    if (isNaN(v)) return;
    if (v < min) el.value = min;
    if (v > max) el.value = max;
  }

  lvInput.addEventListener('change',    function() { clampInput(lvInput, 1, 1200); render(); });
  lvInput.addEventListener('input',     render);
  sengiInput.addEventListener('change', function() { clampInput(sengiInput, 0, 30); render(); });
  sengiInput.addEventListener('input',  render);
  kinokoInput.addEventListener('change', function() { clampInput(kinokoInput, 0, 1000); render(); });
  kinokoInput.addEventListener('input',  render);

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#dropdown') && !e.target.closest('#searchInput')) {
      closeDropdown();
    }
  });

})();
