# 素材入力欄のUI自動生成 — 調査と設計案

調査日: 2026-08-18
目的: `game-data.js` の `MATERIALS` に定義を1件追加するだけで、対象ツールに入力欄が生成される仕組みを作る

このドキュメントは**調査と設計案のみ**で、コードの変更は一切行っていない。

---

## 1. 現状のHTML構造

### 1.1 5つのパターンに分類できる

素材の入力UIは、見た目・DOM構造・値の型が異なる**5種類**に分かれる。

#### パターンA: 数値入力 + MAXボタン + 単位表示

最も定型的で、**自動生成に最も適している**。

```html
<div class="bs-point-limit-row">
  <span class="bs-point-limit-label">ヨハネの羽ペン</span>
  <input id="bs-pen-count" type="number" min="0" max="1000" value="0" class="lv-input">
  <button type="button" class="chip-btn"
          onclick="document.getElementById('bs-pen-count').value='1000';
                   document.getElementById('bs-pen-count').dispatchEvent(new Event('input'))">MAX</button>
  <span class="bs-label-text">個（最大1000個）</span>
</div>
```

出現: `build-sim.html:42-90`（6件）、`content/tools/status/index.md:40-88`（6件）

MAXボタンが**インライン `onclick` に生のJSを書いている**点に注意。ID文字列が3回（`id` 属性・`onclick` 内2回）繰り返される。

#### パターンB: ラベル + 数値入力のみ

MAXボタンも単位表示もない簡素な形。

```html
<div class="hero-row hero-stat-row">
  <span class="hero-label">闘晶立方体</span>
  <input id="bs-toushou-count" type="number" min="0" max="1000" value="0">
</div>
```

出現: `build-sim.html:504-542`（5件）、`exp-calc.html`（4件）、`pet-sim.html`（1件）

#### パターンC: ラベル + テキスト入力（カンマ整形付き）

`attachCommaInputBehavior` を前提とする、CLAUDE.md 規約準拠の形。行そのものが `hidden` で出し分けされる。

```html
<div class="hero-row hero-stat-row" id="crystal-row" hidden>
  <span class="hero-label">魔晶立方体:</span>
  <input id="crystal-count" type="text" inputmode="numeric" value="0" autocomplete="off">
</div>
```

出現: `calc-integrated.html:47-62`（4件）、`calc-detail.html:67-86`（4件）

**ラベル末尾に `:` が付く**のがこのパターンだけの特徴。

#### パターンD: 2択トグルボタン（所持/未所持）

数量ではなく真偽値。`aria-pressed` で状態を持ち、JS側が `data-val` を読む。

```html
<span class="bs-point-limit-label">コスモキューブ</span>
<div class="chip-group">
  <button class="chip-btn bs-cosmocube-btn" type="button" data-val="0" aria-pressed="true">未所持</button>
  <button class="chip-btn bs-cosmocube-btn" type="button" data-val="1" aria-pressed="false">所持</button>
</div>
```

出現: コスモキューブ・超越の契約書（build-sim / status の各2件）、経験の起源・キノコハウス（exp-calc）

**IDではなくクラス名で束ねる**点が他パターンと決定的に違う。

#### パターンE: 個数選択チップ（離散値）

数値だが、取りうる値が2択に固定されているもの。

```html
<span class="mode-label">ゴッドオブデビルアイ:</span>
<div class="chip-group" aria-label="god eye count">
  <button id="god-eye-0"    type="button" class="chip-btn" aria-pressed="true">0個</button>
  <button id="god-eye-1000" type="button" class="chip-btn" aria-pressed="false">1000個</button>
</div>
```

出現: `calc-integrated.html:131-137`、`calc-detail.html:281-287`

同じゴッドオブデビルアイが `build-sim.html:541` では**パターンB（数値入力）**になっており、
**同一素材がツールによって別パターン**という不統一がある。

### 1.2 パターン別の要素まとめ

| 要素 | A | B | C | D | E |
|---|---|---|---|---|---|
| ラベル | `<span>` | `<span>` | `<span>`（末尾 `:`） | `<span>` | `<span>`（末尾 `:`） |
| 入力 | `type="number"` | `type="number"` | `type="text" inputmode="numeric"` | ボタン2つ | ボタン2つ |
| MAXボタン | あり（インラインJS） | なし | なし | — | — |
| 単位表示 | 「個（最大1000個）」 | なし | なし | — | — |
| 値の識別 | `id` | `id` | `id` | **class** | `id`（値ごとに別ID） |
| 行の外枠 | `.bs-point-limit-row` | `.hero-row.hero-stat-row` | `.hero-row.hero-stat-row` | `.chip-group` | `.chip-group` |
| 出し分け | なし | クラス（`.bs-phys-only` 等） | `hidden` 属性 | なし | 親の `hidden` |

### 1.3 単位表示の表記ゆれ

パターンAの単位表示だけで3通りある。

| 表記 | 出現 |
|---|---|
| `個（最大1000個）` | 羽ペン・祭壇・天晶・スクロール |
| `個（最大1,000個）` | 賢者の落とし物・禁域の書物（**カンマあり**） |
| `（上限1000）` をラベル側に含める | exp-calc の古のティラピス像 |

---

## 2. IDの命名規則

### 2.1 ツールごとのプレフィックス

| ツール | プレフィックス | 例 |
|---|---|---|
| ビルドシミュ | `bs-` | `bs-pen-count` |
| ステシミュ | `ss-` | `ss-pen-count` |
| 詳細計算機 | `detail-` | `detail-crystal-count` |
| 統合計算機 | **なし** | `crystal-count` |
| 必要経験値 | **なし**（キャメル） | `heroTilapia` |
| ペットシミュ | **なし**（キャメル） | `kinokoInput` |
| 階層早見表 | **なし**（キャメル） | `ownedAdventurer` |

### 2.2 一貫性の評価

**同一素材のID語幹が一致するのは、`bs-` / `ss-` / `detail-` の3ツールのみ。**

| 素材 | build-sim | status | 統合 | 詳細 | その他 |
|---|---|---|---|---|---|
| ヨハネの羽ペン | `bs-pen-count` | `ss-pen-count` | — | — | — |
| 魔晶立方体 | `bs-crystal-count` | — | `crystal-count` | `detail-crystal-count` | — |
| 闘晶立方体 | `bs-toushou-count` | — | `toushou-count` | `detail-toushou-count` | — |
| 賢者の落とし物 | `bs-sage-drop` | `ss-sage-drop` | — | — | — |
| 古のティラピス像 | — | — | — | — | `heroTilapia` / `petTilapia` |
| 天空像～冒険者～ | — | — | — | — | `ownedAdventurer` |

**規則性があるのは「プレフィックス + 共通語幹」の部分だけ**で、語幹の付け方自体は素材ごとに場当たり的。

- `pen-count` / `altar-count` / `tensho-count` / `scroll-count` / `crystal-count` / `toushou-count` … **`-count` 接尾辞**
- `sage-drop` / `forbidden-book` / `devil-eye` … **接尾辞なし**
- `analysis-book-advanced` … 単に長い

さらに `content/item/` のファイル名（＝ `MATERIALS` の `id`）とも一致しない。

| MATERIALS の id | UI上のID語幹 |
|---|---|
| `johanne_quill` | `pen-count` |
| `status_crystal` | `tensho-count` |
| `battle_crystal_cube` | `toushou-count` |
| `sage_lost_item` | `sage-drop` |

**この不一致が自動生成の最大の障害**になる。定義から機械的にIDを導出できない。

### 2.3 例外

- 天空回廊計算表（`tenku/single.html`）だけ `analysis-book-adv`（他は `-advanced`）
- ステシミュの `shakerCount` はプレフィックスなしのキャメル（同じファイル内で `ss-` 系と混在）
- ペットシミュの粉入力は**JSが動的生成**（`pet-sim.js:36-70`、`powder-vit` 等）。既に自動生成されている唯一の例

---

## 3. 配置されているタブ・セクション

### 3.1 分類

| 素材 | ツール | セクション | 物理/魔法 |
|---|---|---|---|
| ヨハネの羽ペン | build-sim / status | 「振り分けポイントを計算する」 | 共通 |
| ヨハネの祭壇 | build-sim / status | 同上 | 共通 |
| ステータス天晶 | build-sim / status | 同上 | 共通 |
| スーパースクロール | build-sim / status | 同上 | 共通 |
| コスモキューブ | build-sim / status | 同上 | 共通 |
| 賢者の落とし物 | build-sim / status | 「振り分け上限を計算する」 | 共通 |
| 禁域の書物 | build-sim / status | 同上 | 共通 |
| 超越の契約書 | build-sim / status | 同上 | 共通 |
| 闘晶立方体 | build-sim | `.bs-phys-only` | **物理のみ** |
| 闘晶立方体 | 統合 | `#toushou-row`（常時表示） | **共通**（不統一） |
| 闘晶立方体 | 詳細 | `#detail-physical-panel` 内 | **物理のみ** |
| 解析書 / 解析書の解析書 / 魔晶立方体 | build-sim | `.bs-magic-only` | **魔法のみ** |
| 解析書 / 解析書の解析書 / 魔晶立方体 | 統合 / 詳細 | `hidden` 属性で出し分け | **魔法のみ** |
| ゴッドオブデビルアイ | build-sim | `.bs-phys-only` | **物理のみ** |
| ゴッドオブデビルアイ | 統合 / 詳細 | `#god-eye-row`（クリティカルON時のみ） | **物理 + 条件付き** |
| 古のティラピス像 | exp-calc | 主人公セクション / ペットセクション | 共通（**同一素材で2欄**） |
| ペガサスのメダル等 | exp-calc | 討伐数計算セクション | 共通 |
| 天空像2種 | guide | 階層到達早見表 | 共通 |
| ルミナスキノコ | pet-sim / exp-calc | キノコセクション | 共通 |

### 3.2 出し分け方式が3通りある

| 方式 | 使用箇所 |
|---|---|
| **CSSクラス**（`.bs-phys-only` / `.bs-magic-only`） | build-sim |
| **`hidden` 属性**（JSが `setHiddenForce` で操作） | 統合計算機 / 詳細計算機 |
| **出し分けなし**（常時表示） | status / exp-calc / guide / pet-sim |

CLAUDE.md には「`hidden` 属性は削除される場合がある → `style="display:none"` を使う」という
Goldmark制約の注記がある。`content/` 配下のMarkdownに生成する場合はこの制約が効く。

### 3.3 闘晶立方体の扱いが3ツールで割れている

同じ素材が build-sim では物理タブ限定、詳細計算機でも物理パネル内、
統合計算機では常時表示（`#toushou-row` に `hidden` なし）。
物理ダメージにしか効かない素材なので、統合計算機の常時表示は仕様の揺れの可能性がある。

---

## 4. 直書きされている素材入力欄の総数

### 4.1 `MATERIALS`（12件）に対応する入力欄: **22欄**

| 素材 | 欄数 | 配置 |
|---|---:|---|
| 闘晶立方体 | 3 | build-sim / 統合 / 詳細 |
| 魔晶立方体 | 3 | build-sim / 統合 / 詳細 |
| ヨハネの羽ペン | 2 | build-sim / status |
| ヨハネの祭壇 | 2 | build-sim / status |
| ステータス天晶 | 2 | build-sim / status |
| スーパースクロール | 2 | build-sim / status |
| 賢者の落とし物 | 2 | build-sim / status |
| 禁域の書物 | 2 | build-sim / status |
| 古のティラピス像 | 2 | exp-calc（主人公 / ペット） |
| 天空像～冒険者～ | 1 | guide |
| 天空像～悪魔～ | 1 | guide |
| **禁域の液体** | **0** | **UIなし**（未実装） |

### 4.2 `MATERIALS` 外だがUI上は素材として扱われるもの

自動生成の対象範囲を決めるうえで重要。**これらは現在 `MATERIALS` に定義がない。**

| 名称 | 入力欄 | 型 |
|---|---|---|
| 解析書 | `analysis-book` / `bs-analysis-book` / `detail-analysis-book` | 数値（3欄） |
| 解析書の解析書 | 同上 `-advanced` + tenku の `-adv` | 数値（4欄） |
| ゴッドオブデビルアイ | `bs-devil-eye` + 統合/詳細のチップ | 数値1 + チップ2組 |
| コスモキューブ | `bs-cosmocube-btn` / `ss-cosmocube-btn` | トグル（2組） |
| 超越の契約書 | `bs-contract-btn` / `ss-contract-btn` | トグル（2組） |
| Pシェーカー | `shakerCount` | 数値（1欄） |
| プロテイン7種 | `protein_vit`〜`protein_luk` | 数値（7欄 × 2ファイル） |
| 粉7種 | `powder-vit`〜`powder-luk` | 数値（**JS生成**） |
| ペガサスのメダル | `medalCount` | 数値（1欄） |
| ジパングの酒 | `zipangCount` | 数値（1欄） |
| ルミナスキノコ | `luminousCount` / `kinokoInput` | 数値（2欄） |
| キノコハウス | `hasHouse`/`noHouse` / `houseBtn` | トグル（2組） |
| 経験の起源 | `hasKigen`/`hasKigenOn` / `origin-exp` | トグル + checkbox |

### 4.3 合計

| 区分 | 欄数 |
|---:|---:|
| `MATERIALS` 由来 | 22 |
| `MATERIALS` 外の素材系 | 約40（プロテイン14・粉7を含む） |
| **素材系の入力欄 合計** | **約62** |

うち **JSで生成されているのは粉7欄のみ**。残り約55欄がHTMLに直書きされている。

さらに `build-sim.html`（66入力）と `content/tools/status/index.md`（54入力）は
**63個のIDを二重にベタ書き**している（`refactoring-survey.md` の C-1）。
素材欄もこの二重管理に含まれるため、自動生成はこの問題の解決策にもなる。

---

## 5. 設計案

### 5.1 `MATERIALS` に持たせるメタ情報

現在の `MATERIALS` は `{ id, name, baseMax, effect }` の4項目。
UI生成には**表示先・配置・入力型・ラベル**の情報が要る。

```js
{
  id: "johanne_quill",
  name: "ヨハネの羽ペン",
  baseMax: 1000,
  effect: "振り分けPt +1%/個",

  // --- ここから UI 用メタ情報（追加分） ---
  ui: {
    kind: "count",          // "count" | "toggle" | "chips"
    unit: "個",             // 単位表示。null なら単位なし
    showMax: true,          // MAXボタンを出すか
    slots: [                // 表示先。ツール単位ではなく「スロット」単位で指定
      { tool: "build-sim", section: "stat-point", inputId: "bs-pen-count" },
      { tool: "status",    section: "stat-point", inputId: "ss-pen-count" }
    ]
  }
}
```

#### `kind`（入力欄の型）

| 値 | 対応パターン | 生成されるDOM |
|---|---|---|
| `"count"` | A / B / C | ラベル + 数値入力（+ MAXボタン + 単位） |
| `"toggle"` | D | ラベル + 未所持/所持 の2ボタン |
| `"chips"` | E | ラベル + 指定値のチップ群（`values: [0, 1000]`） |

#### `slots`（表示先）

**ツール名だけでは足りない。**理由は3つ。

1. 同一素材が同一ツールに2欄ある（古のティラピス像 = 主人公 / ペット）
2. 同一素材でもツールによって配置タブが違う（闘晶立方体 = 物理タブ / 常時表示）
3. **既存IDが定義から導出できない**（`johanne_quill` → `pen-count`）

そのため `slots` は配列とし、**`inputId` を明示的に持たせる**。
自動導出を諦めることで、既存HTMLとの互換を保ったまま移行できる。

#### `section`（配置先）

| 値 | 意味 | 出し分け |
|---|---|---|
| `"stat-point"` | 振り分けポイント計算 | なし |
| `"point-limit"` | 振り分け上限計算 | なし |
| `"physical"` | 物理タブ | build-sim は `.bs-phys-only`、統合/詳細は `hidden` |
| `"magic"` | 魔法タブ | 同上 `.bs-magic-only` |
| `"common"` | 常時表示 | なし |

出し分けの実装方式（クラス or `hidden`）はツールごとに違うため、
**`section` は論理的な区分だけを表し、実際のクラス付与は生成側が判断する**。

#### `MATERIALS` 外の素材の扱い

解析書・プロテイン・粉などは `MATERIALS` に無い。3つの選択肢がある。

| 案 | 内容 | 評価 |
|---|---|---|
| **P-1** | `MATERIALS` に追加して一元化 | 一貫性は最高。ただし `baseMax` の意味が曖昧なもの（プロテイン・粉）が混ざる |
| **P-2** | `MATERIALS` は所持上限のある効果素材のみに保ち、UI生成用に別配列 `UI_FIELDS` を作る | 責務が分かれて明快。定義が2箇所に散る |
| **P-3** | 当面は `MATERIALS` の12件だけ自動生成し、他は直書きのまま | 移行が最小。混在状態が続く |

**推奨は P-1。** 粉・プロテインも「所持上限のある効果素材」であることは変わらず、
`baseMax`（粉は1100、プロテインは要確認）を持たせられる。
ただし粉7種・プロテイン7種は**ステータス別に7欄へ展開する**という別の構造を持つため、
`ui.expand: "stats"` のような展開指定が要る。

### 5.2 生成関数のAPI設計

#### 案G-1: スロット指定でDOMを生成（推奨）

```js
// HTML側は空のコンテナだけ置く
// <div data-material-slot="build-sim:stat-point"></div>

// JS側
renderMaterialSlots(root);   // data-material-slot を全て走査して埋める
```

内部では `MATERIALS` を走査し、`ui.slots` の `tool:section` が一致するものを
定義順に生成してコンテナへ流し込む。

| メリット | デメリット |
|---|---|
| **HTMLからは素材の記述が完全に消える。**素材追加＝定義1件追加で完結 | 生成前のHTMLは空で、ソースを読んでも何が表示されるか分からない |
| build-sim と status の二重管理（C-1）が素材欄については解消される | 生成タイミング前に他JSが `getElementById` すると `null` になる。初期化順の制約が生まれる |
| 表示順を定義順で一元管理できる | CSSの `:nth-child` 等に依存したスタイルがあると壊れる |

#### 案G-2: 既存HTMLを残し、属性で補強するだけ

```html
<div class="bs-point-limit-row" data-material="johanne_quill" data-slot="build-sim:stat-point">
  <!-- ラベル・MAXボタン・単位は JS が補う。input だけ直書き -->
  <input id="bs-pen-count" type="number" min="0" value="0" class="lv-input">
</div>
```

| メリット | デメリット |
|---|---|
| 既存の初期化順を壊さない。input は最初からDOMにある | **素材追加時にHTMLも触る必要が残る**。目的を達成できない |
| 上限値・ラベル・単位が定義と自動で同期する | 中途半端で、二重管理は残る |

#### 案G-3: Hugoテンプレート側で生成

`game-data.js` と同じ内容を `data/materials.toml` に持ち、Hugoの `range` でHTMLを出力する。

| メリット | デメリット |
|---|---|
| **静的HTMLとして出力される。**JSの初期化順の問題が一切ない | 定義が `data/materials.toml` と `game-data.js` の**2箇所に分裂**する |
| ソースを読めば何が表示されるか分かる | Hugoビルドが必要。JS側からUI情報を参照できない |
| Goldmarkの制約（`hidden` が消える等）を回避しやすい | `content/` 配下のMarkdown（status）では partial 呼び出しが必要 |

**推奨は G-1。** ただし G-3 の「定義の二重化」を避けるため、
`data/materials.toml` を単一の定義元とし、`game-data.js` をHugoが生成する案も検討に値する
（`layouts/index.MonsterData.js` が既に同じ手法でモンスターデータをJSへ出力している）。

#### 生成関数のシグネチャ案

```js
// 1スロット分のDOMを生成して返す（テスト可能）
buildMaterialField(material, slot) -> HTMLElement

// ページ内の全スロットを埋める
renderMaterialSlots(root = document) -> number   // 生成した欄数を返す

// 定義とHTMLの整合を検証する（開発用）
validateMaterialSlots(root = document) -> { missing: [], orphan: [] }
```

`validateMaterialSlots` は、定義にあるのにスロットが無い / スロットがあるのに定義に無い、を検出する。
段階的移行の途中で取りこぼしを防ぐために有用。

### 5.3 既存HTMLの置き換え方（段階的移行）

**一度に置き換えるのは危険。**素材欄は22欄あり、それぞれに保存処理・計算処理が紐づく。
以下の順なら、各段階で動作を確認しながら進められる。

| 段階 | 内容 | リスク | 検証方法 |
|---|---|---|---|
| 1 | `MATERIALS` に `ui` メタ情報を追加するだけ。生成はまだしない | 極小 | 既存動作に影響なし |
| 2 | `buildMaterialField` / `renderMaterialSlots` を実装。**どこからも呼ばない** | 極小 | 単体テストのみ |
| 3 | `validateMaterialSlots` で、定義と既存HTMLのIDが一致することを確認 | なし | 不一致が出れば定義側を修正 |
| 4 | **build-sim の「振り分けポイント」セクション（6欄）だけ**をスロット化 | 中 | 生成前後のDOMを比較。保存/復元の往復テスト |
| 5 | status の同セクション（6欄）をスロット化。ここで C-1 の二重管理が1箇所減る | 中 | 同上 |
| 6 | 「振り分け上限」セクション（build-sim / status で計4欄） | 中 | 同上 |
| 7 | 統合/詳細計算機の魔法系3欄 × 2 | 中 | `hidden` 出し分けが維持されるか |
| 8 | 残り（闘晶立方体・exp-calc・guide） | 中 | 同上 |

段階4で止めても、**その時点で仕組みは動いている**。以降は同じ手順の繰り返しなので、
途中で中断しても中途半端な壊れ方はしない。

#### 初期化順の制約

`renderMaterialSlots` は、素材欄を参照する全てのJSより**前**に実行される必要がある。

現在の読み込み順（build-sim.html）:
```
calc-utils.js → number-format.js → help-drawer.js → storage-manager.js
→ game-data.js → calc-logic.js → status-sim.js → build-sim-logic.js → build-sim-ui.js
```

`status-sim.js` と `build-sim-ui.js` は `DOMContentLoaded` 内で `$("bs-pen-count")` を参照する。
生成を `game-data.js` の直後（`DOMContentLoaded` より前、パース時点）に行えば間に合うが、
**その時点ではまだスロットのコンテナがパースされていない可能性がある**（scriptがbody末尾なら問題ない）。

安全なのは、生成専用のJSを**素材欄より後・利用側JSより前**に置くこと。
現在の構成では body 末尾に全scriptがあるため、`game-data.js` の直後で成立する。

### 5.4 自動生成にしない方がよい箇所

以下は**自動生成の対象から外すべき**と考える。

| 対象 | 理由 |
|---|---|
| **ゴッドオブデビルアイ（統合/詳細のチップ）** | クリティカルONのときだけ表示という**他の状態に依存した出し分け**を持つ。素材定義に書くには条件が複雑すぎる。build-sim 側の数値入力とも型が違う |
| **粉7種・プロテイン7種** | ステータス別に7欄へ展開する構造で、素材1件＝入力1欄という前提から外れる。専用の展開ロジックが要り、汎用の生成関数に混ぜると複雑化する。粉は既に `pet-sim.js` が独自生成しており、そちらに寄せる方が自然 |
| **経験の起源** | `exp-calc` ではトグルボタン、`monster/single.html` では**チェックボックス**と、同一概念で型が違う。統一してから検討すべき |
| **`content/tools/status/index.md`（当面）** | Markdown内のHTMLはGoldmarkの制約を受ける（`hidden` が消える・行頭タグ不可）。スロットの空 `<div>` 1つなら問題ないが、C-1（build-sim との二重管理）を先に解消してからの方が手戻りが少ない |
| **天空回廊計算表（tenku）** | 素材欄は `analysis-book-adv` の1件のみで、しかも表記ゆれがある。自動生成の効果より、まず命名を揃える方が先 |

逆に、**パターンA（数値 + MAX + 単位）の12欄は最優先で自動生成すべき**。
定型度が最も高く、MAXボタンのインライン `onclick` という技術的負債も同時に解消できる。

---

## 6. 着手前に決めておくべきこと

- **`MATERIALS` の責務をどこまで広げるか**（5.1 の P-1 / P-2 / P-3）。
  解析書・プロテイン・粉を含めるかで、必要なメタ情報の複雑さが変わる。
- **定義の単一化をどうするか**（5.2 の G-1 / G-3）。
  `data/materials.toml` を単一の定義元にして `game-data.js` をHugoが生成する案は、
  `layouts/index.MonsterData.js` の前例があり実現可能。ただし影響範囲が広がる。
- **既存IDを維持するか、命名を揃えてから移行するか。**
  維持すれば移行は安全だが、`johanne_quill` → `pen-count` という対応表を
  `slots` に持ち続けることになる。揃えるならlocalStorageの保存キーにも影響が及ぶ
  （`BS_PERSIST_INPUTS` の `id` が変わる）。
- **闘晶立方体の配置の不統一**（3.3）を仕様として直すか、現状維持か。
  自動生成では `section` を1つ選ぶ必要があるため、先に決めておく必要がある。

---

## 7. 関連ドキュメント

- `docs/refactoring-survey.md` — C-1（build-sim と status のHTML二重管理）、C-5（ID命名規則の4系統混在）
- `docs/storage-survey.md` — R-1（案Bへの移行）、R-6（`bs-devil-eye` が未接続）

UI自動生成は C-1 の解決策にもなるため、両者は同時に進める価値がある。
