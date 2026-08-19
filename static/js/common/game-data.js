// ============================================================
// game-data.js  ゲームデータ定義（DOM非依存・他ファイルに依存しない）
// calc-logic.js より先に読み込むこと
// ============================================================

// ------------------------------------------------------------
// 魔法
// ------------------------------------------------------------
// mult: 魔法ダメージにかかる倍率
// cssClass: static/css/common/style.css の魔法カラー用クラス
const SPELLS = [
  { id: "fire",    name: "炎帝轟火", mult: 1.0, cssClass: "spell-fire" },
  { id: "water",   name: "氷槍陣",   mult: 1.0, cssClass: "spell-water" },
  { id: "wood",    name: "大地葬送", mult: 1.3, cssClass: "spell-wood" },
  { id: "light",   name: "雷鳴一閃", mult: 2.0, cssClass: "spell-light" },
  { id: "dark",    name: "冥刃降臨", mult: 1.4, cssClass: "spell-dark" },
  { id: "shingan", name: "心眼威圧", mult: 0.1, cssClass: "spell-shingan" }
];

// ------------------------------------------------------------
// 効果素材
// ------------------------------------------------------------
// ui: UI自動生成用のメタ情報（material-ui.js が使う）
//   kind    "count" = 数値入力
//   unit    単位表示。null なら単位なし
//   showMax MAXボタンを出すか
//   slots   表示先。tool:section と inputId を明示する
//           （MATERIALS の id とUI上のID語幹が一致しないため自動導出はしない）
const MATERIALS = [
  { id: "battle_crystal_cube",     name: "闘晶立方体",       baseMax: 1000, effect: "物理ダメージ +1%/個",
    ui: { kind: "count", unit: "個", showMax: false, slots: [
      { tool: "build-sim", section: "physical", inputId: "bs-toushou-count" },
      { tool: "calc",      section: "physical", inputId: "toushou-count" },
      { tool: "detail",    section: "physical", inputId: "detail-toushou-count" }
    ] } },
  { id: "magic_crystal_cube",      name: "魔晶立方体",       baseMax: 1000, effect: "解析書補正後のINT +1%/個",
    ui: { kind: "count", unit: "個", showMax: false, slots: [
      { tool: "build-sim", section: "magic", inputId: "bs-crystal-count" },
      { tool: "calc",      section: "magic", inputId: "crystal-count" },
      { tool: "detail",    section: "magic", inputId: "detail-crystal-count" }
    ] } },
  { id: "analysis_book",           name: "解析書",           baseMax: 1000, effect: "魔法がわずかに強くなる（1冊INT+1相当）",
    ui: { kind: "count", unit: "冊", showMax: false, slots: [
      { tool: "build-sim", section: "magic", inputId: "bs-analysis-book" },
      { tool: "calc",      section: "magic", inputId: "analysis-book" },
      { tool: "detail",    section: "magic", inputId: "detail-analysis-book" }
    ] } },
  { id: "analysis_of_analysis",    name: "解析書の解析書",   baseMax: 1000, effect: "解析書の効果 +10%",
    ui: { kind: "count", unit: "冊", showMax: false, slots: [
      { tool: "build-sim", section: "magic", inputId: "bs-analysis-book-advanced" },
      { tool: "calc",      section: "magic", inputId: "analysis-book-advanced" },
      { tool: "detail",    section: "magic", inputId: "detail-analysis-book-advanced" }
    ] } },
  { id: "god_of_devil_eye",        name: "ゴッドオブデビルアイ", baseMax: 1000, effect: "クリティカル時ダメージ +0.3%/個",
    ui: { kind: "count", unit: "個", showMax: false, slots: [
      { tool: "build-sim", section: "physical", inputId: "bs-devil-eye" },
      { tool: "calc",      section: "critical", inputId: "god-eye-count" },
      { tool: "detail",    section: "critical", inputId: "detail-god-eye-count" }
    ] } },
  { id: "johanne_quill",           name: "ヨハネの羽ペン",   baseMax: 1000, effect: "振り分けPt +1%/個",
    ui: { kind: "count", unit: "個", showMax: true, slots: [
      { tool: "build-sim", section: "stat-point", inputId: "bs-pen-count" },
      { tool: "status",    section: "stat-point", inputId: "ss-pen-count" }
    ] } },
  { id: "johanne_altar",           name: "ヨハネの祭壇",     baseMax: 1000, effect: "振り分けPt +0.2%/個",
    ui: { kind: "count", unit: "個", showMax: true, slots: [
      { tool: "build-sim", section: "stat-point", inputId: "bs-altar-count" },
      { tool: "status",    section: "stat-point", inputId: "ss-altar-count" }
    ] } },
  { id: "status_crystal",          name: "ステータス天晶",   baseMax: 1000, effect: "振り分けPt +10000/個",
    ui: { kind: "count", unit: "個", showMax: true, slots: [
      { tool: "build-sim", section: "stat-point", inputId: "bs-tensho-count" },
      { tool: "status",    section: "stat-point", inputId: "ss-tensho-count" }
    ] } },
  { id: "super_scroll",            name: "スーパースクロール", baseMax: 1000, effect: "振り分けPt +0.2%/個",
    ui: { kind: "count", unit: "個", showMax: true, slots: [
      { tool: "build-sim", section: "stat-point", inputId: "bs-scroll-count" },
      { tool: "status",    section: "stat-point", inputId: "ss-scroll-count" }
    ] } },
  { id: "sage_lost_item",          name: "賢者の落とし物",   baseMax: 1000, effect: "基礎ポイント上限 +10/個",
    ui: { kind: "count", unit: "個", showMax: true, slots: [
      { tool: "build-sim", section: "point-limit", inputId: "bs-sage-drop" },
      { tool: "status",    section: "point-limit", inputId: "ss-sage-drop" }
    ] } },
  { id: "forbidden_book",          name: "禁域の書物",       baseMax: 1000, effect: "基礎ポイント上限 +80/個",
    ui: { kind: "count", unit: "個", showMax: true, slots: [
      { tool: "build-sim", section: "point-limit", inputId: "bs-forbidden-book" },
      { tool: "status",    section: "point-limit", inputId: "ss-forbidden-book" }
    ] } },
  { id: "dragon_brand_kneader",    name: "ドラゴン印の手ごね機", baseMax: 1000, effect: "ペットの粉使用上限 +1/個",
    ui: { kind: "count", unit: "個", showMax: true, slots: [
      { tool: "pet-sim", section: "common", inputId: "kneaderInput" }
    ] } },
  { id: "convict_substitute_dinner", name: "死刑囚の身代わり晩餐", baseMax: 1000, effect: "主人公への被ダメージ -0.09%/個",
    ui: { kind: "count", unit: "個", showMax: false, slots: [
      { tool: "detail",    section: "defense", inputId: "detail-dinner-count" },
      { tool: "build-sim", section: "defense", inputId: "bs-dinner-count" }
    ] } },
  { id: "hades_helmet",            name: "ハデスの兜",       baseMax: 1000, effect: "ペットの最大レベル +1/個（上限Lv2200）",
    ui: { kind: "count", unit: "個", showMax: true, slots: [
      { tool: "pet-sim", section: "common", inputId: "helmetInput" }
    ] } },
  { id: "ancient_tilaphis_statue", name: "古のティラピス像", baseMax: 1000, effect: "天命輪廻倍率 -0.00005/個",
    ui: { kind: "count", unit: "個", showMax: false, slots: [
      { tool: "exp-calc", section: "hero", inputId: "heroTilapia" },
      { tool: "exp-calc", section: "pet",  inputId: "petTilapia" }
    ] } },
  { id: "sky_statue_adventurer",   name: "天空像~冒険者~",   baseMax: 1000, effect: "天空回廊で所持数分フロアが進む",
    ui: { kind: "count", unit: "個", showMax: false, slots: [
      { tool: "guide", section: "common", inputId: "ownedAdventurer" }
    ] } },
  { id: "sky_statue_devil",        name: "天空像~悪魔~",     baseMax: 1000, effect: "SG撃破時に所持数×100F追加",
    ui: { kind: "count", unit: "個", showMax: false, slots: [
      { tool: "guide", section: "common", inputId: "ownedDevil" }
    ] } },
  { id: "forbidden_liquid",        name: "禁域の液体",       baseMax: 1000, effect: "主人公HP +1%/個",
    ui: { kind: "count", unit: "個", showMax: false, slots: [] } }   // UI未実装
];

// ------------------------------------------------------------
// 属性相性
// ------------------------------------------------------------
// ペアは [攻撃側, 防御側]
const ELEMENT_CHART = {
  advantage:    1.3,
  disadvantage: 0.8,
  neutral:      1.0,
  advantagePairs: [
    ["fire",  "wood"],
    ["wood",  "water"],
    ["water", "fire"],
    ["light", "dark"],
    ["dark",  "light"]
  ],
  disadvantagePairs: [
    ["fire",  "water"],
    ["water", "wood"],
    ["wood",  "fire"],
    ["light", "light"],
    ["dark",  "dark"]
  ]
};

// ------------------------------------------------------------
// 属性表記の正規化テーブル
// ------------------------------------------------------------
// キーは小文字化・trim 済みの文字列を想定
const ELEMENT_ALIASES = {
  fire: "fire",
  "火": "fire",
  "火属性": "fire",
  water: "water",
  "水": "water",
  "水属性": "water",
  wood: "wood",
  tree: "wood",
  "木": "wood",
  "木属性": "wood",
  light: "light",
  "光": "light",
  "光属性": "light",
  dark: "dark",
  "闇": "dark",
  "闇属性": "dark"
};

// ------------------------------------------------------------
// ヘルパー
// ------------------------------------------------------------

// パンドラの有無を考慮した所持上限を返す
// 未知のIDは null を返す
function getMaterialMax(materialId, hasPandora) {
  const m = MATERIALS.find(x => x.id === materialId);
  if (!m) return null;
  return m.baseMax * (hasPandora ? 2 : 1);
}

// 魔法定義を返す。未知のIDは undefined
function getSpell(id) {
  const key = (id ?? "").toString().trim().toLowerCase();
  return SPELLS.find(s => s.id === key);
}
