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

(() => {
  const KEYS = {
    ORIGIN_EXP:    "onceworld_origin_exp",       // 生文字列 "1"/"0"
    CALC:          "calc_state_v5",
    DETAIL_CALC:   "detail_calc_state_v1",
    STATUS_INLINE: "status_sim_inline_v7",
    BUILD_SLOTS:   "status_sim_build_slots_v1",  // 名前付きビルド（ユーザー資産・要後方互換）
    SS_CALC:       "status_sim_ss_calc_v1",
    BUILD_SIM:     "build_sim_state_v1",
    EXP_HUNT:      "exp_calc_hunt_v1",
    CALC_TAB:      "calc_active_tab"             // 生文字列 "integrated"/"detail"
  };

  // --- JSON 用 ---

  // 読み込み。未保存・パース失敗・localStorage 不可のいずれも fallback を返す
  function read(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === "") return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  // 書き込み。成功したら true、失敗（容量超過・プライベートモード等）なら false
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- 生文字列用（JSON化しないキー向け） ---

  function readRaw(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (e) {
      return fallback;
    }
  }

  function writeRaw(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (e) {
      return false;
    }
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

  window.OWStorage = { KEYS, read, write, readRaw, writeRaw, remove, onChange };
})();
