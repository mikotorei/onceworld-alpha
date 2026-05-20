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
  <label>G強化値：+<input id="gLevelInput" type="number" min="0" max="100" value="0"><span id="gLevelDisplay">0</span></label>
  <input id="gLevelSlider" type="range" min="0" max="100" value="0">
</div>
<div id="equipTables">
  <div class="equip-table active" id="tab-weapon">
    <table>
      <thead id="weaponThead">
        <tr>
          <th data-sort="name">名前</th>
          <th data-sort="vit">VIT</th>
          <th data-sort="spd">SPD</th>
          <th data-sort="atk">ATK</th>
          <th data-sort="int">INT</th>
          <th data-sort="def">DEF</th>
          <th data-sort="mdef">MDEF</th>
          <th data-sort="luk">LUK</th>
          <th data-sort="mov">MOV</th>
          <th data-sort="power">種族値</th>
          <th data-sort="gcost" class="g-cost-col" style="display:none;">必要G</th>
        </tr>
      </thead>
      <tbody id="weaponBody"></tbody>
      <tfoot id="weaponTfoot"></tfoot>
    </table>
  </div>
  <div class="equip-table" id="tab-armor">
    <table>
      <thead id="armorThead">
        <tr>
          <th data-sort="name">名前</th>
          <th data-sort="slot">部位</th>
          <th data-sort="series">シリーズ</th>
          <th data-sort="vit">VIT</th>
          <th data-sort="spd">SPD</th>
          <th data-sort="atk">ATK</th>
          <th data-sort="int">INT</th>
          <th data-sort="def">DEF</th>
          <th data-sort="mdef">MDEF</th>
          <th data-sort="luk">LUK</th>
          <th data-sort="mov">MOV</th>
          <th data-sort="power">種族値</th>
          <th data-sort="gcost" class="g-cost-col" style="display:none;">必要G</th>
        </tr>
      </thead>
      <tbody id="armorBody"></tbody>
      <tfoot id="armorTfoot"></tfoot>
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
