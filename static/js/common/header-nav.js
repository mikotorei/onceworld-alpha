(() => {
  const header = document.getElementById("owHeader");
  const button = header?.querySelector(".ow-hamburger");
  const menu = document.getElementById("owMenu");
  const overlay = document.getElementById("owOverlay");

  if (!header || !button || !menu || !overlay) return;

  const openMenu = () => {
    menu.hidden = false;
    overlay.hidden = false;

    requestAnimationFrame(() => header.classList.add("ow-menu-open"));

    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "メニューを閉じる");
    document.body.classList.add("ow-no-scroll");
  };

  const closeMenu = () => {
    header.classList.remove("ow-menu-open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "メニューを開く");
    document.body.classList.remove("ow-no-scroll");

    window.setTimeout(() => {
      if (!header.classList.contains("ow-menu-open")) {
        menu.hidden = true;
        overlay.hidden = true;
      }
    }, 200);
  };

  const toggleMenu = () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    expanded ? closeMenu() : openMenu();
  };

  button.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
      closeMenu();
    }
  });

  menu.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) closeMenu();
  });

  window.addEventListener("resize", () => {
    if (button.getAttribute("aria-expanded") === "true") closeMenu();
  });
})();
