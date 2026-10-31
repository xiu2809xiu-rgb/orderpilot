// Runs before first paint so the wrong theme never flashes. It is a file, not
// an inline script, because the Content-Security-Policy allows scripts from our
// own origin only. The key and the values match src/lib/theme.ts.
(function () {
  var stored;
  try {
    stored = localStorage.getItem("op-theme");
  } catch {
    // Storage can be blocked. Fall back to the system theme.
  }
  var dark =
    stored === "dark" ||
    ((stored === undefined || stored === null || stored === "system") &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  var root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
})();
