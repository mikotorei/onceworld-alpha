+++
title = "主人公ステータス・シミュレーター"
home = true
weight = 50
description = "主人公の装備・ペット・ステータスを確認できるシミュレーター"
+++

<div class="status-sim">

<h1>主人公ステータス・シミュレーター</h1>

<h2>主人公 振り分けポイント</h2>

<details class="fold">
<summary>振り分けポイント・上限の計算</summary>
<div class="bs-point-calc-wrap">

<div class="bs-point-sub-section">
<div class="bs-point-sub-title">振り分けポイントを計算する</div>
<div class="bs-point-limit-grid">
<div class="bs-point-limit-row">
<span class="bs-point-limit-label">キャラLv</span>
<input id="ss-chara-lv" type="number" min="1" max="200" value="200" class="lv-input">
<button type="button" class="chip-btn" onclick="document.getElementById('ss-chara-lv').value='200';document.getElementById('ss-chara-lv').dispatchEvent(new Event('input'))">MAX</button>
<span class="bs-label-text">（上限200）</span>
</div>
<div class="bs-point-limit-row">
<span class="bs-point-limit-label">天命輪廻</span>
<input id="ss-sp-tenme-count" type="number" min="0" max="30" value="0" class="lv-input">
<button type="button" class="chip-btn" onclick="document.getElementById('ss-sp-tenme-count').value='30';document.getElementById('ss-sp-tenme-count').dispatchEvent(new Event('input'))">MAX</button>
<span class="bs-label-text">回（上限30）</span>
</div>
<div class="bs-point-limit-row">
<span class="bs-point-limit-label">コスモキューブ</span>
<div class="chip-group">
<button class="chip-btn ss-cosmocube-btn" type="button" data-val="0" aria-pressed="true">未所持</button>
<button class="chip-btn ss-cosmocube-btn" type="button" data-val="1" aria-pressed="false">所持</button>
</div>
</div>
<div data-material-slot="status:stat-point"></div>
<div class="bs-point-limit-result">
<span class="bs-point-limit-label">獲得振り分けポイント</span>
<span id="bs-stat-point-display" class="bs-point-limit-total">4,980</span>
<span class="bs-label-text">pt</span>
</div>
<div class="bs-point-limit-row" style="margin-top:4px">
<button id="ss-apply-stat-point-btn" type="button" class="chip-btn">振り分け合計に反映</button>
</div>
</div>
</div>

<div class="bs-point-sub-section">
<div class="bs-point-sub-title">振り分け上限を計算する</div>
<div class="bs-point-limit-grid">
<div data-material-slot="status:point-limit"></div>
<div class="bs-point-limit-row">
<span class="bs-point-limit-label">超越の契約書</span>
<div class="chip-group">
<button class="chip-btn ss-contract-btn" type="button" data-val="0" aria-pressed="true">未所持</button>
<button class="chip-btn ss-contract-btn" type="button" data-val="1" aria-pressed="false">所持</button>
</div>
</div>
<div class="bs-point-limit-result">
<span class="bs-point-limit-label">計算された上限</span>
<span id="bs-point-limit-display" class="bs-point-limit-total">10,000</span>
<span class="bs-label-text">ポイント</span>
</div>
</div>
</div>

</div>
</details>

<div class="row">
  <label class="pill">合計 <input id="basePointTotal" type="number" min="0" value="0"></label>
  <div id="basePointInfo" class="note"></div>
</div>

<div class="grid">
  <label class="pill">vit <div class="pill-input-wrap"><input id="base_vit" type="number" min="0" value="0"><button type="button" class="base-max-btn" data-stat="vit">max</button></div></label>
  <label class="pill">spd <div class="pill-input-wrap"><input id="base_spd" type="number" min="0" value="0"><button type="button" class="base-max-btn" data-stat="spd">max</button></div></label>
  <label class="pill">atk <div class="pill-input-wrap"><input id="base_atk" type="number" min="0" value="0"><button type="button" class="base-max-btn" data-stat="atk">max</button></div></label>
  <label class="pill">int <div class="pill-input-wrap"><input id="base_int" type="number" min="0" value="0"><button type="button" class="base-max-btn" data-stat="int">max</button></div></label>
  <label class="pill">def <div class="pill-input-wrap"><input id="base_def" type="number" min="0" value="0"><button type="button" class="base-max-btn" data-stat="def">max</button></div></label>
  <label class="pill">mdef <div class="pill-input-wrap"><input id="base_mdef" type="number" min="0" value="0"><button type="button" class="base-max-btn" data-stat="mdef">max</button></div></label>
  <label class="pill">luk <div class="pill-input-wrap"><input id="base_luk" type="number" min="0" value="0"><button type="button" class="base-max-btn" data-stat="luk">max</button></div></label>
</div>

<hr>

<h2>結果</h2>

<table class="stats-table">
  <thead>
    <tr>
      <th>ステ</th>
      <th>基礎＋プロテイン</th>
      <th>装備</th>
      <th>合計</th>
    </tr>
  </thead>
  <tbody id="statsTbody"></tbody>
</table>

<div class="row buttons">
  <button id="recalcBtn" type="button">再計算</button>
  <button id="resetBtn" type="button">振り分けリセット</button>
  <button id="clearSaveBtn" type="button">自動保存クリア</button>
</div>

<div class="error" id="errBox"></div>

<hr>

<details class="fold" id="foldBuildSave" open>
  <summary>ビルド保存</summary>
  <div class="row">
    <label class="pill">保存済みビルド <select id="buildSlotSelect"></select></label>
    <button id="loadBuildBtn" type="button">読込</button>
    <button id="deleteBuildBtn" type="button">削除</button>
  </div>
  <div id="buildPreview" class="build-preview" hidden></div>
  <div class="row">
    <label class="pill">保存名 <input id="buildNameInput" type="text" value="" placeholder="例: 物理火力"></label>
    <button id="saveBuildBtn" type="button">保存</button>
  </div>
</details>

<hr>

<details class="fold" id="foldProtein">
  <summary>プロテイン</summary>
  <div class="row">
    <label class="pill">シェイカー <input id="shakerCount" type="number" min="0" value="0"></label>
    <button id="proteinAll1000Btn" type="button">プロテイン・シェイカーALL1000</button>
  </div>
  <div class="grid">
    <label class="pill">vit <input id="protein_vit" type="number" min="0" value="0"></label>
    <label class="pill">spd <input id="protein_spd" type="number" min="0" value="0"></label>
    <label class="pill">atk <input id="protein_atk" type="number" min="0" value="0"></label>
    <label class="pill">int <input id="protein_int" type="number" min="0" value="0"></label>
    <label class="pill">def <input id="protein_def" type="number" min="0" value="0"></label>
    <label class="pill">mdef <input id="protein_mdef" type="number" min="0" value="0"></label>
    <label class="pill">luk <input id="protein_luk" type="number" min="0" value="0"></label>
  </div>
</details>

<details class="fold" id="foldEquip" open>
  <summary>装備</summary>
  <div class="series-select-row">
  <span class="series-select-label">シリーズ一括</span>
  <div class="chip-group">
  <button class="chip-btn" type="button" data-series="demon">悪魔</button>
  <button class="chip-btn" type="button" data-series="dragon">ドラゴン</button>
  <button class="chip-btn" type="button" data-series="inferno">獄炎</button>
  <button class="chip-btn" type="button" data-series="leather">皮</button>
  <button class="chip-btn" type="button" data-series="mage">魔道士</button>
  <button class="chip-btn" type="button" data-series="metal">鉄</button>
  <button class="chip-btn" type="button" data-series="platinum">白金</button>
  <button class="chip-btn" type="button" data-series="tyrant">暴君</button>
  </div>
  </div>
  <div class="series-select-row">
  <button id="enhance1100AllBtn" type="button" class="chip-btn" data-equip-limit-label="all">武器・防具すべて+1100</button>
  </div>
  <div class="bs-point-limit-grid" data-material-slot="status:equip" data-pandora-toggle="off"></div>
  <div class="equip-grid">

  <div class="equip-row">
    <div class="slot">武器</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_weapon" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_weapon" class="equip-suggest" hidden></div>
        <select id="select_weapon" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_weapon" type="number" min="0" max="1100" value="0" data-equip-limit="enhance"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_weapon" type="number" min="0" max="300" value="0" data-equip-limit="glevel"></div>
    </div>
  </div>

  <div class="equip-row">
    <div class="slot">頭</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_head" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_head" class="equip-suggest" hidden></div>
        <select id="select_head" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_head" type="number" min="0" max="1100" value="0" data-equip-limit="enhance"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_head" type="number" min="0" max="300" value="0" data-equip-limit="glevel"></div>
    </div>
  </div>

  <div class="equip-row">
    <div class="slot">体</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_body" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_body" class="equip-suggest" hidden></div>
        <select id="select_body" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_body" type="number" min="0" max="1100" value="0" data-equip-limit="enhance"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_body" type="number" min="0" max="300" value="0" data-equip-limit="glevel"></div>
    </div>
  </div>

  <div class="equip-row">
    <div class="slot">手</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_hands" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_hands" class="equip-suggest" hidden></div>
        <select id="select_hands" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_hands" type="number" min="0" max="1100" value="0" data-equip-limit="enhance"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_hands" type="number" min="0" max="300" value="0" data-equip-limit="glevel"></div>
    </div>
  </div>

  <div class="equip-row">
    <div class="slot">脚</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_feet" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_feet" class="equip-suggest" hidden></div>
        <select id="select_feet" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_feet" type="number" min="0" max="1100" value="0" data-equip-limit="enhance"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_feet" type="number" min="0" max="300" value="0" data-equip-limit="glevel"></div>
    </div>
  </div>

  <div class="equip-row">
    <div class="slot">盾</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_shield" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_shield" class="equip-suggest" hidden></div>
        <select id="select_shield" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_shield" type="number" min="0" max="1100" value="0" data-equip-limit="enhance"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_shield" type="number" min="0" max="300" value="0" data-equip-limit="glevel"></div>
    </div>
  </div>

  <div class="stat-filter-row">
  <span class="stat-filter-label">ステ絞り込み</span>
  <div class="chip-group">
  <button type="button" class="chip-btn stat-filter-btn" data-stat="all" aria-pressed="true">クリア</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="vit" aria-pressed="false">VIT</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="spd" aria-pressed="false">SPD</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="atk" aria-pressed="false">ATK</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="int" aria-pressed="false">INT</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="def" aria-pressed="false">DEF</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="mdef" aria-pressed="false">MDEF</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="luk" aria-pressed="false">LUK</button>
  </div>
  </div>
  <div class="equip-row accessory-row">
    <div class="slot">アクセ1</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_accessory1" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_accessory1" class="equip-suggest" hidden></div>
        <select id="select_accessory1" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">Lv</span>
      <div class="lvbox"><input id="level_accessory1" type="number" min="1" value="1"></div>
      <button id="maxlv_btn_accessory1" type="button" class="chip-btn" style="font-size:12px;padding:4px 8px;" hidden></button>
    </div>
    <div class="effectbox"><div class="acc-effect-preview" id="effect_accessory1">-</div></div>
  </div>

  <div class="equip-row accessory-row">
    <div class="slot">アクセ2</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_accessory2" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_accessory2" class="equip-suggest" hidden></div>
        <select id="select_accessory2" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">Lv</span>
      <div class="lvbox"><input id="level_accessory2" type="number" min="1" value="1"></div>
      <button id="maxlv_btn_accessory2" type="button" class="chip-btn" style="font-size:12px;padding:4px 8px;" hidden></button>
    </div>
    <div class="effectbox"><div class="acc-effect-preview" id="effect_accessory2">-</div></div>
  </div>

  <div class="equip-row accessory-row">
    <div class="slot">アクセ3</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_accessory3" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_accessory3" class="equip-suggest" hidden></div>
        <select id="select_accessory3" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">Lv</span>
      <div class="lvbox"><input id="level_accessory3" type="number" min="1" value="1"></div>
      <button id="maxlv_btn_accessory3" type="button" class="chip-btn" style="font-size:12px;padding:4px 8px;" hidden></button>
    </div>
    <div class="effectbox"><div class="acc-effect-preview" id="effect_accessory3">-</div></div>
  </div>

  <div class="equip-row accessory-row">
    <div class="slot">アクセ4</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_accessory4" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_accessory4" class="equip-suggest" hidden></div>
        <select id="select_accessory4" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">Lv</span>
      <div class="lvbox"><input id="level_accessory4" type="number" min="1" value="1"></div>
      <button id="maxlv_btn_accessory4" type="button" class="chip-btn" style="font-size:12px;padding:4px 8px;" hidden></button>
    </div>
    <div class="effectbox"><div class="acc-effect-preview" id="effect_accessory4">-</div></div>
  </div>

  </div>
</details>

<details class="fold" id="foldPet" open>
  <summary>ペットスキル</summary>
  <div class="stat-filter-row">
  <span class="stat-filter-label">ステ絞り込み</span>
  <div class="chip-group">
  <button type="button" class="chip-btn stat-filter-btn" data-stat="all" aria-pressed="true">クリア</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="vit" aria-pressed="false">VIT</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="spd" aria-pressed="false">SPD</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="atk" aria-pressed="false">ATK</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="int" aria-pressed="false">INT</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="def" aria-pressed="false">DEF</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="mdef" aria-pressed="false">MDEF</button>
  <button type="button" class="chip-btn stat-filter-btn" data-stat="luk" aria-pressed="false">LUK</button>
  </div>
  </div>
  <div class="equip-grid">

  <div class="equip-row pet-row">
    <div class="slot">ペット1</div>
    <div class="main">
      <div class="pet-search-wrap">
        <input id="pet_search_pet1" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="pet_suggest_pet1" class="pet-suggest" hidden></div>
        <select id="select_pet1" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">段階</span>
      <div class="lvbox">
        <select id="stage_pet1">
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </div>
    </div>
  </div>

  <div class="equip-row pet-row">
    <div class="slot">ペット2</div>
    <div class="main">
      <div class="pet-search-wrap">
        <input id="pet_search_pet2" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="pet_suggest_pet2" class="pet-suggest" hidden></div>
        <select id="select_pet2" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">段階</span>
      <div class="lvbox">
        <select id="stage_pet2">
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </div>
    </div>
  </div>

  <div class="equip-row pet-row">
    <div class="slot">ペット3</div>
    <div class="main">
      <div class="pet-search-wrap">
        <input id="pet_search_pet3" type="search" placeholder="名前で検索して選択" autocomplete="off">
        <div id="pet_suggest_pet3" class="pet-suggest" hidden></div>
        <select id="select_pet3" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">段階</span>
      <div class="lvbox">
        <select id="stage_pet3">
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </div>
    </div>
  </div>

  </div>
</details>

</div>

<button id="bcOpenBtn" type="button" class="bc-open-btn">📷 画像を生成</button>

<div id="bcOverlay" class="bc-overlay" style="display:none"></div>

<div id="bcModal" class="bc-modal" style="display:none">
<div class="bc-modal-header">
<span>ビルドプレビュー</span>
<button id="bcCloseBtn" type="button" class="bc-modal-close">✕</button>
</div>
<div class="bc-modal-body">
<div id="bcPreview"></div>
</div>
<div class="bc-modal-footer">
<button id="bcSaveBtn" type="button" class="chip-btn">保存</button>
</div>
</div>

<button class="ow-help-btn" id="owHelpBtn" aria-label="使い方を見る">❓</button>

<div class="ow-help-overlay" id="owHelpOverlay" hidden></div>

<div class="ow-help-drawer" id="owHelpDrawer" aria-hidden="true">
<div class="ow-help-drawer-header">
<span class="ow-help-drawer-title">ステータスシミュレーター 使い方</span>
<button class="ow-help-drawer-close" id="owHelpClose">✕</button>
</div>
<div class="ow-help-drawer-body">
<h3>基本操作</h3>
<p>装備・アクセサリー・ペットを選択してステータスを確認できます。</p>
<p>振り分けポイントを入力して最終ステータスを計算できます。</p>
<h3>装備選択</h3>
<p>検索欄をタップすると装備一覧が表示されます。素材強化（+強化値）とG強化値を入力できます。素材強化不可の装備は入力が自動でグレーアウトされます。</p>
<h3>振り分けポイント</h3>
<p>キャラLvや天命などから振り分けポイント・上限を自動計算できます。各ステータスの max ボタンで上限まで一括入力できます。</p>
<h3>ビルド保存</h3>
<p>名前を付けてビルドを保存・呼び出しできます。</p>
<h3>ビルドシミュ</h3>
<p>設定した内容がビルドシミュの逆算・探索に自動反映されます。</p>
</div>
</div>

<link rel="stylesheet" href="../../css/status-sim.css">

<script src="../../js/common/storage-manager.js" defer></script>
<script src="../../js/common/game-data.js" defer></script>
<script src="../../js/common/pandora.js" defer></script>
<script src="../../js/common/material-ui.js" defer></script>
<script src="../../js/common/calc-logic.js" defer></script>
<script src="../../js/tools/status/status-sim.js" defer></script>
<script src="../../js/common/help-drawer.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" defer></script>
<script src="../../js/common/build-card.js" defer></script>
