// ============================================================
// material-ui.js  素材入力欄のUI自動生成
// game-data.js の MATERIALS を前提とする。より後に読み込むこと
// ============================================================
//
// HTML側は空のスロットを置くだけでよい。
//   <div data-material-slot="build-sim:stat-point"></div>
// renderMaterialSlots() が MATERIALS を走査し、ui.slots の tool:section が
// 一致する素材を定義順に生成して流し込む。
//
// IIFE + window 公開の形にしているため、二重読み込みしても SyntaxError にならない。

(() => {
  // 1素材分の入力欄DOMを生成して返す
  // material: MATERIALS の1要素 / slot: material.ui.slots の1要素
  function buildMaterialField(material, slot) {
    const ui = material.ui || {};
    const max = (typeof OWPandora !== "undefined")
      ? OWPandora.materialCap(material.id, material.baseMax) : material.baseMax;

    const row = document.createElement("div");
    row.className = "bs-point-limit-row material-row";
    row.setAttribute("data-material", material.id);

    const label = document.createElement("span");
    label.className = "bs-point-limit-label";
    label.textContent = material.name;
    row.appendChild(label);

    const input = document.createElement("input");
    input.id = slot.inputId;
    input.type = "number";
    input.min = "0";
    input.max = String(max);
    input.value = "0";
    input.className = "lv-input";
    row.appendChild(input);

    if (ui.showMax) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn material-max-btn";
      btn.textContent = "MAX";
      // インライン onclick ではなくリスナーで束ねる
      btn.addEventListener("click", () => {
        input.value = String(max);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      row.appendChild(btn);
    }

    if (ui.unit) {
      const unit = document.createElement("span");
      unit.className = "bs-label-text";
      unit.textContent = ui.unit + "（最大" + max.toLocaleString("ja-JP") + ui.unit + "）";
      row.appendChild(unit);
    }

    return row;
  }

  // ページ内の data-material-slot をすべて埋める。生成した欄数を返す
  // data-pandora-slot の容器にはパンドラのトグルだけを置く
  function renderMaterialSlots(root) {
    const r = root || document;
    const slots = r.querySelectorAll("[data-material-slot]");
    let count = 0;

    r.querySelectorAll("[data-pandora-slot]").forEach(container => {
      container.innerHTML = "";
      container.appendChild(buildPandoraToggle());
    });

    slots.forEach(container => {
      const key = (container.getAttribute("data-material-slot") || "").trim();
      const sep = key.indexOf(":");
      if (sep < 0) return;
      const tool = key.slice(0, sep);
      const section = key.slice(sep + 1);

      container.innerHTML = "";

      // 素材欄の先頭にパンドラの箱のトグルを置く
      if (container.getAttribute("data-pandora-toggle") !== "off") {
        container.appendChild(buildPandoraToggle());
      }

      MATERIALS.forEach(m => {
        const ui = m.ui;
        if (!ui || !Array.isArray(ui.slots)) return;
        ui.slots.forEach(slot => {
          if (slot.tool !== tool || slot.section !== section) return;
          container.appendChild(buildMaterialField(m, slot));
          count++;
        });
      });
    });

    return count;
  }

  // 定義とHTMLの整合を検証する（開発用）
  //   missing: 定義にあるがページ上に入力欄が無いもの
  //   orphan : ページ上にあるが定義に無い data-material 行
  function validateMaterialSlots(root) {
    const r = root || document;
    const missing = [];
    const orphan = [];
    const defined = new Set();

    MATERIALS.forEach(m => {
      const ui = m.ui;
      if (!ui || !Array.isArray(ui.slots)) return;
      ui.slots.forEach(slot => {
        defined.add(slot.inputId);
        if (!r.querySelector("#" + CSS.escape(slot.inputId))) {
          missing.push({ id: m.id, inputId: slot.inputId, tool: slot.tool, section: slot.section });
        }
      });
    });

    r.querySelectorAll("[data-material]").forEach(el => {
      const input = el.querySelector("input[id]");
      if (input && !defined.has(input.id)) orphan.push(input.id);
    });

    return { missing, orphan };
  }

  // --- パンドラの箱 ---

  // トグルUIを生成して返す（未所持 / 所持 の2ボタン）
  function buildPandoraToggle() {
    const row = document.createElement("div");
    row.className = "bs-point-limit-row material-pandora-row";

    const label = document.createElement("span");
    label.className = "bs-point-limit-label";
    label.textContent = "パンドラの箱";
    row.appendChild(label);

    const group = document.createElement("div");
    group.className = "chip-group";

    const owned = (typeof OWPandora !== "undefined") ? OWPandora.get() : false;
    [["0", "未所持"], ["1", "所持"]].forEach(([val, text]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn material-pandora-btn";
      btn.setAttribute("data-val", val);
      btn.setAttribute("aria-pressed", (val === "1") === owned ? "true" : "false");
      btn.textContent = text;
      btn.addEventListener("click", () => setPandora(val === "1"));
      group.appendChild(btn);
    });
    row.appendChild(group);

    const note = document.createElement("span");
    note.className = "bs-label-text";
    note.textContent = "効果素材の所持上限が2倍になる";
    row.appendChild(note);

    return row;
  }

  // 所持状態を変更し、上限を超えた入力値は即座に切り詰める
  function setPandora(owned) {
    if (typeof OWPandora === "undefined") return;
    OWPandora.set(owned);
  }

  // 全ボタンの押下状態を現在の所持状態に合わせる
  function syncPandoraButtons(root) {
    const r = root || document;
    const owned = (typeof OWPandora !== "undefined") ? OWPandora.get() : false;
    r.querySelectorAll(".material-pandora-btn").forEach(btn => {
      btn.setAttribute("aria-pressed",
        (btn.getAttribute("data-val") === "1") === owned ? "true" : "false");
    });
  }

  // 素材入力欄の max を現在の上限に合わせ、超過分を切り詰める
  // 戻り値は切り詰めた欄の数
  function applyMaterialCaps(root) {
    const r = root || document;
    let trimmed = 0;

    MATERIALS.forEach(m => {
      const ui = m.ui;
      if (!ui || !Array.isArray(ui.slots)) return;
      const max = (typeof OWPandora !== "undefined")
        ? OWPandora.materialCap(m.id, m.baseMax) : m.baseMax;

      ui.slots.forEach(slot => {
        const el = r.getElementById
          ? r.getElementById(slot.inputId)
          : r.querySelector("#" + slot.inputId);
        if (!el) return;
        el.max = String(max);
        const cur = Math.floor(Number(String(el.value ?? "").replace(/,/g, "")) || 0);
        if (cur > max) {
          el.value = String(max);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          trimmed++;
        }
        // 単位表示（同じ行の2つ目の span）も更新する
        const row = el.parentNode;
        if (row && row.querySelectorAll) {
          const spans = row.querySelectorAll(".bs-label-text");
          if (spans.length && ui.unit) {
            spans[spans.length - 1].textContent =
              ui.unit + "（最大" + max.toLocaleString("ja-JP") + ui.unit + "）";
          }
        }
      });
    });

    return trimmed;
  }

  // パンドラの状態が変わったらボタンと上限を追随させる
  if (typeof OWPandora !== "undefined" && typeof OWPandora.onChange === "function") {
    OWPandora.onChange(() => {
      syncPandoraButtons(document);
      applyMaterialCaps(document);
    });
  }

  window.OWMaterialUI = {
    buildMaterialField, renderMaterialSlots, validateMaterialSlots,
    buildPandoraToggle, syncPandoraButtons, applyMaterialCaps
  };

  // スロットを自動で埋める。
  // 利用側のJSは DOMContentLoaded 内で入力欄を参照するため、
  // それより早い DOMContentLoaded の最初のリスナーとして登録する
  // （material-ui.js を利用側より前に読み込むこと）。
  document.addEventListener("DOMContentLoaded", () => {
    renderMaterialSlots(document);
    // 直書きの入力欄も含めて現在の上限を反映する
    applyMaterialCaps(document);
    syncPandoraButtons(document);
  });
})();
