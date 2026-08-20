# モンスターデータ 現状調査

調査日: 2026-08-20 / 対象コミット: `17f1fc3`
最終更新: 2026-08-20（`f1c6847` までの対応を反映）

> **この調査で挙げた課題は Excel 由来のデータ全件更新で対応済み。**
> 反映内容は末尾の「7. 対応状況」を参照。

背景: モンスターを複数体追加する予定があり、またペットスキルに
「各段階の解放レベル」を持たせる変更も控えている。
構造を見直すかどうかの判断材料として現状を把握する。

---

## 0. 要約

| 項目 | 結果 |
|---|---:|
| `content/monster/` のファイル数 | **136**（`_index.md` を除く） |
| ID の範囲 | 001〜254（**欠番118個**） |
| `monsters-data.js` の出力フィールド | 19 |
| ペットスキルの保管場所 | **`content/monster/` ではなく `static/db/pet-skills.json`** |
| 生成される `monsters-data.js` | 52KB（5ページが読み込む） |

**すぐ直すべき不具合が3件見つかった。**

1. `011.md` / `013.md` の `[[level_shortcuts]]` が**フロントマターの外**に書かれており、データが失われている
2. `drop_rate` フィールドが123ファイルにあるが**どこからも参照されていない**
3. ペットスキルの `exp` / `capture` / `drop` / `heal` / `sp` は
   ステシミュで**黙って捨てられている**

---

## 1. `content/monster/` のファイル構造

### 1-1. フロントマターの全フィールド

TOML（`+++`）形式。全136ファイルの実測値。

| フィールド | 出現 | 型 | 出力 | 用途 |
|---|---:|---|---|---|
| `id` | 136 | string | ✅ | `"001"` のゼロ埋め3桁。ファイル名と一致 |
| `title` | 136 | string | ✅ | モンスター名。検索キー |
| `image` | 136 | string | ❌ | `img/monster/001.png`。詳細・一覧ページのみ |
| `element` | 136 | string | ✅ | 火/水/木/光/闇の**日本語** |
| `attack_type` | 136 | string | ✅ | 物理84 / 魔法52 |
| `attack_range` | 136 | string | ✅ | 近距離113 / 遠距離23 |
| `exp` | 136 | int | ✅ | 基礎経験値 |
| `gold` | 136 | int | ✅ | 出力されるが**JSからは未使用** |
| `capture_rate` | 136 | int 81 / float 55 | ✅ | 出力されるが**JSからは未使用** |
| `drops` | 136 | array | ✅ | 出力されるが**JSからは未使用** |
| `locations` | 136 | array | ✅ | ビルドシミュのみ使用 |
| `drop_rate` | **123** | int 120 / float 3 | ❌ | **どこからも参照されていない**（後述） |
| `level_shortcuts` | 128 | array / テーブル配列 | ✅ | Lvショートカット |
| `[status]` | 136 | table | ✅ | vit/spd/atk/int/def/mdef/luk の7つ |
| `[fixed_status]` | 136 | table | ✅ | `mov` のみ |

### 1-2. 型の揺れ

- **`capture_rate`**: 整数81件 / 小数55件（`3` と `0.5` が混在）
- **`drop_rate`**: 整数120件 / 小数3件
- どちらも TOML としては正当だが、Hugo の `jsonify` を通ると
  型がそのまま出るため、JS側で数値比較する場合は注意が要る
- `[status]` のインデントに揺れがある（`mdef  = 8` のように
  スペース2つのファイルと1つのファイルが混在）。動作には影響しない

### 1-3. ペットスキル関連のフィールド

**`content/monster/` にペットスキルのフィールドは存在しない。**

実体は `static/db/pet-skills.json` にあり、モンスターIDをキーにした
別ファイルとして管理されている。

```json
{
  "001": [
    {"add": {"vit": 140}},
    {"add": {"vit": 140}},
    {"add": {"vit": 140}},
    {"final_mul": {"vit": 35}}
  ],
  ...
}
```

| 項目 | 実測 |
|---|---|
| エントリ数 | 136（モンスターと**1対1で過不足なし**） |
| 段階数 | 4段階が132件 / 3段階が4件 |
| 効果の種類 | `add` 155 / `mul` 329 / `final_mul` 56 |
| 対象キー | vit, spd, atk, int, def, mdef, luk, mov, exp, capture, drop, heal, sp |
| 1段階あたりの効果 | **必ず1種別・1ステータスのみ**（複数持ちは0件） |

各段階は `{種別: {ステータス: 数値}}` の1組だけを持つ。
`mul` / `final_mul` の値はパーセント（`{"mul":{"atk":5}}` = +5%）。

### 1-4. `level_shortcuts` の形式

書かれ方が**3通りに分かれている**。

| 書き方 | ファイル数 | 出力される値 |
|---|---:|---|
| `level_shortcuts = []` | 46 | `[]` |
| `[[level_shortcuts]]`（フロントマター内） | 82 | `[{"label":"...","lv":123}]` |
| 記載なし | 8 | **`null`** |

テーブル配列の形式:

```toml
[[level_shortcuts]]
lv = 99
label = "草原の古池"
[[level_shortcuts]]
lv = 999
label = "循環宇宙"
```

エントリ総数は167件。`lv`（int）と `label`（string）の2キーで、
両方とも167件すべてに揃っている。

JS側は `Array.isArray()` でガードしているため `null` でも落ちないが、
「空配列」と「未定義」が混在しているのは意図的な区別ではない。

---

## 2. データがJSに渡される経路

### 2-1. 全体像

```
content/monster/*.md ──┬─ layouts/index.MonsterData.js ─→ /monsters-data.js（52KB）
                       │                                    → window.MONSTERS
                       ├─ layouts/monster/single.html ─→ モンスター詳細ページ
                       ├─ layouts/monster/list.html   ─→ モンスター一覧
                       └─ layouts/pet-names/list.json.json ─→ /pet-names/index.json
                                                              （id と title だけ）

static/db/pet-skills.json ─┬─ status-sim.js（fetch）      → ステシミュ / ビルドシミュ
                           └─ pet-skills.js（fetch）      → モンスター詳細ページ
```

### 2-2. `layouts/index.MonsterData.js` の出力

`hugo.toml` の `outputFormats.MonsterData` により、ホームページの
出力の一つとして `/monsters-data.js` が生成される。

出力される19フィールド:

```
id, title, element, attack_type, attack_range, level_shortcuts,
exp, gold, capture_rate, drops, locations,
vit, spd, atk, int, def, mdef, luk, mov
```

- `[status]` の7つと `[fixed_status].mov` は**トップレベルに平坦化**される
- `image` と `drop_rate` は出力されない
- `{{ if $m.Params.exp }}...{{ else }}0{{ end }}` のように
  欠損時のフォールバックが手書きで並んでおり、フィールドを1つ足すたびに
  同じパターンを書き足す必要がある

### 2-3. 各ツールが参照するフィールド

| ファイル | 参照しているフィールド |
|---|---|
| `tools/calc/calc-ui.js` | id, title, element, attack_type, level_shortcuts, vit, spd, atk, int, def, mdef, luk |
| `detail-calc-ui.js` | id, title, element, attack_type, vit, spd, atk, int, def, mdef, luk |
| `tools/build-sim/build-sim-ui.js` | id, title, element, attack_type, level_shortcuts, **locations**, spd, atk, int, def, mdef, luk |
| `tenku.js` | id, title, element, attack_type, **attack_range**, vit, spd, atk, int, def, mdef, luk |
| `pet-sim.js` | id, title, element, vit, spd, atk, int, def, mdef, luk, **mov** |
| `tools/exp-calc/exp-calc.js` | id, title, **exp**, level_shortcuts |
| `common/build-card.js` | id, title |

### 2-4. ツールごとの必要フィールドの違い

| フィールド | 使うツール |
|---|---|
| id / title | 全ツール |
| 7ステータス | 計算系5ツール（exp-calc と build-card 以外） |
| element | 計算系5ツール |
| attack_type | calc / detail / build-sim / tenku |
| level_shortcuts | calc / build-sim / exp-calc |
| mov | **pet-sim のみ** |
| attack_range | **tenku のみ** |
| locations | **build-sim のみ** |
| exp | **exp-calc のみ** |
| gold / capture_rate / drops | **どのJSからも未使用**（詳細ページのHugoテンプレートのみ） |

`monsters-data.js` は5ページ（build-sim / calc / exp-calc / pet-sim / tenku）が
読み込む。exp-calc は `exp` と `level_shortcuts` しか使わないが52KB全体を読む。

### 2-5. ペットスキルの経路

`static/db/pet-skills.json` を **fetch で読む**（`monsters-data.js` とは別系統）。

- `status-sim.js` … `convertPetStageList()` で `{add, mul, final_mul}` に整形し、
  `sumPetUpToStage(id, stage)` で「選択した段階まで」を合算する。
  先頭にダミーの0段階目を挿入し、段階番号をそのまま添字にしている
- `common/pet-skills.js` … モンスター詳細ページで「一段階〜四段階」を文章化する。
  `Object.keys(entry)[0]` と `Object.keys(payload)[0]` しか見ないため、
  **1段階に複数の効果があると表示できない**（現データでは複数持ちが0件のため顕在化していない）

---

## 3. 現在の構造の問題点

### 3-1. 【不具合】`[[level_shortcuts]]` がフロントマターの外にある — 2件

`011.md`（ボスゴブリン）と `013.md` の `[[level_shortcuts]]` が
**閉じ `+++` より後ろ**に書かれている。

```toml
[fixed_status]
mov = 17
+++          ← ここでフロントマターが終わっている

[[level_shortcuts]]     ← 本文扱いになり、TOMLとして解釈されない
lv = 10
label = 草原の奥地      ← 引用符もないが、TOMLではないので誰も気付かない
```

結果:

- `monsters-data.js` での値は `level_shortcuts: null`
- モンスター詳細ページにも「草原の奥地」は出力されない（実測0件）
- 統合計算機・ビルドシミュのLvショートカットも出ない

`label` が引用符なしなのは136ファイル中この1件だけで、
**フロントマター内なら Hugo がビルドエラーにしていたはず**の書き方。
外に出たことでエラーにもならず、静かに消えている。

### 3-2. 【不具合】`drop_rate` が完全な死にフィールド — 123件

123ファイルに `drop_rate` があるが、

- `layouts/index.MonsterData.js` は出力していない
- `layouts/monster/single.html` も `list.html` も参照していない
- `static/js` 配下にも参照が無い

つまり**サイトのどこにも出ていない**。13ファイルには最初から無く、
あるファイルとないファイルの区別にも意味がない。

意図としては「ドロップ率」を出したかったのだと思われる。
表示するか、削除するかの判断が必要。

### 3-3. 【不具合】ペットスキルの一部の効果が黙って捨てられている

`pet-skills.json` には13種類のキーが出てくる。

```
vit, spd, atk, int, def, mdef, luk, mov, exp, capture, drop, heal, sp
```

ステシミュの `STATS` は `vit,spd,atk,int,def,mdef,luk,mov` の8つで、
`convertPetStageList()` が `STATS.includes(key)` で絞り込むため、

**`exp` / `capture` / `drop` / `heal` / `sp` は無視される。**

`exp` は55箇所、`capture` は38箇所、`drop` は22箇所に出てくるので
少なくない。モンスター詳細ページ（`pet-skills.js`）では正しく表示されるため、
**同じデータが画面によって違う扱いになっている**。

ステータス計算に載らないのは仕様として妥当だが、
現状は「意図して除外している」ことがコード上どこにも書かれていない。

### 3-4. 冗長な箇所

**(a) 出力されるが誰も使わないフィールド**

`gold` / `capture_rate` / `drops` は `monsters-data.js` に出力されているが
JSからは未使用。詳細ページはHugoテンプレートから直接 `.Params` を読むため、
JSに渡す必要がない。`drops` は配列なので相応にサイズを食う。

**(b) `level_shortcuts` の3通りの書き分け**

`[]` 46件 / テーブル配列 82件 / 記載なし8件。
「無い」を表すのに2通りあり、JS側は毎回 `Array.isArray()` で吸収している。

**(c) `index.MonsterData.js` の手書きフォールバック**

```
exp: {{ if $m.Params.exp }}{{ $m.Params.exp }}{{ else }}0{{ end }},
vit: {{ if $m.Params.status }}{{ if $m.Params.status.vit }}{{ $m.Params.status.vit }}{{ else }}0{{ end }}{{ else }}0{{ end }},
```

ステータス7つ＋mov で同じ入れ子が8回並ぶ。
フィールドを1つ足すと同じ行を書き足すことになる。
`range` とスライスで回せば1箇所で済む。

### 3-5. ツールから使いにくい箇所

**(a) `element` が日本語の生文字列**

`"火"` `"水"` のような日本語で保存されており、JS側は
`normalizeElement()`（`ELEMENT_ALIASES`）で英語キーに変換してから使う。
変換テーブルを介する分、表記揺れが起きたときに気付きにくい。

**(b) ステータスが `[status]` と `[fixed_status]` に分かれている**

`mov` だけが `[fixed_status]` にある。「レベルで伸びない」という意味だが、
出力時には両方ともトップレベルに平坦化されるため、
**JSから見ると区別が消えている**。`scaleStat` を掛けるかどうかは
呼び出し側が `mov` を特別扱いすることで実現している。

**(c) exp-calc が52KBを読む**

`exp` と `level_shortcuts` しか使わないが `monsters-data.js` 全体を読み込む。
モンスターが増えるほどこの無駄が広がる。

**(d) ペットスキルだけ fetch で非同期**

`monsters-data.js` は同期スクリプトなのに、`pet-skills.json` は fetch。
ステシミュの初期化が2系統になっており、読み込み完了の待ち合わせが必要。

### 3-6. 拡張しにくい箇所

**(a) ID の欠番が118個ある**

001〜254 の範囲に136件しかない。欠番は
`008-009, 014-015, 017-020, 034-035, 037-040, 055, 057-060, 069, 074-075,
077-080, 094-095, 097-100, 115, 117-120, 126-129, 131, 135-140, 143-145,
147-150, 154-160, 167-170, 173-180, 184-200, 208-220, 224-225, 230-240, 250`。

ゲーム内の図鑑番号に合わせているなら妥当。
**モンスターを追加するときは、欠番を埋めるのか末尾に足すのかを先に決める必要がある。**
`id` はファイル名・`pet-skills.json` のキー・画像ファイル名の3箇所に現れる。

**(b) ペットスキルに「解放レベル」を足す場所**

現在の形は `{種別: {ステータス: 数値}}` だけで、メタ情報を足す余地がない。

```json
"001": [
  {"add": {"vit": 140}},   ← ここに unlock_lv を足す場所がない
  ...
]
```

足すなら形を変えることになる。取りうる案:

| 案 | 形 | 影響 |
|---|---|---|
| A | `{"add":{"vit":140}, "unlock_lv":10}` | 既存キーと並べる。`entryToText` は `keys[0]` を見ているので**壊れる**（下記） |
| B | `{"effect":{"add":{"vit":140}}, "unlock_lv":10}` | 1階層深くなる。両方の読み手を書き換え |
| C | 解放レベルを別ファイル `pet-skill-levels.json` に分離 | 既存を触らないが、対応付けの管理が増える |
| D | 段階数がモンスター共通なら `pet-skills.json` の外に1つ持つ | 4段階/3段階の差があるので単純には持てない |

**案Aの注意点**: `common/pet-skills.js` の `entryToText()` は
`Object.keys(entry)[0]` を効果種別とみなしている。
`unlock_lv` を同じ階層に置くと、キーの順序次第で `unlock_lv` を
効果種別と誤認する。案Aを採るなら `entryToText()` の修正が必須。

`status-sim.js` の `convertPetStageList()` は
`stage?.add` / `stage?.mul` / `stage?.final_mul` を名指しで読むため、
どの案でも既存の合算処理は壊れない。

**(c) 3段階しかないモンスターが4件ある**

`132件が4段階 / 4件が3段階`。解放レベルを足すとき、
3段階のモンスターの4段階目をどう扱うかを決める必要がある
（現在は詳細ページで「—」と表示している）。

**(d) `pet-names/index.json` の存在**

`content/pet-names/_index.md` が `outputs = ["json"]` で
`id` と `title` だけの一覧を生成している。
`monsters-data.js` にも同じ情報があり、**同じデータの3つ目の出口**になっている
（`monsters-data.js` / `pet-names/index.json` / 各詳細ページ）。

---

## 4. モンスター追加時に触る箇所

複数体を追加する場合の作業一覧。

| # | 対象 | 内容 |
|---|---|---|
| 1 | `content/monster/NNN.md` | フロントマター一式。`drop_rate` は現状不要（3-2） |
| 2 | `static/db/pet-skills.json` | 同じIDのエントリを追加。無いとステシミュのペット欄に出ない |
| 3 | `static/img/monster/NNN.png` | `image` フィールドが指す画像 |
| 4 | `content/item/` | 新規ドロップ素材があれば追加。`drops` はページへのリンクになる |
| 5 | `content/map/` | 新規出現場所があれば追加。`locations` も同様にリンク |

自動生成される（作業不要）:
`monsters-data.js` / `pet-names/index.json` / モンスター一覧・詳細ページ。

**チェックが無い点**: `pet-skills.json` にエントリを足し忘れても
ビルドは通り、ステシミュで「ペットスキルなし」として静かに扱われる。
現状は136件で過不足なく揃っているが、それを保証する仕組みは無い。

---

## 5. 見直すとしたら

優先度順の提案。判断は別途。

### 優先度：高（データが壊れている / 無駄が確定している）

| # | 内容 | 影響範囲 |
|---|---|---|
| 1 | `011.md` / `013.md` の `[[level_shortcuts]]` をフロントマター内へ移す | 2ファイル。3-1 |
| 2 | `drop_rate` を削除するか、出力・表示に載せる | 123ファイル。3-2 |
| 3 | `level_shortcuts` を「常に書く」か「常に書かない」に統一 | 136ファイル。3-4(b) |

### 優先度：中（ペットスキル変更の前にやると楽）

| # | 内容 | 影響範囲 |
|---|---|---|
| 4 | ペットスキルの `exp`/`capture`/`drop`/`heal`/`sp` の扱いを決めてコードに明記 | `status-sim.js`。3-3 |
| 5 | `entryToText()` を複数キー対応にする（解放レベル追加の前提） | `pet-skills.js`。3-6(b) |
| 6 | 解放レベルの持たせ方を案A〜Dから選ぶ | `pet-skills.json` と読み手2本 |

### 優先度：低（あると良い）

| # | 内容 | 影響範囲 |
|---|---|---|
| 7 | `index.MonsterData.js` をスライスの `range` で書き直す | 1ファイル。3-4(c) |
| 8 | `gold` / `capture_rate` / `drops` を出力から外す | 出力サイズ削減。3-4(a) |
| 9 | `pet-skills.json` を `monsters-data.js` に合流させ fetch を無くす | ステシミュの初期化が単純になる。3-5(d) |
| 10 | `pet-names/index.json` を廃止し `monsters-data.js` に一本化 | 3-6(d) |

### 補足

`CLAUDE.md` の「モンスターデータ（約300件）」は実際には**136件**。
IDの最大値が254なので、そこから来た数字と思われる。

---

## 6. 関連ファイル

| パス | 役割 |
|---|---|
| `content/monster/*.md` | モンスターデータ本体（136件） |
| `static/db/pet-skills.json` | ペットスキル（136件・別系統） |
| `layouts/index.MonsterData.js` | `monsters-data.js` の生成 |
| `layouts/pet-names/list.json.json` | `pet-names/index.json` の生成 |
| `layouts/monster/single.html` / `list.html` | 詳細・一覧ページ |
| `static/js/common/pet-skills.js` | 詳細ページのペットスキル表示 |
| `static/js/tools/status/status-sim.js` | ペットスキルの合算（`convertPetStageList` / `sumPetUpToStage`） |

---

## 7. 対応状況（2026-08-20）

Excelから抽出した141件での全件更新に合わせて、本調査で挙げた課題を処理した。

| コミット | 内容 |
|---|---|
| `9d3770a` | ペットスキルを5段階に対応。`data/pet-skill-patterns.yaml` を新設 |
| `f014ecd` | `index.MonsterData.js` を `range` で書き直し、`pet_skill_levels` を追加 |
| `9a14ae7` | `content/monster/*.md` 141件と `pet-skills.json` を再生成 |
| `f1c6847` | 詳細ページに ドロップ率 / ドロップEX / 解放レベル を表示 |

### 解消した項目

| 章 | 内容 | 対応 |
|---|---|---|
| 3-1 | `011.md` / `013.md` の `[[level_shortcuts]]` がフロントマター外 | 本文から回収してフロントマター内へ移した。3エントリが復活 |
| 3-2 | `drop_rate` が死にフィールド | 全141件に記載し、詳細ページの「報酬・捕獲」に表示 |
| 3-3 | ペットスキルの一部の効果が黙って捨てられる | `sp` の表示を実数に修正。ステシミュが8ステしか合算しない点は仕様として CLAUDE.md に明記 |
| 3-4(b) | `level_shortcuts` の3通りの書き分け | 全141件に必ず記載する形に統一。`null` が出力されなくなった |
| 3-4(c) | `index.MonsterData.js` の手書きフォールバック | `range` とスライスで1箇所にまとめた |
| 3-6(b) | ペットスキルに解放レベルを持たせる場所がない | パターン名をモンスター側の `pet_skill_pattern` に持たせ、レベルの実体はYAMLに置いた。`entryToText()` は無修正で済んだ |
| 3-6(c) | 3段階しかないモンスターの扱い | 末尾の未設定段階は配列に入れず、途中の空欄は `{}`。どちらも「—」表示 |

### 残っている項目

| 章 | 内容 | 状況 |
|---|---|---|
| 3-4(a) | `gold` / `capture_rate` / `drops` がJSから未使用なのに出力される | 未対応。出力サイズは60KB |
| 3-5(a) | `element` が日本語の生文字列 | 未対応。`normalizeElement()` で変換している |
| 3-5(b) | `mov` だけ `[fixed_status]` にある | 未対応 |
| 3-5(c) | exp-calc が60KB全体を読む | 未対応 |
| 3-5(d) | ペットスキルだけ fetch で非同期 | 未対応 |
| 3-6(d) | `pet-names/index.json` が3つ目の出口 | 未対応 |

### 件数の更新

| 項目 | 調査時 | 現在 |
|---|---:|---:|
| `content/monster/` | 136 | **141** |
| `pet-skills.json` | 136 | **141** |
| ペットスキルの段階 | 4段階132 / 3段階4 | **5段階130 / 4段階11** |
| `monsters-data.js` | 52KB | 60KB |
