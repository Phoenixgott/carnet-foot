/**
 * Petites animations « maison », sans dépendance : chiffres qui comptent, carte inclinée en 3D
 * au pointeur. Tout est instantané si le téléphone demande de réduire les animations
 * (`prefers-reduced-motion`) ; les transitions/animations CSS sont coupées globalement dans
 * styles.css, mais ces deux effets sont pilotés en JavaScript et doivent le vérifier eux-mêmes.
 */
import { useEffect, useRef, useState } from "react";

export function reduireMouvement(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Anime un nombre de 0 (au premier affichage) ou de sa valeur précédente (ensuite) vers `cible`.
 * Utilisé pour le chiffre de bankroll de l'accueil : il « compte » au lieu d'apparaître d'un coup.
 */
export function useCompte(cible: number, duree = 900): number {
  const fini = Number.isFinite(cible);
  const [valeur, setValeur] = useState(fini && !reduireMouvement() ? 0 : cible);
  const precedent = useRef(fini && !reduireMouvement() ? 0 : cible);
  const premier = useRef(true);
  useEffect(() => {
    // Pas de nombre à animer (ex. rentabilité « ? » quand aucun pari n'est terminé) : affiché tel quel.
    if (!fini || reduireMouvement()) {
      setValeur(cible);
      if (fini) precedent.current = cible;
      premier.current = false;
      return;
    }
    const debut = premier.current ? 0 : precedent.current;
    premier.current = false;
    if (debut === cible) {
      setValeur(cible);
      return;
    }
    const t0 = performance.now();
    let id = 0;
    const pas = (t: number) => {
      const p = Math.min(1, (t - t0) / duree);
      const amorti = 1 - (1 - p) ** 3; // décélère en fin de course
      setValeur(debut + (cible - debut) * amorti);
      if (p < 1) id = requestAnimationFrame(pas);
      else precedent.current = cible;
    };
    id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, [cible, duree]);
  return valeur;
}

/**
 * Légère inclinaison 3D d'une carte selon la position du pointeur (souris uniquement : au doigt,
 * il cache la carte). Pose deux variables CSS (--incl-x/--incl-y) que styles.css utilise dans un
 * `transform`. Ne fait rien si les animations sont réduites.
 */
export function useInclinaison3D<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduireMouvement()) return;
    const remettre = () => {
      el.style.setProperty("--incl-x", "0deg");
      el.style.setProperty("--incl-y", "0deg");
    };
    const surPointeur = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--incl-x", (py * -7).toFixed(2) + "deg");
      el.style.setProperty("--incl-y", (px * 9).toFixed(2) + "deg");
    };
    el.addEventListener("pointermove", surPointeur);
    el.addEventListener("pointerleave", remettre);
    return () => {
      el.removeEventListener("pointermove", surPointeur);
      el.removeEventListener("pointerleave", remettre);
    };
  }, []);
  return ref;
}
