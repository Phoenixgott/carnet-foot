/**
 * Générateur de la demande à copier vers l'autre conversation Claude (avec recherche web).
 *
 * Reprend la demande du carnet d'origine (mêmes étapes, mêmes noms de champs : ses réponses
 * restent importables), avec les changements de la phase 2 :
 *  - saison calculée d'après la date (le carnet écrivait « 2026-2027 » en dur) ;
 *  - nombre de matchs par réponse réglable (8 dans le carnet) et nombre total facultatif ;
 *  - cotes « moins de 1,5 / 2,5 buts » en plus, pour calculer la marge du bookmaker.
 */
import { dernierReleve } from "./cotes";
import { saisonDe, saisonPrecedente } from "./saison";
import type { Match } from "./types";

export type GroupeCompetition = "clubs" | "selections" | "feminin";

export interface Competition {
  /** Nom court, gardé dans les réglages (identique au carnet). */
  cle: string;
  /** Description envoyée dans la demande. */
  libelle: string;
  groupe: GroupeCompetition;
}

/** Liste et libellés identiques au carnet d'origine. */
export const COMPETITIONS: readonly Competition[] = [
  { cle: "Ligue 1", libelle: "Ligue 1 (France)", groupe: "clubs" },
  { cle: "Ligue 2", libelle: "Ligue 2 (France)", groupe: "clubs" },
  { cle: "Premier League", libelle: "Premier League (Angleterre)", groupe: "clubs" },
  { cle: "Championship", libelle: "Championship (Angleterre, 2e division)", groupe: "clubs" },
  { cle: "LaLiga", libelle: "LaLiga (Espagne)", groupe: "clubs" },
  { cle: "Serie A", libelle: "Serie A (Italie)", groupe: "clubs" },
  { cle: "Bundesliga", libelle: "Bundesliga (Allemagne)", groupe: "clubs" },
  { cle: "Eredivisie", libelle: "Eredivisie (Pays-Bas)", groupe: "clubs" },
  { cle: "Liga Portugal", libelle: "Liga Portugal (Portugal)", groupe: "clubs" },
  { cle: "Jupiler Pro League", libelle: "Jupiler Pro League (Belgique)", groupe: "clubs" },
  { cle: "Super League", libelle: "Super League (Suisse)", groupe: "clubs" },
  { cle: "Ligue des champions", libelle: "Ligue des champions (UEFA)", groupe: "clubs" },
  { cle: "Ligue Europa", libelle: "Ligue Europa (UEFA)", groupe: "clubs" },
  { cle: "Ligue Conférence", libelle: "Ligue Conférence (UEFA)", groupe: "clubs" },
  {
    cle: "Coupes nationales",
    libelle: "Coupes nationales : Coupe de France, Carabao Cup, FA Cup, Coppa Italia, Copa del Rey, DFB-Pokal",
    groupe: "clubs",
  },
  { cle: "Ligue des nations", libelle: "Ligue des nations UEFA (sélections nationales)", groupe: "selections" },
  { cle: "Qualifs Coupe du monde", libelle: "Qualifications Coupe du monde, zone Europe (sélections)", groupe: "selections" },
  { cle: "Qualifs Euro", libelle: "Qualifications Euro (sélections)", groupe: "selections" },
  { cle: "Coupe du monde / Euro", libelle: "Phase finale Coupe du monde ou Euro (sélections)", groupe: "selections" },
  { cle: "Amicaux internationaux", libelle: "Matchs amicaux internationaux (sélections)", groupe: "selections" },
  { cle: "Arkema Première Ligue", libelle: "Arkema Première Ligue (France, féminin)", groupe: "feminin" },
  { cle: "WSL", libelle: "Women's Super League (Angleterre, féminin)", groupe: "feminin" },
  { cle: "Liga F", libelle: "Liga F (Espagne, féminin)", groupe: "feminin" },
  { cle: "Serie A Femminile", libelle: "Serie A Femminile (Italie, féminin)", groupe: "feminin" },
  { cle: "Frauen-Bundesliga", libelle: "Frauen-Bundesliga (Allemagne, féminin)", groupe: "feminin" },
  { cle: "Ligue des champions F", libelle: "Ligue des champions féminine (UEFA)", groupe: "feminin" },
  {
    cle: "Sélections féminines",
    libelle: "Sélections féminines : Ligue des nations, qualifications Euro et Coupe du monde, amicaux",
    groupe: "feminin",
  },
];

/** Choix par défaut du carnet. */
export const COMPETITIONS_PAR_DEFAUT: readonly string[] = [
  "Ligue 1",
  "Premier League",
  "LaLiga",
  "Serie A",
  "Bundesliga",
  "Ligue des champions",
  "Coupes nationales",
  "Ligue des nations",
  "Qualifs Coupe du monde",
  "Qualifs Euro",
];

export const LIBELLE_GROUPE: Readonly<Record<GroupeCompetition, string>> = {
  clubs: "Clubs",
  selections: "Sélections nationales",
  feminin: "Féminin",
};

export interface OptionsDemande {
  /** Jour des matchs, AAAA-MM-JJ. */
  date: string;
  /** Un seul match (« Lens – Brest ») ; vide pour tous les matchs du jour. */
  unMatch?: string;
  /** Clés des compétitions choisies. */
  competitions: readonly string[];
  /** Matchs par réponse avant « SUITE DISPONIBLE » (8 dans le carnet). */
  parReponse: number;
  /** Nombre maximum de matchs au total (null : tous). */
  maxTotal: number | null;
}

export const PAR_REPONSE_CHOIX: readonly number[] = [4, 6, 8, 10, 12];
export const MAX_TOTAL_CHOIX: ReadonlyArray<number | null> = [null, 5, 10, 15, 20, 30];
export const OPTIONS_PAR_DEFAUT = { parReponse: 8, maxTotal: null as number | null };

/** Date longue en français : « mardi 22 septembre 2026 » (comme le carnet). */
export function dateLongueFr(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Exemple de format : celui du carnet, avec les cotes « moins de » en plus. */
export function exempleFormat(date: string): string {
  const id = `${date}-lens-brest`;
  return `{"matchs":[{
  "id":"${id}",
  "date":"${date}","heure":"21:00","ligue":"Ligue 1","journee":"6e journée","selection":false,"feminin":false,
  "moyenneButsLigue":2.85,
  "domicile":{"nom":"Lens","joues":6,"marques":11,"encaisses":7,
    "pctOver15":83,"pctOver25":67,"derniersButsMarques":[2,1,3,2]},
  "exterieur":{"nom":"Brest","joues":6,"marques":8,"encaisses":9,
    "pctOver15":83,"pctOver25":50,"derniersButsMarques":[1,2,1,2]},
  "h2h":{"joues":6,"over25":4},
  "contexte":"normal",
  "absents":["Brest : Nom du joueur (blessé)"],
  "absenceOffensive":false,"meilleurButeurAbsent":false,"defenseAffaiblie":false,
  "cotes":{"over15":1.27,"under15":3.60,"over25":1.80,"under25":1.95,"bookmaker":"Unibet"},
  "manquants":[],
  "sources":["https://fbref.com/...","https://footystats.org/..."]
}]}`;
}

/** Demande complète pour un jour (ou un seul match). */
export function construireDemande(o: OptionsDemande): string {
  const d = o.date;
  const saison = saisonDe(d);
  const precedente = saisonPrecedente(saison);
  const un = (o.unMatch ?? "").trim();
  const comps =
    COMPETITIONS.filter((c) => o.competitions.includes(c.cle))
      .map((c) => "- " + c.libelle)
      .join("\n") || "- Ligue 1 (France)";
  const portee = un
    ? `LE MATCH : ${un}, joué le ${dateLongueFr(d)} (date ${d}).`
    : `LE JOUR : ${dateLongueFr(d)} (date ${d}), heure de Paris.\n\nLES COMPÉTITIONS :\n${comps}`;
  const total =
    !un && o.maxTotal
      ? `\n- Garde au plus ${o.maxTotal} matchs au total : en priorité les compétitions dans l'ordre de la liste ci-dessus, puis par heure.`
      : "";
  const n = o.parReponse;

  return `Tu vas collecter des données de football pour mon outil d'analyse de paris sur le nombre de buts. Fais de vraies recherches sur le web pour chaque chiffre. La précision compte plus que la rapidité.

${portee}

=== ÉTAPE 1 : LA LISTE DES MATCHS ===
${
  un
    ? "Vérifie la date, l'heure (heure de Paris) et la compétition de ce match."
    : `Pour CHAQUE compétition ci-dessus, ouvre le calendrier de ce jour précis (flashscore.fr, lequipe.fr, sofascore.com ou le site officiel de la ligue).
- Prends TOUS les matchs joués ce jour-là, y compris les journées en semaine (mardi, mercredi, jeudi), les coupes, les matchs européens, les matchs féminins s'ils sont demandés, et les matchs de sélections nationales (pendant les trêves internationales, il y en a beaucoup : prends ceux des sélections européennes et des grandes nations).
- Vérifie la date et l'heure en heure de Paris.
- Si une compétition n'a aucun match ce jour-là, ne la mets pas. N'invente aucun match.${total}`
}

=== ÉTAPE 2 : LES STATS DE CHAQUE ÉQUIPE ===
CLUBS : utilise toujours le CHAMPIONNAT NATIONAL de l'équipe, saison ${saison}, même si le match est une coupe ou un match européen.
Sources conseillées : fbref.com, footystats.org (pourcentages over), sofascore.com, flashscore.fr, soccerway.com.
- "joues" : matchs de championnat joués cette saison
- "marques" et "encaisses" : total de buts marqués et encaissés en championnat
- "pctOver15" : % de ses matchs de championnat avec 2 buts ou plus AU TOTAL (les deux équipes additionnées). Nombre entier de 0 à 100.
- "pctOver25" : pareil avec 3 buts ou plus.
  -> Si tu ne trouves pas ces % tout faits, CALCULE-LES à partir de la liste des scores de l'équipe cette saison. Exemple : 4 matchs sur 6 avec 2 buts ou plus = 67.
- "derniersButsMarques" : buts marqués PAR L'ÉQUIPE lors de ses 4 derniers matchs, toutes compétitions, du plus récent au plus ancien. Exemple : [2,0,1,3].
- Si l'équipe a joué moins de 4 matchs de championnat cette saison, complète avec la fin de la saison ${precedente} et écris-le dans "manquants".

CAS DU FOOTBALL FÉMININ :
- Mets "feminin": true (false sinon). Utilise UNIQUEMENT les stats de l'équipe féminine et de son championnat féminin, jamais celles de l'équipe masculine du même club.
- Sources conseillées : footystats.org (sections women), fbref.com, flashscore.fr, soccerway.com, sofascore.com, sites officiels des ligues.
- Les cotes des matchs féminins sont souvent absentes chez Unibet : cherche chez d'autres bookmakers, sinon null.
- Pour une sélection féminine, applique la règle des 10 derniers matchs officiels ci-dessous.

CAS DES SÉLECTIONS NATIONALES (Ligue des nations, qualifications Coupe du monde ou Euro, phase finale, amicaux) :
- Mets "selection": true (false pour un match de clubs).
- Une sélection n'a pas de championnat : calcule "joues", "marques", "encaisses", "pctOver15" et "pctOver25" sur ses 10 DERNIERS MATCHS OFFICIELS, toutes compétitions (hors amicaux si possible). "joues" = 10, ou moins si elle en a joué moins.
- "derniersButsMarques" : ses 4 derniers matchs, amicaux compris.
- Sources conseillées : fr.uefa.com, fifa.com, flashscore.fr (onglet résultats de la sélection), footystats.org, eu-football.info, transfermarkt.fr.
- Absents : liste des joueurs forfaits ou non convoqués parmi les titulaires habituels (annonce officielle de la liste du sélectionneur).

=== ÉTAPE 3 : LE MATCH ===
- "moyenneButsLigue" : moyenne de buts par match du championnat cette saison (footystats.org ou fbref.com). Pour une coupe, un match européen ou un match de sélections, mets la moyenne de buts de la compétition (édition en cours, sinon l'édition précédente). Pour la Ligue des nations, prends la moyenne de la ligue concernée (A, B, C ou D).
- "h2h" : les 6 dernières confrontations directes, toutes compétitions. "joues" = nombre trouvé, "over25" = combien ont eu 3 buts ou plus.
- "contexte", une seule valeur parmi : normal, finale, derby (ou grand rival historique entre sélections), maintien (une équipe joue sa place : relégation ou barrage de Ligue des nations), montee (une équipe peut se qualifier ou monter à l'issue du match), sans_enjeu (plus rien à jouer, ou match amical), retour_coupe_retard (match retour où une équipe a perdu l'aller).
- "absents" : blessés et suspendus connus (lequipe.fr, sofascore.com, transfermarkt.fr, conférences de presse). Format : "Équipe : Nom (raison)".
- "absenceOffensive" : true si un attaquant titulaire ou un buteur régulier est absent.
- "meilleurButeurAbsent" : true si le meilleur buteur de l'équipe cette saison est absent.
- "defenseAffaiblie" : true si le gardien titulaire ou au moins 2 défenseurs titulaires sont absents.
- "cotes" : cotes « plus de 1,5 but » (over15), « moins de 1,5 but » (under15), « plus de 2,5 buts » (over25) et « moins de 2,5 buts » (under25), toutes chez le MÊME bookmaker. D'abord Unibet, sinon un autre bookmaker français (Winamax, Betclic, PMU) ; indique lequel dans "bookmaker". Introuvable : null.

=== ÉTAPE 4 : CONTRÔLE AVANT DE RÉPONDRE ===
Vérifie pour chaque match :
- la date est bien ${d} et l'heure est à l'heure de Paris
- "marques" divisé par "joues" donne une moyenne réaliste (entre 0 et 4)
- les % sont des nombres entiers de 0 à 100
- "derniersButsMarques" contient 4 nombres
- chaque info introuvable vaut null ET son nom est écrit dans "manquants"

=== FORMAT DE LA RÉPONSE ===
- Réponds UNIQUEMENT avec un bloc de code json, sans texte avant.
- Garde exactement les noms de champs de l'exemple. "id" = date-equipedomicile-equipeexterieur, en minuscules, sans accents.
- S'il y a plus de ${n} matchs, donne les ${n} premiers par heure, puis écris sous le bloc : SUITE DISPONIBLE — écris « continue ». Quand j'écris « continue », donne les ${n} suivants au même format.
- Aucun match trouvé : {"matchs":[]}
- N'invente JAMAIS un chiffre. Une donnée introuvable = null, et elle est notée dans "manquants".

Exemple de format :
${exempleFormat(d)}`;
}

const nom = (m: Match) => `${m.domicile?.nom || "?"} – ${m.exterieur?.nom || "?"}`;

/** Demande de compléments pour des matchs incomplets (même texte que le carnet, format à jour). */
export function construireDemandeComplements(liste: ReadonlyArray<{ m: Match; manque: readonly string[] }>, date: string): string {
  return `Complète les infos manquantes de ces matchs. Fais de vraies recherches web (fbref.com, footystats.org, sofascore.com, flashscore.fr, lequipe.fr). Si un % n'existe pas tout fait, calcule-le à partir des scores de la saison.

${liste.map(({ m, manque }) => `- ${nom(m)} (${m.ligue || ""}, ${m.date || ""}), id "${m.id}" : ${manque.join(", ")}`).join("\n")}

Réponds UNIQUEMENT avec un bloc de code json au format {"matchs":[...]}. Pour chaque match, garde son "id" exact, "date", "domicile.nom", "exterieur.nom", et ajoute les champs complétés. Toujours introuvable = null + noté dans "manquants". N'invente aucun chiffre.

Rappel des champs :
${exempleFormat(date)}`;
}

/**
 * Demande de mise à jour du jour J : cotes actuelles et absents, pour suivre
 * l'évolution des cotes. Les autres champs ne sont pas redemandés.
 */
export function construireDemandeCotes(matchs: readonly Match[]): string {
  return `Donne-moi les cotes ACTUELLES et les absents de ces matchs. Fais de vraies recherches web, maintenant (les cotes bougent) : d'abord Unibet, sinon un autre bookmaker français (Winamax, Betclic, PMU).

${matchs
  .map((m) => {
    const r = dernierReleve(m);
    return `- ${nom(m)} (${m.ligue || ""}, ${m.date || ""}${m.heure ? " à " + m.heure : ""}), id "${m.id}"${r?.bookmaker ? ` : dernier relevé chez ${r.bookmaker}, garde ce bookmaker si possible` : ""}`;
  })
  .join("\n")}

Pour chaque match :
- "cotes" : "over15" (plus de 1,5 but), "under15" (moins de 1,5 but), "over25" (plus de 2,5 buts), "under25" (moins de 2,5 buts), toutes chez le MÊME bookmaker, indiqué dans "bookmaker". Introuvable : null.
- "absents" : blessés et suspendus connus, format "Équipe : Nom (raison)" ; [] s'il n'y en a aucun.
- "absenceOffensive", "meilleurButeurAbsent", "defenseAffaiblie" : true ou false, comme dans la demande de départ.

Réponds UNIQUEMENT avec un bloc de code json :
{"matchs":[{"id":"...","date":"...","domicile":{"nom":"..."},"exterieur":{"nom":"..."},
  "cotes":{"over15":1.27,"under15":3.60,"over25":1.80,"under25":1.95,"bookmaker":"Unibet"},
  "absents":[],"absenceOffensive":false,"meilleurButeurAbsent":false,"defenseAffaiblie":false,"manquants":[]}]}
Garde l'"id", la "date" et les noms d'équipes exacts. N'invente aucune cote : introuvable = null + noté dans "manquants".`;
}
