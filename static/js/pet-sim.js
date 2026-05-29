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
  var searchInput  = document.getElementById('searchInput');
  var dropdown     = document.getElementById('dropdown');
  var badge        = document.getElementById('selectedBadge');
  var badgeName    = document.getElementById('selectedName');
  var clearBtn     = document.getElementById('clearBtn');
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

  // --- 検索 ---
  function openDropdown(query) {
    var q    = (query || '').trim().toLowerCase();
    var hits = q
      ? monsters.filter(function (m) {
          return m.title.toLowerCase().indexOf(q) !== -1 || m.id.indexOf(q) !== -1;
        })
      : monsters.slice();

    if (!hits.length) {
      dropdown.innerHTML = '<div class="drop-item drop-empty">見つかりません</div>';
    } else {
      dropdown.innerHTML = hits.map(function (m) {
        return '<div class="drop-item" data-id="' + m.id + '">'
          + '[' + m.id + ']&nbsp;' + m.title
          + '&nbsp;<span class="drop-element">' + m.element + '</span>'
          + '</div>';
      }).join('');
    }
    dropdown.classList.add('open');
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
  }

  function selectMonster(id) {
    selected = monsters.find(function (m) { return m.id === id; });
    if (!selected) return;
    searchInput.value = '[' + selected.id + '] ' + selected.title;
    badge.style.display = 'none';
    closeDropdown();
    render();
  }

  searchInput.addEventListener('input',  function () {
    if (selected && searchInput.value !== '[' + selected.id + '] ' + selected.title) {
      selected = null;
      render();
    }
    openDropdown(searchInput.value);
  });
  searchInput.addEventListener('focus',  function () { openDropdown(searchInput.value); });
  searchInput.addEventListener('search', function () {
    if (searchInput.value.trim() === '') {
      selected = null;
      badge.style.display = 'none';
      closeDropdown();
    }
  });

  dropdown.addEventListener('click', function (e) {
    var item = e.target.closest('.drop-item[data-id]');
    if (item) selectMonster(item.dataset.id);
  });

  clearBtn.addEventListener('click', function () {
    selected = null;
    badge.style.display = 'none';
    render();
  });

  lvInput.addEventListener('input',    render);
  sengiInput.addEventListener('input', render);
  kinokoInput.addEventListener('input', render);

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#dropdown') && !e.target.closest('#searchInput')) {
      closeDropdown();
    }
  });

})();
