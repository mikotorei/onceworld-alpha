# C-1 調査: build-sim.html と status/index.md の二重管理

調査日: 2026-08-19 / 対象コミット: `af085de`

対象ファイル:

- `layouts/tools/build-sim.html`（Hugoレイアウト。`content/tools/build-sim/index.md` が `layout = "build-sim"` で指定）
- `content/tools/status/index.md`（Markdown内に生HTMLを直書き。Goldmarkの `unsafe = true` で通している）

---

## 0. 要約

| 項目 | 結果 |
|---|---|
| 二重管理されているID | **105件**（当初の見積り57件より多い） |
| 空白正規化後に構造が一致するか | **入力欄13スロット・39要素すべて一致**（差異ゼロ） |
| 構造が異なる箇所 | 3件（`equip-grid` の開始位置2件、振り分け計算セクションの見出しマークアップ1件） |
| 生成関数化できる割合 | 105件中 **80件（76%）** が単純な繰り返しパターン |
| 副産物として見つかった不具合 | 3件（後述） |

「57個」という当初の数は、装備30 + ペット12 + 基礎ステ7 + プロテイン7 + シェイカー1 = 57 に相当する。
実際にはこれにアクセサリ24件とビルド保存・折りたたみ・ヘルプなど24件が加わり、
**共通IDは105件**である。

---

## 1. 二重管理されている105IDの内訳

### 1-1. 分類

| 分類 | 件数 | 1スロットあたりのID | 生成 |
|---|---:|---|---|
| 装備スロット（武器・頭・体・手・脚・盾） | 30 | `equip_search_` / `equip_suggest_` / `select_` / `level_` / `glevel_` × 6 | ◎ |
| アクセサリスロット（アクセ1〜4） | 24 | `equip_search_` / `equip_suggest_` / `select_` / `level_` / `maxlv_btn_` / `effect_` × 4 | ◎ |
| ペットスロット（ペット1〜3） | 12 | `pet_search_` / `pet_suggest_` / `select_` / `stage_` × 3 | ◎ |
| 基礎ステ入力 | 7 | `base_vit` … `base_luk` | ◎ |
| プロテイン入力 | 7 | `protein_vit` … `protein_luk` | ◎ |
| 振り分け・プロテイン操作 | 4 | `basePointTotal` `basePointInfo` `shakerCount` `proteinAll1000Btn` | ○ |
| ビルド保存 | 6 | `buildSlotSelect` `loadBuildBtn` `deleteBuildBtn` `buildPreview` `buildNameInput` `saveBuildBtn` | ○ |
| 結果・操作 | 4 | `statsTbody` `recalcBtn` `resetBtn` `errBox` | ○ |
| 折りたたみ | 4 | `foldEquip` `foldPet` `foldProtein` `foldBuildSave` | △ |
| ヘルプドロワー | 4 | `owHelpBtn` `owHelpOverlay` `owHelpDrawer` `owHelpClose` | △ |
| 強化一括・計算結果表示 | 3 | `enhance1100AllBtn` `bs-stat-point-display` `bs-point-limit-display` | ○ |
| **合計** | **105** | | |

◎ = キー配列を回すだけ / ○ = 1回きりのブロック / △ = 中身がツール別

### 1-2. HTML構造パターン

**装備スロット**（6件とも同一。`{key}` = weapon / head / body / hands / feet / shield、`{label}` = 武器 / 頭 / 体 / 手 / 脚 / 盾）

```html
<div class="equip-row">
  <div class="slot">{label}</div>
  <div class="main">
    <div class="equip-search-wrap">
      <input id="equip_search_{key}" type="search" placeholder="名前で検索して選択" autocomplete="off">
      <div id="equip_suggest_{key}" class="equip-suggest" hidden></div>
      <select id="select_{key}" hidden></select>
    </div>
  </div>
  <div class="lv-row">
    <span class="lvtag">+</span>
    <div class="lvbox"><input id="level_{key}" type="number" min="0" max="1100" value="0" data-equip-limit="enhance"></div>
    <span class="lvtag">G</span>
    <div class="lvbox"><input id="glevel_{key}" type="number" min="0" max="300" value="0" data-equip-limit="glevel"></div>
  </div>
</div>
```

**アクセサリスロット**（4件とも同一。`lv-row` の中身と `effectbox` が装備と異なる）

```html
<div class="equip-row accessory-row">
  <div class="slot">アクセ{n}</div>
  <div class="main">…装備と同じ equip-search-wrap…</div>
  <div class="lv-row">
    <span class="lvtag">Lv</span>
    <div class="lvbox"><input id="level_accessory{n}" type="number" min="1" value="1"></div>
    <button id="maxlv_btn_accessory{n}" type="button" class="chip-btn" style="font-size:12px;padding:4px 8px;" hidden></button>
  </div>
  <div class="effectbox"><div class="acc-effect-preview" id="effect_accessory{n}">-</div></div>
</div>
```

**ペットスロット**（3件とも同一。`stage_pet{n}` の `<option>` は 0〜4 の固定5件）

```html
<div class="equip-row pet-row">
  <div class="slot">ペット{n}</div>
  <div class="main">
    <div class="pet-search-wrap">
      <input id="pet_search_pet{n}" type="search" …>
      <div id="pet_suggest_pet{n}" class="pet-suggest" hidden></div>
      <select id="select_pet{n}" hidden></select>
    </div>
  </div>
  <div class="lv-row">
    <span class="lvtag">段階</span>
    <div class="lvbox"><select id="stage_pet{n}"><option value="0">0</option>…<option value="4">4</option></select></div>
  </div>
</div>
```

**基礎ステ入力**（`{k}` = vit / spd / atk / int / def / mdef / luk）

```html
<label class="pill">{k} <div class="pill-input-wrap">
  <input id="base_{k}" type="number" min="0" value="0">
  <button type="button" class="base-max-btn" data-stat="{k}">max</button>
</div></label>
```

**プロテイン入力**

```html
<label class="pill">{k} <input id="protein_{k}" type="number" min="0" value="0"></label>
```

---

## 2. 両ファイルで構造が異なる箇所

### 2-1. 一致していた部分

空白・インデントを正規化した上で比較した結果、**入力欄そのものは完全に一致**していた。

| 比較対象 | 件数 | 不一致 |
|---|---:|---:|
| `equip-row`（装備） | 6 | 0 |
| `equip-row accessory-row` | 4 | 0 |
| `equip-row pet-row` | 3 | 0 |
| `stat-filter-row` | 2 | 0 |
| 単独ID要素（`base_*` `protein_*` ビルド保存 折りたたみ ヘルプ ほか） | 39 | 0 |
| プロテインセクション全体 | 1 | 0 |
| ビルド保存セクション全体 | 1 | 0 |

Hugoビルド後の出力同士でも同様に不一致0。
`hidden` 属性はGoldmarkを通しても保持されており（`equip_suggest_*` / `select_*` /
`maxlv_btn_*` / `buildPreview` で確認）、両ページで同じ状態になっている。

### 2-2. 差異1: `equip-grid` の開始位置（装備セクション）

| | build-sim.html | status/index.md |
|---|---|---|
| シリーズ一括ボタン | `equip-grid` の**外** | `equip-grid` の**中** |
| 「武器・防具すべて+1100」 | 外 | 中 |
| 素材スロット（禁域のロック） | 外 | 中 |

`.equip-grid` は `display:grid; grid-template-columns:1fr; gap:10px`（`status-sim.css:124`）。
グリッドの子になると `gap:10px` が効き、`.series-select-row` 自身の
`margin:8px 0 12px` とマージン相殺しなくなるため、**status側のほうが行間がわずかに広い**。
機能差はなく見た目の余白だけの違い。

### 2-3. 差異2: `equip-grid` の開始位置（ペットセクション）

装備とは**逆向き**の差異になっている。

| | build-sim.html | status/index.md |
|---|---|---|
| ステ絞り込み（`stat-filter-row`） | `equip-grid` の**中** | `equip-grid` の**外** |

### 2-4. 差異3: 振り分けポイント計算セクションの見出し

```html
<!-- build-sim.html: details の外に summary がある（不正なHTML） -->
<div class="bs-point-sub-section">
        <summary>振り分けポイントを計算する</summary>

<!-- status/index.md: div を使っている（正しい） -->
<div class="bs-point-sub-section">
<div class="bs-point-sub-title">振り分けポイントを計算する</div>
```

`build-sim.html` の167行目付近と、もう1箇所（「振り分け上限を計算する」）で
`<summary>` が `<details>` の外に置かれている。HTMLとしては不正で、
ブラウザは `display:block` の無名要素として描画するため実害は出ていないが、
**status側の `<div class="bs-point-sub-title">` が正しい**。

### 2-5. どちらが正しいか

| 差異 | 判断 | 根拠 |
|---|---|---|
| 2-2 `equip-grid`（装備） | **build-sim側**に寄せる | 操作系（シリーズ一括・素材欄）は装備行のグリッドとは別物。グリッドの外が自然 |
| 2-3 `equip-grid`（ペット） | **status側**に寄せる | 同上。`stat-filter-row` は絞り込み操作でグリッドの一部ではない |
| 2-4 見出しマークアップ | **status側**に寄せる | `<summary>` を `<details>` の外に置くのは不正なHTML |

いずれも見た目の差は数pxの余白のみで、統一による回帰リスクは低い。

---

## 3. 生成関数化の難易度

### 3-1. 前提: 2つのファイルは種類が違う

- `build-sim.html` は**Hugoレイアウト** → `{{ partial }}` が使える
- `status/index.md` は**Markdown** → `{{ partial }}` は使えない。ショートコードが必要

そのため「共通化」には2つの経路がある。

### 3-2. 経路A: Hugoパーシャル + ショートコード（推奨）

```
layouts/partials/slots/equip-rows.html   ← 実体（1本）
layouts/shortcodes/equip-rows.html       ← {{ partial "slots/equip-rows.html" . }} を呼ぶだけ
```

- `build-sim.html` からは `{{ partial "slots/equip-rows.html" . }}`
- `status/index.md` からは `{{< equip-rows >}}`

**実証済み**: スクラッチのHugoサイトで、Markdown内の生HTMLブロック
（`<div class="status-sim">` … `<details>` の中）に置いたショートコードが
正しく展開され、`hidden` 属性も保持されることを確認した。

| 利点 | 内容 |
|---|---|
| 出力が現状と同一にできる | ビルド後のHTMLをバイト単位で比較して検証できる |
| 実行時の挙動が一切変わらない | JSの読み込み順・DOMContentLoadedのタイミングに影響しない |
| Goldmarkの制約を回避できる | ショートコードの出力はMarkdown処理を通らないため、インデント0の制約から解放される |
| no-JSでも表示される | 静的サイトとして自然 |

| 欠点 | 内容 |
|---|---|
| `layouts/shortcodes/` の新設が必要 | 現状このディレクトリは存在しない |
| パーシャルとショートコードの2ファイル必要 | ショートコード側は1行の委譲だけ |

### 3-3. 経路B: JSでの生成（material-ui.js と同じパターン）

```html
<div data-equip-slots="armor"></div>
<div data-equip-slots="accessory"></div>
<div data-pet-slots></div>
```

| 利点 | 内容 |
|---|---|
| 既存パターンの延長 | `material-ui.js` の `renderMaterialSlots` と同型 |
| 定義がJSに一本化される | `SLOT_LABEL` などJS側の定数と共有できる |

| 欠点 | 内容 |
|---|---|
| 読み込み順の制約が増える | 生成スクリプトを `status-sim.js` より前に読む必要がある（`material-ui.js` と同じ制約） |
| no-JSで何も出ない | 素材欄と違い、装備欄はページの主要コンテンツ |
| 検証が実行時にしかできない | ビルド出力の比較では確認できず、DOMシミュレーションが必要 |
| `hidden` 属性の再現が要注意 | `createElement` 経由で `hidden` を明示的に付ける必要がある |

### 3-4. 難易度の内訳

| 対象 | 難易度 | 備考 |
|---|---|---|
| 装備スロット6 | **易** | `{key, label}` の配列を回すだけ |
| アクセサリスロット4 | **易** | 同上。`lv-row` の中身が違うだけで別テンプレートにすればよい |
| ペットスロット3 | **易** | `<option>` 0〜4 も固定 |
| 基礎ステ入力7 / プロテイン入力7 | **易** | `BASE_STATS` を回すだけ |
| ビルド保存 / 結果テーブル / プロテイン操作 | **中** | 繰り返しではないが両ファイルで完全一致。ブロックごと1本にまとめられる |
| ヘルプドロワー | **中** | 外枠（`owHelp*` の4ID）は共通、**中身の文章はツール別**。外枠だけパーシャル化し、本文はパラメータで渡す |
| 振り分けポイント計算セクション | **難** | IDが `bs-` / `ss-` で分かれている（3組）。プレフィックスを引数にすれば共通化できるが、**status側は素材欄が直書き、build-sim側は `data-material-slot` 生成**という非対称も同時に解消する必要がある |
| 折りたたみ `<details id="fold*">` | **中** | `open` の有無がセクションで違う。パーシャルの引数にする |

### 3-5. 特殊な処理が必要なもの

1. **振り分けポイント計算セクション**
   同じUIだが `bs-chara-lv` / `ss-chara-lv` のようにIDが分かれている。
   共通化するにはプレフィックスを引数化する必要がある。
   さらに `MAX` ボタンがインライン `onclick` でIDを文字列で埋め込んでいるため、
   プレフィックス化と同時にインラインハンドラの排除が要る。

2. **ヘルプドロワー**
   `owHelpBtn` / `owHelpOverlay` / `owHelpDrawer` / `owHelpClose` の外枠は
   全ツール共通だが、`ow-help-drawer-title` と `ow-help-drawer-body` はツール別。
   なお同じ外枠は `tenku/single.html` `guide/single.html` など**他の6ページにも存在する**ため、
   共通化するならC-1の範囲を超えてサイト全体に効く。

3. **`stat-filter-row`**
   装備セクションとペットセクションで同じマークアップが計2回ずつ（両ファイルで計4回）出現する。
   ボタンの `data-stat` は `all` + `BASE_STATS` の8個で固定。

---

## 4. 副産物として見つかった問題

### 4-1. status ページの素材MAXボタンがパンドラに追随しない（実害あり）

`content/tools/status/index.md` の素材欄は直書きで、MAXボタンが
インライン `onclick` で `1000` を直接埋め込んでいる。

```html
<input id="ss-pen-count" type="number" min="0" max="1000" value="0" class="lv-input">
<button type="button" class="chip-btn"
  onclick="document.getElementById('ss-pen-count').value='1000'; …">MAX</button>
```

`material-ui.js` の `applyMaterialCaps()` は `max` 属性を2000に直すが、
インライン `onclick` の `'1000'` は書き換えられない。
そのため**パンドラの箱を所持していてもMAXボタンは1000までしか入らない**。
対象は `ss-pen-count` / `ss-altar-count` / `ss-tensho-count` / `ss-scroll-count` /
`ss-sage-drop` / `ss-forbidden-book` の6件。

ビルドシミュ側は `data-material-slot` による生成なのでこの問題はない。
**status側も `data-material-slot="status:stat-point"` / `"status:point-limit"` に
移行すれば同時に解消する**（段階1の対象にすべき）。

### 4-2. status ページに `bs-` プレフィックスのIDが混在

```
content/tools/status/index.md:66  id="bs-stat-point-display"
content/tools/status/index.md:99  id="bs-point-limit-display"
```

他は `ss-` で統一されているのにこの2件だけ `bs-`。
`status-sim.js` 側もこのIDで参照しているため動作はしているが、命名規則が破綻している。

### 4-3. `<summary>` が `<details>` の外にある（build-sim.html）

2-4 のとおり。不正なHTMLだが実害は出ていない。

### 4-4. JS側にも `SLOT_LABEL` の二重定義がある

```
static/js/tools/status/status-sim.js:9        const SLOT_LABEL = { weapon:"武器", … }
static/js/tools/build-sim/build-sim-logic.js:351  const SLOT_LABEL = { weapon:"武器", … }
```

内容は同一。HTML側を生成関数化するなら、スロット定義（キー・ラベル）は
1箇所に置いて両方から参照する形にしたい。

---

## 5. 段階分けの提案

前提として**経路A（Hugoパーシャル + ショートコード）を推奨**する。
出力HTMLを現状と同一にできるため、各段階で
「ビルド結果を正規化して比較 → 不一致0」という機械的な検証が使える。

### 段階1: スロット定義の一本化（JS側の下準備）

- `game-data.js` に `EQUIP_SLOTS` / `ACCESSORY_SLOTS` / `PET_SLOTS` を新設
  （`{ key, label }` の配列。`SLOT_LABEL` の実体をここに移す）
- `status-sim.js` / `build-sim-logic.js` の `SLOT_LABEL` 重複を解消
- HTMLは触らない
- 検証: 計算結果が変わらないこと

### 段階2: 構造差異3件の統一

- 装備セクションの `equip-grid` を build-sim 側に寄せる
- ペットセクションの `equip-grid` を status 側に寄せる
- build-sim の `<summary>` を `<div class="bs-point-sub-title">` に直す
- 検証: 両ページのビルド出力を正規化して比較し、当該箇所以外に差分が出ないこと

**この段階を先にやらないと、段階3以降で「どちらの構造を採用するか」が決まらない。**

### 段階3: status ページの素材欄をスロット生成に移行（4-1のバグ修正を兼ねる）

- `content/tools/status/index.md` の直書き6素材を
  `data-material-slot="status:stat-point"` / `"status:point-limit"` に置換
- `game-data.js` の該当素材の `slots` に `tool:"status"` の項目を追加（既に存在するものは確認のみ）
- 4-2 の `bs-stat-point-display` → `ss-stat-point-display` 改名も同時に
- 検証: パンドラ所持時にMAXボタンが2000を入れること／保存データが壊れないこと

### 段階4: 装備・アクセサリ・ペットのスロット生成（66件）

- `layouts/partials/slots/equip-rows.html`（装備6・アクセ4）
- `layouts/partials/slots/pet-rows.html`（ペット3）
- `layouts/shortcodes/` に委譲用ショートコードを追加
- 両ファイルから呼ぶ形に置換
- 検証: ビルド出力の正規化比較で**両ページとも変更前と完全一致**

### 段階5: ステータス入力・プロテイン・ビルド保存・結果テーブル（21件）

- `base_*` / `protein_*` のグリッド、ビルド保存ブロック、結果テーブル、
  プロテイン操作行をパーシャル化
- 検証: 同上

### 段階6: 振り分けポイント計算セクション（プレフィックス引数化）

- パーシャルに `prefix`（`bs-` / `ss-`）を渡す形にする
- インライン `onclick` を `data-max-target` + 共通リスナーに置き換える
- 検証: 両ツールの振り分けポイント計算結果が変わらないこと

### 段階7（任意・C-1の範囲外）: ヘルプドロワーの共通化

- 外枠を `layouts/partials/help-drawer.html` にまとめ、本文をブロックで渡す
- 対象は build-sim / status に加え tenku / guide / pet-sim / exp-calc など計8ページ
- C-1とは独立して実施できる

### 段階の依存関係

```
段階1（JS定義）─┐
段階2（構造統一）─┼→ 段階4 → 段階5 → 段階6
段階3（素材欄）──┘
段階7 は独立
```

段階1〜3は互いに独立で順不同。段階4以降は段階2の完了が前提。

---

## 6. 想定される削減量

| 段階 | 削減されるHTML行数（概算） | 解消されるID重複 |
|---|---:|---:|
| 段階3 | 約 24行 | 2件（改名） |
| 段階4 | 約 240行 | 66件 |
| 段階5 | 約 60行 | 21件 |
| 段階6 | 約 90行 | 3組 |
| 合計 | 約 414行 | 89件 |

残る16件（折りたたみ4・ヘルプ4・結果操作4・強化一括ほか）は
段階5〜7とパーシャルの粒度次第で吸収できる。
