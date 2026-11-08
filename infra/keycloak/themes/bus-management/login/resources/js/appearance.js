// Appearance only: never read tokens, credentials or authentication cookies.
(() => {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    let preference = "system";
    try {
      const saved = document.cookie
        .split("; ")
        .find((item) => item.startsWith("bus-management.appearance="))
        ?.split("=")[1];
      if (["light", "dark", "system"].includes(saved)) preference = saved;
    } catch {
      // Follow the device if optional browser storage is disabled.
    }
    const root = document.documentElement;
    root.dataset.theme = preference;
    root.classList.toggle(
      "pf-v5-theme-dark",
      preference === "dark" || (preference === "system" && media.matches),
    );
  }
  apply();
  media.addEventListener("change", apply);
  window.addEventListener("pageshow", apply);
})();
