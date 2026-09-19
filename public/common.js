const THEME_KEY = "irr-theme";
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function resolveTheme(theme) {
  if (theme === "light" || theme === "dark") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function applyTheme(theme) {
  const mode = resolveTheme(theme || localStorage.getItem(THEME_KEY) || "system");
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}
async function loadSettings() {
  const s = await fetch("/api/settings").then((r) => r.json());
  localStorage.setItem(THEME_KEY, s.theme || "system");
  applyTheme(s.theme);
  return s;
}
function convertTemp(c, unit) { return unit === "F" ? (c * 9) / 5 + 32 : c; }
function convertHumidity(pct, unit) { return unit === "ratio" ? pct / 100 : pct; }
function convertPressure(hpa, unit) {
  if (hpa == null) return null;
  if (unit === "mmHg") return hpa * 0.750061683;
  if (unit === "inHg") return hpa * 0.029529983;
  return hpa;
}
function labelsFor(s) {
  return {
    temp: s.temp_unit === "F" ? "\u00b0F" : "\u00b0C",
    humidity: s.humidity_unit === "ratio" ? "0-1" : "%",
    pressure: s.pressure_unit || "hPa",
  };
}
function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return "-";
  return Number(n).toFixed(digits);
}
applyTheme(localStorage.getItem(THEME_KEY) || "system");
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  applyTheme(localStorage.getItem(THEME_KEY) || "system");
});
