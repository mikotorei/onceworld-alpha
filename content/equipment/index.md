+++
title = "装備データベース"
home = true
weight = 20
description = "武器・防具・アクセサリーの装備データ一覧"
+++

<div class="equip-db">

<h1>装備データベース</h1>

<div class="equip-tabs">
  <button class="equip-tab active" data-tab="weapon">武器</button>
  <button class="equip-tab" data-tab="armor">防具</button>
  <button class="equip-tab" data-tab="accessory">アクセ</button>
</div>

<div class="enhance-tabs" id="enhanceTabs">
  <button class="enhance-tab active" data-enhance="base">基礎値</button>
  <button class="enhance-tab" data-enhance="plus1100">+1100</button>
  <button class="enhance-tab" data-enhance="genhance">G強化</button>
</div>

<div id="gEnhanceControl" style="display:none;">
  <label>G強化値：+<input id="gLevelInput" type="number" min="1" max="100" value="100"><span id="gLevelDisplay">100</span></label>
  <input id="gLevelSlider" type="range" min="1" max="100" value="100">
</div>

<div id="equipTables">

  <div class="equip-table active" id="tab-weapon">
    <table>
      <thead>
        <tr>
          <th>名前</th>
          <th>VIT</th>
          <th>SPD</th>
          <th>ATK</th>
          <th>INT</th>
          <th>DEF</th>
          <th>MDEF</th>
          <th>LUK</th>
          <th>MOV</th>
        </tr>
      </thead>
      <tbody id="weaponBody"></tbody>
    </table>
  </div>

  <div class="equip-table" id="tab-armor">
    <table>
      <thead>
        <tr>
          <th>名前</th>
          <th>部位</th>
          <th>シリーズ</th>
          <th>VIT</th>
          <th>SPD</th>
          <th>ATK</th>
          <th>INT</th>
          <th>DEF</th>
          <th>MDEF</th>
          <th>LUK</th>
          <th>MOV</th>
        </tr>
      </thead>
      <tbody id="armorBody"></tbody>
    </table>
  </div>

  <div class="equip-table" id="tab-accessory">
    <table class="accessory-list-table">
      <thead>
        <tr>
          <th>名前</th>
          <th>効果</th>
          <th>効果量</th>
          <th>最大Lv</th>
        </tr>
      </thead>
      <tbody id="accessoryBody"></tbody>
    </table>
  </div>

</div>

</div>

<link rel="stylesheet" href="../css/equipment.css">
<script src="../js/equipment-db.js"></script>
