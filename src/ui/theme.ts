/** Thème : automatique (suit le téléphone), clair ou sombre. */
export type Theme = "auto" | "clair" | "sombre";

export function appliquerTheme(t: Theme | undefined): void {
  const racine = document.documentElement;
  if (t === "clair") racine.setAttribute("data-theme", "light");
  else if (t === "sombre") racine.setAttribute("data-theme", "dark");
  else racine.removeAttribute("data-theme");
  const sombre = t === "sombre" || (t !== "clair" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", sombre ? "#0F1512" : "#17663F");
}
