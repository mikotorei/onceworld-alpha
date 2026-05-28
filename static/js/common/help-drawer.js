(() => {
  const btn     = document.getElementById("owHelpBtn");
  const drawer  = document.getElementById("owHelpDrawer");
  const overlay = document.getElementById("owHelpOverlay");
  const close   = document.getElementById("owHelpClose");

  if (!btn || !drawer || !overlay) return;

  const open = () => {
    overlay.hidden = false;
    drawer.hidden  = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      drawer.classList.add("open");
    }));
    drawer.setAttribute("aria-hidden", "false");
  };

  const closeDrawer = () => {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      overlay.hidden = true;
    }, 260);
  };

  btn.addEventListener("click", open);
  close?.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);
})();
