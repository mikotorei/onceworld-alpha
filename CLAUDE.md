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
- 自LUK ≤ 敵LUK → 0%
- 自LUK > 敵LUK → 10%スタート、敵LUK×10倍で90%上限（線形補間）

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

| 素材 | 上限 | 効果 |
|---|---|---|
| ヨハネの羽ペン | 1000 | 振り分けポイント +1%/個（最大11倍） |
| ヨハネの祭壇 | 1000 | 振り分けポイント +0.2%/個（最大3倍） |
| ステータス天晶 | 1000 | 振り分けポイント +10,000pt/個 |
| スーパースクロール | 1000 | 振り分けポイント +0.2%/個（最大3倍） |
| 闘晶立方体 | 1000 | 物理ダメージ +1%/個（最大11倍） |
| 天空像～冒険者～ | 2000 | 天空回廊で所持数分フロアが進む |
| 天空像～悪魔～ | 2000 | SG撃破時に所持数×100F追加 |
| 古のティラピス像 | 1000 | 天命輪廻倍率を0.00005/個下げる |

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
