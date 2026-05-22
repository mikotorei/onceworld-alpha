// static/js/monster-level.js
(() => {
  const LEVELSCALE = 0.1;

  const STORAGE_KEY_ORIGIN = "onceworld_origin_exp"; // 経験の起源 保存キー

  const clampLv = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  };

  const isDigits = (s) => /^\d+$/.test(s);

  const calcStat = (base, lv) => Math.floor(base * (1 + (lv - 1) * LEVELSCALE));
  const calcRealHp = (vit) => vit * 18;

  const calcExpMultiplier = (lv) => {
    const raw = 0.2 * Math.pow(lv, 1.1);
    const floored = Math.floor(raw);
    return Math.max(1, floored);
  };

  const init = () => {
    const levelInput = document.getElementById("monster-level");
    const statEls = document.querySelectorAll("#status-table dd[data-base]");
    const lvBtns = document.querySelectorAll(".d-btn[data-lv]");
    const originExp = document.getElementById("origin-exp");
    const expEl = document.getElementById("exp-value");
    const realHpEl = document.getElementById("real-hp");

    const statusRoot = document.getElementById("status-table");
    const rewardRoot = expEl ? expEl.closest(".d-list") : null;

    if (!levelInput || statEls.length === 0) return;

    // ▼ 起源チェックの復元（localStorage）
    if (originExp) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_ORIGIN);
        if (saved === "1") originExp.checked = true;
        if (saved === "0") originExp.checked = false;
      } catch (_) {}
    }

    const recalcStats = (lv) => {
      let scaledVit = null;

      statEls.forEach((el) => {
        const base = Number(el.dataset.base);
        const stat = el.dataset.stat || "";
        if (!Number.isFinite(base)) return;

        if (stat === "mov") {
          el.textContent = String(base);
          return;
        }

        const value = calcStat(base, lv);
        el.textContent = String(value);

        if (stat === "vit") {
          scaledVit = value;
        }
      });

      if (realHpEl && scaledVit !== null) {
        realHpEl.textContent = String(calcRealHp(scaledVit));
      }
    };

    const recalcExp = (lv) => {
      if (!expEl) return;

      const baseRaw = Number(expEl.dataset.base);
      if (!Number.isFinite(baseRaw)) return;

      const base = (originExp && originExp.checked) ? baseRaw * 2 : baseRaw;
      const mult = calcExpMultiplier(lv);

      expEl.textContent = String(base * mult);
    };

    let rafId = 0;
    const requestRecalc = (normalizeInput) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;

        const raw = (levelInput.value || "").trim();

        if (raw === "") return;
        if (!isDigits(raw)) return;

        const lv = clampLv(raw);
        if (normalizeInput) levelInput.value = String(lv);

        recalcStats(lv);
        recalcExp(lv);

        if (typeof window.formatNumbers === "function") {
          if (statusRoot) window.formatNumbers(statusRoot);
          if (rewardRoot) window.formatNumbers(rewardRoot);
        }
      });
    };

    // ボタン
    lvBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        levelInput.value = btn.dataset.lv || "1";
        requestRecalc(true);
      });
    });

    // 入力中：空OK、書き戻ししない
    levelInput.addEventListener("input", () => {
      if ((levelInput.value || "") === "" && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        return;
      }
      requestRecalc(false);
    });

    // 入力確定：正規化して反映
    levelInput.addEventListener("change", () => requestRecalc(true));

    // フォーカス外れ：空なら1に戻す
    levelInput.addEventListener("blur", () => {
      const raw = (levelInput.value || "").trim();
      if (raw === "") {
        levelInput.value = "1";
      }
      requestRecalc(true);
    });

    if (originExp) {
      originExp.addEventListener("change", () => {
        // ▼ 起源チェックの保存（localStorage）
        try {
          localStorage.setItem(STORAGE_KEY_ORIGIN, originExp.checked ? "1" : "0");
        } catch (_) {}

        requestRecalc(true);
      });
    }

    requestRecalc(true);
  };

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
})();
