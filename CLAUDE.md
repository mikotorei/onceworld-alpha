# onceworld-alpha

「OnceWorld あの頃のMMO風ソロRPG」の攻略サイト。Hugo製の静的サイトで、GitHub Pagesで公開している。

- 公開URL: https://mikotorei.github.io/onceworld-alpha/
- 技術スタック: Hugo（Goldmarkレンダラー） + GitHub Pages

---

## コード提案時のルール

- JavaScriptはDOMより後に読み込む（`<script>`はbody末尾、またはDOMContentLoadedでラップ）
- ファイルは役割ごとに分離する（HTML / ユーティリティ / ゲームロジック / UI）
- GitHub Actionsでのビルドを意識し、Hugo互換の記法を使う
- コードの変更は差分を確認後、**全文置き換え**で示す（部分修正によるバグ発生を避けるため）
- スマホレイアウトを基準に考える（利用者の大半がスマホ）

## HugoのTOMLフロントマター

- 空の数値フィールドは不可
- 範囲値は文字列化する
- 小数は完全な値を書く（`.5` ではなく `0.5`）

## Goldmark（Markdown）の制約

Markdownファイル内の `script` / `style` ブロックで避けるべき記述：

1. インデントは0スペース必須（4スペースはコードブロック化される）
2. 行頭に `<tag>` 形式のHTMLタグを置かない（innerHTMLテンプレートリテラルの複数行展開など）→ `document.createElement` に置き換える
3. `// ----` や `// ==` など空行に挟まれたコメント単独行はMarkdownのパラグラフになるため削除する
4. `hidden` 属性は削除される場合がある → `style="display:none"` を使う

---

## ディレクトリ構成

### レイアウト
```
layouts/
├── _default/baseof.html          # 全ページ共通の外枠
├── index.html                    # ホーム（home=trueのページを列挙）
├── partials/
│   ├── header.html               # サイトタイトル・ハンバーガーメニュー
│   ├── calc-integrated.html      # 統合計算機のUI
│   └── calc-detail.html          # 詳細計算機のUI
├── tools/
│   ├── build-sim.html            # ビルドシミュレーター
│   ├── calc.html / calc-wrapper.html
│   ├── exp-calc.html             # 必要経験値計算機
│   ├── monster-base-stats.html   # モンスター基礎ステ表
│   ├── pet-sim.html              # ペットステシミュ
│   ├── tenku/single.html         # 天空回廊計算表
│   └── guide/single.html         # ガイドページ（天空ノウハウ等）
├── monster/                      # モンスター一覧・詳細
├── item/                         # 素材一覧・詳細
└── map/                          # マップ
```

### JavaScript
```
static/js/
├── common/
│   ├── calc-logic.js             # 計算式の中核（ダメージ・命中・無効化）
│   ├── calc-utils.js             # UI補助（attachCommaInputBehavior等）
│   ├── help-drawer.js            # ❓ヘルプドロワー（全ページ共通）
│   ├── build-card.js             # ビルド画像生成（html2canvas）
│   └── monster-level.js
├── tools/
│   ├── build-sim/
│   │   ├── build-sim-logic.js    # ビルドシミュの計算ロジック
│   │   └── build-sim-ui.js       # ビルドシミュのUI制御
│   ├── calc/calc-ui.js           # 統合計算機のUI
│   ├── status/status-sim.js      # ステータスシミュ（ビルドシミュと共用）
│   └── exp-calc/exp-calc.js      # 必要経験値計算機
├── detail-calc-ui.js             # 詳細計算機のUI
├── equipment-db.js               # 装備DB
├── monster-base-stats.js         # モンスター基礎ステ表
├── pet-sim.js                    # ペットステシミュ
├── tenku.js                      # 天空回廊計算表
└── guide-floor-calc.js           # 天空回廊 階層到達早見表
```

### CSS
```
static/css/
├── common/
│   ├── style.css                 # 全体共通（ヘルプボタン・魔法カラー等）
│   ├── guide.css                 # ガイドページ
│   ├── monster.css               # モンスター詳細
│   ├── home.css / map.css / tenku.css
├── tools/
│   ├── integrated-tool.css       # 統合・詳細計算機（chip-btn等の共通スタイル）
│   ├── build-sim/build-sim.css
│   └── exp-calc/exp-calc.css
├── status-sim.css                # ステシミュ + ビルドカード
├── equipment.css / monster-base-stats.css / pet-sim.css / item.css
```

### コンテンツ
```
content/
├── monster/                      # モンスターデータ（約300件）
├── item/                         # 素材データ
├── map/                          # マップデータ
├── equipment/                    # 装備DB
└── tools/                        # 各ツールページ
    ├── build-sim/ status/ calc/ exp-calc/ tenku/ pet-sim/
    └── guide/tenku-corridor/     # 天空回廊のノウハウ
```

### データ
```
static/db/equipment.json          # 装備データ
layouts/index.MonsterData.js      # モンスターデータをJSに出力するテンプレート
```

---

## ゲーム計算式

### モンスターのステータスLv補正
```
ステータス = floor(基礎値 × (1 + (Lv - 1) × 0.1))
```
- 根拠: wiki「モンスターはステータスが基礎値×(1+(Lv.-1)×0.1)増加する」
- Lv1で基礎値そのまま、Lv2で1.1倍、Lv11で2倍
- ツール内部で `lv = 0` は「基本」表示用の値。Lv1と同じ等倍として扱う
- 実装: `common/calc-logic.js` の `scaleStat`（`tenku.js` / `monster-base-stats.js` にも同式の複製あり）
- 装備・アクセサリ・ペットのLv補正は**別系統**なので混同しないこと
- 計算結果がちょうど整数になるケースで、ゲーム内表示と最大1の差が出る場合がある
  （ゲーム側の浮動小数点処理による。振り分けポイントと同種の誤差として許容する）

### HP（実体力）
```
HP = (100 + VIT × 18) × (1 + 禁域の液体所持数 × 0.01)
```
- 禁域の液体は**主人公のみ**に有効。敵モンスターのHPは `100 + VIT × 18`
- VITはレベル補正後の値を使う
- 実装: `common/monster-level.js`（モンスター詳細ページ）、`calc-logic.js` 系の計算機4本
- 禁域の液体の補正は現状どのツールにも未実装

### 物理ダメージ
```
((自ATK × 1.75 × 闘晶立方体倍率) - (相手DEF + 相手M-DEF / 10)) × 4 × 属性 × 乱数 × クリティカル × 多段数
```
- 闘晶立方体倍率 = `1 + 所持数 × 0.01`（上限1000個 → 最大11倍）
- オーバーキル判定では多段数は1固定（多段は影響しない）

### 魔法ダメージ
```
(自INT + 解析書ボーナス) × 1.25 × 魔法倍率 × 魔晶立方体倍率 - 敵魔法防御
```

### 敵の防御値
```
物理防御 = DEF + MDEF × 0.1
魔法防御 = MDEF + DEF × 0.1
```

### 魔法の種類と倍率
| ID | 正式名称 | 倍率 | 色 |
|---|---|---|---|
| fire | 炎帝轟火 | ×1.0 | 赤 |
| water | 氷槍陣 | ×1.0 | 青 |
| wood | 大地葬送 | ×1.3 | 緑 |
| light | 雷鳴一閃 | ×2.0 | 黄 |
| dark | 冥刃降臨 | ×1.4 | 紫 |
| shingan | 心眼威圧 | ×0.1 | 橙 |

CSSクラス: `.spell-fire` `.spell-water` `.spell-wood` `.spell-light` `.spell-dark` `.spell-shingan`

### 会心率
```
自LUK ≤ 敵LUK          → 0%
自LUK = 敵LUK + 1      → 10%
自LUK ≥ 敵LUK × 10     → 90%（上限）
上記の間               → 線形補間
　floor(10 + (自LUK - 敵LUK - 1) / (敵LUK × 10 - 敵LUK - 1) × 80)
```
- 敵LUK = 0 のときは自LUK ≥ 1 で90%（`自LUK ≥ 敵LUK × 10` を満たすため）
- 実装は `common/calc-logic.js` の `calcCritRate` に一本化
- 逆算（目標会心率に必要な自LUK）は同ファイルの `requiredLukForCritRate`

### 振り分けポイント
```
floor((base × (1 + 羽ペン×0.01) × (1 + 祭壇×0.002) + 天晶×10000) × (1 + スクロール×0.002))
```
- ゲーム内と最大1ptの誤差あり（浮動小数点依存、許容範囲として対応しない）

### 必要経験値
```
Lv.N→N+1 = 前回の必要経験値 × 天命・殲儀倍率 + 現在Lv × 5
天命・殲儀倍率 = 1.05 + max(天命・殲儀回数 × 0.01 - 古のティラピス像 × 0.00005, 0)
```
- 主人公 Lv1→2 = 100
- ペット Lv1→2 = MOVを除く基礎ステ合計 + 50
- ペットはLv201以降、Lv199→200と同じ値で固定

### 獲得経験値
```
経験値基準値 = 基礎経験値 × 経験の起源 × floor(Lv^1.1 × 0.2) + ペガサスのメダル × 10
主人公獲得経験値 = 経験値基準値 × (1 + ペットスキル補正 + アクセサリー補正) × EXP薬
ペット獲得経験値 = 経験値基準値 × (1 + ジパングの酒補正) × (1 + ルミナスキノコ補正 × キノコハウス補正)
```

### 暗殺者のカギ爪（equipment id: `assassin_claw`）
- 物理攻撃時：DEF=0で計算、最終ダメージ×0.1
- 魔法には影響しない

---

## 効果素材の上限

**効果素材の所持上限は全て共通で、通常時1000 / パンドラの箱所持で2000。**
素材ごとの例外はない。

### パンドラの箱

効果素材の所持上限を1000から2000に引き上げるアイテム。
上限が伸びると効果も比例して伸びる（例: ヨハネの羽ペンは最大11倍 → 21倍）。

### 一覧

| 素材 | 効果 | 通常時（1000） | パンドラ時（2000） |
|---|---|---|---|
| ヨハネの羽ペン | 振り分けポイント +1%/個 | 最大11倍 | 最大21倍 |
| ヨハネの祭壇 | 振り分けポイント +0.2%/個 | 最大3倍 | 最大5倍 |
| スーパースクロール | 振り分けポイント +0.2%/個 | 最大3倍 | 最大5倍 |
| ステータス天晶 | 振り分けポイント +10,000pt/個 | 最大1,000万pt | 最大2,000万pt |
| 闘晶立方体 | 物理ダメージ +1%/個 | 最大11倍 | 最大21倍 |
| 魔晶立方体 | 解析書補正後のINT +1%/個 | 最大11倍 | 最大21倍 |
| 禁域の液体 | 主人公のHP +1%/個（敵には無効） | 最大11倍 | 最大21倍 |
| 賢者の落とし物 | 基礎ポイント上限 +10/個 | 最大 +10,000 | 最大 +20,000 |
| 禁域の書物 | 基礎ポイント上限 +80/個 | 最大 +80,000 | 最大 +160,000 |
| 古のティラピス像 | 天命輪廻倍率を0.00005/個下げる | 最大 -0.05 | 最大 -0.1 |
| 天空像～冒険者～ | 天空回廊で所持数分フロアが進む | 最大 +1,000F | 最大 +2,000F |
| 天空像～悪魔～ | SG撃破時に所持数×100F追加 | 最大 +100,000F | 最大 +200,000F |

データ定義は `static/js/common/game-data.js` の `MATERIALS`。
上限を求めるときは `getMaterialMax(materialId, hasPandora)` を使う。

### 実装に残っているクランプ値との対応

`MATERIALS` はまだ計算側から参照されていないため、各ツールには個別のクランプが残っている。
数値の意味が上記モデルと一致しないものがあるので注意。

| 箇所 | 値 | 意味 |
|---|---|---|
| `guide-floor-calc.js:34`（`MAX_B`）、`:319`（直書き） | 2000 | 天空像2件の上限。**パンドラ所持前提の値**。未所持なら1000が正しい |
| `build-sim-logic.js:162`、`status-sim.js:817` | 10000 | 賢者の落とし物。**素材上限ではなく防御的な安全上限**（実際の上限は1000/2000） |
| `build-sim-logic.js:163`、`status-sim.js:818` | 80000 | 禁域の書物。同上 |
| `calc-logic.js:110`（`getTouShouMultiplier`） | 1000 | 闘晶立方体。**通常時上限で固定**。パンドラ所持（最大21倍）に未対応 |
| `calc-logic.js:163`（`getCrystalMultiplier`） | 11.0 | 魔晶立方体。倍率側で固定。同じくパンドラ未対応 |
| `build-sim-logic.js:127-130` | なし | 羽ペン・祭壇・天晶・スクロールは**個数クランプ自体が無い**。入力値がそのまま乗る |

---

## 天空回廊

- 敵レベル = `10000 + 現在の階層 × 100`
- 片側全滅で+1F、両側で+2F
- 100層ごとにスカイガーディアン（撃破で+99F）
- ボスフロア: 1万・10万・100万・1000万F
- ワープ①: 最高到達フロア-10万F（1万の倍数）へワープ。ボスフロアに降りても通常エリア扱い
- ワープ②: 100万Fの麒麟に直行

---

## 注意事項

### localStorage の保存形式

localStorage の読み書きは `static/js/common/storage-manager.js` の `OWStorage` に集約している。
`localStorage` を直接呼ばないこと。

JSONで保存するキーは**封筒形式**で保存される。

```json
{ "__v": 1, "data": { ...実データ... } }
```

- `__v` を持たない保存済みデータは「バージョン0（旧形式）」として読み込まれる
- 移行関数は `MIGRATIONS[key][n]`（バージョン n を n+1 にする関数）。
  未定義なら無変換。現時点は全キー無変換
- スキーマを変えるときは `SCHEMA_VERSIONS` の番号を上げ、`MIGRATIONS` に変換を足す
- 生文字列で保存するキー（`onceworld_origin_exp` / `calc_active_tab`）は封筒の対象外

`status_sim_build_slots_v1`（名前付きビルド）は**ユーザーが手で貯めた資産**で、
失うと復元できない。旧形式を最初に読み書きした時点で
`status_sim_build_slots_v1__pre_v1_backup` へ原本をバイト単位で退避する（一度だけ）。

### game-data.js の二重読み込み

`static/js/common/game-data.js` はトップレベルに `const` 宣言（`SPELLS` / `MATERIALS` /
`ELEMENT_CHART` / `ELEMENT_ALIASES`）を持つため、**同一ページで二重読み込みすると
`SyntaxError: Identifier 'SPELLS' has already been declared` になり、
2回目のスクリプトが丸ごと実行されない**。読み込み箇所を増やす際は重複しないか確認すること。

現在の読み込み箇所:
- `layouts/tools/build-sim.html`
- `layouts/tools/calc.html`
- `layouts/tools/calc-wrapper.html`
- `layouts/tools/tenku/single.html`
- `content/tools/status/index.md`

なお `calc-logic.js` はトップレベルが `function` 宣言のみなので二重読み込みでもエラーにならない。

### ファイルの区別
- `calc-integrated.html`（統合計算機）と `calc-detail.html`（詳細計算機）は**別物**
  - 統合計算機: IDにプレフィックスなし（`hero-atk`, `toushou-count`）
  - 詳細計算機: IDに `detail-` プレフィックス（`detail-hero-atk`, `detail-toushou-count`）
  - 混同して上書きした事故が過去にあるため要注意

### モンスターデータ
- スキル欄が3段階のみのモンスターは3エントリ、4段階目は自動で「—」表示
- `level_shortcuts` は `[[level_shortcuts]]` のTOMLテーブル配列形式

### 数値入力
- `attachCommaInputBehavior`（`static/js/common/calc-utils.js`）がサイト標準
- 使用条件: `type="text" inputmode="numeric"` が必要

### 素材一覧の並び順
- `weight` の昇順で表示
- 中間挿入に備えて100刻みで採番する
