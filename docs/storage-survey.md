# localStorage 調査と共通化の設計案

調査日: 2026-08-18 / 対象: `static/js/` `layouts/` `content/` 配下の全localStorage利用箇所

このドキュメントは**調査と設計案のみ**で、コードの変更は一切行っていない。

---

## 1. 全localStorageキーと保存内容の構造

現在9キー。うち1つ（`calc_active_tab`）のみJSではなくレイアウトHTMLのインラインscriptにある。

### 1.1 一覧

| # | キー | 定義箇所 | 用途 | 値の型 |
|---|---|---|---|---|
| 1 | `onceworld_origin_exp` | `common/monster-level.js:5` | 「経験の起源」チェック状態 | **文字列 `"1"` / `"0"`** |
| 2 | `calc_state_v5` | `tools/calc/calc-ui.js:19` | 統合計算機の入力状態 | JSON |
| 3 | `detail_calc_state_v1` | `detail-calc-ui.js:24` | 詳細計算機の入力状態 | JSON |
| 4 | `status_sim_inline_v7` | `tools/status/status-sim.js:7` | ステシミュの作業状態 | JSON |
| 5 | `status_sim_build_slots_v1` | `status-sim.js:8` ほか2箇所 | 名前付きビルドの保存スロット | JSON |
| 6 | `status_sim_ss_calc_v1` | `status-sim.js:748` | ステシミュの振り分けPt計算欄 | JSON |
| 7 | `build_sim_state_v1` | `tools/build-sim/build-sim-ui.js:8` | ビルドシミュの状態 | JSON |
| 8 | `exp_calc_hunt_v1` | `tools/exp-calc/exp-calc.js:346` | 討伐数計算の設定 | JSON |
| 9 | `calc_active_tab` | `layouts/tools/calc-wrapper.html:43` | 選択中タブ | **文字列 `"integrated"` / `"detail"`** |

`onceworld_origin_exp` と `calc_active_tab` だけが生文字列で、残り7つはJSON。

### 1.2 各キーの構造

#### `calc_state_v5` — 統合計算機

```js
{
  monster_id: "",          // 選択中モンスターID
  lv: 1,                   // 敵Lv
  hero: {
    atk, int, spd,
    analysisBook, analysisBookAdvanced, crystalCount   // すべて文字列（正規化済み整数）
  },
  state: {
    heroElement, attackType, spell,
    debuffWood, debuffDark, critical, godEyeCount
  }
}
```

#### `detail_calc_state_v1` — 詳細計算機

```js
{
  monster_id: "",
  lv: 1,
  hero:  { vit, spd, atk, int, def, mdef, luk, analysisBook, analysisBookAdvanced, crystalCount },
  enemy: { vit, spd, atk, int, def, mdef, luk },
  state: {
    heroElement, attackType, spell, enemyElement, enemyAttackType,
    debuffWood, debuffDark, critical, godEyeCount
  }
}
```

#### `status_sim_inline_v7` — ステシミュ作業状態

```js
{
  basePointTotal: 0,
  statPointTotal: 0,                       // 保存のみ（1.3参照）
  base:    { vit, spd, atk, int, def, mdef, luk },
  shaker:  0,
  protein: { vit, spd, atk, int, def, mdef, luk },
  equip: {
    weapon | head | body | hands | feet | shield : { id, lv, glv },
    accessory1..4                                : { id, lv }      // glv なし
  },
  pets: { pet1, pet2, pet3 : { id, stage } }
}
```

#### `status_sim_build_slots_v1` — 名前付きビルド

```js
{
  "<ビルド名>": {
    // …collectState() と同一構造（status_sim_inline_v7 と同じ）
    finalTotal: { /* 最終ステータス */ }   // このキーにだけ追加される。無い場合は null
  }
}
```

ユーザーが任意の名前を付けたスロットが並ぶ辞書。**3ツールから参照される唯一の共有キー**。

#### `status_sim_ss_calc_v1` — ステシミュ 振り分けPt計算欄

```js
{
  charaLv, spTenme, penCount, altarCount, tenshoCount, scrollCount,
  sageDrop, forbiddenBook,
  hasCosmoCube, hasContract,               // boolean
  tenmeCount                               // 保存のみ・spTenme と重複（1.3参照）
}
```

#### `build_sim_state_v1` — ビルドシミュ

```js
{
  state:      { attackType, heroElement, spell, debuffWood, debuffDark,
                npanLimit, hasContract, hasCosmoCube, reverseHitRate,
                useMinRandom, calcMode, nullifyTarget },   // nullifyTarget は保存のみ
  pointLimit: { sageDrop, forbiddenBook, hasContract, tenmeCount },  // tenmeCount は保存のみ
  statPoint:  { lv, tenme, hasCosmoCube, penCount, altarCount, tenshoCount, scrollCount }
}
```

#### `exp_calc_hunt_v1` — 討伐数計算

```js
{ kigen: true, medal: 0, zipang: 0, luminous: 0, house: true }
```

**唯一、保存と復元が完全に一致しているキー。**

---

## 2. 読み書きしているファイル

| キー | 書き込み | 読み込み |
|---|---|---|
| `onceworld_origin_exp` | `common/monster-level.js:143` | `common/monster-level.js:40` |
| `calc_state_v5` | `tools/calc/calc-ui.js:152` | `calc-ui.js:158`, `calc-ui.js:331` |
| `detail_calc_state_v1` | `detail-calc-ui.js:289` | `detail-calc-ui.js:295` |
| `status_sim_inline_v7` | `status-sim.js:495` | `status-sim.js:496`, `:497`(remove) |
| **`status_sim_build_slots_v1`** | `status-sim.js:499` | `status-sim.js:498`、`detail-calc-ui.js:359`、`calc-ui.js:619` |
| `status_sim_ss_calc_v1` | `status-sim.js:754` | `status-sim.js:772` |
| `build_sim_state_v1` | `build-sim-ui.js:132` | `build-sim-ui.js:142` |
| `exp_calc_hunt_v1` | `exp-calc.js:350` | `exp-calc.js:362` |
| `calc_active_tab` | `calc-wrapper.html:61` | `calc-wrapper.html:69` |

### ツールをまたぐのは1キーだけ

`status_sim_build_slots_v1` のみが**書き手1・読み手3**の非対称な共有キー。

- 書き込み: ステシミュ（`status-sim.js`）だけ
- 読み込み: ステシミュ + 統合計算機 + 詳細計算機（「ビルド引用」機能）

さらに `detail-calc-ui.js:399` と `calc-ui.js:657` が `window.addEventListener("storage")` で
別タブの更新を監視している。**共通化の際はこの storage イベント連携を壊さないこと。**

---

## 3. 保存漏れ・復元漏れ

### 3.1 保存されるが復元されない（書き込み専用フィールド）

| キー | フィールド | 状況 |
|---|---|---|
| `status_sim_inline_v7` | `statPointTotal` | `collectState` で保存されるが `applyState` に復元処理がない。ただし `build-sim-logic.js:398,572,624` が `simState.statPointTotal` として参照するため、**ビルドスロット経由では意味を持つ**。ステシミュ自身の復元では捨てられる |
| `status_sim_ss_calc_v1` | `tenmeCount` | `spTenme` と同じ `$("ss-sp-tenme-count")` から読んでおり**完全に重複**。`loadSsCalc` にも復元処理なし。純粋な冗長フィールド |
| `build_sim_state_v1` | `state.nullifyTarget` | `state` の初期値 `"auto"` として定義されているが、**コードベース全体で他に一切参照がない**（`build-sim-ui.js:46` の1箇所のみ）。死んだフィールドが永続化されている |
| `build_sim_state_v1` | `pointLimit.tenmeCount` | `statPoint.tenme` と同じ `bs-sp-tenme-count` 由来で重複。`loadSimState` は `statPoint.tenme` 側だけ復元する |

### 3.2 入力欄があるのに保存対象外

**ビルドシミュが最も深刻。20個の `bs-*` 入力のうち保存されるのは8個だけ。**

| 保存される（8） | 保存されない（12） |
|---|---|
| `bs-chara-lv` | `bs-analysis-book` |
| `bs-sp-tenme-count` | `bs-analysis-book-advanced` |
| `bs-pen-count` | `bs-crystal-count` |
| `bs-altar-count` | `bs-toushou-count` |
| `bs-tensho-count` | `bs-devil-eye` |
| `bs-scroll-count` | `bs-npan-limit` ※`state.npanLimit` 経由で実質復元される |
| `bs-sage-drop` | `bs-tenku-floor` |
| `bs-forbidden-book` | `bs-reverse-monster-search` |
| | `bs-reverse-lv` |
| | `bs-reverse-npan` |
| | `bs-reverse-hits` |
| | `bs-reverse-crit` |

魔法計算に必要な解析書・魔晶立方体、物理計算に必要な闘晶立方体がすべて保存対象外で、
リロードのたびに 0 に戻る。

**統合計算機・詳細計算機にも同じ問題がある。**

| ツール | 未保存の入力 | 影響 |
|---|---|---|
| 統合計算機 | `toushou-count` | `calc-ui.js:488` で計算に使われるのに `saveState` の `hero` に含まれない |
| 詳細計算機 | `detail-toushou-count` | `detail-calc-ui.js:626` で使われるのに `getHeroInputs` に含まれない |

闘晶立方体は物理ダメージ最大11倍（パンドラ時21倍）の主要素材なので、
毎回入れ直しになるのは実用上の不便が大きい。

### 3.3 復元されるが保存されない

**該当なし。** 全キーで「復元側にあって保存側にない」フィールドは存在しなかった。

### 3.4 例外処理の抜け

`status-sim.js` の3箇所が `try/catch` なしで localStorage を呼んでいる。

| 箇所 | 内容 |
|---|---|
| `status-sim.js:495` | `saveAutoState` — `setItem` が裸 |
| `status-sim.js:497` | `clearAutoState` — `removeItem` が裸 |
| `status-sim.js:499` | `saveBuildSlots` — `setItem` が裸 |

プライベートブラウジングや容量超過（`QuotaExceededError`）で例外が飛ぶと、
呼び出し元の処理がそこで止まる。他ファイルは全て `try/catch` で保護されている。

---

## 4. キー文字列の直書き

| キー | 直書きファイル数 | ファイル |
|---|---:|---|
| **`status_sim_build_slots_v1`** | **3** | `status-sim.js:8`、`detail-calc-ui.js:25`、`calc-ui.js:613` |
| その他8キー | 各1 | — |

問題は `status_sim_build_slots_v1` の1つだけ。ただし3ファイルのうち
`detail-calc-ui.js` と `calc-ui.js` は**関数スコープ内でローカル定数として再定義**しており
（`calc-ui.js:613` は関数の中）、片方だけ変更しても気付けない。

**バージョン接尾辞も不統一**: `_v1`（5個）/ `_v5`（1個）/ `_v7`（1個）/ 接尾辞なし（2個）。
どのキーにもマイグレーション処理は存在せず、構造を変えると
`JSON.parse` は通るが中身が合わずに**黙って初期値に戻る**（実質データ消失）。

---

## 5. 設計案

### 5.1 storage-manager.js のAPI設計

#### 案A: 薄いラッパー（キー定数 + JSON入出力のみ）

```js
const STORAGE_KEYS = {
  ORIGIN_EXP:    "onceworld_origin_exp",
  CALC:          "calc_state_v5",
  DETAIL_CALC:   "detail_calc_state_v1",
  STATUS_INLINE: "status_sim_inline_v7",
  BUILD_SLOTS:   "status_sim_build_slots_v1",
  SS_CALC:       "status_sim_ss_calc_v1",
  BUILD_SIM:     "build_sim_state_v1",
  EXP_HUNT:      "exp_calc_hunt_v1",
  CALC_TAB:      "calc_active_tab"
};

Storage.read(key, fallback)   // JSON.parse + try/catch、失敗時 fallback
Storage.write(key, value)     // JSON.stringify + try/catch、成否を boolean で返す
Storage.remove(key)
Storage.onChange(key, cb)     // storage イベントをキー単位で購読
```

| メリット | デメリット |
|---|---|
| 移行が最小・低リスク。既存の `saveState`/`loadState` の中身を差し替えるだけ | 保存漏れ（3.2）は解決しない。各ツールが個別に「何を保存するか」を書き続ける |
| キー直書きと `try/catch` 抜けが一掃される | マイグレーションの受け皿がない |
| storage イベント購読が統一される | |

#### 案B: スキーマ駆動（推奨）

```js
Storage.define("calc", {
  key: "calc_state_v5",
  version: 5,
  fields: [
    { id: "hero-atk",      path: "hero.atk",     type: "int" },
    { id: "toushou-count", path: "hero.toushou", type: "int", default: 0 }
  ],
  extra: () => ({ monster_id: picked ? picked.id : "", state: state }),
  migrate: { 4: (old) => old }
});

Storage.save("calc");     // fields を DOM から収集して書き込み
Storage.load("calc");     // 読み込んで DOM に流し込む
```

| メリット | デメリット |
|---|---|
| **保存漏れが構造的に起きにくい**。フィールド追加＝1行追加 | 初期実装が重い。`type` 変換（int/bool/string）や `default` の設計が必要 |
| マイグレーションの置き場所が自然に決まる | DOM外の状態（`state` オブジェクト、`picked`）は `extra` で逃がす必要があり、完全に宣言的にはならない |
| 保存/復元の対応漏れが定義から機械的に検証できる | 既存4ツールすべての書き換えが必要で、一度に移行するとリスクが大きい |

**推奨: 案A → 案B の段階移行。**
まず案Aでキー定数と `try/catch` を一元化（低リスク・即効性あり）、
その上で保存漏れが多いビルドシミュから案Bへ順次移行する。

### 5.2 マイグレーション方式

現状**どのキーにもマイグレーションが無い**ため、構造変更＝ユーザーデータ消失。
共通化と同時に受け皿を用意すべき。

#### 案1: バージョン番号を値の中に持つ（推奨）

```js
{ __v: 5, data: { /* 実データ */ } }
```

| メリット | デメリット |
|---|---|
| キー名を変えずにバージョンを上げられる。移行チェーン（v5→v6→v7）を素直に書ける | 既存データは `__v` を持たないので、`__v` 欠落＝旧形式として扱う分岐が必要 |
| 1キー1エントリのままで済み、容量が増えない | ラップするため既存の読み出しコードは全て変更が必要 |

#### 案2: キー名にバージョンを埋め込む（現行方式の延長）

`calc_state_v5` → `calc_state_v6` のように新キーへ書き、旧キーから読んで変換。

| メリット | デメリット |
|---|---|
| 現行の命名と地続き。旧データが残るのでロールバックが容易 | 旧キーが残り続けて**ゴミが溜まる**。削除タイミングの判断が必要 |
| 移行失敗時に旧データが無傷 | キーが増えるほど「どれが現行か」が分かりにくくなる |

#### 案3: 移行しない（欠けたフィールドは default で埋める）

| メリット | デメリット |
|---|---|
| 実装コストゼロ | 型が変わる変更（文字列→数値など）に対応できない。`onceworld_origin_exp` の `"1"`/`"0"` を boolean にするような変更で破綻 |

**推奨: 案1。** ただし移行第1弾では
「`__v` が無ければ現行構造とみなして `__v: N` を付けて書き戻すだけ」の
**無変換マイグレーション**にとどめ、既存データを確実に温存する。

なお `status_sim_build_slots_v1` は**ユーザーが手で名前を付けて貯めた資産**であり、
失われた場合の影響が他キーと段違いに大きい。ここだけは
移行前に旧キーのバックアップを別キーへ退避することを推奨する。

### 5.3 保存対象の宣言方法

#### 案X: HTMLの data- 属性で指定

```html
<input id="bs-toushou-count" data-persist="build_sim.statPoint.toushou" type="text">
```

```js
document.querySelectorAll("[data-persist]")   // 収集は1行
```

| メリット | デメリット |
|---|---|
| **入力欄を追加した人がその場で保存指定できる**。JS側の修正漏れが起きない | 保存構造がHTMLに散らばり、全体像が1箇所で見えない |
| HTMLとJSの二重管理が消える | `build-sim.html` と `content/tools/status/index.md` は63個のIDが**二重にベタ書き**されており（refactoring-survey.md C-1）、両方に属性を書く必要がある。C-1を先に解消しないと不整合が起きる |
| | Markdown内のHTMLでも属性は生き残るが、Goldmarkの制約に注意が必要 |

#### 案Y: JS側に対象IDリストを持つ（推奨）

```js
const PERSIST_FIELDS = [
  { id: "bs-chara-lv",      path: "statPoint.lv",      type: "int", default: 200 },
  { id: "bs-toushou-count", path: "statPoint.toushou", type: "int", default: 0 }
];
```

| メリット | デメリット |
|---|---|
| 保存構造が**1箇所で一望できる**。レビューで漏れに気付きやすい | 入力欄追加時にJS側も直す必要があり、片方だけ直す漏れは残る |
| 型・デフォルト値・マイグレーションを同じ場所に書ける | HTMLとの対応はID文字列頼りで、静的には検証されない |
| HTMLの二重管理（C-1）の影響を受けない | |
| テストで「全 `bs-*` 入力がリストに載っているか」を機械的に検証できる | |

#### 案Z: ハイブリッド

JSにリストを持ちつつ、`data-persist` 属性を持つ要素がリストに無ければ
開発時に `console.warn` を出す。

| メリット | デメリット |
|---|---|
| 案Yの一望性と案Xの漏れ検出を両立 | 仕組みが2つになり、理解コストが上がる |

**推奨: 案Y。**
理由は、`build-sim.html` と `content/tools/status/index.md` のHTML二重管理（C-1）が
未解消の現状で `data-` 属性方式を採ると、**同じ入力欄に2箇所で属性を書く**ことになり
かえって漏れが増えるため。C-1を解消した後なら案Xも有力になる。

漏れ検出は、案Yのリストと実HTMLのID一覧を突き合わせる
**検証スクリプト**（`node` で `layouts/` と `content/` を走査してリストと比較）で代替できる。
これは今回の調査で使った手法がそのまま流用できる。

---

## 6. 推奨する進め方

段階を分け、各段階で「計算結果・保存データが変わらないこと」を検証しながら進める。

| 段階 | 内容 | リスク |
|---|---|---|
| 1 | `storage-manager.js` を案Aで作成。キー定数・`try/catch`・storage購読を一元化。既存の保存構造は**一切変えない** | 低 |
| 2 | `status-sim.js` の未保護3箇所（3.4）を `Storage.write` 経由にして例外を潰す | 低 |
| 3 | 冗長・死んだフィールドを整理（`tenmeCount` ×2、`nullifyTarget`）。読み込み側は既に無視しているので後方互換あり | 低 |
| 4 | `__v` による無変換マイグレーションを導入。`status_sim_build_slots_v1` は事前退避 | 中 |
| 5 | 案Yの `PERSIST_FIELDS` をビルドシミュに導入し、未保存12項目を保存対象に追加 | 中 |
| 6 | 統合計算機・詳細計算機の `toushou-count` 保存漏れを解消 | 低 |

段階1〜3は既存の保存データに一切触れないため、先行して安全に実施できる。

---

## 7. 着手前に決めておくべきこと

- **`status_sim_build_slots_v1` の後方互換をどこまで保証するか。**
  ユーザーが貯めた名前付きビルドは復元不能な資産であり、
  ここを壊す変更は他のキーと同列に扱えない。
- **保存漏れを「バグとして直す」か「仕様として据え置く」か。**
  3.2の未保存項目を保存対象にすると、これまで毎回0から始まっていた入力が
  前回値を引き継ぐようになる。挙動変更としてユーザーに影響する。
- **`onceworld_origin_exp` の型。**
  唯一の生文字列 `"1"`/`"0"` を boolean のJSONに統一するかどうか。
  統一するならマイグレーションが必須。
