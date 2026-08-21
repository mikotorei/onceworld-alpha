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

本文の記述で避けるべきもの：

1. 強調の閉じ `**` の直前に全角チルダなどの約物を置き、直後に文字が続くと、
   CommonMarkのright-flanking判定を満たさず強調として認識されない。
   生の `**` がそのままページに表示される（例: `**天空像～冒険者～**を`）。
   `<strong>` かリンク表記にすること。`hugo.toml` は `unsafe = true` なので
   インラインの `<strong>` はそのまま出力される。
   チルダが文字列の中間にある `**1〜10階**` は閉じ側の直前が文字なので問題ない

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
├── monster/                      # モンスターデータ（141件）
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
static/db/pet-skills.json         # ペットスキル（モンスターIDがキー・141件）
data/slots.yaml                   # 装備・ペット・シリーズのスロット定義
data/pet-skill-patterns.yaml      # ペットスキルの解放レベル（early / late）
layouts/index.MonsterData.js      # モンスターデータをJSに出力するテンプレート
layouts/index.SlotsData.js        # slots.yaml をJSに出力するテンプレート
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

### 被ダメージ軽減（死刑囚の身代わり晩餐）
```
軽減後ダメージ = floor(ダメージ × (10000 - 所持数 × 9) / 10000)
```
- 主人公が受けるダメージを1個につき0.09%軽減する
- 上限1000個で−90%、パンドラ所持の2000個で−180%
- 軽減率が100%を超える場合はダメージ0で底打ちする
- 0.0009 の積み重ねによる浮動小数点誤差を避けるため**1万分率の整数演算**で計算する
- 実装: `calc-logic.js` の `applyDamageReduction` / `getDamageReductionRate`
- 反映先: 詳細計算機の被ダメ（物理・魔法）、ビルドシミュの `calcReceivedDamage`

### 装備の強化上限

```
通常強化の上限 = 1100 + 禁域のロック所持数
G強化の上限   = 300（固定）
G強化の解禁条件 = 通常強化 +1100（固定。通常強化の上限が伸びても連動しない）
G強化の基準値 = 基礎値 × 111（= 1 + 1100 × 0.1 の畳み込み。固定）
G強化後のステータス = 基礎値 × 111 + (基礎値 × 25 + 10000) × G強化値
```

- 上限の定義は `game-data.js` の `LIMITS`。値を取るときは `getLimit(limitId, materialCounts)`
- 装備向けのラッパーは `calc-logic.js` にある
  - `getEquipEnhanceMax()` … 通常強化の上限（可変）
  - `getEquipGLevelMax()` … G強化の上限（300固定）
  - `getEquipMaxEnhanceMultiplier()` … 通常強化の表示・計算にのみ使う倍率（可変）
  - `EQUIP_G_UNLOCK_LV` = 1100 … G強化の解禁しきい値（固定）
  - `EQUIP_G_BASE_MULTIPLIER` = 111 … G強化の基準値（固定）
- **通常強化とG強化で倍率の扱いが違う**。通常強化の上限が伸びても
  G強化の基準値・解禁条件は +1100 のまま。混同しないこと
- HTML側の `max` 属性とボタン文言は `applyEquipLimits()` が実行時に書き換える。
  対象は `data-equip-limit="enhance"` / `="glevel"` /
  `data-equip-limit-label="all"` / `="plus"` を持つ要素
- 上限を下回った入力値はパンドラと同じ方式で切り詰める

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

「大切なもの」枠のアイテムで売値が存在しないため、`content/item/` には登録しない。

**実装**: 所持状態は `static/js/common/pandora.js`（`window.OWPandora`）が
localStorage の `onceworld_pandora` で全ツール共通に管理する。

- `OWPandora.get()` / `set(v)` / `onChange(cb)`
- `OWPandora.materialCap(id, fallback)` … パンドラの状態を加味した所持上限
- 計算側は `calc-logic.js` の `materialCap()` / `clampCount()` を使う。
  素材の上限をハードコードしないこと
- UIのトグルは `material-ui.js` が生成する。素材スロットの先頭に自動で入り、
  単独で置きたい場合は `<div data-pandora-slot></div>` を使う
- 所持を解除したとき、上限を超える入力値は即座に切り詰められる

### 一覧

| 素材 | 効果 | 通常時（1000） | パンドラ時（2000） |
|---|---|---|---|
| ヨハネの羽ペン | 振り分けポイント +1%/個 | 最大11倍 | 最大21倍 |
| ヨハネの祭壇 | 振り分けポイント +0.2%/個 | 最大3倍 | 最大5倍 |
| スーパースクロール | 振り分けポイント +0.2%/個 | 最大3倍 | 最大5倍 |
| ステータス天晶 | 振り分けポイント +10,000pt/個 | 最大1,000万pt | 最大2,000万pt |
| 闘晶立方体 | 物理ダメージ +1%/個 | 最大11倍 | 最大21倍 |
| 死刑囚の身代わり晩餐 | 主人公への被ダメージ -0.09%/個 | 最大 -90% | 最大 -180%（0で底打ち） |
| ハデスの兜 | ペットの最大レベル +1/個 | 最大 Lv2200 | 最大 Lv2200（頭打ち） |
| 魔晶立方体 | 解析書補正後のINT +1%/個 | 最大11倍 | 最大21倍 |
| 禁域の液体 | 主人公のHP +1%/個（敵には無効） | 最大11倍 | 最大21倍 |
| 賢者の落とし物 | 基礎ポイント上限 +10/個 | 最大 +10,000 | 最大 +20,000 |
| 禁域の書物 | 基礎ポイント上限 +80/個 | 最大 +80,000 | 最大 +160,000 |
| 禁域のロック | 装備の通常強化上限 +1/個 | 最大 +2,100 | 最大 +3,100 |
| 古のティラピス像 | 天命輪廻倍率を0.00005/個下げる | 最大 -0.05 | 最大 -0.1 |
| 天空像～冒険者～ | 天空回廊で所持数分フロアが進む | 最大 +1,000F | 最大 +2,000F |
| 天空像～悪魔～ | SG撃破時に所持数×100F追加 | 最大 +100,000F | 最大 +200,000F |

データ定義は `static/js/common/game-data.js` の `MATERIALS`。
上限を求めるときは `getMaterialMax(materialId, hasPandora)` を使う。

### 倍率型素材の宣言

「所持数1個につき○○が+n%」型の素材は `MATERIALS` の `apply` に適用先を宣言する。

```js
{ id: "battle_crystal_cube", …, apply: { target: "physicalDamage", perUnit: 0.01 } }
{ id: "magic_crystal_cube",  …, apply: { target: "magicDamage",    perUnit: 0.01 } }
```

- `target` … 適用先の識別子。現在は `physicalDamage` / `magicDamage`
- `perUnit` … 1個あたりの倍率の増分
- `combine` … 同じ `target` の素材が複数あるときの合成方法。
  省略時は `"multiply"`（`1 + 所持数 × perUnit` の積）。
  `"add"` を指定した素材どうしは増分を合算して1つの括弧にまとめ、
  `multiply` 側の積と掛け合わせる

計算式側は倍率を直接書かず、以下を使う。

- `getMultiplier(target, counts)` … `game-data.js`。所持数は引数で受け取る
- `getMaterialsFor(target)` … `game-data.js`。`target` に紐づく素材定義の一覧
- `materialMultiplier(target, counts)` … `calc-logic.js`。
  パンドラを加味した上限で切り詰めてから `getMultiplier` を呼ぶ
- `collectMaterialCounts(target, provided)` … `calc-logic.js`。
  `provided` に無い素材だけ `ui.slots` の `inputId` からページ上の値を読む

**同じ `target` の倍率型素材を足すときは `MATERIALS` に1件追加するだけでよい。**
計算式側・ツール側のコード変更は不要。

対象外（構造が特殊なため個別実装のまま）:
ゴッドオブデビルアイ（定数項1.5がある）／解析書系（素材間依存）／
振り分けポイント系（適用順序が結果を変える）／禁域の液体（未実装）

### 実装に残っているクランプ値との対応

`MATERIALS` はまだ計算側から参照されていないため、各ツールには個別のクランプが残っている。
数値の意味が上記モデルと一致しないものがあるので注意。

✅ すべて解消済み。`calc-logic.js` の各計算は `materialCap()` 経由で
パンドラの状態を加味した上限を使い、`guide-floor-calc.js` の天空像も連動する。
ハードコードされていた 2000 / 10000 / 80000 / 1000 / 11.0 はすべて置き換えた。

---

## 天空回廊

- 敵レベル = `10000 + 現在の階層 × 100`
- 片側全滅で+1F、両側で+2F
- 100層ごとにスカイガーディアン（撃破で+99F）
- ボスフロア: 1万・10万・100万・1000万F
- ワープ①（指定ワープ）: 最高到達フロア-10万F（1万の倍数）へワープ。ボスフロアに降りても通常エリア扱い
- ワープ②（麒麟ワープ）: 100万Fの麒麟に直行

### 天空像を使った周回の進行

1回の移動は、現在地がボスフロアかどうかで2種類に分かれる。
A = 天空像～悪魔～、B = 天空像～冒険者～ の所持数。

| 種類 | 条件 | 進行 |
|---|---|---|
| 通常サイクル | 現在地がボスフロア以外 | `100 + B + 100×A` F（片側撃破+1、冒険者+B、SG撃破+99、悪魔+100×A） |
| ボスサイクル | 現在地がボスフロア | `2B` F |

ボスサイクルは、ボス討伐後の移動が通常移動でSGが出ないため悪魔像が乗らない。
`+1 + B` で100の倍数から外れるので、1Fスタートと同じく2個置きで `+1 + (B-2)` を足して
合計 `2B` になる。

- Bは100の倍数に限る。通常サイクルが100の倍数になりSGが出現し続けるため
- ボスフロアの間隔は1万Fで `2B` は1万F未満のため、ボスサイクルは連続しない
- B = 0 のときボスサイクルは0Fとなり進めない（その編成は不成立）
- 実装: `guide-floor-calc.js` の `simulate()`。割り切れ判定ではなく1回ずつ進めて判定する

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
- 生文字列で保存するキーは `calc_active_tab` のみ。これだけ封筒の対象外
- `onceworld_origin_exp` は boolean で保存する。旧形式の `"1"` / `"0"` は
  `MIGRATIONS` の v0→v1 で boolean に変換されるため、読み込み側は boolean だけ見ればよい

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

`content/monster/NNN.md` が141件。IDは3桁ゼロ埋めで、欠番がある（001〜254）。

フロントマターのフィールド:

| フィールド | 内容 |
|---|---|
| `id` / `title` / `image` | IDはファイル名と一致。画像は `img/monster/NNN.png` |
| `element` / `attack_type` / `attack_range` | 火水木光闇 / 物理・魔法 / 近距離・遠距離 |
| `exp` / `gold` / `capture_rate` / `drop_rate` | 捕獲率とドロップ率は% |
| `drops` | 通常ドロップの配列 |
| `drop_ex` | オーバーキル時に確率でドロップする素材（単数・無ければ書かない） |
| `locations` | 出現場所 |
| `pet_skill_pattern` | `early` / `late`。ペットスキルの解放レベル |
| `level_shortcuts` | `[[level_shortcuts]]` のTOMLテーブル配列。**無くても `= []` を必ず書く** |
| `[status]` / `[fixed_status]` | 7ステ / mov |

- **`[[level_shortcuts]]` は必ず閉じ `+++` より前に書く。**
  外に出るとTOMLとして解釈されず、エラーにもならず静かに消える（過去に2件発生）
- モンスターを追加するときは `content/monster/NNN.md` と
  `static/db/pet-skills.json` の**両方**にIDを足す。
  片方だけでもビルドは通るが、ペット欄に出ない

### ペットスキル

実体は `static/db/pet-skills.json`。モンスターIDをキーに、段階を配列で持つ。

```json
"001": [
  {"add": {"vit": 140}},
  ...
  {"final_mul": {"vit": 350}}
]
```

- 最大5段階。末尾の未設定段階は配列に入れない。
  途中の空欄は `{}` を置く（表示は「—」）
- 効果は `add`（加算）/ `mul`（倍率）/ `final_mul`（最終倍率）の3種
- **倍率は百分率で保存する**（`{"mul":{"atk":5}}` = +5%）
- ただし `sp`（SP回復）は割合ではなく実数。`pet-skills.js` の
  `FLAT_STATS` に入っており、`mul` でも % を付けずに表示する
- ステシミュは `vit,spd,atk,int,def,mdef,luk,mov` しか合算しない。
  `exp` / `capture` / `drop` / `heal` / `sp` は詳細ページの表示専用

解放レベルは `data/pet-skill-patterns.yaml` に2パターン。

```yaml
early: [31, 71, 121, 181, 2200]
late:  [200, 500, 800, 1200, 2200]
```

- 配列の要素数がそのまま段階数になり、段階セレクトの選択肢もここから生成する
- JS側の段階数は `status-sim.js` の `PET_SKILL_STAGES`。値を変えたら揃えること
- `monsters-data.js` と `pet-names/index.json` の両方に解決済みの
  `pet_skill_levels` が出力される。ステシミュは `monsters-data.js` を
  読み込まないため、シミュ側の段階ラベルは `pet-names/index.json` を使う
- 段階ラベルは「一段階（Lv31〜）」。モンスター詳細は `common/pet-skills.js` の
  `LEVELS`、シミュは `status-sim.js` の `PET_STAGE_NAMES` と
  `layouts/partials/slots/pet-rows.html` の `$stageNames`。表記を変えたら3箇所揃えること

### 数値入力
- `attachCommaInputBehavior`（`static/js/common/calc-utils.js`）がサイト標準
- 使用条件: `type="text" inputmode="numeric"` が必要

### 素材一覧の並び順
- `weight` の昇順で表示
- 中間挿入に備えて100刻みで採番する
