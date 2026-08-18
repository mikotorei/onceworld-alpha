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
    const max = (typeof getMaterialMax === "function")
      ? (getMaterialMax(material.id, false) || material.baseMax) : material.baseMax;

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
  function renderMaterialSlots(root) {
    const r = root || document;
    const slots = r.querySelectorAll("[data-material-slot]");
    let count = 0;

    slots.forEach(container => {
      const key = (container.getAttribute("data-material-slot") || "").trim();
      const sep = key.indexOf(":");
      if (sep < 0) return;
      const tool = key.slice(0, sep);
      const section = key.slice(sep + 1);

      container.innerHTML = "";
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

  window.OWMaterialUI = { buildMaterialField, renderMaterialSlots, validateMaterialSlots };
})();
