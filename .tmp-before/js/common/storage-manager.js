// ============================================================
// storage-manager.js  localStorage の共通ラッパー
// 他ファイルに依存しない。利用側より先に読み込むこと
// ============================================================
//
// IIFE + window 公開の形にしているため、同一ページで二重読み込みしても
// SyntaxError にならない（game-data.js はトップレベル const のため不可）。
//
// 名前は OWStorage。window.Storage はブラウザ組み込みの Storage
// インターフェース（localStorage の型）なので上書きしてはいけない。
//
// --- スキーマバージョン ---
// JSONキーは { __v: <番号>, data: <実データ> } の封筒に入れて保存する。
// __v を持たない保存済みデータは「バージョン0（封筒なしの旧形式）」として扱い、
// MIGRATIONS を順に適用してから返す。
// 現時点の移行は v0 -> v1 の無変換のみで、実データには一切手を加えない。
//
// 呼び出し側は従来どおり read/write を使えばよい（封筒は透過的に処理される）。

(() => {
  const KEYS = {
    ORIGIN_EXP:    "onceworld_origin_exp",       // boolean（旧形式の "1"/"0" は移行で吸収）
    CALC:          "calc_state_v5",
    DETAIL_CALC:   "detail_calc_state_v1",
    STATUS_INLINE: "status_sim_inline_v7",
    BUILD_SLOTS:   "status_sim_build_slots_v1",  // 名前付きビルド（ユーザー資産・要後方互換）
    SS_CALC:       "status_sim_ss_calc_v1",
    BUILD_SIM:     "build_sim_state_v1",
    EXP_HUNT:      "exp_calc_hunt_v1",
    CALC_TAB:      "calc_active_tab",            // 生文字列 "integrated"/"detail"
    PANDORA:       "onceworld_pandora"           // boolean。効果素材の所持上限が2倍になる
  };

  // 現行スキーマバージョン。ここに載っているキーだけ封筒に入る。
  // 生文字列キー（ORIGIN_EXP / CALC_TAB）は対象外。
  const SCHEMA_VERSIONS = {
    [KEYS.PANDORA]:       1,
    [KEYS.ORIGIN_EXP]:    1,
    [KEYS.CALC]:          1,
    [KEYS.DETAIL_CALC]:   1,
    [KEYS.STATUS_INLINE]: 1,
    [KEYS.BUILD_SLOTS]:   1,
    [KEYS.SS_CALC]:       1,
    [KEYS.BUILD_SIM]:     1,
    [KEYS.EXP_HUNT]:      1
  };

  // 移行関数。MIGRATIONS[key][n] は「バージョン n のデータを n+1 にする」関数。
  // 未定義なら無変換（データをそのまま次のバージョンとして扱う）。
  // 例: MIGRATIONS[KEYS.CALC] = { 1: (d) => ({ ...d, newField: 0 }) };
  const MIGRATIONS = {
    // 経験の起源: 旧形式は生文字列 "1"/"0"（JSON.parse すると数値 1/0）だった。
    // 数値・文字列・真偽値のいずれで保存されていても boolean に揃える。
    [KEYS.ORIGIN_EXP]: {
      0: (d) => d === true || d === 1 || d === "1"
    }
  };

  // 失うと復元できないユーザー資産。旧形式を最初に読んだ時点で退避する。
  const BACKUP_KEYS = [KEYS.BUILD_SLOTS];
  const BACKUP_SUFFIX = "__pre_v1_backup";

  const backupKeyOf = (key) => key + BACKUP_SUFFIX;

  // --- 低レベル ---

  function getRaw(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function setRaw(key, str) {
    try {
      localStorage.setItem(key, str);
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- 封筒 ---

  function isEnvelope(v) {
    return !!v
      && typeof v === "object"
      && !Array.isArray(v)
      && Object.prototype.hasOwnProperty.call(v, "__v")
      && Object.prototype.hasOwnProperty.call(v, "data")
      && typeof v.__v === "number";
  }

  // 旧形式（封筒なし）を初めて読み書きするときに一度だけ退避する。
  // 既に退避済み・未保存・封筒済みのいずれでも何もしない
  function backupLegacyOnce(key) {
    if (BACKUP_KEYS.indexOf(key) < 0) return false;
    const bk = backupKeyOf(key);
    if (getRaw(bk) !== null) return false;   // 退避済み
    const cur = getRaw(key);
    if (cur === null || cur === "") return false;   // 保存データなし
    try {
      if (isEnvelope(JSON.parse(cur))) return false;  // 既に封筒済み＝退避不要
    } catch (e) {
      return false;   // 壊れたJSONは退避しない
    }
    return setRaw(bk, cur);
  }

  function migrate(key, data, fromVersion, toVersion) {
    const steps = MIGRATIONS[key] || {};
    let out = data;
    for (let v = fromVersion; v < toVersion; v++) {
      const fn = steps[v];
      if (typeof fn === "function") out = fn(out);
      // 未定義なら無変換
    }
    return out;
  }

  // --- JSON 用 ---

  // 読み込み。未保存・パース失敗・localStorage 不可のいずれも fallback を返す
  function read(key, fallback = null) {
    const raw = getRaw(key);
    if (raw === null || raw === "") return fallback;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
    if (parsed === null || parsed === undefined) return fallback;

    const target = SCHEMA_VERSIONS[key];
    if (target === undefined) return parsed;  // バージョン管理外のキー

    if (isEnvelope(parsed)) {
      const data = parsed.data;
      if (data === null || data === undefined) return fallback;
      return migrate(key, data, parsed.__v, target);
    }

    // 封筒なし = 旧形式（バージョン0）
    backupLegacyOnce(key);
    return migrate(key, parsed, 0, target);
  }

  // 書き込み。成功したら true、失敗（容量超過・プライベートモード等）なら false
  function write(key, value) {
    const target = SCHEMA_VERSIONS[key];
    const payload = target === undefined ? value : { __v: target, data: value };
    let str;
    try {
      str = JSON.stringify(payload);
    } catch (e) {
      return false;
    }
    // 旧形式を上書きする前に退避する
    backupLegacyOnce(key);
    return setRaw(key, str);
  }

  // --- 生文字列用（JSON化しないキー向け） ---

  function readRaw(key, fallback = null) {
    const raw = getRaw(key);
    return raw === null ? fallback : raw;
  }

  function writeRaw(key, value) {
    return setRaw(key, String(value));
  }

  // --- 共通 ---

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 別タブでの変更を購読する。解除用の関数を返す
  function onChange(key, callback) {
    const handler = (e) => {
      if (e.key === key) callback(e);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }

  window.OWStorage = {
    KEYS, SCHEMA_VERSIONS, BACKUP_KEYS, BACKUP_SUFFIX,
    read, write, readRaw, writeRaw, remove, onChange, backupKeyOf
  };
})();
