# localStorage 調査と共通化の設計案

調査日: 2026-08-18 / 対象: `static/js/` `layouts/` `content/` 配下の全localStorage利用箇所
最終更新: 2026-08-18（フェーズ3 完了を反映）

## 対応状況

✅ の付いた項目はフェーズ3で解消済み。未対応の項目は末尾の「8. 残タスク」に集約している。

| 解消済み | 内容 | コミット |
|---|---|---|
| ✅ | localStorage 呼び出しの一元化（`OWStorage`） | `62c4ec9` |
| ✅ | キー文字列の直書き（3ファイル） | `62c4ec9` |
| ✅ | `try/catch` 抜け3箇所 | `62c4ec9` |
| ✅ | 冗長・死んだフィールド4件 | `d1a4591` |
| ✅ | ビルドシミュの未保存12項目 | `54a1f3a` |
| ✅ | `__v` マイグレーション基盤 + ビルド退避 | `cbf5118` |
| ✅ | 統合・詳細計算機の `toushou-count` 保存漏れ | `b8f7bc0` |
| ✅ | 両計算機のリセットボタン追加 | `b8f7bc0` |
| ✅ | `onceworld_origin_exp` の boolean 化 | `40d57f9` |

採用した設計は、API が **案A（薄いラッパー）**、マイグレーションが **案1（値の中に `__v`）**、
保存対象の宣言が **案Y（JS側に対象IDリスト）**。いずれも5章の比較のとおり。

---

## 1. 全localStorageキーと保存内容の構造

現在9キー + 退避用1キー。キー定義はすべて `storage-manager.js` の `KEYS` にある。
読み書きのうち `calc_active_tab` の1つだけがJSファイルではなくレイアウトHTMLの
インラインscriptにある（残タスク R-3）。

### 1.1 一覧

| # | キー | 定義箇所 | 用途 | 値の型 |
|---|---|---|---|---|
| 1 | `onceworld_origin_exp` | `storage-manager.js` `KEYS.ORIGIN_EXP` | 「経験の起源」チェック状態 | ✅ **boolean**（旧 `"1"`/`"0"` は移行で吸収） |
| 2 | `calc_state_v5` | `KEYS.CALC` | 統合計算機の入力状態 | JSON（封筒） |
| 3 | `detail_calc_state_v1` | `KEYS.DETAIL_CALC` | 詳細計算機の入力状態 | JSON（封筒） |
| 4 | `status_sim_inline_v7` | `KEYS.STATUS_INLINE` | ステシミュの作業状態 | JSON（封筒） |
| 5 | `status_sim_build_slots_v1` | `KEYS.BUILD_SLOTS` | 名前付きビルドの保存スロット | JSON（封筒） |
| 6 | `status_sim_ss_calc_v1` | `KEYS.SS_CALC` | ステシミュの振り分けPt計算欄 | JSON（封筒） |
| 7 | `build_sim_state_v1` | `KEYS.BUILD_SIM` | ビルドシミュの状態 | JSON（封筒） |
| 8 | `exp_calc_hunt_v1` | `KEYS.EXP_HUNT` | 討伐数計算の設定 | JSON（封筒） |
| 9 | `calc_active_tab` | `KEYS.CALC_TAB` | 選択中タブ | **文字列 `"integrated"` / `"detail"`** |
| 退避 | `status_sim_build_slots_v1__pre_v1_backup` | `storage-manager.js` が自動作成 | 5の旧形式の退避（読み書き専用ではなく保険） | 旧形式のバイト列そのまま |

✅ キー定義は `static/js/common/storage-manager.js` の `KEYS` に一元化された。
生文字列のまま残るのは `calc_active_tab` のみ。

**保存形式（封筒）**: バージョン管理下の8キーは `{ "__v": 1, "data": <実データ> }` で保存される。
`__v` を持たない旧データは「バージョン0」として読まれ、`MIGRATIONS` を通してから返る。
以下の 1.2 に載せた構造は、すべて `data` の中身を指す。

### 1.2 各キーの構造

#### `calc_state_v5` — 統合計算機

```js
{
  monster_id: "",          // 選択中モンスターID
  lv: 1,                   // 敵Lv
  hero: {
    atk, int, spd,
    analysisBook, analysisBookAdvanced, crystalCount,
    toushouCount                                       // ✅ 追加。すべて文字列（正規化済み整数）
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
  hero:  { vit, spd, atk, int, def, mdef, luk, analysisBook, analysisBookAdvanced,
           crystalCount, toushouCount },   // ✅ toushouCount を追加
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
  statPointTotal: 0,                       // 保存のみ（意図的に維持。3.1参照）
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
  hasCosmoCube, hasContract                // boolean
  // ✅ tenmeCount は削除済み（spTenme と重複していた）
}
```

#### `build_sim_state_v1` — ビルドシミュ

```js
{
  state:      { attackType, heroElement, spell, debuffWood, debuffDark,
                npanLimit, hasContract, hasCosmoCube, reverseHitRate,
                useMinRandom, calcMode },     // ✅ nullifyTarget は削除済み
  pointLimit: { sageDrop, forbiddenBook },    // ✅ 復元される2項目のみに縮小
  statPoint:  { lv, tenme, hasCosmoCube, penCount, altarCount, tenshoCount, scrollCount },
  inputs:     { analysisBook, analysisBookAdvanced, crystalCount, toushouCount,
                devilEye, npanLimit, tenkuFloor, reverseLv, reverseNpan,
                reverseHits, reverseCrit, reverseMonster }   // ✅ 新設（3.2参照）
}
```

#### `exp_calc_hunt_v1` — 討伐数計算

```js
{ kigen: true, medal: 0, zipang: 0, luminous: 0, house: true }
```

調査当時、**唯一保存と復元が完全に一致していたキー**。現在は他のキーも一致している。

#### `onceworld_origin_exp` — 経験の起源

```js
true   // ✅ boolean。旧形式の "1" / "0" は MIGRATIONS の v0→v1 で吸収
```

---

## 2. 読み書きしているファイル

✅ **すべて `OWStorage` 経由になった。**`localStorage` の直接呼び出しはコードベースから
消えている（`storage-manager.js` 内部を除く）。

| キー | 書き込み | 読み込み |
|---|---|---|
| `onceworld_origin_exp` | `common/monster-level.js` | `common/monster-level.js` |
| `calc_state_v5` | `tools/calc/calc-ui.js` | `calc-ui.js`（2箇所） |
| `detail_calc_state_v1` | `detail-calc-ui.js` | `detail-calc-ui.js` |
| `status_sim_inline_v7` | `status-sim.js` | `status-sim.js`（remove も） |
| **`status_sim_build_slots_v1`** | `status-sim.js` | `status-sim.js`、`detail-calc-ui.js`、`calc-ui.js` |
| `status_sim_ss_calc_v1` | `status-sim.js` | `status-sim.js` |
| `build_sim_state_v1` | `build-sim-ui.js` | `build-sim-ui.js` |
| `exp_calc_hunt_v1` | `exp-calc.js` | `exp-calc.js` |
| `calc_active_tab` | `calc-wrapper.html`（インライン） | `calc-wrapper.html`（インライン） |

### ツールをまたぐのは1キーだけ

`status_sim_build_slots_v1` のみが**書き手1・読み手3**の非対称な共有キー。

- 書き込み: ステシミュ（`status-sim.js`）だけ
- 読み込み: ステシミュ + 統合計算機 + 詳細計算機（「ビルド引用」機能）

さらに2ファイルが別タブの更新を監視している。共通化にあたっては
`OWStorage.onChange(key, cb)` に置き換え、連携を維持した。

---

## 3. 保存漏れ・復元漏れ

### 3.1 保存されるが復元されない（書き込み専用フィールド）— ✅ 解消済み（`d1a4591`）

4件のうち3件を削除し、1件は意図的に残した。

| キー | フィールド | 状況 |
|---|---|---|
| `status_sim_inline_v7` | `statPointTotal` | **維持**。`applyState` では復元されないが、`build-sim-logic.js` が3箇所で `simState.statPointTotal` を参照しており、ビルドスロット経由で意味を持つため残した |
| `status_sim_ss_calc_v1` | `tenmeCount` | ✅ **削除**。`spTenme` と同じ `$("ss-sp-tenme-count")` から読む完全な重複だった |
| `build_sim_state_v1` | `state.nullifyTarget` | ✅ **削除**。定義箇所以外に参照が一切ない死んだフィールドだった |
| `build_sim_state_v1` | `pointLimit.tenmeCount` | ✅ **削除**。`statPoint.tenme` と重複 |
| `build_sim_state_v1` | `pointLimit.hasContract` | ✅ **削除**。調査時の見落とし。実装中に発見。`state.hasContract` と重複していた |

削除したフィールドが既存データに残っていても復元側は参照しないため、後方互換は保たれる。

### 3.2 入力欄があるのに保存対象外 — ✅ 解消済み（`54a1f3a` / `b8f7bc0`）

**調査時点ではビルドシミュの20個の `bs-*` 入力のうち保存されるのは8個だけだった。**
現在は20個すべてが保存対象。

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
リロードのたびに 0 に戻っていた。

**対応**: `BS_PERSIST_INPUTS`（案Y）に id / 保存キー / 型 / 既定値を宣言的に一覧化し、
`build_sim_state_v1` の `inputs` 配下へ保存するようにした。
`inputs` を持たない既存データを読んだ場合は全項目が既定値になる。

実装時に判明した2点:

- `bs-npan-limit` は `state.npanLimit` として保存されてはいたが**DOMに書き戻されておらず**、
  リロードで既定値3に戻っていた。今回DOM側も復元する
- `bs-reverse-monster-search` は `setupMonsterSearch` がクロージャの `picked` に
  選択状態を持つため、テキストを入れるだけでは未選択のまま。`restore(title)` を追加した

**統合計算機・詳細計算機にも同じ問題があった。** ✅ 両方とも解消済み（`b8f7bc0`）。

| ツール | 未保存だった入力 | 対応 |
|---|---|---|
| 統合計算機 | `toushou-count` | `saveState` の `hero` と `loadState` の復元マップに追加 |
| 詳細計算機 | `detail-toushou-count` | `getHeroInputs` と `loadState` の `heroMap` に追加 |

闘晶立方体は物理ダメージ最大11倍（パンドラ時21倍）の主要素材なので、
毎回入れ直しになるのは実用上の不便が大きかった。

あわせて両計算機に**リセットボタン**を追加した（計算ボタンの下・確認ダイアログ付き）。
保存値を削除し、入力欄・状態・結果表示を初期状態に戻す。

### 3.3 復元されるが保存されない

**該当なし。** 全キーで「復元側にあって保存側にない」フィールドは存在しなかった。

### 3.4 例外処理の抜け — ✅ 解消済み（`62c4ec9`）

調査時点では `status-sim.js` の3箇所が `try/catch` なしで localStorage を呼んでいた。
`OWStorage` 経由になり、すべて内部で保護されている。

| 箇所 | 内容 |
|---|---|
| `status-sim.js:495` | `saveAutoState` — `setItem` が裸 |
| `status-sim.js:497` | `clearAutoState` — `removeItem` が裸 |
| `status-sim.js:499` | `saveBuildSlots` — `setItem` が裸 |

プライベートブラウジングや容量超過（`QuotaExceededError`）で例外が飛ぶと
呼び出し元の処理がそこで止まっていた。現在は `write` が `false` を返すだけで処理は継続する。

---

## 4. キー文字列の直書き — ✅ 解消済み（`62c4ec9`）

調査時点の状況:

| キー | 直書きファイル数 | ファイル |
|---|---:|---|
| **`status_sim_build_slots_v1`** | **3** | `status-sim.js:8`、`detail-calc-ui.js:25`、`calc-ui.js:613` |
| その他8キー | 各1 | — |

現在はキー文字列の直書きは**0箇所**で、すべて `OWStorage.KEYS.*` を参照している。

問題は `status_sim_build_slots_v1` の1つだけ。ただし3ファイルのうち
`detail-calc-ui.js` と `calc-ui.js` は**関数スコープ内でローカル定数として再定義**しており
（`calc-ui.js:613` は関数の中）、片方だけ変更しても気付けない。

**バージョン接尾辞の不統一は未解消**: `_v1`（5個）/ `_v5`（1個）/ `_v7`（1個）/ 接尾辞なし（2個）。
ただし `__v` によるスキーマバージョン管理が入ったため、
キー名の接尾辞に頼る必要はなくなった（残タスク R-2 参照）。

✅ マイグレーション処理の不在は解消済み。構造を変える際は
`SCHEMA_VERSIONS` の番号を上げ、`MIGRATIONS` に変換関数を足せばよい。

---

## 5. 設計案（当時の比較・採用結果を追記）

採用したのは **案A + 案1 + 案Y**。以下は判断の根拠として当時の比較をそのまま残す。

### 5.1 storage-manager.js のAPI設計

#### 案A: 薄いラッパー（キー定数 + JSON入出力のみ）— ✅ 採用

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

#### 案B: スキーマ駆動（推奨）— 部分採用

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

**結果**: 案A を全ツールに適用（`62c4ec9`）。案B のうち「宣言的な項目リスト」の部分だけを
ビルドシミュに導入した（`54a1f3a` の `BS_PERSIST_INPUTS`）。
`Storage.define` のような完全なスキーマ駆動APIには至っていない（残タスク R-1）。

### 5.2 マイグレーション方式

現状**どのキーにもマイグレーションが無い**ため、構造変更＝ユーザーデータ消失。
共通化と同時に受け皿を用意すべき。

#### 案1: バージョン番号を値の中に持つ（推奨）— ✅ 採用

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

**結果**（`cbf5118`）: 案1をそのまま採用。`MIGRATIONS` は空のまま無変換で導入し、
`status_sim_build_slots_v1` は旧形式を最初に読み書きした時点で
`status_sim_build_slots_v1__pre_v1_backup` へバイト単位で退避する仕組みを入れた
（一度だけ。読み込み経路と書き込み経路の両方に仕掛けてある）。

その後 `onceworld_origin_exp` の boolean 化（`40d57f9`）で、
この基盤に**実際の変換を伴う移行を初めて載せた**。

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

#### 案Y: JS側に対象IDリストを持つ（推奨）— ✅ 採用（ビルドシミュのみ）

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

**結果**: 案Yをビルドシミュに適用（`BS_PERSIST_INPUTS`）。
統合計算機・詳細計算機は項目数が少ないため、既存の保存マップに直接追加する形にとどめた。

漏れ検出は、案Yのリストと実HTMLのID一覧を突き合わせる
**検証スクリプト**（`node` で `layouts/` と `content/` を走査してリストと比較）で代替できる。
これは今回の調査で使った手法がそのまま流用できる。

---

## 6. 進め方（実施結果）

段階を分け、各段階で「計算結果・保存データが変わらないこと」を検証しながら進める。

| 段階 | 内容 | 状況 | コミット |
|---|---|---|---|
| 1 | `storage-manager.js` を案Aで作成。キー定数・`try/catch`・storage購読を一元化 | ✅ 完了 | `62c4ec9` |
| 2 | `status-sim.js` の未保護3箇所（3.4）を解消 | ✅ 段階1に内包 | `62c4ec9` |
| 3 | 冗長・死んだフィールドを整理 | ✅ 完了（4件） | `d1a4591` |
| 4 | `__v` による無変換マイグレーション導入 + ビルド退避 | ✅ 完了 | `cbf5118` |
| 5 | 案Yの宣言的リストをビルドシミュに導入 | ✅ 完了（12項目） | `54a1f3a` |
| 6 | 統合・詳細計算機の `toushou-count` 保存漏れ + リセットボタン | ✅ 完了 | `b8f7bc0` |
| 追加 | `onceworld_origin_exp` の boolean 化 | ✅ 完了 | `40d57f9` |

実施順は 1 → 3 → 5 → 4 → 6 → boolean化。段階5を4より先に行ったのは、
既存データに触れない作業を優先したため。

---

## 7. 着手前に決めておくべきこと（決定済み）

| 論点 | 決定 |
|---|---|
| `status_sim_build_slots_v1` の後方互換 | **完全に保証する。** キー名も構造も変えず、読み込み時に旧形式を受け入れる。加えて自動退避も実装した |
| 保存漏れの扱い | **バグとして直す。** ただし挙動変更を伴うため、両計算機にリセットボタンを追加して初期状態に戻せるようにした |
| `onceworld_origin_exp` の型 | **boolean に統一。** 読み込み時は `"1"` / `"0"` / `true` / `false` のすべてを受け入れる |

---

## 8. 残タスク

フェーズ3 完了時点で未対応の項目。いずれも既知の不具合ではなく、設計上の改善余地。

| # | 内容 | 参照 | 優先度 |
|---|---|---|---|
| R-1 | **案B（完全なスキーマ駆動API）への移行。** 現在、宣言的な項目リストを持つのはビルドシミュの `BS_PERSIST_INPUTS` だけ。統合計算機・詳細計算機・ステシミュは各自が保存マップを手書きしている。`Storage.define` 相当のAPIに寄せれば、保存漏れが構造的に起きにくくなる | 5.1 案B | 中 |
| R-2 | **キー名のバージョン接尾辞の不統一。** `_v1` / `_v5` / `_v7` / 接尾辞なしが混在。`__v` が入った今、接尾辞は歴史的な残骸でしかない。ただしキー名を変えると既存データの移行が必要なので、単独で行う価値は低い | 4章 | 低 |
| R-3 | **`calc_active_tab` がレイアウトHTMLのインラインscriptにある。** 唯一JSファイル外にある保存処理。`OWStorage` は経由しているが、タブ切り替えロジックごと共通JSへ移すのが筋 | 1.1 / 2章 | 低 |
| R-4 | **`statPointTotal` の書き込み専用状態。** ステシミュ自身の復元では捨てられ、ビルドスロット経由でのみ意味を持つ。意図的に維持しているが、役割が分かりにくい。`applyState` でも復元するか、ビルドスロット専用フィールドとして分離するのが望ましい | 3.1 | 低 |
| R-5 | **退避キーの後始末。** `status_sim_build_slots_v1__pre_v1_backup` は作られたまま消えない。移行が十分に行き渡ったと判断できた時点で削除する処理を入れるか、手動削除の手順を残すか決める必要がある | 5.2 | 低 |
| R-6 | **`bs-devil-eye`（ゴッドオブデビルアイ）が未接続。** HTMLに入力欄があり保存対象にも入れたが、`build-sim-ui.js` での参照は `BS_PERSIST_INPUTS` の登録1件のみで、**計算には一切使われていない**。機能を実装するか入力欄を削除するかの判断が必要 | 3.2 | 中 |

### 着手前に決めておくべきこと（残タスク向け）

- **R-1 を進めるなら、`data-` 属性方式（案X）を再検討する価値がある。**
  案Yを選んだ理由はHTML二重管理（`refactoring-survey.md` の C-1）が未解消だったため。
  C-1 を先に片付ければ、入力欄の追加と保存指定を1箇所で完結させられる。
- **R-5 の判断には、ユーザーの利用状況が読めないという制約がある。**
  静的サイトなので「全ユーザーが移行済み」を確認する手段がない。
  退避キーは数KB程度なので、当面は残しておくのが無難。
