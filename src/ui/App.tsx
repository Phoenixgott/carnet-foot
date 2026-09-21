/**
 * Coquille de l'application : en-tête, navigation, chargement des données,
 * messages, confirmations et bandeau de mise à jour.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { eur } from "../core/format";
import { bankrollCourante } from "../core/paris";
import type { Resultat } from "../core/types";
import { contexteAnalyse } from "../data/analyse";
import { bankrollDe, contenuVide, estVide, reglage, type Contenu } from "../data/contenu";
import { lireContenu, lireResultats } from "../data/depot";
import { assurerCopieDuJour, dateDernierExport } from "../data/services";
import { appliquerMiseAJour, ecouterPwa, type EtatPwa } from "../pwa/pwa";
import { Confirmation, Icone } from "./composants";
import { ContexteAppli, lireRoute, ROUTES, type Appli, type OptionsConfirmation, type Route } from "./contexte";
import { Accueil } from "./ecrans/Accueil";
import { Donnees } from "./ecrans/Donnees";
import { Equipe } from "./ecrans/Equipe";
import { Live } from "./ecrans/Live";
import { Matchs } from "./ecrans/Matchs";
import { Paris } from "./ecrans/Paris";
import { Reglages } from "./ecrans/Reglages";
import { appliquerTheme, type Theme } from "./theme";

const ECRANS: Record<Route, () => any> = { accueil: Accueil, matchs: Matchs, live: Live, paris: Paris, donnees: Donnees, reglages: Reglages, equipe: Equipe };

export function App() {
  const [route, setRoute] = useState<Route>(lireRoute());
  const [contenu, setContenu] = useState<Contenu | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [demande, setDemande] = useState<OptionsConfirmation | null>(null);
  const [pwa, setPwa] = useState<EtatPwa>({ horsLigne: "indisponible", miseAJourPrete: false, installable: false, installee: false });
  const [dernierExport, setDernierExport] = useState<Date | null>(null);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [, setAdresse] = useState(window.location.hash);
  const reponse = useRef<((ok: boolean) => void) | null>(null);
  const minuterie = useRef<number | null>(null);
  const premierAffichage = useRef(true);

  const recharger = useCallback(async () => {
    const c = await lireContenu();
    appliquerTheme(reglage<Theme>(c, "theme"));
    setDernierExport(await dateDernierExport());
    setContenu(c);
  }, []);
  const rechargerResultats = useCallback(async () => setResultats(await lireResultats()), []);
  const contexteDe = useMemo(() => contexteAnalyse(contenu ?? contenuVide(), resultats), [contenu, resultats]);

  useEffect(() => {
    (async () => {
      try {
        await recharger();
        await rechargerResultats();
        if (await assurerCopieDuJour()) await recharger();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : String(e));
      }
    })();
    const auRetour = () => {
      if (document.visibilityState === "visible") assurerCopieDuJour().catch(() => {});
    };
    document.addEventListener("visibilitychange", auRetour);
    // L'adresse complète est gardée aussi : une fiche équipe à une autre se réaffiche.
    const surHash = () => {
      setRoute(lireRoute());
      setAdresse(window.location.hash);
    };
    window.addEventListener("hashchange", surHash);
    const arreterPwa = ecouterPwa(setPwa);
    return () => {
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("hashchange", surHash);
      arreterPwa();
    };
  }, [recharger, rechargerResultats]);

  // Changement d'écran : on remonte en haut et on place le focus sur le titre (lecteurs d'écran).
  useEffect(() => {
    if (premierAffichage.current) {
      premierAffichage.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [route]);

  const message = useCallback((texte: string) => {
    setToast(texte);
    if (minuterie.current) window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const confirmer = useCallback(
    (o: OptionsConfirmation) =>
      new Promise<boolean>((resolve) => {
        reponse.current = resolve;
        setDemande(o);
      }),
    [],
  );
  const repondre = (ok: boolean) => {
    setDemande(null);
    reponse.current?.(ok);
    reponse.current = null;
  };

  if (erreur) {
    return (
      <main id="contenu">
        <h1>Impossible d'ouvrir tes données</h1>
        <div className="bandeau erreur" role="alert">
          <p>{erreur}</p>
          <p>Vérifie que tu n'es pas en navigation privée, puis recharge la page.</p>
        </div>
      </main>
    );
  }
  if (!contenu) {
    return (
      <main id="contenu" aria-busy="true">
        <p className="aide">Chargement…</p>
      </main>
    );
  }

  const appli: Appli = { contenu, recharger, message, confirmer, pwa, dernierExport, resultats, rechargerResultats, contexteDe };
  const Ecran = ECRANS[route];
  const vide = estVide(contenu);

  return (
    <ContexteAppli.Provider value={appli}>
      <a className="lien-evitement" href="#contenu" onClick={(e: Event) => { e.preventDefault(); document.querySelector<HTMLElement>("main h1")?.focus(); }}>
        Aller au contenu
      </a>
      <header className="entete">
        <div className="entete-in">
          <p className="marque">
            <img src="./icons/icon-192.png" alt="" width={30} height={30} />
            Carnet de <span>Paris</span> Foot
          </p>
          {!vide && (
            <p className="bankroll-entete" style={{ margin: 0 }}>
              Bankroll <b className="num" data-test="bankroll-entete">{eur(bankrollCourante(contenu.paris, bankrollDe(contenu)))}</b>
            </p>
          )}
        </div>
      </header>

      {pwa.miseAJourPrete && (
        <div className="maj" style={{ padding: "8px 16px 0", maxWidth: 720, margin: "0 auto" }}>
          <div className="bandeau info" role="status">
            <p>Une nouvelle version de l'application est prête.</p>
            <button type="button" className="btn" onClick={() => appliquerMiseAJour()}>Mettre à jour</button>
          </div>
        </div>
      )}

      <main id="contenu">
        <Ecran />
      </main>

      <nav className="onglets" aria-label="Navigation principale">
        <ul>
          {ROUTES.map((r) => (
            <li key={r.route}>
              <a href={`#/${r.route}`} aria-current={route === r.route ? "page" : undefined}>
                <Icone nom={r.route} />
                {r.libelle}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Zone lue par les lecteurs d'écran, toujours présente ; le toast visible est décoratif. */}
      <div className="sr-only" role="status" aria-live="polite">{toast ?? ""}</div>
      {toast && (
        <div className="toast" aria-hidden="true" data-test="toast">
          {toast}
        </div>
      )}
      <Confirmation demande={demande} repondre={repondre} />
    </ContexteAppli.Provider>
  );
}
