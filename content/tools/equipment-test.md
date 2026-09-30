---
draft: true
title: "装備DBテスト"
---

<div class="equip-test">
  <h2>equipment.json 読み込みテスト</h2>
  <button id="loadEquipBtn" type="button">読み込み</button>
  <pre id="equipTestResult"></pre>
</div>

<style>
  .equip-test{
    max-width: 900px;
  }

  #loadEquipBtn{
    border: 1px solid rgba(0,0,0,.18);
    border-radius: 12px;
    padding: 8px 12px;
    background: #fff;
    cursor: pointer;
    margin: 8px 0 12px;
  }

  #equipTestResult{
    white-space: pre-wrap;
    border: 1px solid rgba(0,0,0,.12);
    border-radius: 12px;
    padding: 12px;
    background: rgba(0,0,0,.02);
  }
</style>

<script>
document.addEventListener("DOMContentLoaded", () => {

  const btn = document.getElementById("loadEquipBtn");
  const out = document.getElementById("equipTestResult");

  btn?.addEventListener("click", async () => {

    try {

      out.textContent = "読み込み中...";

      const base = window.location.origin + window.location.pathname.split("/tools")[0];

      const url = base + "/db/equipment.json";

      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      const count = Array.isArray(data.items) ? data.items.length : 0;
      const first = count > 0 ? data.items[0] : null;

      out.textContent =
        "件数: " + count + "\n\n" +
        "先頭データ:\n" +
        JSON.stringify(first, null, 2);

    } catch (e) {

      out.textContent =
        "読み込み失敗\n\n" +
        String(e?.message ?? e);

    }

  });

});
</script>
