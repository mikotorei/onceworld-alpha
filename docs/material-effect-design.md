# 効果素材の計算経路 — 調査と設計案

調査日: 2026-08-19 / 対象: `MATERIALS` に定義済みの18件
基準コミット: `2bfd4b9`

このドキュメントは**調査と設計案のみ**で、コードの変更は一切行っていない。

---

## 1. 素材ごとの計算経路

### 1.1 一覧

| # | 素材 | 実装ファイル | 関数 | 行 | 適用方法 | floor との関係 |
|---|---|---|---|---:|---|---|
| 1 | 闘晶立方体 | `common/calc-logic.js` | `getTouShouMultiplier` | 130-133 | `1 + n × 0.01` を**攻撃力に乗算** | floor **前**（`damageRangeTotal:137` で ATK に掛かる） |
| 2 | 魔晶立方体 | `common/calc-logic.js` | `getCrystalMultiplier` | 205-208 | `1 + n × 0.01` を**INTに乗算** | floor **前**（`calcMagicDamageRange:219`） |
| 3 | 解析書 | `common/calc-logic.js` | `calcAnalysisBonus` | 198-203 | `n × (1 + adv/10)` を**INTに加算** | 加算値は floor、その後 floor 前に加算 |
| 4 | 解析書の解析書 | `common/calc-logic.js` | `calcAnalysisBonus` | 198-203 | **解析書の効果に乗算**（`1 + adv/10`） | 同上 |
| 5 | ゴッドオブデビルアイ | `common/calc-logic.js` | `getCriticalModifier` | 105-108 | `1 + 1.50 + n × 0.003` を**最終ダメージに乗算** | floor **前**（`damageRangeTotal:139`） |
| 6 | ヨハネの羽ペン | `common/calc-logic.js` | `calcTotalStatPoints` | 272, 302 | `1 + n × 0.01` を**基礎ptに乗算** | floor **前**（最外の floor は1回だけ） |
| 7 | ヨハネの祭壇 | `common/calc-logic.js` | `calcTotalStatPoints` | 273, 302 | `1 + n × 0.002` を**羽ペン適用後に乗算** | 同上 |
| 8 | ステータス天晶 | `common/calc-logic.js` | `calcTotalStatPoints` | 274, 302 | `n × 10000` を**加算**（ヨハネ補正の外側） | 同上 |
| 9 | スーパースクロール | `common/calc-logic.js` | `calcTotalStatPoints` | 275, 302 | `1 + n × 0.002` を**天晶加算後に乗算** | 同上 |
| 10 | 賢者の落とし物 | `common/calc-logic.js` | `calcBasePointLimit` | 307 | `n × 10` を**上限値に加算** | floor なし（整数演算） |
| 11 | 禁域の書物 | `common/calc-logic.js` | `calcBasePointLimit` | 308 | `n × 80` を**上限値に加算** | 同上 |
| 12 | 死刑囚の身代わり晩餐 | `common/calc-logic.js` | `applyDamageReduction` | 169-177 | `(10000 - n×9) / 10000` を**被ダメージに乗算** | floor **後**に適用し、内部で再度 floor |
| 13 | ドラゴン印の手ごね機 | `pet-sim.js` | `getPowderMax` | 162-164 | `100 + n` を**粉の入力上限に加算** | 上限値のため floor 無関係 |
| 14 | ハデスの兜 | `pet-sim.js` | `getLvMax` | 104-106 | `min(2200, 1200 + n)` を**Lvの入力上限に加算** | 同上 |
| 15 | 古のティラピス像 | `tools/exp-calc/exp-calc.js` | `calcMultiplier` | 66-70 | `n × 0.00005` を**天命倍率から減算** | floor なし |
| 16 | 天空像～冒険者～ | `guide-floor-calc.js` | `capAdventurer` | 37-40 | 所持数が**探索の上限**になる | 上限値 |
| 17 | 天空像～悪魔～ | `guide-floor-calc.js` | `capDevil` | 41-44 | 同上 | 上限値 |
| 18 | 禁域の液体 | — | — | — | **未実装**（HP計算式のみ CLAUDE.md に記載） | — |

### 1.2 floor の位置が重要な例

**被ダメージ軽減（#12）だけが floor 後に適用される。**

```js
// damageRangeTotal（攻撃側）は floor 済みの値を返す
const min = Math.floor(modifiedBase * 0.9 * hits);
// ↓ その後、軽減を掛けて再度 floor
applyDamageReduction(recv.min, dinner)  // floor(d * remain / 10000)
```

二重の floor になるため、理論値より最大1小さくなる可能性がある。
攻撃側の素材（#1・#2・#5）はすべて floor 前に乗算されるため、この問題は起きない。

**振り分けポイント（#6〜#9）は floor が最外に1回だけ。**

```js
return Math.floor((base * (1 + pen*0.01) * (1 + altar*0.002) + tensho*10000) * (1 + scroll*0.002));
```

4素材が入れ子の乗算・加算で絡み合っており、**適用順が結果を変える**。
順序は 羽ペン → 祭壇 → 天晶（加算）→ スクロール で固定。

---

## 2. 効果の種類の分類

18件は**5つの主要な種類**に分かれるが、どれにも当てはまらない例外が2件と未実装が1件ある。

### 種類A: 倍率（乗算）— 6件

対象の値に `1 + n × 係数` を掛ける。最も多いパターン。

| 素材 | 係数 | 適用対象 |
|---|---|---|
| 闘晶立方体 | 0.01 | 攻撃力 |
| 魔晶立方体 | 0.01 | INT（解析書補正後） |
| 解析書の解析書 | 0.1 | 解析書の効果 |
| ヨハネの羽ペン | 0.01 | 振り分けポイント |
| ヨハネの祭壇 | 0.002 | 振り分けポイント |
| スーパースクロール | 0.002 | 振り分けポイント |

ゴッドオブデビルアイも乗算だが、`1 + 1.50 + n × 0.003` と**定数項1.50が入る**ため
純粋な `1 + n × 係数` ではない。クリティカル基礎倍率と合成されているため、
下の「種類外1」として別扱いにしている。

### 種類B: 加算 — 2件

| 素材 | 加算量 | 適用対象 |
|---|---|---|
| 解析書 | `n × (1 + adv/10)` | INT |
| ステータス天晶 | `n × 10000` | 振り分けポイント |

`MATERIALS` 未定義だが同型のものにペガサスのメダル（`n × 10` を経験値基準値に加算）がある。
下の集計には含めない。

### 種類C: 減算率（軽減）— 1件

| 素材 | 軽減率 | 適用対象 |
|---|---|---|
| 死刑囚の身代わり晩餐 | `n × 0.0009` | 被ダメージ |

種類Aの逆向きだが、**0で底打ちする**点と**1万分率の整数演算**を使う点が異なる。

### 種類D: 上限値の変更 — 4件

計算式ではなく、入力できる値の範囲を変える。

| 素材 | 変更対象 | 式 |
|---|---|---|
| 賢者の落とし物 | 振り分け上限 | `+ n × 10` |
| 禁域の書物 | 振り分け上限 | `+ n × 80` |
| ドラゴン印の手ごね機 | 粉の使用上限 | `100 + n` |
| ハデスの兜 | ペットの最大Lv | `min(2200, 1200 + n)` |

前2件は「計算結果としての上限値」、後2件は「入力欄の max 属性」で、
**同じ種類に見えて実装レイヤーが違う**。

### 種類E: 探索範囲の上限 — 2件

| 素材 | 適用対象 |
|---|---|
| 天空像～冒険者～ | 階層到達の組み合わせ探索の上限 |
| 天空像～悪魔～ | 同上 |

所持数そのものが探索空間の境界になる特殊な形。

### 種類外1: 定数項つき倍率 — 1件

| 素材 | 式 |
|---|---|
| ゴッドオブデビルアイ | `1 + 1.50 + n × 0.003` |

定数項1.50はクリティカルの基礎倍率で、素材の効果ではない。
`1 + n × 係数` の形に収まらないため種類Aから分離した。

### 種類外2: 減算（倍率から引く）— 1件

| 素材 | 式 |
|---|---|
| 古のティラピス像 | `1.05 + max(天命×0.01 − n×0.00005, 0)` |

倍率から引くが、`max(…, 0)` で下限が入るため種類Cとも異なる。**この1件だけの形**。

### 分類の集計

| 種類 | 件数 | 素材 |
|---|---:|---|
| A 倍率 | 6 | 闘晶・魔晶・解析書の解析書・羽ペン・祭壇・スクロール |
| B 加算 | 2 | 解析書・ステータス天晶 |
| C 減算率 | 1 | 死刑囚の身代わり晩餐 |
| D 上限変更 | 4 | 賢者・禁域の書物・手ごね機・ハデスの兜 |
| E 探索範囲 | 2 | 天空像2件 |
| 種類外1 定数項つき倍率 | 1 | ゴッドオブデビルアイ |
| 種類外2 減算 | 1 | 古のティラピス像 |
| 未実装 | 1 | 禁域の液体 |
| **合計** | **18** | = `MATERIALS` の定義数 |

---

## 3. 同じ種類が複数箇所に散らばっている例

### 3.1 上限値の変更（種類D）— 3ファイルに分散

| 素材 | 実装場所 |
|---|---|
| 賢者の落とし物 / 禁域の書物 | `common/calc-logic.js` の `calcBasePointLimit` |
| ドラゴン印の手ごね機 | `pet-sim.js` の `getPowderMax` |
| ハデスの兜 | `pet-sim.js` の `getLvMax` |

同じ「上限を n だけ増やす」効果が、共通ロジックとツール固有ファイルに分かれている。
`getPowderMax` と `getLvMax` は構造がほぼ同じだが**共通化されていない**。

```js
function getPowderMax() { return POWDER_BASE_MAX + getKneader(); }
function getLvMax()     { return Math.min(LV_HARD_MAX, LV_BASE_MAX + getHelmet()); }
```

### 3.2 倍率（種類A）— 適用先ごとに別関数

振り分けポイントの3素材（羽ペン・祭壇・スクロール）は同じ「倍率を掛ける」効果だが、
`calcTotalStatPoints` の中に**べた書きの1行**として埋め込まれている。

```js
Math.floor((base * (1 + pen*0.01) * (1 + altar*0.002) + tensho*10000) * (1 + scroll*0.002))
```

素材を1つ足すと、この式を直接書き換える必要がある。

### 3.3 所持数の読み取り — 各ツールが独自実装

同じ「入力欄から所持数を読んでクランプする」処理が、少なくとも6通りある。

| 実装 | 場所 |
|---|---|
| `clampCount(v, materialCap(id))` | `calc-logic.js`（共通） |
| `clampGodEye(v)` | `calc-ui.js` / `detail-calc-ui.js`（同一実装が2箇所） |
| `getKneader()` | `pet-sim.js` |
| `getHelmet()` | `pet-sim.js` |
| `bsDinnerCount()` | `build-sim-ui.js` |
| `getInt(el, 0)` + `Math.min(cap, …)` | `guide-floor-calc.js` |

`getKneader` と `getHelmet` は素材IDが違うだけでほぼ同一。

### 3.4 上限の取得 — 2系統

| 経路 | 使う場所 |
|---|---|
| `materialCap(id, fallback)` | `calc-logic.js` |
| `OWPandora.materialCap(id, fallback)` | `pet-sim.js` / `material-ui.js` |

前者は後者のラッパで、`OWPandora` 未読み込み時に `getMaterialMax(id, false)` へ
フォールバックする。実質同じものが2つの名前で呼ばれている。

---

## 4. 新素材を追加するときの修正箇所

直近3件の実績から数える。

| コミット | 素材 | 変更ファイル数 |
|---|---|---:|
| `a91e8f4` | ドラゴン印の手ごね機 | 3 |
| `b7daeb0` | 死刑囚の身代わり晩餐 | **8** |
| `0d34dbc` | ハデスの兜 | 4 |

### 4.1 最も重い例（死刑囚の身代わり晩餐・8ファイル）

| # | ファイル | 作業内容 |
|---|---|---|
| 1 | `common/game-data.js` | `MATERIALS` に1エントリ追加 |
| 2 | `common/calc-logic.js` | 効果関数（`getDamageReductionRate` / `applyDamageReduction`）を新規実装 |
| 3 | `layouts/partials/calc-detail.html` | 入力欄を追加 |
| 4 | `layouts/tools/build-sim.html` | 入力欄を追加 |
| 5 | `detail-calc-ui.js` | カンマ整形リストに追加 + 被ダメ計算2箇所に適用 |
| 6 | `build-sim-logic.js` | `calcReceivedDamage` に引数追加 |
| 7 | `build-sim-ui.js` | 所持数の読み取り関数 + 呼び出しに引数追加 + 保存リスナー |
| 8 | `CLAUDE.md` | 計算式と効果素材表に追記 |

### 4.2 種類別の最小修正箇所

| 効果の種類 | 最小ファイル数 | 内訳 |
|---|---:|---|
| A: 倍率（既存の適用先） | 2〜3 | `game-data.js` + `calc-logic.js`（+ UI） |
| B: 加算（既存の適用先） | 2〜3 | 同上 |
| C: 減算率（新規） | 8 | 4.1参照 |
| D: 上限変更（既存ツール） | 3〜4 | `game-data.js` + ツールのJS + HTML（+ CLAUDE.md） |
| E: 探索範囲 | 3 | `game-data.js` + `guide-floor-calc.js` + HTML |

**UI自動生成（`material-ui.js`）を使えばHTMLの修正は不要になる**が、
現状スロット化されているのは build-sim の2セクションと pet-sim のみ。

---

## 5. 設計案: 効果の適用位置を宣言的に定義する

### 5.1 目標

`game-data.js` に1エントリ追加するだけで、計算にもUIにも反映される形。

```js
{
  id: "new_material", name: "新素材", baseMax: 1000,
  effect: "物理ダメージ +2%/個",
  ui: { kind: "count", unit: "個", showMax: false, slots: [...] },
  // ↓ 追加する定義
  apply: { target: "physical.attack", kind: "multiply", perUnit: 0.02 }
}
```

### 5.2 `apply` の設計

#### `kind`（適用方法）

| 値 | 意味 | 式 |
|---|---|---|
| `"multiply"` | 倍率 | `value × (1 + n × perUnit)` |
| `"add"` | 加算 | `value + n × perUnit` |
| `"reduce"` | 軽減 | `value × (1 − n × perUnit)`、0で底打ち |
| `"cap"` | 上限加算 | `base + n × perUnit`（`hardMax` があれば `min`） |

#### `target`（適用位置）

計算式の中の「フック地点」に名前を付ける。

| target | 適用先 | 現在の該当素材 |
|---|---|---|
| `physical.attack` | 物理ダメージの攻撃力（防御減算より前） | 闘晶立方体 |
| `physical.final` | 物理ダメージの最終値（乱数・多段より前） | ゴッドオブデビルアイ※ |
| `magic.int` | 魔法ダメージのINT（1.25倍より前） | 魔晶立方体・解析書 |
| `damageTaken` | 主人公が受けるダメージ | 死刑囚の身代わり晩餐 |
| `statPoint` | 振り分けポイント | 羽ペン・祭壇・天晶・スクロール |
| `statPointLimit` | 振り分け上限 | 賢者の落とし物・禁域の書物 |
| `pet.powderMax` | 粉の使用上限 | ドラゴン印の手ごね機 |
| `pet.levelMax` | ペットの最大Lv | ハデスの兜 |
| `exp.tenmeMultiplier` | 天命倍率 | 古のティラピス像 |
| `hero.hp` | 主人公HP | 禁域の液体（未実装） |

※ゴッドオブデビルアイは定数項1.50があるため、`apply` だけでは表現できない（5.5参照）。

#### `order`（適用順）

振り分けポイントのように**順序が結果を変える**フックでは、順序の指定が要る。

```js
{ id: "johanne_quill",  apply: { target: "statPoint", kind: "multiply", perUnit: 0.01,  order: 10 } },
{ id: "johanne_altar",  apply: { target: "statPoint", kind: "multiply", perUnit: 0.002, order: 20 } },
{ id: "status_crystal", apply: { target: "statPoint", kind: "add",      perUnit: 10000, order: 30 } },
{ id: "super_scroll",   apply: { target: "statPoint", kind: "multiply", perUnit: 0.002, order: 40 } }
```

`order` 昇順に適用すれば現在の式と一致する。

### 5.3 適用エンジンのAPI

```js
// 指定フックに、素材の所持数を渡して効果を適用した値を返す
applyMaterialEffects(target, baseValue, counts)
// counts は { johanne_quill: 1000, johanne_altar: 500, ... }

// 上限系のフック用
resolveMaterialCap(target, baseMax, counts, hardMax)
```

計算側は次のように書き換わる。

```js
// 現在
return Math.floor((base * (1 + pen*0.01) * (1 + altar*0.002) + tensho*10000) * (1 + scroll*0.002));

// 案
return Math.floor(applyMaterialEffects("statPoint", base, counts));
```

| メリット | デメリット |
|---|---|
| 素材追加が定義1件で完結する（`apply` のあるフックに限る） | フック地点をコード側に用意する必要があり、新しい適用位置は結局コード修正になる |
| 同種の効果が1箇所に集まり、3.1〜3.3の分散が解消する | `order` の付け方を誤ると計算結果が静かに変わる |
| 適用順が定義から読める（現在は式を読まないと分からない） | デバッグ時に「どの素材が効いたか」が式から直接見えなくなる |
| 所持数の読み取りとクランプも `counts` 生成に一元化できる | 既存17件すべての移行が必要で、非退行検証の範囲が広い |

### 5.4 所持数の収集

`counts` は `MATERIALS` の `ui.slots` から自動生成できる。

```js
function collectMaterialCounts(root) {
  const counts = {};
  MATERIALS.forEach(m => {
    const slot = (m.ui?.slots || []).find(s => document.getElementById(s.inputId));
    counts[m.id] = slot
      ? clampCount(document.getElementById(slot.inputId).value, OWPandora.materialCap(m.id, m.baseMax))
      : 0;
  });
  return counts;
}
```

これで 3.3 に挙げた6通りの読み取り実装が1つになる。

### 5.5 この仕組みに載らない素材

| 素材 | 理由 |
|---|---|
| ゴッドオブデビルアイ | `1 + 1.50 + n × 0.003` の定数項1.50はクリティカル基礎倍率で、素材の効果ではない。`multiply` では表現できない |
| 解析書 / 解析書の解析書 | 解析書の効果に解析書の解析書が乗るという**素材間の依存**がある。`apply` は素材ごとに独立している前提 |
| 古のティラピス像 | `max(天命×0.01 − n×0.00005, 0)` と、他の項と合成された下限つきの減算 |
| 天空像2件 | 所持数が探索空間の境界になる。値への適用ではない |
| ハデスの兜 | `hardMax` で表現できるが、`min(2200, …)` の 2200 は素材と無関係な別枠の上限 |

**18件中5〜6件は例外扱いが要る。** 汎用エンジンで全部を賄おうとすると、
かえって `apply` の仕様が複雑になる。

### 5.6 推奨する範囲

**種類A（倍率）・B（加算）・C（減算率）の単純なものに限定して導入する。**

| 対象 | 件数 | 扱い |
|---|---:|---|
| `apply` で宣言 | 8 | 闘晶・魔晶・羽ペン・祭壇・天晶・スクロール・賢者・禁域の書物 |
| 個別実装のまま | 6 | デビルアイ・解析書2件・ティラピス像・天空像2件 |
| 上限系（別APIに寄せる） | 3 | 手ごね機・ハデスの兜・（禁域の液体） |
| 現状維持 | 1 | 死刑囚の身代わり晩餐（`applyDamageReduction` で既に共通化済み） |

8件を宣言に寄せるだけでも、振り分けポイント系4件のべた書き式（3.2）が解消し、
**同じ適用先への素材追加は定義1件で済む**ようになる。

### 5.7 段階的な導入

| 段階 | 内容 | リスク |
|---|---|---|
| 1 | `collectMaterialCounts` を実装（5.4）。既存の読み取り6通りを置き換える | 低 |
| 2 | `applyMaterialEffects` を実装するが、**どこからも呼ばない** | 極小 |
| 3 | `statPoint` フック（羽ペン・祭壇・天晶・スクロール）を移行。旧式と全数比較 | 中 |
| 4 | `statPointLimit` フック（賢者・禁域の書物）を移行 | 低 |
| 5 | `physical.attack` / `magic.int` フックを移行 | 中 |
| 6 | 上限系を `resolveMaterialCap` に寄せる（`getPowderMax` / `getLvMax`） | 低 |

段階3が最も価値が高く、リスクも中程度。ここまでで打ち切っても意味がある。

---

## 6. 着手前に決めておくべきこと

- **`order` を明示するか、`MATERIALS` の定義順を使うか。**
  定義順に依存すると、素材を並び替えたときに計算結果が変わる事故が起きうる。
  明示的な `order` を推奨するが、値の採番規則（100刻みなど）を決める必要がある。
- **例外6件を `apply` に無理に載せるか、個別実装のまま残すか。**
  無理に載せると `apply` に `constant` や `dependsOn` のような
  フィールドが増え、宣言の見通しが悪くなる。
- **フック地点の粒度。**
  `physical.attack` と `physical.final` を分けたが、乱数・多段・属性補正の
  どこに挟むかまで含めると、フック名がさらに増える。
  現在の素材で必要な最小限にとどめるか、将来を見越して細かく切るか。

---

## 7. 関連ドキュメント

- `docs/material-implementation-status.md` — 効果素材53件の実装状況
- `docs/ui-generation-design.md` — `ui` メタ情報とUI自動生成
- `CLAUDE.md` — 各計算式、効果素材の上限、パンドラの箱
