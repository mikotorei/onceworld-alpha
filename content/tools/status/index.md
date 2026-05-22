+++
title = "主人公ステータス・シミュレーター"
home = true
weight = 50
description = "主人公の装備・ペット・ステータスを確認できるシミュレーター"
+++

<div class="status-sim">

<h1>主人公ステータス・シミュレーター</h1>

<h2>主人公 振り分けポイント</h2>

<div class="row">
  <label class="pill">合計 <input id="basePointTotal" type="number" min="0" value="0"></label>
  <div id="basePointInfo" class="note"></div>
</div>

<div class="grid">
  <label class="pill">vit <input id="base_vit" type="number" min="0" value="0"></label>
  <label class="pill">spd <input id="base_spd" type="number" min="0" value="0"></label>
  <label class="pill">atk <input id="base_atk" type="number" min="0" value="0"></label>
  <label class="pill">int <input id="base_int" type="number" min="0" value="0"></label>
  <label class="pill">def <input id="base_def" type="number" min="0" value="0"></label>
  <label class="pill">mdef <input id="base_mdef" type="number" min="0" value="0"></label>
  <label class="pill">luk <input id="base_luk" type="number" min="0" value="0"></label>
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
  <div class="equip-grid">

  <div class="equip-row">
    <div class="slot">武器</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_weapon" type="text" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_weapon" class="equip-suggest" hidden></div>
        <select id="select_weapon" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_weapon" type="number" min="0" max="1100" value="0"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_weapon" type="number" min="0" max="100" value="0"></div>
    </div>
  </div>

  <div class="equip-row">
    <div class="slot">頭</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_head" type="text" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_head" class="equip-suggest" hidden></div>
        <select id="select_head" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_head" type="number" min="0" max="1100" value="0"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_head" type="number" min="0" max="100" value="0"></div>
    </div>
  </div>

  <div class="equip-row">
    <div class="slot">体</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_body" type="text" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_body" class="equip-suggest" hidden></div>
        <select id="select_body" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_body" type="number" min="0" max="1100" value="0"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_body" type="number" min="0" max="100" value="0"></div>
    </div>
  </div>

  <div class="equip-row">
    <div class="slot">手</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_hands" type="text" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_hands" class="equip-suggest" hidden></div>
        <select id="select_hands" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_hands" type="number" min="0" max="1100" value="0"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_hands" type="number" min="0" max="100" value="0"></div>
    </div>
  </div>

  <div class="equip-row">
    <div class="slot">脚</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_feet" type="text" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_feet" class="equip-suggest" hidden></div>
        <select id="select_feet" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_feet" type="number" min="0" max="1100" value="0"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_feet" type="number" min="0" max="100" value="0"></div>
    </div>
  </div>

  <div class="equip-row">
    <div class="slot">盾</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_shield" type="text" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_shield" class="equip-suggest" hidden></div>
        <select id="select_shield" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">+</span>
      <div class="lvbox"><input id="level_shield" type="number" min="0" max="1100" value="0"></div>
      <span class="lvtag">G</span>
      <div class="lvbox"><input id="glevel_shield" type="number" min="0" max="100" value="0"></div>
    </div>
  </div>

  <div class="equip-row accessory-row">
    <div class="slot">アクセ1</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_accessory1" type="text" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_accessory1" class="equip-suggest" hidden></div>
        <select id="select_accessory1" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">Lv</span>
      <div class="lvbox"><input id="level_accessory1" type="number" min="1" value="1"></div>
    </div>
    <div class="effectbox"><div class="acc-effect-preview" id="effect_accessory1">-</div></div>
  </div>

  <div class="equip-row accessory-row">
    <div class="slot">アクセ2</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_accessory2" type="text" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_accessory2" class="equip-suggest" hidden></div>
        <select id="select_accessory2" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">Lv</span>
      <div class="lvbox"><input id="level_accessory2" type="number" min="1" value="1"></div>
    </div>
    <div class="effectbox"><div class="acc-effect-preview" id="effect_accessory2">-</div></div>
  </div>

  <div class="equip-row accessory-row">
    <div class="slot">アクセ3</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_accessory3" type="text" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_accessory3" class="equip-suggest" hidden></div>
        <select id="select_accessory3" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">Lv</span>
      <div class="lvbox"><input id="level_accessory3" type="number" min="1" value="1"></div>
    </div>
    <div class="effectbox"><div class="acc-effect-preview" id="effect_accessory3">-</div></div>
  </div>

  <div class="equip-row accessory-row">
    <div class="slot">アクセ4</div>
    <div class="main">
      <div class="equip-search-wrap">
        <input id="equip_search_accessory4" type="text" placeholder="名前で検索して選択" autocomplete="off">
        <div id="equip_suggest_accessory4" class="equip-suggest" hidden></div>
        <select id="select_accessory4" hidden></select>
      </div>
    </div>
    <div class="lv-row">
      <span class="lvtag">Lv</span>
      <div class="lvbox"><input id="level_accessory4" type="number" min="1" value="1"></div>
    </div>
    <div class="effectbox"><div class="acc-effect-preview" id="effect_accessory4">-</div></div>
  </div>

  </div>
</details>

<details class="fold" id="foldPet" open>
  <summary>ペットスキル</summary>
  <div class="equip-grid">

  <div class="equip-row pet-row">
    <div class="slot">ペット1</div>
    <div class="main">
      <div class="pet-search-wrap">
        <input id="pet_search_pet1" type="text" placeholder="名前で検索して選択" autocomplete="off">
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
        <input id="pet_search_pet2" type="text" placeholder="名前で検索して選択" autocomplete="off">
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
        <input id="pet_search_pet3" type="text" placeholder="名前で検索して選択" autocomplete="off">
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

<link rel="stylesheet" href="{{ "css/status-sim.css" | relURL }}">

<script src="{{ "js/tools/status/status-sim.js" | relURL }}" defer></script>
