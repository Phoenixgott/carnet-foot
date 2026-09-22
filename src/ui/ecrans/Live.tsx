/**
 * Live +1.5 : écran pensé pour une main, en plein match.
 *
 *  1. Chronomètre et fenêtre 15ᵉ-20ᵉ minute (alerte : bandeau, vibration, notification).
 *  2. « J'entre ? » : cote proposée, score, match animé → verdict, cote juste et cote minimale
 *     à cette minute (nouveau modèle, avec la répartition réelle des buts dans le temps).
 *  3. Pari pris → bouton « BUT ! ».
 *  4. Couverture instantanée : pari contraire, exchange (lay) ou cash-out, avec le résultat
 *     de chaque scénario (2ᵉ but / plus de but), en couvrant et sans couvrir.
 * L'état (chronomètre, pari) est gardé sur l'appareil : fermer l'app ne perd rien.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { estNombre, eur, fr, lireSaisie, pc } from "../../core/format";
import { alerteMise, miseConseilleeSelonReglages } from "../../core/mises";
import { analyserV2 } from "../../core/modele-v2/analyse";
import {
  chancesLive,
  couvrir,
  decisionLive,
  fenetre,
  tableauLive,
  type EtatFenetre,
  type ModeCouverture,
} from "../../core/modele-v2/live";
import { repartition } from "../../core/modele-v2/temps";
import type { Match } from "../../core/types";
import { reglagesMisesDe } from "../../data/bankroll";
import { deposerBrouillonPari } from "../../data/brouillon-pari";
import { bankrollDe } from "../../data/contenu";
import { ecrireEtatLive, ETAT_LIVE_VIDE, lireEtatLive, tempsEcoule, type EtatLive } from "../../data/live";
import { jourLocal } from "../../data/versions";
import { etatNotifications, notifier } from "../../pwa/pwa";
import { PastilleVerdict } from "../composants";
import { ChampNombre, Choix, nombreOuNull } from "../champs";
import { parametresRoute, useAppli } from "../contexte";

/** Heure actuelle rafraîchie chaque seconde tant que `actif` ; recalculée dès que l'écran revient au premier plan. */
function useMaintenant(actif: boolean): number {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    if (!actif) return;
    const tick = () => setT(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    const auRetour = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [actif]);
  return t;
}

const TEXTE_FENETRE: Record<EtatFenetre, string> = {
  "non-lance": "info",
  "trop-tot": "info",
  bientot: "attention",
  ouverte: "ok",
  passee: "attention",
  tard: "erreur",
};

export function Live() {
  const { contenu, contexteDe, message, confirmer } = useAppli();
  const courant = useRef<EtatLive>(ETAT_LIVE_VIDE);
  const [etat, setEtatBrut] = useState<EtatLive>(ETAT_LIVE_VIDE);
  const [charge, setCharge] = useState(false);
  const [coteTexte, setCoteTexte] = useState("");
  const [miseTexte, setMiseTexte] = useState("");
  const [scoreNul, setScoreNul] = useState(true);
  const [anime, setAnime] = useState(false);
  const [coteContraire, setCoteContraire] = useState("");
  const [coteLay, setCoteLay] = useState("");
  const [cashOut, setCashOut] = useState("");
  const [minuteSaisie, setMinuteSaisie] = useState("");
  const [autreMatch, setAutreMatch] = useState<string | null>(null);

  const changer = useCallback((p: Partial<EtatLive>) => {
    const n = { ...courant.current, ...p };
    courant.current = n;
    setEtatBrut(n);
    ecrireEtatLive(n).catch(() => {});
  }, []);

  // Chargement de l'état gardé
  useEffect(() => {
    let vivant = true;
    lireEtatLive().then((e) => {
      if (!vivant) return;
      courant.current = e;
      setEtatBrut(e);
      setCharge(true);
    });
    return () => {
      vivant = false;
    };
  }, []);

  // Match demandé par l'adresse (« Suivre en live »), à l'ouverture ou pendant que l'écran est ouvert.
  // Un match inconnu est ignoré ; pendant un live en cours, rien n'est effacé sans accord.
  const demande = parametresRoute().get("match");
  useEffect(() => {
    if (!charge || !demande) return;
    if (demande !== courant.current.matchId && contenu.matchs.some((m) => m.id === demande)) {
      if (courant.current.phase === "avant") changer({ matchId: demande });
      else setAutreMatch(demande);
    }
    // L'adresse est nettoyée : un rechargement ne remet pas ce match par-dessus un choix fait depuis.
    history.replaceState(null, "", "#/live");
  }, [demande, charge, changer, contenu]);

  const chronoLance = etat.coupEnvoiLe !== null;
  const maintenant = useMaintenant(chronoLance);
  const t = tempsEcoule(etat.coupEnvoiLe, maintenant);
  const minute = t ? t.minute : etat.minuteManuelle;
  const fen = fenetre(t ? t.minute : null, t ? t.secondes : 0);

  // Alertes quand la fenêtre change d'état (bandeau toujours visible ; vibration, message, notification en plus)
  const precedente = useRef<EtatFenetre | null>(null);
  useEffect(() => {
    const avant = precedente.current;
    precedente.current = fen.etat;
    if (!charge || avant === null || avant === fen.etat || courant.current.phase !== "avant") return;
    const textes: Partial<Record<EtatFenetre, [string, string, number[]]>> = {
      bientot: ["Prépare-toi", "La fenêtre 15-20 min s'ouvre dans 3 minutes.", [150]],
      ouverte: ["Fenêtre ouverte", "15ᵉ-20ᵉ minute : c'est le moment d'entrer si c'est 0-0.", [250, 100, 250]],
      passee: ["Fenêtre passée", "La cote minimale monte à chaque minute.", [400]],
    };
    const x = textes[fen.etat];
    if (!x) return;
    try {
      navigator.vibrate?.(x[2]);
    } catch {
      /* vibration indisponible */
    }
    message(x[0] + " : " + x[1]);
    if (document.visibilityState === "hidden" && etatNotifications() === "autorisees") {
      notifier("Live +1.5 : " + x[0], x[1], "#/live", "live-fenetre").catch(() => {});
    }
  }, [fen.etat, charge, message]);

  // Match et buts attendus
  const match: Match | null = etat.matchId ? (contenu.matchs.find((m) => m.id === etat.matchId) ?? null) : null;
  const ctx = match ? contexteDe(match) : null;
  const analyse = match && ctx ? analyserV2(match, "+1.5", ctx) : null;
  const saisi = lireSaisie(etat.butsAttendusSaisis);
  const auto = analyse?.est.ok === true;
  const lambda = auto ? analyse!.est.lambda : typeof saisi === "number" ? saisi : NaN;
  const sigma = auto ? analyse!.est.sigma : lambda * 0.15;
  const rep = repartition(ctx?.stats?.partPremiereMiTemps);
  const cote = lireSaisie(coteTexte);
  // Mise conseillée : Kelly fractionné si réglé (avec les chances live à cette minute), sinon le % fixe du carnet.
  const reglagesMises = reglagesMisesDe(contenu);
  const chancesPourMise = Number.isFinite(lambda) ? chancesLive(lambda, sigma, minute, rep) : null;
  const miseBase = miseConseilleeSelonReglages({
    paris: contenu.paris,
    reglagesBankroll: bankrollDe(contenu),
    reglagesMises,
    p: chancesPourMise?.p,
    cote: typeof cote === "number" ? cote : undefined,
  }).montant;
  const alerte = typeof cote === "number" ? alerteMise(contenu.paris, reglagesMises, match?.date ?? jourLocal(new Date()), miseBase) : null;

  const decision = decisionLive({
    lambda,
    sigma,
    rep,
    minute,
    cote: typeof cote === "number" ? cote : NaN,
    scoreNul,
    anime,
    evaluation: analyse?.ev ?? null,
    miseBase,
  });
  const tableau = Number.isFinite(lambda) ? tableauLive(lambda, sigma, rep) : [];

  const matchsTries = [...contenu.matchs].sort(
    (x, y) => String(x.date).localeCompare(String(y.date)) || String(x.heure).localeCompare(String(y.heure)),
  );
  const nom = (m: Match) => `${m.domicile?.nom ?? "?"} – ${m.exterieur?.nom ?? "?"}`;

  /** Prépare un pari à moitié rempli pour l'onglet Paris (voir « Noter ce pari » plus bas). */
  const noterPari = async (partiel: { statut: "attente" } | { statut: "manuel"; pnl: number }) => {
    if (etat.cote === null || etat.mise === null) return;
    // Arrondi au centime : évite de coller un résultat à virgule flottante brut dans le formulaire.
    const p = partiel.statut === "manuel" ? { ...partiel, pnl: Math.round(partiel.pnl * 100) / 100 } : partiel;
    await deposerBrouillonPari({
      date: match?.date ?? jourLocal(new Date()),
      match: match ? nom(match) : "Live +1.5",
      methode: "+1.5",
      cote: etat.cote,
      mise: etat.mise,
      ligue: match?.ligue ?? null,
      matchId: match?.id ?? null,
      ...p,
    });
    location.hash = "#/paris";
  };

  const remettreAZero = async (demander: boolean) => {
    if (demander) {
      const ok = await confirmer({
        titre: "Terminer ce live ?",
        texte: "Le chronomètre et le pari en cours sont effacés de cet écran. Pense à le noter dans ton journal (bouton « Noter ce pari ») s'il n'y est pas déjà.",
        action: "Terminer",
        danger: true,
      });
      if (!ok) return;
    }
    changer({ ...ETAT_LIVE_VIDE, commission: etat.commission, modeCouverture: etat.modeCouverture, butsAttendusSaisis: etat.butsAttendusSaisis });
    setCoteTexte("");
    setMiseTexte("");
    setScoreNul(true);
    setAnime(false);
    setCoteContraire("");
    setCoteLay("");
    setCashOut("");
  };

  const parier = () => {
    if (typeof cote !== "number" || cote <= 1) return;
    const saisieMise = lireSaisie(miseTexte);
    const mise = typeof saisieMise === "number" && saisieMise > 0 ? saisieMise : (decision.mise ?? miseBase);
    changer({ phase: "en-jeu", cote, mise, minuteEntree: minute, minuteBut: null });
  };

  const regler = () => {
    const m = lireSaisie(minuteSaisie);
    if (typeof m !== "number" || m > 120) {
      message("Tape une minute entre 0 et 120.");
      return;
    }
    if (chronoLance) changer({ coupEnvoiLe: Date.now() - Math.floor(m) * 60000 });
    else changer({ minuteManuelle: Math.floor(m) });
    setMinuteSaisie("");
  };

  if (!charge) {
    return (
      <>
        <h1 tabIndex={-1}>Live +1.5</h1>
        <p className="aide">Chargement…</p>
      </>
    );
  }

  const couverture =
    etat.phase === "but" && etat.cote !== null && etat.mise !== null && etat.minuteBut !== null
      ? couvrir({
          mode: etat.modeCouverture,
          mise: etat.mise,
          cote: etat.cote,
          coteContraire: nombreOuNull(coteContraire),
          coteLay: nombreOuNull(coteLay),
          commission: etat.commission,
          cashOut: nombreOuNull(cashOut),
          lambda,
          sigma,
          minuteBut: etat.minuteBut,
          rep,
        })
      : null;
  const seuilAvance =
    etat.phase !== "avant" && etat.cote !== null && etat.mise !== null
      ? couvrir({ mode: "contre", mise: etat.mise, cote: etat.cote, coteContraire: 2, coteLay: null, commission: 0, cashOut: null, lambda, sigma, minuteBut: minute, rep }).seuil
      : null;

  return (
    <>
      <div>
        <h1 tabIndex={-1}>Live +1.5</h1>
        <p className="chapeau">Pari live à 0-0 vers la 15ᵉ-20ᵉ minute, puis couverture après le premier but.</p>
      </div>

      {autreMatch && (
        <div className="bandeau attention" role="status">
          <p>Un live est déjà en cours. Tu as demandé un autre match.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              changer({ ...ETAT_LIVE_VIDE, matchId: autreMatch, commission: etat.commission, modeCouverture: etat.modeCouverture });
              setAutreMatch(null);
            }}
          >
            Passer à ce match (efface le live en cours)
          </button>
          <button type="button" className="btn secondaire" onClick={() => setAutreMatch(null)}>Garder le live en cours</button>
        </div>
      )}

      {/* ---------- Match ---------- */}
      <section className="carte" aria-labelledby="titre-live-match">
        <h2 id="titre-live-match">Match</h2>
        <label className="champ" htmlFor="live-match">
          Match suivi
          <select
            id="live-match"
            value={etat.matchId ?? ""}
            onChange={(e: Event) => changer({ matchId: (e.target as HTMLSelectElement).value || null })}
          >
            <option value="">Sans match (je saisis les buts attendus)</option>
            {matchsTries.map((m) => (
              <option key={m.id} value={m.id}>
                {nom(m)}
                {m.heure ? " · " + m.heure : ""}
              </option>
            ))}
          </select>
        </label>
        {match && analyse && (
          <p className="live-verdict-match" data-test="live-match-verdict">
            <PastilleVerdict v={analyse.v} /> <span>Avant-match : {analyse.why}</span>
          </p>
        )}
        {auto ? (
          <p className="aide" data-test="live-lambda">
            Buts attendus : <b>{fr(lambda)}</b> ± {fr(sigma)} (nouveau modèle).
          </p>
        ) : (
          <>
            {match && <p className="bandeau attention">Il manque des infos pour estimer ce match : saisis les buts attendus à la main.</p>}
            <ChampNombre
              id="live-lambda"
              libelle="Buts attendus sur le match"
              valeur={etat.butsAttendusSaisis}
              changer={(x) => changer({ butsAttendusSaisis: x })}
              pas={0.1}
              min={0.5}
              defaut={2.7}
            />
            <p className="aide">Sans match, l'incertitude est estimée à 15 % des buts attendus.</p>
          </>
        )}
      </section>

      {/* ---------- Chronomètre ---------- */}
      <section className="carte chrono" aria-labelledby="titre-chrono" data-test="chrono">
        <h2 id="titre-chrono">Chronomètre</h2>
        {chronoLance ? (
          <p className="chrono-temps" aria-live="off">
            <span className="chrono-minute" data-test="chrono-minute">{t!.minute}′</span>
            <span className="chrono-secondes num" data-test="chrono-temps">
              {String(t!.minute).padStart(2, "0")}:{String(t!.secondes).padStart(2, "0")}
            </span>
          </p>
        ) : (
          <button type="button" className="btn enorme" onClick={() => changer({ coupEnvoiLe: Date.now() })}>
            Coup d'envoi
          </button>
        )}
        <div className={`bandeau ${TEXTE_FENETRE[fen.etat]} fenetre fenetre-${fen.etat}`} role="status" data-test="fenetre" data-etat={fen.etat}>
          <p><b>{fen.titre}</b></p>
          <p>{fen.detail}</p>
        </div>
        {chronoLance ? (
          <div className="rangee rangee-serree">
            <button type="button" className="btn secondaire" onClick={() => changer({ coupEnvoiLe: Math.min(Date.now(), (etat.coupEnvoiLe ?? 0) + 60000) })}>−1 min</button>
            <button type="button" className="btn secondaire" onClick={() => changer({ coupEnvoiLe: (etat.coupEnvoiLe ?? Date.now()) - 60000 })}>+1 min</button>
          </div>
        ) : (
          <ChampNombre
            id="live-minute-manuelle"
            libelle="Sans chronomètre : minute actuelle"
            valeur={String(etat.minuteManuelle)}
            changer={(x) => {
              const v = lireSaisie(x);
              if (typeof v === "number") changer({ minuteManuelle: Math.min(Math.floor(v), 120) });
            }}
            pas={1}
            min={0}
            defaut={15}
          />
        )}
        <details className="repli" data-test="regler-chrono">
          <summary>{chronoLance ? "Caler ou arrêter le chronomètre" : "Lancer le chronomètre à une autre minute"}</summary>
          <div className="section">
            <form
              className="rangee"
              onSubmit={(e: Event) => {
                e.preventDefault();
                regler();
              }}
            >
              <label className="champ" htmlFor="live-regler" style={{ flex: "1 1 120px" }}>
                {chronoLance ? "Caler sur la minute du match" : "Lancer à la minute"}
                <input
                  id="live-regler"
                  type="text"
                  inputMode="numeric"
                  placeholder="ex. 17"
                  value={minuteSaisie}
                  onChange={(e: Event) => setMinuteSaisie((e.target as HTMLInputElement).value)}
                />
              </label>
              <button type="submit" className="btn secondaire">{chronoLance ? "Caler" : "Lancer"}</button>
              {chronoLance && (
                <button type="button" className="btn discret" onClick={() => changer({ coupEnvoiLe: null, minuteManuelle: minute })}>Arrêter</button>
              )}
            </form>
            <p className="aide">
              Les alertes (bandeau, vibration, notification) partent tant que l'application reste ouverte : le téléphone peut les retarder quand
              l'écran est éteint. La minute, elle, est toujours recalculée juste.
            </p>
          </div>
        </details>
      </section>

      {/* ---------- 1. J'entre ? ---------- */}
      {etat.phase === "avant" && (
        <section className="carte" aria-labelledby="titre-entree" data-test="entree">
          <h2 id="titre-entree">J'entre ?</h2>
          <ChampNombre
            id="live-cote"
            libelle="Cote « plus de 1,5 but »"
            valeur={coteTexte}
            changer={setCoteTexte}
            pas={0.05}
            min={1.01}
            defaut={1.7}
            placeholder="ex. 1,75"
          />
          <Choix libelle="Score" valeur={scoreNul ? "nul" : "but"} options={[["nul", "0-0"], ["but", "Un but marqué"]]} changer={(v) => setScoreNul(v === "nul")} />
          <Choix libelle="Le match est" valeur={anime ? "anime" : "ferme"} options={[["anime", "Animé"], ["ferme", "Fermé"]]} changer={(v) => setAnime(v === "anime")} />
          <div className={`reponse ${decision.v}`} role="status" data-test="decision-live" data-verdict={decision.v}>
            <strong>{decision.titre}</strong>
            <p>{decision.pourquoi}</p>
            {decision.mise !== null && (
              <p>
                Mise conseillée{reglagesMises.methode === "kelly" && chancesPourMise ? " (Kelly)" : ""} : <b>{eur(decision.mise)}</b>
              </p>
            )}
          </div>
          {decision.mise !== null && alerte && (alerte.parPari || alerte.parJour?.depasse) && (
            <p className="bandeau attention" role="status" data-test="alerte-plafond">
              {alerte.parPari && <>Cette mise dépasse ton plafond par pari. </>}
              {alerte.parJour?.depasse && (
                <>
                  Déjà {eur(alerte.parJour.dejaEngage)} misés aujourd'hui : au-delà de ton plafond de {eur(alerte.parJour.plafond)}.{" "}
                </>
              )}
              La décision reste la tienne.
            </p>
          )}
          {Number.isFinite(decision.p) && (
            <div className="faits" data-test="chiffres-live">
              <div className="fait"><span>Chances (à 0-0 à la {minute}ᵉ)</span><b>{pc(decision.p)} ({Math.round(decision.pBas * 100)}-{Math.round(decision.pHaut * 100)} %)</b></div>
              <div className="fait"><span>Cote juste · cote minimale</span><b>{fr(decision.coteJuste)} · {fr(decision.coteMinimale)}</b></div>
              <div className="fait">
                <span>Value avec ta cote</span>
                <b className={Number.isFinite(decision.value) ? (decision.value >= 0 ? "pos" : "neg") : ""}>
                  {Number.isFinite(decision.value) ? (decision.value >= 0 ? "+" : "−") + Math.abs(Math.round(decision.value * 100)) + " %" : "⏳"}
                </b>
              </div>
            </div>
          )}
          <label className="champ" htmlFor="live-mise">
            Mise (vide : celle conseillée)
            <input
              id="live-mise"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={fr(decision.mise ?? miseBase)}
              value={miseTexte}
              onChange={(e: Event) => setMiseTexte((e.target as HTMLInputElement).value)}
            />
          </label>
          <button type="button" className="btn enorme" disabled={!(typeof cote === "number" && cote > 1)} onClick={parier}>
            J'ai parié
          </button>
          {tableau.length > 0 && (
            <>
              <h3>Cote minimale selon la minute (si toujours 0-0)</h3>
              <div className="tableau-defilant">
                <table className="tableau-live" data-test="tableau-live">
                  <thead>
                    <tr>
                      <th scope="col">Minute</th>
                      <th scope="col">Cote juste</th>
                      <th scope="col">Cote minimale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableau.map((r) => (
                      <tr key={r.minute} className={Math.abs(r.minute - minute) < 3 ? "actuelle" : ""}>
                        <th scope="row">{r.minute}ᵉ</th>
                        <td>{fr(r.coteJuste)}</td>
                        <td><b>{fr(r.coteMinimale)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="aide">
                La cote minimale est celle à exiger pour rester gagnant même si l'estimation est un peu trop optimiste. Ce sont des estimations :
                elles peuvent se tromper.
              </p>
            </>
          )}
        </section>
      )}

      {/* ---------- 2. Pari pris ---------- */}
      {etat.phase === "en-jeu" && etat.cote !== null && etat.mise !== null && (
        <section className="carte" aria-labelledby="titre-en-jeu" data-test="en-jeu">
          <h2 id="titre-en-jeu">Pari en cours</h2>
          <div className="faits">
            <div className="fait"><span>Mise · cote</span><b>{eur(etat.mise)} · {fr(etat.cote)}</b></div>
            <div className="fait"><span>Entré à la</span><b>{etat.minuteEntree ?? "⏳"}ᵉ minute</b></div>
            <div className="fait"><span>Gain si un 2ᵉ but arrive</span><b className="pos">+{eur(etat.mise * (etat.cote - 1))}</b></div>
          </div>
          {seuilAvance && (
            <p className="aide" data-test="seuil-avance">
              Si un but tombe, couvrir rapportera à partir d'une cote « moins de 1,5 but » de <b>{fr(seuilAvance.cote)}</b> (pari contraire).
            </p>
          )}
          <button type="button" className="btn enorme but" onClick={() => changer({ phase: "but", minuteBut: minute })}>
            BUT !
          </button>
          <button type="button" className="btn secondaire" onClick={() => changer({ phase: "avant", cote: null, mise: null, minuteEntree: null, minuteBut: null })}>
            Annuler ce pari
          </button>
          <button type="button" className="btn secondaire" onClick={() => noterPari({ statut: "attente" })}>
            Noter ce pari dans mon journal
          </button>
          <button type="button" className="btn discret" onClick={() => remettreAZero(true)}>Terminer le live</button>
        </section>
      )}

      {/* ---------- 3. Couverture ---------- */}
      {etat.phase === "but" && etat.cote !== null && etat.mise !== null && etat.minuteBut !== null && couverture && (
        <section className="carte" aria-labelledby="titre-couverture" data-test="couverture">
          <h2 id="titre-couverture">But à la {etat.minuteBut}ᵉ minute : couvrir ?</h2>
          <p className="aide">
            Ton pari : {eur(etat.mise)} à {fr(etat.cote)}. Il faut encore un but pour gagner.
          </p>
          <Choix<ModeCouverture>
            libelle="Comment couvrir"
            valeur={etat.modeCouverture}
            options={[["contre", "Pari contraire"], ["lay", "Exchange (lay)"], ["cash", "Cash-out"]]}
            changer={(v) => changer({ modeCouverture: v })}
          />
          {etat.modeCouverture === "contre" && (
            <ChampNombre id="live-contre" libelle="Cote « moins de 1,5 but » (autre site)" valeur={coteContraire} changer={setCoteContraire} pas={0.1} min={1.01} defaut={2.5} placeholder="ex. 2,60" />
          )}
          {etat.modeCouverture === "lay" && (
            <>
              <ChampNombre id="live-lay" libelle="Cote lay « plus de 1,5 but »" valeur={coteLay} changer={setCoteLay} pas={0.05} min={1.01} defaut={1.5} placeholder="ex. 1,40" />
              <ChampNombre
                id="live-commission"
                libelle="Commission de l'exchange (%)"
                valeur={String(etat.commission).replace(".", ",")}
                changer={(x) => {
                  const v = lireSaisie(x);
                  if (typeof v === "number") changer({ commission: Math.min(v, 30) });
                }}
                pas={0.5}
                min={0}
                defaut={5}
              />
            </>
          )}
          {etat.modeCouverture === "cash" && (
            <ChampNombre id="live-cash" libelle="Montant proposé par le bookmaker (€)" valeur={cashOut} changer={setCashOut} pas={0.5} min={0} defaut={etat.mise} placeholder="ex. 26,00" />
          )}

          {couverture.calculable ? (
            <div className={`reponse ${couverture.rentable ? "ok" : "ko"}`} role="status" data-test="reponse-couverture" data-rentable={couverture.rentable}>
              {etat.modeCouverture === "contre" && (
                <>
                  <strong>{couverture.rentable ? `Mise ${eur(couverture.miseCouverture!)} sur « moins de 1,5 but »` : "Pas rentable maintenant"}</strong>
                  <p>
                    {couverture.rentable ? (
                      <>Tu gagnes <b>{eur(couverture.garanti)}</b> quel que soit le score final.</>
                    ) : (
                      <>
                        Couvrir te ferait perdre <b>{eur(-couverture.garanti)}</b>. Il faut une cote « moins de 1,5 but » d'au moins{" "}
                        <b>{fr(couverture.seuil!.cote)}</b> pour gagner à coup sûr. Sans nouveau but, cette cote baisse avec le temps : attendre
                        ne l'améliore pas.
                      </>
                    )}
                  </p>
                </>
              )}
              {etat.modeCouverture === "lay" && (
                <>
                  <strong>{couverture.rentable ? `Lay de ${eur(couverture.miseCouverture!)}` : "Pas rentable"}</strong>
                  <p>
                    {couverture.rentable ? (
                      <>Tu gagnes au moins <b>{eur(couverture.garanti)}</b>. Il faut {eur(couverture.responsabilite!)} sur ton compte exchange.</>
                    ) : (
                      <>La cote lay est trop haute pour gagner à coup sûr : il faut au plus <b>{fr(couverture.seuil!.cote)}</b>.</>
                    )}
                  </p>
                </>
              )}
              {etat.modeCouverture === "cash" && (
                <>
                  <strong>{couverture.rentable ? `Tu gagnes ${eur(couverture.garanti)}` : `Tu perds ${eur(-couverture.garanti)}`}</strong>
                  <p>
                    {couverture.rentable ? "C'est ton bénéfice net si tu acceptes ce cash-out." : "Ce cash-out est inférieur à ta mise."} Compare avec « Pari
                    contraire » : sécuriser toi-même rapporte souvent plus.
                  </p>
                </>
              )}
            </div>
          ) : (
            <p className="bandeau info" data-test="couverture-a-saisir">
              {etat.modeCouverture === "contre" ? "Tape la cote « moins de 1,5 but » proposée." : etat.modeCouverture === "lay" ? "Tape la cote lay proposée." : "Tape le montant du cash-out proposé."}
            </p>
          )}

          <h3>Résultat de chaque scénario</h3>
          <div className="tableau-defilant">
            <table className="scenarios" data-test="scenarios">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Scénario</span></th>
                  <th scope="col">Sans couvrir</th>
                  <th scope="col">En couvrant</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">S'il y a un 2ᵉ but</th>
                  <td data-test="sc-but-sans">{euroSigne(couverture.sansCouvrir.siBut)}</td>
                  <td data-test="sc-but-avec">{couverture.calculable ? euroSigne(couverture.siBut) : "⏳"}</td>
                </tr>
                <tr>
                  <th scope="row">S'il n'y a plus de but</th>
                  <td data-test="sc-pas-but-sans">{euroSigne(couverture.sansCouvrir.siPasDeBut)}</td>
                  <td data-test="sc-pas-but-avec">{couverture.calculable ? euroSigne(couverture.siPasDeBut) : "⏳"}</td>
                </tr>
                <tr>
                  <th scope="row">Espérance (estimation)</th>
                  <td data-test="sc-esperance-sans">{estNombre(couverture.sansCouvrir.esperance) ? euroSigne(couverture.sansCouvrir.esperance) : "⏳"}</td>
                  <td data-test="sc-esperance-avec">
                    {couverture.calculable && Number.isFinite(couverture.pBut)
                      ? euroSigne(couverture.pBut * couverture.siBut + (1 - couverture.pBut) * couverture.siPasDeBut)
                      : "⏳"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {Number.isFinite(couverture.pBut) && (
            <p className="aide" data-test="chances-but">
              Chances d'un 2ᵉ but avant la fin : <b>{pc(couverture.pBut)}</b> d'après le modèle. Ne pas couvrir a la meilleure espérance quand ce chiffre est élevé,
              mais tu perds toute ta mise dans les autres cas. Ce sont des estimations : elles peuvent se tromper.
            </p>
          )}
          <button
            type="button"
            className="btn secondaire"
            onClick={() =>
              noterPari(couverture.calculable && couverture.rentable ? { statut: "manuel", pnl: couverture.garanti } : { statut: "attente" })
            }
          >
            {couverture.calculable && couverture.rentable ? `Noter ce pari sécurisé (${eur(couverture.garanti)})` : "Noter ce pari (résultat à préciser)"}
          </button>
          <button type="button" className="btn secondaire" onClick={() => changer({ phase: "en-jeu", minuteBut: null })}>But annulé (VAR)</button>
          <button type="button" className="btn discret" onClick={() => remettreAZero(true)}>Terminer le live</button>
        </section>
      )}
    </>
  );
}

const euroSigne = (x: number) => (Number.isFinite(x) ? (x > 0 ? "+" : "") + eur(x) : "⏳");
