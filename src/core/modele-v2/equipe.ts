/**
 * Fiche équipe, à partir des historiques CSV : forme sur les 10 derniers matchs,
 * buts, séries en cours, confrontations directes.
 *
 * Les noms diffèrent souvent entre la réponse de Claude (« PSG », « Olympique de Marseille »)
 * et les fichiers de football-data (« Paris SG », « Marseille ») : une table d'équivalences
 * couvre les grands championnats, puis on retire les sigles courants (FC, AS…).
 * Si aucune équipe ne correspond, la fiche le dit : rien n'est deviné.
 */
import type { Resultat } from "../types";

export const normaliser = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Nom courant (normalisé) → nom de football-data (normalisé). */
const EQUIVALENCES: Readonly<Record<string, string>> = {
  // France
  psg: "parissg", parissaintgermain: "parissg", paris: "parissg", om: "marseille", olympiquedemarseille: "marseille",
  ol: "lyon", olympiquelyonnais: "lyon", staderennais: "rennes", losc: "lille", lilleosc: "lille", ogcnice: "nice",
  rclens: "lens", stadebrestois: "brest", stadebrestois29: "brest", rcstrasbourg: "strasbourg", strasbourgalsace: "strasbourg",
  stadedereims: "reims", montpellierhsc: "montpellier", assaintetienne: "stetienne", saintetienne: "stetienne",
  angerssco: "angers", lehavreac: "lehavre", ajauxerre: "auxerre", clermontfoot: "clermont", estac: "troyes", estactroyes: "troyes",
  asmonaco: "monaco", fcnantes: "nantes", toulousefc: "toulouse", fclorient: "lorient", fcmetz: "metz", girondinsdebordeaux: "bordeaux",
  // Angleterre
  manchesterunited: "manunited", manutd: "manunited", manchestercity: "mancity", nottinghamforest: "nottmforest",
  tottenhamhotspur: "tottenham", spurs: "tottenham", wolverhampton: "wolves", wolverhamptonwanderers: "wolves",
  newcastleunited: "newcastle", westhamunited: "westham", brightonhovealbion: "brighton", brightonandhovealbion: "brighton",
  leedsunited: "leeds", sheffieldutd: "sheffieldunited", leicestercity: "leicester", ipswichtown: "ipswich", afcbournemouth: "bournemouth",
  // Espagne
  atleticomadrid: "athmadrid", atleticodemadrid: "athmadrid", atletico: "athmadrid", athleticbilbao: "athbilbao", athleticclub: "athbilbao",
  realsociedad: "sociedad", celtavigo: "celta", rcceltadevigo: "celta", rayovallecano: "vallecano", realbetis: "betis",
  espanyol: "espanol", rcdespanyol: "espanol", deportivoalaves: "alaves", fcbarcelone: "barcelona", fcbarcelona: "barcelona", barca: "barcelona",
  villarrealcf: "villarreal", sevillafc: "sevilla", seville: "sevilla", valenciacf: "valencia", gironafc: "girona", rcdmallorca: "mallorca", majorque: "mallorca",
  // Italie
  intermilan: "inter", internazionale: "inter", interdemilan: "inter", acmilan: "milan", asroma: "roma", sscnapoli: "napoli", naples: "napoli",
  juventusturin: "juventus", sslazio: "lazio", acffiorentina: "fiorentina", atalantabergame: "atalanta", torinofc: "torino", turin: "torino",
  // Allemagne
  bayernmunich: "bayernmunich", bayernmunchen: "bayernmunich", fcbayernmunich: "bayernmunich", bayern: "bayernmunich",
  borussiadortmund: "dortmund", bvb: "dortmund", bayerleverkusen: "leverkusen", eintrachtfrancfort: "einfrankfurt",
  eintrachtfrankfurt: "einfrankfurt", francfort: "einfrankfurt", borussiamonchengladbach: "mgladbach", monchengladbach: "mgladbach",
  vfbstuttgart: "stuttgart", werderbreme: "werderbremen", werderbremen: "werderbremen", vflwolfsburg: "wolfsburg",
  scfribourg: "freiburg", fribourg: "freiburg", scfreiburg: "freiburg", fccologne: "fckoln", cologne: "fckoln", koln: "fckoln",
  mayence: "mainz", mainz05: "mainz", fsvmainz05: "mainz", augsbourg: "augsburg", fcaugsburg: "augsburg", unionberlin: "unionberlin",
  "1fcunionberlin": "unionberlin", tsghoffenheim: "hoffenheim", "1899hoffenheim": "hoffenheim", heidenheim: "heidenheim", rbleipzig: "rbleipzig", leipzig: "rbleipzig",
};

const SIGLES = /^(fc|ac|as|ssc|ss|rc|sc|cf|ogc|aj|vfb|vfl|tsg|sv|afc|rcd|cd|ud|sd|ca|us|1fc|fk|sk|bk|if)(.+)$|^(.+?)(fc|cf|afc|sc)$/;

/** Clé de comparaison d'un nom d'équipe. */
export function cleEquipe(nom: string): string {
  const n = normaliser(nom);
  if (EQUIVALENCES[n]) return EQUIVALENCES[n];
  const s = SIGLES.exec(n);
  const sansSigle = s ? (s[2] ?? s[3]) : n;
  return EQUIVALENCES[sansSigle] ?? sansSigle;
}

/** Nom de l'équipe dans les historiques (null si aucune ne correspond de façon sûre). */
export function trouverEquipe(nom: string, resultats: readonly Resultat[]): string | null {
  const noms = new Set<string>();
  for (const r of resultats) {
    noms.add(r.domicile);
    noms.add(r.exterieur);
  }
  const cle = cleEquipe(nom);
  const exacts = [...noms].filter((x) => cleEquipe(x) === cle || normaliser(x) === cle);
  if (exacts.length === 1) return exacts[0];
  if (exacts.length > 1) return null;
  if (cle.length < 4) return null;
  const proches = [...noms].filter((x) => {
    const k = cleEquipe(x);
    return k.length >= 4 && (k.includes(cle) || cle.includes(k));
  });
  return proches.length === 1 ? proches[0] : null;
}

export interface LigneMatch {
  date: string;
  championnat: string;
  adversaire: string;
  aDomicile: boolean;
  marques: number;
  encaisses: number;
  resultat: "V" | "N" | "D";
}

export interface Serie {
  texte: string;
  longueur: number;
}

export interface FicheEquipe {
  nom: string;
  /** Nom trouvé dans les historiques (null : aucun historique pour cette équipe). */
  nomHistorique: string | null;
  derniers: LigneMatch[];
  bilan: {
    victoires: number;
    nuls: number;
    defaites: number;
    marques: number;
    encaisses: number;
    butsParMatch: number;
    part2plus: number;
    part3plus: number;
    lesDeuxMarquent: number;
  } | null;
  series: Serie[];
  confrontations: Array<LigneMatch & { total: number }>;
}

function ligne(r: Resultat, equipe: string): LigneMatch {
  const aDomicile = r.domicile === equipe;
  const marques = aDomicile ? r.butsDomicile : r.butsExterieur;
  const encaisses = aDomicile ? r.butsExterieur : r.butsDomicile;
  return {
    date: r.date,
    championnat: r.championnat,
    adversaire: aDomicile ? r.exterieur : r.domicile,
    aDomicile,
    marques,
    encaisses,
    resultat: marques > encaisses ? "V" : marques === encaisses ? "N" : "D",
  };
}

const PREDICATS: ReadonlyArray<[string, (l: LigneMatch) => boolean]> = [
  ["victoires", (l) => l.resultat === "V"],
  ["matchs sans défaite", (l) => l.resultat !== "D"],
  ["défaites", (l) => l.resultat === "D"],
  ["matchs sans victoire", (l) => l.resultat !== "V"],
  ["matchs à 3 buts ou plus", (l) => l.marques + l.encaisses >= 3],
  ["matchs à 2 buts ou plus", (l) => l.marques + l.encaisses >= 2],
  ["matchs à moins de 3 buts", (l) => l.marques + l.encaisses < 3],
  ["matchs où elle marque", (l) => l.marques > 0],
  ["matchs sans marquer", (l) => l.marques === 0],
  ["matchs sans encaisser", (l) => l.encaisses === 0],
];

/** Séries en cours (du match le plus récent vers le passé), d'au moins 3 matchs. */
export function seriesEnCours(derniers: readonly LigneMatch[]): Serie[] {
  const series: Serie[] = [];
  for (const [texte, p] of PREDICATS) {
    let n = 0;
    while (n < derniers.length && p(derniers[n])) n++;
    if (n >= 3) series.push({ texte: `${n} ${texte} de suite`, longueur: n });
  }
  // Une série « 2 buts ou plus » est redondante avec une série « 3 buts ou plus » aussi longue.
  return series
    .filter((s, _, tous) => !(s.texte.includes("2 buts ou plus") && tous.some((t) => t.texte.includes("3 buts ou plus") && t.longueur >= s.longueur)))
    .sort((a, b) => b.longueur - a.longueur)
    .slice(0, 4);
}

export function ficheEquipe(nom: string, resultats: readonly Resultat[], adversaire?: string | null, n = 10): FicheEquipe {
  const equipe = trouverEquipe(nom, resultats);
  if (!equipe) return { nom, nomHistorique: null, derniers: [], bilan: null, series: [], confrontations: [] };
  const siens = resultats.filter((r) => r.domicile === equipe || r.exterieur === equipe).sort((a, b) => b.date.localeCompare(a.date));
  const derniers = siens.slice(0, n).map((r) => ligne(r, equipe));
  const nb = derniers.length;
  const bilan = nb
    ? {
        victoires: derniers.filter((l) => l.resultat === "V").length,
        nuls: derniers.filter((l) => l.resultat === "N").length,
        defaites: derniers.filter((l) => l.resultat === "D").length,
        marques: derniers.reduce((s, l) => s + l.marques, 0),
        encaisses: derniers.reduce((s, l) => s + l.encaisses, 0),
        butsParMatch: derniers.reduce((s, l) => s + l.marques + l.encaisses, 0) / nb,
        part2plus: derniers.filter((l) => l.marques + l.encaisses >= 2).length / nb,
        part3plus: derniers.filter((l) => l.marques + l.encaisses >= 3).length / nb,
        lesDeuxMarquent: derniers.filter((l) => l.marques > 0 && l.encaisses > 0).length / nb,
      }
    : null;
  const autre = adversaire ? trouverEquipe(adversaire, resultats) : null;
  const confrontations = autre
    ? siens
        .filter((r) => r.domicile === autre || r.exterieur === autre)
        .map((r) => ({ ...ligne(r, equipe), total: r.butsDomicile + r.butsExterieur }))
    : [];
  return { nom, nomHistorique: equipe, derniers, bilan, series: seriesEnCours(siens.map((r) => ligne(r, equipe))), confrontations };
}
