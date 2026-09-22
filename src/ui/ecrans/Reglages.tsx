/**
 * Réglages : thème, installation, hors ligne, notifications, à propos.
 */
import { useState } from "react";
import { METHODES, METHODES_JOUABLES } from "../../core/methodes";
import { ReglagesRemiseAZero } from "../reglages/ReglagesRemiseAZero";
import { reglage } from "../../data/contenu";
import { ecrireReglage } from "../../data/depot";
import { VERSION_APP } from "../../data/services";
import { demanderNotifications, etatNotifications, installer, notifier, type EtatNotifications } from "../../pwa/pwa";
import { useAppli } from "../contexte";
import { ReglagesAnalyse } from "../reglages/ReglagesAnalyse";
import { ReglagesBankroll } from "../reglages/ReglagesBankroll";
import { ReglagesJeuResponsable } from "../reglages/ReglagesJeuResponsable";
import { ReglagesMises } from "../reglages/ReglagesMises";
import { appliquerTheme, type Theme } from "../theme";

const THEMES: Array<{ t: Theme; libelle: string }> = [
  { t: "auto", libelle: "Automatique" },
  { t: "clair", libelle: "Clair" },
  { t: "sombre", libelle: "Sombre" },
];

const TEXTE_NOTIFS: Record<EtatNotifications, string> = {
  "non-supportees": "Ce navigateur ne permet pas les notifications ici. Elles fonctionneront une fois l'application installée sur ton écran d'accueil.",
  "a-demander": "Pas encore activées.",
  autorisees: "Activées.",
  refusees: "Bloquées. Pour les réactiver : dans Chrome, touche le cadenas à gauche de l'adresse, puis « Autorisations ».",
};

export function Reglages() {
  const { contenu, recharger, message, pwa } = useAppli();
  const theme = reglage<Theme>(contenu, "theme") ?? "auto";
  const [notifs, setNotifs] = useState<EtatNotifications>(etatNotifications());
  const construitLe = typeof __BUILD_DATE__ === "string" ? new Date(__BUILD_DATE__).toLocaleDateString("fr-FR") : "⏳";

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Réglages</h1>
      </div>

      <ReglagesBankroll />

      <section className="carte" aria-labelledby="titre-theme">
        <h2 id="titre-theme">Apparence</h2>
        <div className="segments" role="group" aria-labelledby="titre-theme">
          {THEMES.map((x) => (
            <button
              key={x.t}
              type="button"
              aria-pressed={theme === x.t}
              onClick={async () => {
                appliquerTheme(x.t);
                await ecrireReglage("theme", x.t);
                await recharger();
              }}
            >
              {x.libelle}
            </button>
          ))}
        </div>
      </section>

      <ReglagesJeuResponsable />

      <details className="repli avances" data-test="reglages-avances">
        <summary>Réglages avancés</summary>
        <p className="aide">Critères d'analyse des matchs, Kelly, plafonds de mise, objectifs du mois. Pas besoin d'y toucher pour commencer.</p>
        <div className="section">
          <ReglagesAnalyse />
          <ReglagesMises />
        </div>
      </details>

      <section className="carte" aria-labelledby="titre-installation">
        <h2 id="titre-installation">Installation et hors ligne</h2>
        <div className="faits">
          <div className="fait">
            <span>Sur l'écran d'accueil</span>
            <b>{pwa.installee ? "Installée" : "Non installée"}</b>
          </div>
          <div className="fait">
            <span>Sans réseau</span>
            <b data-test="etat-hors-ligne">
              {pwa.horsLigne === "pret" ? "Prête" : pwa.horsLigne === "installation" ? "Préparation…" : pwa.horsLigne === "erreur" ? "Échec" : "Indisponible ici"}
            </b>
          </div>
        </div>
        {pwa.horsLigne === "indisponible" && (
          <p className="aide">Le mode hors ligne et l'installation fonctionnent quand l'application est ouverte depuis son adresse d'hébergement, pas dans un aperçu.</p>
        )}
        {!pwa.installee && pwa.installable && (
          <button
            type="button"
            className="btn"
            onClick={async () => message((await installer()) ? "Application installée" : "Installation annulée")}
          >
            Installer l'application
          </button>
        )}
        {!pwa.installee && !pwa.installable && pwa.horsLigne === "pret" && (
          <p className="aide">Pour l'installer : menu ⋮ de Chrome, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».</p>
        )}
      </section>

      <section className="carte" aria-labelledby="titre-notifs">
        <h2 id="titre-notifs">Notifications</h2>
        <p className="aide" data-test="etat-notifs">{TEXTE_NOTIFS[notifs]}</p>
        <p className="aide">
          Elles sont créées sur le téléphone, sans serveur : une alerte ne peut donc partir que si l'application est ouverte ou vient d'être utilisée.
        </p>
        {notifs === "a-demander" && (
          <button type="button" className="btn" onClick={async () => setNotifs(await demanderNotifications())}>
            Activer les notifications
          </button>
        )}
        {notifs === "autorisees" && (
          <button
            type="button"
            className="btn secondaire"
            onClick={async () => {
              const r = await notifier("Carnet de Paris Foot", "Les notifications fonctionnent.", "#/reglages");
              message(r === "envoyee" ? "Notification envoyée" : "Notification impossible pour l'instant : réessaie une fois l'application installée.");
            }}
          >
            Envoyer une notification de test
          </button>
        )}
      </section>

      <section className="carte" aria-labelledby="titre-methodes">
        <h2 id="titre-methodes">Les méthodes</h2>
        <div className="faits">
          {METHODES.filter((m) => METHODES_JOUABLES.includes(m.nom)).map((m) => (
            <div className="fait" key={m.nom} style={{ display: "grid", gap: 2 }}>
              <b style={{ textAlign: "left", fontFamily: "var(--font)" }}>{m.libelle}</b>
              <span>{m.resume}</span>
            </div>
          ))}
        </div>
        <p className="aide">Aucune méthode ne gagne à tous les coups : l'app donne des estimations, qui peuvent se tromper.</p>
        <a className="btn secondaire" href="#/aide">Comment ça marche ? (tutoriel complet)</a>
      </section>

      <section className="carte" aria-labelledby="titre-recherche">
        <h2 id="titre-recherche">Recherche</h2>
        <p className="aide">Retrouve un match ou un pari par un mot.</p>
        <a className="btn secondaire" href="#/recherche">Rechercher</a>
      </section>

      <ReglagesRemiseAZero />

      <section className="carte" aria-labelledby="titre-apropos">
        <h2 id="titre-apropos">À propos</h2>
        <div className="faits">
          <div className="fait"><span>Version</span><b>{VERSION_APP}</b></div>
          <div className="fait"><span>Construite le</span><b>{construitLe}</b></div>
          <div className="fait"><span>Données envoyées à un serveur</span><b>Aucune</b></div>
        </div>
        <p className="aide">
          Réservé aux plus de 18 ans. Jouer comporte des risques : endettement, dépendance… Appelle le 09 74 75 13 13 (appel non surtaxé) ou va
          sur joueurs-info-service.fr.
        </p>
      </section>
    </>
  );
}
