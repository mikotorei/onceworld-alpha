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
// baseMax: 通常時の所持上限。パンドラ所持で2倍になる（getMaterialMax を使うこと）
// id は content/item/ のファイル名に合わせている
// （スーパースクロールのみ素材ページ未作成のため super_scroll を暫定採用）
const MATERIALS = [
  { id: "battle_crystal_cube",     name: "闘晶立方体",       baseMax: 1000, effect: "物理ダメージ +1%/個" },
  { id: "magic_crystal_cube",      name: "魔晶立方体",       baseMax: 1000, effect: "解析書補正後のINT +1%/個" },
  { id: "johanne_quill",           name: "ヨハネの羽ペン",   baseMax: 1000, effect: "振り分けPt +1%/個" },
  { id: "johanne_altar",           name: "ヨハネの祭壇",     baseMax: 1000, effect: "振り分けPt +0.2%/個" },
  { id: "status_crystal",          name: "ステータス天晶",   baseMax: 1000, effect: "振り分けPt +10000/個" },
  { id: "super_scroll",            name: "スーパースクロール", baseMax: 1000, effect: "振り分けPt +0.2%/個" },
  { id: "forbidden_liquid",        name: "禁域の液体",       baseMax: 1000, effect: "主人公HP +1%/個" },
  { id: "ancient_tilaphis_statue", name: "古のティラピス像", baseMax: 1000, effect: "天命輪廻倍率 -0.00005/個" },
  { id: "sky_statue_adventurer",   name: "天空像~冒険者~",   baseMax: 1000, effect: "天空回廊で所持数分フロアが進む" },
  { id: "sky_statue_devil",        name: "天空像~悪魔~",     baseMax: 1000, effect: "SG撃破時に所持数×100F追加" },
  { id: "sage_lost_item",          name: "賢者の落とし物",   baseMax: 1000, effect: "基礎ポイント上限 +10/個" },
  { id: "forbidden_book",          name: "禁域の書物",       baseMax: 1000, effect: "基礎ポイント上限 +80/個" }
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
