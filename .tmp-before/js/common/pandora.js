// ============================================================
// pandora.js  パンドラの箱の所持状態（全ツール共通）
// storage-manager.js を前提とする。より後に読み込むこと
// ============================================================
//
// パンドラの箱は「大切なもの」枠のアイテムで、効果素材の所持上限を
// 1000 から 2000 に引き上げる。上限が伸びると効果も比例して伸びる。
//
// 所持状態は localStorage に1件だけ持ち、全ツールで共有する。
// 別タブでの変更も storage イベントで拾って同期する。
//
// IIFE + window 公開の形にしているため、二重読み込みしても SyntaxError にならない。

(() => {
  const KEY = (typeof OWStorage !== "undefined") ? OWStorage.KEYS.PANDORA : "onceworld_pandora";

  let cached = null;              // 未読み込みは null
  const listeners = [];

  // 現在の所持状態を返す
  function get() {
    if (cached === null) {
      cached = (typeof OWStorage !== "undefined")
        ? OWStorage.read(KEY, false) === true
        : false;
    }
    return cached;
  }

  // 所持状態を変更して保存し、購読者へ通知する
  function set(value) {
    const next = !!value;
    if (cached !== null && cached === next) return next;
    cached = next;
    if (typeof OWStorage !== "undefined") OWStorage.write(KEY, next);
    notify(next);
    return next;
  }

  function notify(value) {
    listeners.forEach(fn => {
      try { fn(value); } catch (e) {}
    });
  }

  // 変更を購読する。解除用の関数を返す
  function onChange(callback) {
    if (typeof callback !== "function") return () => {};
    listeners.push(callback);
    return () => {
      const i = listeners.indexOf(callback);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  // 別タブでの変更に追随する
  if (typeof OWStorage !== "undefined" && typeof OWStorage.onChange === "function") {
    OWStorage.onChange(KEY, () => {
      const before = cached;
      cached = OWStorage.read(KEY, false) === true;
      if (before !== cached) notify(cached);
    });
  }

  // 素材の現在の所持上限を返す（パンドラの状態を自動で加味する）
  // 未知のIDや game-data.js 未読み込みのときは fallback を返す
  function materialCap(materialId, fallback) {
    const fb = (fallback === undefined || fallback === null) ? 1000 : fallback;
    if (typeof getMaterialMax !== "function") return fb;
    const max = getMaterialMax(materialId, get());
    return (max === null || max === undefined) ? fb : max;
  }

  window.OWPandora = { get, set, onChange, materialCap, KEY };
})();
