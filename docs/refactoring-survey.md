# static/js/ リファクタリング事前調査

調査日: 2026-08-18 / 対象: `static/js/` 配下の全JSファイル 19本・計8,479行
最終更新: 2026-08-18（コミット `5888c18` の修正を反映）

## 対応状況

✅ の付いた項目はコミット `5888c18` で解消済み。未対応の項目は末尾の「6. 残タスク」に集約している。

| 解消済み | 内容 |
|---|---|
| ✅ | HP計算の `+100` 不一致（2.4） |
| ✅ | 会心率の式が仕様と不一致（2.9） |
| ✅ | `fmt` がページによって別実装に解決される（1.4 / 4.2） |
| ✅ | `tenku.js` の `normalizeElement` に「〜属性」形式が無い（1.1） |
| ✅ | モンスターのLv補正が1ずれている（本文追記分） |
| ✅ | `calcCritRate` の二重定義（1.1関連） |
| ✅ | `calcMonsterHp` のインライン式（1.7） |

なお会心率は「敵LUK+1で10%、敵LUK×10で90%、間は線形補間」で仕様確定。
低LUK帯（敵LUKが小さいと補間の刻みが粗い）の誤差は実用上問題なしとして許容する方針。

---

## 0. 全体像

### ファイル一覧（行数降順）

| 行数 | ファイル | 役割 |
|---:|---|---|
| 1580 | `tools/build-sim/build-sim-ui.js` | ビルドシミュ UI |
| 1102 | `tools/status/status-sim.js` | ステータスシミュ（ビルドシミュと共用） |
| 841 | `tools/build-sim/build-sim-logic.js` | ビルドシミュ ロジック |
| 746 | `detail-calc-ui.js` | 詳細計算機 UI |
| 729 | `tenku.js` | 天空回廊計算表 |
| 662 | `tools/calc/calc-ui.js` | 統合計算機 UI |
| 524 | `equipment-db.js` | 装備DB |
| 514 | `tools/exp-calc/exp-calc.js` | 必要経験値計算機 |
| 330 | `guide-floor-calc.js` | 階層到達早見表 |
| 326 | `monster-base-stats.js` | モンスター基礎ステ表 |
| 263 | `pet-sim.js` | ペットステシミュ |
| 230 | `common/calc-logic.js` | **共通計算ロジック** |
| 196 | `common/build-card.js` | ビルド画像生成 |
| 154 | `common/monster-level.js` | モンスター詳細のLv連動 |
| 88 | `common/pet-skills.js` | ペットスキル表示 |
| 73 | `common/calc-utils.js` | **共通UIユーティリティ** |
| 60 | `common/header-nav.js` | ハンバーガーメニュー |
| 32 | `common/number-format.js` | `.n` 要素の数値整形 |
| 29 | `common/help-drawer.js` | ヘルプドロワー |

### モジュールパターンが3種類混在している

リファクタリングの前提として最も重要な構造的事実。

| パターン | 該当ファイル | 外部からの可視性 |
|---|---|---|
| **A. 素のグローバル**（ラップなし） | `common/calc-logic.js`, `common/calc-utils.js`, `tools/build-sim/build-sim-logic.js` | 全関数がグローバル。共有ライブラリ層として機能している |
| **B. IIFE** | `common/header-nav.js`, `help-drawer.js`, `number-format.js`, `monster-level.js`, `pet-skills.js`, `build-card.js`, `monster-base-stats.js` | 完全に閉じている（明示的な `window.*` 代入を除く） |
| **C. DOMContentLoadedコールバック** | `detail-calc-ui.js`, `tools/calc/calc-ui.js`, `tools/status/status-sim.js`, `tools/build-sim/build-sim-ui.js`, `tools/exp-calc/exp-calc.js`, `pet-sim.js`, `tenku.js`, `equipment-db.js` | **関数スコープに閉じている**。ファイル内の `const`／`function` は他ファイルから見えない |

パターンCのファイルは全体が `document.addEventListener("DOMContentLoaded", ...)` のコールバック内にあるため、
ファイル冒頭に見える `const EQUIP_URL = ...` などは**グローバルではなく関数スコープ**である。
そのため同名宣言が複数ファイルにあっても `SyntaxError` にはならない（後述4.1参照）。

### パターンC同士の連携は `window.*` 経由のみ

| 提供元 | エクスポート | 消費側 |
|---|---|---|
| `status-sim.js:744` | `window.statusSimRecalc` | （外部呼び出しなし） |
| `status-sim.js:896` | `window.statusSimCollectState` | （外部呼び出しなし） |
| `status-sim.js:902` | `window.statusSimGetEffectiveMul` | `build-sim-ui.js:683, 907, 1075`（3箇所とも `typeof` ガード付き） |
| `status-sim.js:897` | `window.petNameMapGlobal` | — |
| `status-sim.js:898` | `window.equipmentMapGlobal` | — |
| `status-sim.js:655` | `window.lastFinalTotal` | — |
| `number-format.js:27` | `window.formatNumbers` | `monster-level.js:100`（`typeof` ガード付き） |
| `number-format.js:28` | `window.fmt` | 後述4.2の衝突源 |
| `monster-base-stats.js:311` | `window.mbsUpdateSpdMult` | HTMLの `onclick` から |

`build-sim-ui.js` が `status-sim.js` の関数を使えるのは、
両者の DOMContentLoaded ハンドラが**登録順に発火する**ことに依存している
（`build-sim.html` 内で status-sim.js が先に読み込まれる）。暗黙的で壊れやすい。

### ページ別スクリプト読み込み順

| ページ / レイアウト | 読み込み順 |
|---|---|
| `_default/baseof.html`（全ページ） | `common/header-nav.js` |
| `index.html` | `common/help-drawer.js` |
| `monster/single.html` | `pet-skills.js` → `monster-level.js` → `number-format.js` |
| `tools/calc.html` | `calc-utils.js` → `calc-logic.js` → `tools/calc/calc-ui.js` |
| `tools/calc-wrapper.html` | （partial内のJSが先に出力）→ `calc-utils.js` → `calc-logic.js` → `help-drawer.js` |
| `tools/build-sim.html` | `calc-utils.js` → `number-format.js` → `help-drawer.js` → `calc-logic.js` → `status-sim.js` → `build-sim-logic.js` → `build-sim-ui.js` |
| `tools/exp-calc.html` | `tools/exp-calc/exp-calc.js` のみ |
| `tools/tenku/single.html` | `tenku.js` → `help-drawer.js` |
| `tools/guide/single.html` | `calc-utils.js` → `guide-floor-calc.js` |
| `tools/pet-sim.html` | `pet-sim.js` → `help-drawer.js` |
| `tools/monster-base-stats.html` | `monster-base-stats.js` → `help-drawer.js` |
| `content/tools/status/index.md` | `status-sim.js` → `help-drawer.js` → html2canvas(CDN) → `build-card.js` |
| `content/equipment/index.md` | `equipment-db.js` → `help-drawer.js` |

**注意点2件:**

1. `calc-wrapper.html` では partial（`calc-integrated.html` / `calc-detail.html`）が
   ドキュメント上部に展開されるため、`calc-ui.js` と `detail-calc-ui.js` が
   **依存先の `calc-utils.js` / `calc-logic.js` より先に読み込まれる**。
   両UIファイルが DOMContentLoaded でラップされているため現状は動作しているが、
   依存関係と記述順が逆転している。
2. `content/` 配下の2ファイルは Hugo の `relURL` を使わず
   **相対パス直書き**（`../../js/tools/status/status-sim.js`）。
   ページのURL階層が変わると壊れる。他は全て `relURL` 経由。

---

## 1. 重複定義されている関数

### 1.1 `calc-logic.js` ⇔ `tenku.js` — 5関数の再実装

`tenku/single.html` は `calc-logic.js` を読み込まないため、`tenku.js` が同等の関数を自前で持っている。

| 関数 | calc-logic.js | tenku.js | 差異 |
|---|---|---|---|
| `normalizeElement` | L5 | L102 | ✅ 解消済み（コミット `5888c18`）。内容が一致 |
| `scaleStat` | L58 | L77 | ✅ 両方とも `(Lv-1)` 式に修正済み。内容が一致 |
| `getElementModifier` | L108 | L115相当 | なし |
| `getSpellMultiplier` | L177 | L136相当 | 実質同一（fire/water が default に吸収） |
| `getCrystalMultiplier` | L196 | L153 | なし（引数名のみ） |
| `calcAnalysisBonus` | L189 | L146 | 実質同一（`max(0,…)` の有無のみ） |

**⚠ 重複そのものは未解消。** 6関数すべてが2ファイルに存在する状態は変わっていない。
内容が揃ったことで当面の挙動差は無くなったが、片方だけ直す事故のリスクは残る。

補足: `content/monster/` の137件は `element` が全て漢字1文字（火/水/木/光/闇）のみで、
「〜属性」形式は使われていない。当時の `normalizeElement` の差異も実害は出ていなかった。

**✅ 解消済み — `normalizeElement` の内容差（コミット `5888c18`）**

`tenku.js` 側に「火属性」形式のキー5件を追加し、`calc-logic.js` 版と同内容に揃えた。

### 1.2 `build-sim-logic.js` ⇔ `status-sim.js` — 振り分けポイント計算の完全クローン

**最も規模が大きい重複。**関数名だけ `ss` プレフィックスで変えてあるため名前ベースの検索では見つからない。

| build-sim-logic.js | status-sim.js | 内容 |
|---|---|---|
| `calcTotalStatPoints` (L124-157) | `ssTotalStatPoints` (L795-812) | 振り分けポイント総量。ロジック・定数とも完全一致 |
| `calcBasePointLimit` (L159-168) | `ssBasePointLimit` (L815-823) | 基礎ポイント上限。完全一致 |

両者は `build-sim.html` に**同時に読み込まれている**（`build-sim-logic.js` の
`calcTotalStatPoints` はグローバル、`ssTotalStatPoints` は関数スコープ）。
式を変更する際は2箇所を同時に直す必要がある。

### 1.3 `normalizeJP` — 6ファイルに同一実装

`status-sim.js:69` / `build-sim-ui.js:270` / `calc-ui.js:209` / `detail-calc-ui.js:234` / `pet-sim.js:179` / `exp-calc.js:168`

カタカナ→ひらがな変換 + 小文字化。**`pet-sim.js` と `exp-calc.js` の2本のみ `.trim()` を行わない**（他4本は行う）。
いずれも関数スコープのため衝突はしないが、共通化の第一候補。

### 1.4 `fmt` — 4種類の異なる実装（当初5種類）

| ファイル | 挙動 |
|---|---|
| `common/calc-utils.js:69` | `Math.floor` してから `toLocaleString("ja-JP")` |
| `common/build-card.js:28` | `floor` せず `toLocaleString("ja-JP")` |
| `tenku.js:95` | 非有限値を `"—"` で返す。ロケール指定なし |
| `tools/exp-calc/exp-calc.js:8` | **BigInt + 万/億/兆/京…無量大数の漢数字単位** |

**✅ 解消済み — `window.fmt` による上書き（コミット `5888c18`）**

`common/number-format.js:28` の `window.fmt = formatValue;` を削除した。
どこからも参照されていない死んだエクスポートで、唯一の作用が
`build-sim.html` で `calc-utils.js` の `fmt` を上書きすることだった（詳細は4.2）。
`formatValue` は同ファイル内の `formatNode` が使い続けている。

**⚠ 残る4実装は未統合。** 同名で挙動が4通りある状態は変わっていない。
ただし1ページに2つ以上ロードされる組み合わせは現在存在しないため、実害は出ていない。

### 1.5 UI補助関数の重複

| 関数 | 定義ファイル数 | ファイル |
|---|---:|---|
| `closeSuggest` | 4 | `detail-calc-ui.js`, `pet-sim.js`, `build-sim-ui.js`, `calc-ui.js` |
| `openSuggest` | 4 | 同上 |
| `applyModeUI` | 3 | `detail-calc-ui.js`, `build-sim-ui.js`, `calc-ui.js` |
| `setPressed` | 3 | 同上 |
| `saveState` / `loadState` | 2 | `detail-calc-ui.js`, `calc-ui.js` |
| `loadBuilds` | 2 | `detail-calc-ui.js`, `calc-ui.js` |
| `setDebuffButtons` | 2 | `detail-calc-ui.js`, `calc-ui.js` |
| `initBuildImport` | 2 | `detail-calc-ui.js`, `calc-ui.js` |
| `filterMonsters` | 2 | `detail-calc-ui.js`, `calc-ui.js` |
| `setHiddenForce` | 2 | `detail-calc-ui.js`, `calc-ui.js` |
| `renderShortcuts` | 2 | `build-sim-ui.js`, `calc-ui.js` |
| `openPetSuggest` | 2 | `exp-calc.js`, `status-sim.js` |
| `renderTable` | 2 | `tenku.js`, `status-sim.js` |
| `showResult` | 2 | `guide-floor-calc.js`, `exp-calc.js` |
| `clampLv` | 2 | `monster-level.js`, `status-sim.js` |
| `getLv` | 2 | `pet-sim.js`, `tenku.js` |
| `$`（`getElementById` ラッパ） | 多数 | ほぼ全UIファイルが各自定義 |

`detail-calc-ui.js` と `calc-ui.js` は**統合計算機と詳細計算機という別物**（CLAUDE.md記載の注意点）だが、
UI骨格レベルでは9関数が重複している。

### 1.6 ステータスキー配列の重複

```js
["vit","spd","atk","int","def","mdef","luk"]
```
- `monster-base-stats.js:32` … `SCALE_KEYS`
- `pet-sim.js:3` … `STAT_KEYS`（`var`）
- `status-sim.js:314` … `STAT_KEYS`（`const`）
- `status-sim.js:3` … `BASE_STATS`
- `status-sim.js:2` … `STATS`（`mov` を含む8要素版）

### 1.7 計算式のインライン再実装

共通関数があるのに呼ばずに式を直接書いている箇所。

| 式 | 共通関数 | インライン箇所 |
|---|---|---|
| ~~`floor(vit × (1 + lv×0.1))`~~ | `scaleStat`（calc-logic.js） | ✅ 解消済み（コミット `5888c18`）。`build-sim-logic.js:8` は `scaleStat` を呼ぶようになった |
| 魔法ダメージ `(INT+bonus)×1.25×…` | `calcMagicDamageRange` | ⚠ 未対応: `tenku.js:167, 179`, `detail-calc-ui.js:670`, `build-sim-logic.js:112` |

---

## 2. ハードコードされたゲーム定数

いずれも名前付き定数ではなくリテラル直書き。ファイル横断で同じ値が散在している。

### 2.1 ダメージ計算（`common/calc-logic.js`）

| 値 | 意味 | 箇所 |
|---:|---|---|
| `1.75` | 物理ATK係数 | L122, L139 |
| `4` | 物理ダメージ係数 | L122, L139 |
| `10` | 敵MDEFの物理防御寄与の除数 | L122, L139 |
| `0.9` / `1.1` | ダメージ乱数の下限・上限 | L125-126, L196-197 |
| `1.25` | 魔法INT係数 | L187, L226 |
| `1.50` | クリティカル基礎倍率 | L112 |
| `0.003` | ゴッドオブデビルアイ 1個あたり | L112 |
| `1000` | ゴッドオブデビルアイ上限 | L111 |
| `0.01` / `11.0` | 立方体 1個あたり / 上限倍率 | L117, L175 |
| `1000` | 闘晶立方体 上限個数 | L116 |
| `101000` | 解析書ボーナス上限 | L151 |
| `10` | 解析書の解析書の除数（`1 + adv/10`） | L169 |
| `1.3` / `0.8` | 属性相性 有利 / 不利 | L97, L105 |
| `0.1` | レベル毎のステータス上昇率 | L59 |
| `7` / `10` / `4` | 無効化必要防御 `(atk×7-10)/4` | L146 |

### 2.2 魔法倍率（`calc-logic.js:154` と `tenku.js` に重複）

| 魔法 | 倍率 |
|---|---:|
| fire / water | 1.0 |
| wood | 1.3 |
| dark | 1.4 |
| light | 2.0 |
| shingan | 0.1 |

### 2.3 多段数しきい値（`calc-logic.js:30` と `:48` に**二重定義**）

`hitsFromSpd`（if連鎖）と `requiredSpdForHits`（テーブル）が同じ数列を別表現で保持:
`3000, 9000, 27000, 81000, 243000, 729000, 2187000, 6561000, 19683000, 59049000`（3の冪 × 3000、最大11段）

### 2.4 HP計算 — ✅ 解消済み（コミット `5888c18`）

当初、モンスター詳細ページ（`monster-level.js`）だけ `+100` が無く、
同じモンスターの実体力が詳細ページと各計算機で100違って表示されていた。

| 修正箇所 | 内容 |
|---|---|
| `common/monster-level.js:16` | `vit * 18` → `100 + vit * 18` |
| `layouts/monster/single.html:52` | Hugoテンプレートにも同じ式が直書きされていたため `add 100 (mul ...)` に修正（`data-base` と表示値の2箇所） |

現在の実装は全5箇所で `100 + VIT × 18`:
`monster-level.js:16`, `build-sim-logic.js:8`, `detail-calc-ui.js:615`, `tenku.js:160`, `calc-ui.js:477`

正しい式は `HP = (100 + VIT × 18) × (1 + 禁域の液体所持数 × 0.01)`。
**禁域の液体（主人公専用・上限1000）の補正はどのツールにも未実装**で、
そもそも主人公HPを表示する画面がサイト内に存在しない。実装するなら置き場所の決定から必要。

### 2.5 振り分けポイント（`build-sim-logic.js:124` / `status-sim.js:795` に重複）

| 値 | 意味 |
|---:|---|
| `200` | キャラLv上限 |
| `30` | 天命・殲儀 回数上限 |
| `floor(l×0.1+5)` | 通常レベルアップ時の獲得pt |
| `floor(l×1.1+3)` | 10の倍数レベル時の獲得pt |
| `300×t²` | 転生の極致ボーナス（t=1〜9） |
| `floor(30000 + 5000×(t-9)^1.25)` | 同（t≧10） |
| `10000` | コスモキューブ 1回あたり |
| `0.01` | ヨハネの羽ペン 1個あたり |
| `0.002` | ヨハネの祭壇 1個あたり |
| `10000` | ステータス天晶 1個あたり |
| `0.002` | スーパースクロール 1個あたり |

### 2.6 基礎ポイント上限（同じく2ファイルに重複）

| 値 | 意味 |
|---:|---|
| `10000` | 基礎値 |
| `10` / 上限`10000` | 賢者の落とし物 1個あたり / 上限 |
| `80` / 上限`80000` | 禁域の書物 1個あたり / 上限 |
| `900000` | 契約 所持時 |
| `1000000` | 天命11回目以降 1回あたり |

### 2.7 経験値（`tools/exp-calc/exp-calc.js`）

| 値 | 意味 | 箇所 |
|---:|---|---|
| `1.05` | 天命・殲儀 基礎倍率 | L69 |
| `0.01` | 天命・殲儀 1回あたり | L69 |
| `0.00005` | 古のティラピス像 1個あたり | L69 |
| `5` | `+ 現在Lv × 5` | L87, L96, L127… |
| `1.1` / `0.2` | 経験値基準値 `floor(Lv^1.1 × 0.2)` | L486 |
| `10` | ペガサスのメダル 1個あたり | L486 |
| `199` | ペットLv200固定化の基準Lv | L129 |

### 2.8 命中率（`build-sim-logic.js:551`）

`0.25 → 1%`, `0.5 → 50%`, `1.0 → 99%` の2区間指数補間。
係数 `_HIT_A1/_HIT_B1/_HIT_A2/_HIT_B2` は `Math.log` から導出。上限 `99`、下限 `1`。

### 2.9 会心率 — ✅ 解消済み（コミット `5888c18`）

当初 `detail-calc-ui.js:170` に `rate = (heroLuk/enemyLuk - 1) × 12.5` という
比率ベースの実装があり、仕様の「10%スタート」と開始値が一致していなかった。

一方 `build-sim-logic.js:181` の `calcCritRate` は既に正しい線形補間で実装されており、
**同じ計算が2ファイルに別々の式で存在**していた（関数名が異なるため当初の調査では取りこぼした）。

修正内容:
- 正しい実装を `common/calc-logic.js` へ移動して一本化
  （`calcCritRate` L117 / `requiredLukForCritRate` L126）
- `build-sim-logic.js` と `detail-calc-ui.js` のローカル実装を削除
- 敵LUK = 0 のときは90%に統一（`自LUK ≥ 敵LUK × 10` を満たすため）

確定した仕様:
```
自LUK ≤ 敵LUK      → 0%
自LUK = 敵LUK + 1  → 10%
自LUK ≥ 敵LUK × 10 → 90%（上限）
間                 → floor(10 + (自LUK - 敵LUK - 1) / (敵LUK × 10 - 敵LUK - 1) × 80)
```
敵LUKが小さいと補間の刻みが粗くなる（敵LUK=1なら9段階のみ）が、
実用上問題なしとして許容する方針で確定済み。

### 2.10 天空回廊

| 値 | 意味 | 箇所 |
|---:|---|---|
| `[10000, 100000, 1000000, 10000000]` | ボスフロア | `guide-floor-calc.js:35` |
| `2000` | 天空像～悪魔～ 上限 | `guide-floor-calc.js:34`（`MAX_B`） |
| `2000` | 天空像～冒険者～ 上限 | `guide-floor-calc.js:319`（**直書き。`MAX_A` 定数がない**） |
| `30` | 表示件数 | `tenku.js:37`（`TOP_N`） |
| `99999` | 安全フロア上限 | `tenku.js:38`（`SAFE_MAX_F`） |
| `["226"]` | スカイガーディアンのID | `tenku.js:20`（`SG_IDS`） |

`EXCLUDED_IDS` / `SPECIAL_IDS` / `MAGIC_IMMUNE_IDS`（`tenku.js:12-35`）は
モンスターIDのハードコード配列。データ側ではなくJS側に持っている。

### 2.11 装備・その他

| 値 | 意味 | 箇所 |
|---:|---|---|
| `10000000` | 強化コスト基準（S × 1,000万G） | `equipment-db.js:105`, `build-sim-logic.js:240, 379` |
| `300` | 神階レベル上限 | `equipment-db.js:245`, `build-sim-logic.js:279, 401…` |
| `1100` | キャラLv上限（逆算用） | `build-sim-logic.js:349, 426, 602, 706` |
| `10` | SPD倍率上限 | `monster-base-stats.js:304` |
| `11` | 多段数上限 | `build-sim-ui.js:375` |

---

## 3. localStorage キー一覧

全7キー。すべて `try/catch` で保護されている（プライベートブラウジング対策）。

| キー | 定義箇所 | 保存内容 |
|---|---|---|
| `onceworld_origin_exp` | `common/monster-level.js:5` | 「経験の起源」チェック状態。**文字列 `"1"` / `"0"`**（他は全てJSON） |
| `calc_state_v5` | `tools/calc/calc-ui.js:19` | 統合計算機。`{ monster_id, lv, hero:{atk,int,spd,analysisBook,analysisBookAdvanced,crystalCount}, state }` |
| `detail_calc_state_v1` | `detail-calc-ui.js:24` | 詳細計算機。`{ hero, enemy, lv, monster_id, state }`（heroはVIT〜LUK全7ステ+解析書2種+立方体） |
| `status_sim_inline_v7` | `tools/status/status-sim.js:7` | ステシミュ作業状態。`{ basePointTotal, statPointTotal, base{7ステ}, shaker, protein{7ステ}, equip{10スロット×(id,lv,glv)}, pet{3枠×(id,stage)} }` |
| `status_sim_build_slots_v1` | `status-sim.js:8` / `detail-calc-ui.js:25` / `calc-ui.js:613` | **名前付きビルドの保存スロット**。`{ ビルド名: state }` |
| `build_sim_state_v1` | `tools/build-sim/build-sim-ui.js:8` | ビルドシミュ。`{ state, pointLimit, statPoint }` |
| `status_sim_ss_calc_v1` | `status-sim.js:748` | ステシミュの振り分けポイント計算欄。`{ charaLv, spTenme, penCount, altarCount, tenshoCount, scrollCount, hasCosmoCube, sageDrop, forbiddenBook, tenmeCount, hasContract }` |
| `exp_calc_hunt_v1` | `tools/exp-calc/exp-calc.js:346` | 討伐数計算。`{ kigen, medal, zipang, luminous, house }` |
| `calc_active_tab` | `layouts/tools/calc-wrapper.html`（**HTML内インライン**） | 選択中タブ（`"integrated"` / `"detail"`） |

### 気づいた点

1. **`status_sim_build_slots_v1` のキー文字列が3ファイルに直書き**されている
   （`status-sim.js:8`, `detail-calc-ui.js:25`, `calc-ui.js:613`）。定数の共有先がない。
2. **`status_sim_ss_calc_v1` に冗長フィールド**: `spTenme` と `tenmeCount` が
   どちらも `$("ss-sp-tenme-count")` から読まれている（`status-sim.js:757, 766`）。
   さらに `tenmeCount` は `loadSsCalc()` で復元されておらず、書き込み専用になっている。
3. `calc_active_tab` のみJSファイルではなくレイアウトHTMLに埋め込まれている。
4. バージョン接尾辞の付け方が不統一（`_v1` / `_v5` / `_v7` / 接尾辞なし）。
   マイグレーション処理はどのキーにも存在せず、スキーマ変更時は暗黙的に初期化される。

---

## 4. 計算関数の呼び出し関係

### 4.1 共通コア関数の呼び出しマトリクス

`common/calc-logic.js` + `common/calc-utils.js` の関数が、どのファイルから何回呼ばれているか。

| 関数 | detail-calc-ui | calc-ui | build-sim-logic | build-sim-ui | tenku | guide-floor | build-card | exp-calc |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `parseFormattedInt` | 23 | 6 | | 3 | | | | |
| `attachCommaInputBehavior` | 2 | 7 | | 1 | | 4 | | |
| `formatIntString` | 6 | 10 | | 3 | | | | |
| `normalizeFormattedNonNegIntValue` | | 6 | | | | | | |
| `normalizeLv` | | 1 | | | | | | |
| `scaleStat` | 8 | | | | 15※ | | | |
| `buildEnemyScaled` | | 7 | 4 | 4 | | | | |
| `hitsFromSpd` | 2 | 1 | 2 | | | | | |
| `requiredSpdForHits` | | | | 2 | | | | |
| `damageRangeTotal` | 2 | 1 | 1 | | | | | |
| `oneShotLineRequiredAttack` | 2 | 2 | 1 | | | | | |
| `requiredDefenseForNullify` | 2 | 2 | | | | | | |
| `getElementModifier` | 3 | 1 | 3 | 2 | 2※ | | | |
| `getCriticalModifier` | 1 | 1 | | | | | | |
| `getTouShouMultiplier` | | | 1 | | | | | |
| `getCrystalMultiplier` | 1 | | 1 | | 2※ | | | |
| `getSpellMultiplier` | 1 | | 1 | | 2※ | | | |
| `calcAnalysisBonus` | 1 | | 1 | | 2※ | | | |
| `calcMagicDamageRange` | 2 | 2 | 1 | | | | | |
| `calcMagicOneShotRequiredInt` | 2 | 4 | 1 | | | | | |
| `normalizeElement` | 1 | | | | 4※ | | | |
| `formatMinMax` | 4 | 3 | | | | | | |
| `fmt` | 19 | 16 | | 70 | 5※ | | 3※ | 6※ |

※ = 共通関数ではなく**自ファイル内の同名ローカル実装**を呼んでいる（1.1 / 1.4 参照）。

### 4.2 `fmt` の解決先がページによって変わる — ✅ 解消済み（コミット `5888c18`）

当初、`calc-utils.js` が素のグローバル関数 `fmt` を定義する一方で
`number-format.js` が IIFE 内から `window.fmt` に別実装を代入しており、
両方を読み込むページでは後勝ちになっていた。

| ページ | 読み込み | 当時使われていた `fmt` |
|---|---|---|
| `build-sim.html` | calc-utils(1番目) → number-format(2番目) | **number-format 版**（`floor` しない） |
| `calc.html` / `calc-wrapper.html` | calc-utils のみ | calc-utils 版（`floor` する） |
| `guide/single.html` | calc-utils のみ | calc-utils 版 |
| `monster/single.html` | number-format のみ | number-format 版 |

`build-sim-ui.js` は `fmt` を**70箇所**で呼んでおり、そこで `floor` しない版が
解決されていた。`window.fmt` の代入を削除して `calc-utils.js` 版に統一済み。

表示への影響は無し。`fmt()` に渡っていた引数はLUK・ATK・ポイント等すべて整数で、
％値（`currentRate` / `hitRate` 等）は `fmt` を経由せず直接文字列連結されていた。

### 4.3 ツール別の依存グラフ

```
統合計算機 (calc.html / calc-wrapper.html)
  calc-utils.js ─┐
  calc-logic.js ─┴→ calc/calc-ui.js
                    └→ localStorage: calc_state_v5, status_sim_build_slots_v1(読取)

詳細計算機 (calc-wrapper.html の partial)
  calc-utils.js ─┐
  calc-logic.js ─┴→ detail-calc-ui.js  ※自前: calcCriticalRate, normalizeJP
                    └→ localStorage: detail_calc_state_v1, status_sim_build_slots_v1(読取)

ビルドシミュ (build-sim.html)
  calc-utils.js ┐
  number-format.js ┤ ← fmt 衝突
  calc-logic.js ─┼→ build-sim-logic.js ─┐
  status-sim.js ─┘   （ssTotalStatPoints 重複）├→ build-sim-ui.js
        └ window.statusSimGetEffectiveMul ─────┘
           localStorage: build_sim_state_v1, status_sim_inline_v7, status_sim_build_slots_v1

ステシミュ (content/tools/status/index.md)
  status-sim.js → build-card.js (+html2canvas CDN)
    localStorage: status_sim_inline_v7, status_sim_build_slots_v1, status_sim_ss_calc_v1

天空回廊 (tenku/single.html)
  tenku.js（自己完結。calc-logic.js の5関数を自前で再実装）

必要経験値 (exp-calc.html)
  exp-calc.js（自己完結。fmt / normalizeJP を自前実装）

階層早見表 (guide/single.html)
  calc-utils.js → guide-floor-calc.js

ペットシミュ / 基礎ステ表 / 装備DB / モンスター詳細
  各1ファイルで自己完結
```

### 4.4 ツール間の越境参照

`status-sim.js:437`（`collectState`）が **`bs-stat-point-display`**、
すなわちビルドシミュ側のプレフィックスを持つ要素を直接読んでいる。
ステシミュ単体ページでは存在しないため `basePointTotal` にフォールバックする作りだが、
`ss-` / `bs-` の名前空間分離が崩れている箇所。

---

## 5. HTMLに直書きされている入力欄ID

`layouts/` と `content/` 配下の `<input>` / `<select>` / `<textarea>` から抽出。実数157個。

### 5.1 定義元ファイル

| 個数 | ファイル |
|---:|---|
| 83 | `layouts/tools/build-sim.html` |
| 71 | `content/tools/status/index.md` |
| 21 | `layouts/partials/calc-detail.html` |
| 15 | `layouts/tools/exp-calc.html` |
| 10 | `layouts/tools/tenku/single.html` |
| 10 | `layouts/partials/calc-integrated.html` |
| 9 | `layouts/tools/calc.html` |
| 4 | `layouts/tools/pet-sim.html` |
| 3 | `layouts/tools/monster-base-stats.html` |
| 3 | `layouts/tools/guide/single.html` |
| 2 | `layouts/monster/single.html` |
| 2 | `content/equipment/index.md` |

### 5.2 素材（効果素材）関連の入力欄

| 素材 | ID | 定義元 |
|---|---|---|
| ヨハネの羽ペン | `bs-pen-count` / `ss-pen-count` | build-sim.html / status/index.md |
| ヨハネの祭壇 | `bs-altar-count` / `ss-altar-count` | 同上 |
| ステータス天晶 | `bs-tensho-count` / `ss-tensho-count` | 同上 |
| スーパースクロール | `bs-scroll-count` / `ss-scroll-count` | 同上 |
| 賢者の落とし物 | `bs-sage-drop` / `ss-sage-drop` | 同上 |
| 禁域の書物 | `bs-forbidden-book` / `ss-forbidden-book` | 同上 |
| コスモキューブ | `.ss-cosmocube-btn`（chip-btn／input無し） | status/index.md |
| 契約 | `.ss-contract-btn`（chip-btn／input無し） | status/index.md |
| 闘晶立方体 | `toushou-count` / `detail-toushou-count` / `bs-toushou-count` | calc-integrated / calc-detail / build-sim |
| 魔晶立方体 | `crystal-count` / `detail-crystal-count` / `bs-crystal-count` | 同上 + tenku |
| 解析書 | `analysis-book` / `detail-analysis-book` / `bs-analysis-book` | 同上 |
| 解析書の解析書 | `analysis-book-advanced` / `detail-analysis-book-advanced` / `bs-analysis-book-advanced` / **`analysis-book-adv`** | 同上 + tenku（**tenkuだけ表記が違う**） |
| ゴッドオブデビルアイ | `bs-devil-eye` / `god-eye-0`・`god-eye-1000`（ボタン） | build-sim / calc.html |
| Pシェーカー | `shakerCount` | build-sim / status |
| プロテイン各種 | `protein_vit` `protein_spd` `protein_atk` `protein_int` `protein_def` `protein_mdef` `protein_luk` | build-sim / status |
| ペガサスのメダル | `medalCount` | exp-calc.html |
| ジパングの酒 | `zipangCount` | exp-calc.html |
| ルミナスキノコ | `luminousCount` / `kinokoInput` | exp-calc.html / pet-sim.html |
| キノコハウス | `hasHouse`（ボタン） | exp-calc.html |
| 経験の起源 | `origin-exp`（checkbox） / `hasKigenOn`（ボタン） | monster/single.html / exp-calc.html |
| 古のティラピス像 | `heroTilapia` / `petTilapia` | exp-calc.html |
| 天空像～冒険者～ | `ownedAdventurer` | guide/single.html |
| 天空像～悪魔～ | `ownedDevil` | guide/single.html |

### 5.3 ステータス関連の入力欄

**主人公 基礎ステ（build-sim.html と status/index.md で完全に同一のID）**
`base_vit` `base_spd` `base_atk` `base_int` `base_def` `base_mdef` `base_luk` / `basePointTotal`

**キャラLv・天命**
`bs-chara-lv` / `ss-chara-lv` / `bs-sp-tenme-count` / `ss-sp-tenme-count`

**統合計算機**（`calc-integrated.html`）
`hero-atk` `hero-int` `hero-spd` / `monster-search` `enemy-lv` / `build-import-select`

**詳細計算機**（`calc-detail.html`、全て `detail-` プレフィックス）
自: `detail-hero-vit` `detail-hero-spd` `detail-hero-atk` `detail-hero-int` `detail-hero-def` `detail-hero-mdef` `detail-hero-luk`
敵: `detail-enemy-vit` `detail-enemy-spd` `detail-enemy-atk` `detail-enemy-int` `detail-enemy-def` `detail-enemy-mdef` `detail-enemy-luk` `detail-enemy-lv`
他: `detail-monster-search` `detail-build-import-select`

**装備スロット（10枠 × 4項目、build-sim と status で同一）**
`equip_search_{slot}` `select_{slot}` `level_{slot}` `glevel_{slot}`
slot = `weapon` `head` `body` `hands` `feet` `shield` `accessory1`〜`accessory4`
※アクセサリ4枠のみ `glevel_` がない

**ペット枠（3枠）**
`pet_search_pet1`〜`3` / `select_pet1`〜`3` / `stage_pet1`〜`3`

**ビルド保存**
`buildSlotSelect` `buildNameInput`

**天空回廊**（tenku/single.html）
`tenku-floor` `hero-int` `analysis-book` `analysis-book-adv` `crystal-count` `safe-def` `safe-mdef` `safe-luk` `debuff-dark` `include-ranged`

**必要経験値**（exp-calc.html）
`heroFromLv` `heroToLv` `heroTenme` / `petMonsterSearch` `petFromLv` `petToLv` `petTenme` / `huntMonsterSearch` `monsterBaseExp` `huntMonsterLv`

**その他**
`monster-level` `origin-exp`（monster詳細） / `mbsSearch` `mbsCompactToggle` `mbsLevelInput`（基礎ステ表） /
`lvInput` `sengiInput`（ペットシミュ） / `gLevelInput` `gLevelSlider`（装備DB） / `warpFloor`（階層早見表） /
`bs-npan-limit` `bs-reverse-monster-search` `bs-reverse-lv` `bs-tenku-floor` `bs-reverse-npan` `bs-reverse-hits` `bs-reverse-crit`（ビルドシミュ逆算）

### 5.4 ID設計上の問題

1. **`build-sim.html` と `content/tools/status/index.md` が63個のIDを共有している。**
   `basePointTotal`, `base_*`, `protein_*`, `shakerCount`, `equip_search_*`, `select_*`,
   `level_*`, `glevel_*`, `pet_search_*`, `stage_*`, `buildSlotSelect`, `buildNameInput` が
   レイアウトHTMLとMarkdownコンテンツに**二重にベタ書き**されている。
   `status-sim.js` が両方を駆動しているためIDを揃える必要があるが、
   HTML構造の変更時は2ファイルを手作業で同期させることになる。

2. **`calc.html` に `toushou-count` が無い。**
   `calc-integrated.html`（partial）には闘晶立方体の入力欄があるが、
   同じ `calc-ui.js` を読み込む `calc.html` には存在しない（他9個のIDは一致）。
   同一UIの2コピーが分岐している。

3. **命名規則が4系統混在。**
   - プレフィックス付きケバブ: `bs-pen-count`, `ss-pen-count`, `detail-hero-atk`
   - プレフィックスなしケバブ: `hero-atk`, `crystal-count`, `monster-search`
   - スネークケース: `base_vit`, `equip_search_weapon`, `select_pet1`
   - キャメルケース: `basePointTotal`, `shakerCount`, `medalCount`, `heroFromLv`

4. **`analysis-book-advanced` と `analysis-book-adv` の表記ゆれ**（tenku のみ後者）。

5. **`hero-int` / `analysis-book` / `crystal-count` が tenku と統合計算機で同名。**
   別ページなので衝突はしないが、共通コンポーネント化する際は名前空間の整理が必要。

### 5.5 input type が CLAUDE.md の規約と乖離

CLAUDE.md は数値入力の標準を「`type="text" inputmode="numeric"` + `attachCommaInputBehavior`」と定めているが、実際の分布は:

| type | 個数 |
|---|---:|
| `number` | 114 |
| `text` | 43（うち `inputmode="numeric"` は42） |
| `search` | 33 |
| `radio` | 25 |
| `checkbox` | 4 |
| `range` | 1 |

`type="number"` が残っているファイル:
`build-sim.html`, `exp-calc.html`, `monster-base-stats.html`, `pet-sim.html`,
`tenku/single.html`, `content/equipment/index.md`, `content/tools/status/index.md`

直近のコミット（`c24565c` "Change input types from number to text for fields"）で
移行が始まっているが、規約に沿っているのは全体の約4分の1にとどまる。

---

## 6. 残タスク

コミット `5888c18` 時点で未対応の項目。

### ✅ 完了済み（参考）

挙動の差が出ていた5件はすべて解消した。着手前の判断が必要な既知バグは現在ゼロ。

| 項目 | 参照 |
|---|---|
| ✅ HP計算の `+100` 不一致 | 2.4 |
| ✅ 会心率の式が仕様と不一致 | 2.9 |
| ✅ `fmt` の解決先がページで変わる | 1.4 / 4.2 |
| ✅ `tenku.js` の `normalizeElement` の内容差 | 1.1 |
| ✅ モンスターのLv補正が1ずれ | 下記「補足」 |
| ✅ `calcCritRate` の二重定義 | 2.9 |
| ✅ `calcMonsterHp` のインライン式 | 1.7 |

---

### A. 構造的な重複（効果が大きい順）

| # | 内容 | 参照 | 規模 |
|---|---|---|---|
| A-1 | **`ssTotalStatPoints` / `ssBasePointLimit` の解消**<br>`build-sim-logic.js` と `status-sim.js` に完全クローンが存在。式変更時に2箇所直す必要がある | 1.2 | 約50行 |
| A-2 | **`tenku.js` の6関数を `calc-logic.js` に寄せる**<br>tenku ページに `calc-logic.js` を読み込ませれば削除できる。内容は揃えてあるので今なら安全に統合可能 | 1.1 | 6関数 |
| A-3 | **`normalizeJP` の共通化**<br>6ファイルに同一実装（`pet-sim.js` / `exp-calc.js` のみ `.trim()` 無し） | 1.3 | 6箇所 |
| A-4 | **UI補助関数の共通化**<br>`openSuggest` / `closeSuggest` / `applyModeUI` / `setPressed` / `$` など | 1.5 | 16関数 |
| A-5 | **`fmt` の一本化**<br>残4実装。用途別に `fmtInt` / `fmtPlain` / `fmtJapaneseUnit` へ改名するのが安全 | 1.4 | 4箇所 |
| A-6 | **魔法ダメージ式のインライン再実装の解消**<br>`calcMagicDamageRange` があるのに直接書いている箇所が3ファイル4行 | 1.7 | 4箇所 |
| A-7 | **ステータスキー配列の共通化**<br>`STAT_KEYS` / `SCALE_KEYS` / `BASE_STATS` / `STATS` が5箇所に散在 | 1.6 | 5箇所 |

### B. 定数の外出し

| # | 内容 | 参照 |
|---|---|---|
| B-1 | **`common/game-constants.js` の新設**。特に振り分けポイント系（2.5 / 2.6）は2ファイルに散っており最優先。CLAUDE.md の記載値との突き合わせも同時にできる | 2章全体 |
| B-2 | 多段数しきい値が `hitsFromSpd`（if連鎖）と `requiredSpdForHits`（テーブル）に二重定義 | 2.3 |
| B-3 | `guide-floor-calc.js:319` の天空像～冒険者～上限 `2000` が直書き（`MAX_B` に相当する `MAX_A` 定数が無い） | 2.10 |
| B-4 | `tenku.js` のモンスターID配列（`EXCLUDED_IDS` / `SPECIAL_IDS` / `MAGIC_IMMUNE_IDS` / `SG_IDS`）がJS側にハードコード。データ側へ移すか検討 | 2.10 |

### C. HTML / テンプレート

| # | 内容 | 参照 |
|---|---|---|
| C-1 | **`build-sim.html` と `content/tools/status/index.md` のHTML二重管理**。63個のIDがレイアウトとMarkdownに二重にベタ書き。Hugo の partial に切り出せば1箇所になる | 5.4-1 |
| C-2 | `calc.html` と `calc-integrated.html` の統合。同じ `calc-ui.js` を読むのに `calc.html` だけ `toushou-count` が欠落している | 5.4-2 |
| C-3 | `content/` 配下の相対パス `<script src="../../js/...">` を `relURL` に統一（2ファイル） | 0章 注意点2 |
| C-4 | `type="number"`（114個）→ `type="text" inputmode="numeric"`（現在42個）の移行完了 | 5.5 |
| C-5 | ID命名規則が4系統混在（ケバブ / プレフィックス付きケバブ / スネーク / キャメル）。`analysis-book-advanced` と `analysis-book-adv` の表記ゆれも | 5.4-3,4 |
| C-6 | `calc-wrapper.html` の読み込み順逆転。partial の UI JS が依存先の `calc-utils.js` / `calc-logic.js` より先に出力される（DOMContentLoaded で救われているだけ） | 0章 注意点1 |

### D. localStorage

| # | 内容 | 参照 |
|---|---|---|
| D-1 | `status_sim_build_slots_v1` のキー文字列が3ファイルに直書き | 3章 気づいた点1 |
| D-2 | `status_sim_ss_calc_v1` の `tenmeCount` が `spTenme` と重複し、かつ復元されない書き込み専用フィールドになっている | 3章 気づいた点2 |
| D-3 | キーのバージョン接尾辞が不統一（`_v1` / `_v5` / `_v7` / 無し）。マイグレーション処理がどのキーにも無い | 3章 気づいた点4 |

### E. 未実装

| # | 内容 | 参照 |
|---|---|---|
| E-1 | **禁域の液体（主人公HP +1%/個・上限1000）が未実装**。そもそも主人公HPを表示する画面がサイト内に存在しないため、置き場所の決定から必要 | 2.4 |

### F. ツール間の結合

| # | 内容 | 参照 |
|---|---|---|
| F-1 | `status-sim.js` の `collectState` がビルドシミュ側の `bs-stat-point-display` を直接読んでおり、`ss-` / `bs-` の名前空間分離が崩れている | 4.4 |

---

### 着手前に決めておくべきこと

- **モジュール方式を揃えるか**（現状A/B/Cの3パターン混在）。
  ES Modules へ移行すればグローバル汚染と読み込み順の問題（C-6）が同時に解決するが、
  Hugo の `relURL` + `<script type="module">` への一括変更になる。
- **localStorage のスキーマ変更方針**（D-3）。
  マイグレーション処理が無いため、リファクタリングで保存形式が変わると
  ユーザーの保存データが失われる。先に読み込み側の後方互換を用意するべき。

---

## 補足: モンスターのLv補正 — ✅ 解消済み（コミット `5888c18`）

当初、モンスターのステータスLv補正が2系統に分かれていた。

| 式 | 箇所 |
|---|---|
| `floor(base × (1 + (Lv-1) × 0.1))`（正） | `common/monster-level.js:14` |
| `floor(base × (1 + Lv × 0.1))`（誤・1レベル分ずれ） | `calc-logic.js:58`, `tenku.js:77`, `monster-base-stats.js:56`, `build-sim-logic.js:7` |

wiki の「モンスターはステータスが基礎値×(1+(Lv.-1)×0.1)増加する」を根拠に計算機側を修正し、
4実装すべてがLv1〜999で完全一致することを確認済み（Lv1で等倍・Lv2で1.1倍・Lv11で2倍）。

ツール内部で `lv = 0` は「基本」表示用の値（`build-sim-logic.js:59` の
`{lv: 0, label: "基本"}`）なので、`Math.max(1, lv)` でクランプしてLv1と同じ等倍に揃えてある。

**既知の許容誤差:** 計算結果がちょうど整数になるケースで、ゲーム内表示と最大1の差が出る場合がある
（ゲーム側の浮動小数点処理による。振り分けポイントと同種の誤差）。実測7件中6件が完全一致。

装備・アクセサリ・ペットのLv補正は**別系統**のため今回の修正対象外
（`status-sim.js:124, 142`、`build-sim-logic.js` の装備レベル計算8箇所、`pet-sim.js:113`）。
