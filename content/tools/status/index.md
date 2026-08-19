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
<span id="ss-stat-point-display" class="bs-point-limit-total">4,980</span>
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
<span id="ss-point-limit-display" class="bs-point-limit-total">10,000</span>
<span class="bs-label-text">ポイント</span>
</div>
</div>
</div>

</div>
</details>

{{< point-total-row >}}

{{< base-stat-grid >}}

<hr>

<h2>結果</h2>

{{< stats-table >}}

{{< result-buttons clearSave="true" >}}

<hr>

{{< build-save-section >}}
<hr>

{{< protein-section >}}

{{< equip-section tool="status" >}}

{{< pet-section >}}

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
<script src="../../slots-data.js" defer></script>
<script src="../../js/common/pandora.js" defer></script>
<script src="../../js/common/material-ui.js" defer></script>
<script src="../../js/common/calc-logic.js" defer></script>
<script src="../../js/tools/status/status-sim.js" defer></script>
<script src="../../js/common/help-drawer.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" defer></script>
<script src="../../js/common/build-card.js" defer></script>
