/**
 * Point d'entrée : styles, service worker (hors ligne) et interface.
 */
import "./ui/styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { demarrerPwa } from "./pwa/pwa";

const racine = document.getElementById("app")!;
// Signale au filet de sécurité (public/demarrage.js) que l'application a bien démarré.
racine.setAttribute("data-demarree", "1");
try {
  sessionStorage.removeItem("carnet-foot-rechargee");
} catch {
  /* stockage indisponible */
}
demarrerPwa();
createRoot(racine).render(<App />);
