/**
 * Point d'entrée : styles, service worker (hors ligne) et interface.
 */
import "./ui/styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { demarrerPwa } from "./pwa/pwa";

demarrerPwa();
createRoot(document.getElementById("app")!).render(<App />);
