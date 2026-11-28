// « Demander à Claude » : l'app prépare une demande, tu la colles dans l'app Claude
// (avec la recherche web), puis tu recolles sa réponse ici. Gratuit avec ton abonnement Claude.
import { EUROPE_COMPETITIONS, uid } from './defaults';
import type { Bet, MatchContext, Outsider, Settings, TeamFacts, Venue } from './types';

function dayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const TEAM_FORMAT = `{
        "nom": "Angers",
        "cote": 6.20,
        "cote_pinnacle": 6.50,
        "classement": 15, "points": 14, "matchs": 13,
        "ecart_zone_rouge": 2,
        "objectif": "maintien",
        "forme": "VNDDN",
        "lieu": { "joues": 7, "v": 1, "n": 3, "d": 3, "bp": 6, "bc": 9 },
        "buts_marques": 12, "buts_encaisses": 18,
        "xg_pour": 1.10, "xg_contre": 1.50,
        "buteurs": [ { "nom": "Joueur", "buts": 5, "disponible": true } ],
        "absents": [ { "nom": "Joueur", "raison": "blessé", "titulaire": true } ],
        "dernier_match": "samedi, victoire 2-1 contre Lyon",
        "jours_repos": 6,
        "coupe_europe_semaine": false,
        "entraineur": "Nom", "nouvel_entraineur": false,
        "elo": 1580
      }`;

const OUTSIDERS_FORMAT = `{
  "date": "AAAA-MM-JJ",
  "matchs": [
    {
      "competition": "Ligue 1",
      "heure": "21:00",
      "domicile": "Lens",
      "exterieur": "Angers",
      "pari": "Victoire de Angers",
      "bookmaker": "Winamax",
      "cote_nul": 4.20,
      "pinnacle_nul": 4.35,
      "outsider": ${TEAM_FORMAT},
      "favori": { "nom": "Lens", "...": "mêmes champs que l'outsider" },
      "enjeu": "ce que chaque équipe joue : maintien, titre, Europe, rien",
      "lien": "derby, rivalité, ancien joueur… ou vide",
      "confrontations": ["2025-04 Lens 1-1 Angers"],
      "mouvement_cote": "baisse",
      "mouvement_detail": "6,50 → 6,20 depuis hier",
      "meteo": "pluie forte",
      "arbitre": "nom, cartons par match",
      "infos_en_plus": ["phrase courte"],
      "proba_estimee": 15,
      "raisons_pour": ["phrase courte"],
      "raisons_contre": ["phrase courte"],
      "sources": ["https://…"]
    }
  ]
}`;

const FICHE = `Pour chacun, remplis la fiche complète, pour l'OUTSIDER et pour le FAVORI :
- cotes : chez le bookmaker et chez Pinnacle (OddsPortal ou un autre comparateur), et la cote du nul ;
- classement, points, matchs joués, écart avec la zone de relégation (+ si au-dessus, − si dedans), objectif (maintien, titre, europe, milieu, montée) ;
- forme sur les 5 derniers matchs (V, N, D, le plus récent à gauche) ;
- bilan à domicile pour l'équipe qui reçoit, à l'extérieur pour l'autre (joués, victoires, nuls, défaites, buts pour, buts contre) ;
- buts marqués et encaissés en championnat, xG pour et contre par match (Understat, FotMob, FBref…) ;
- les meilleurs buteurs avec leurs buts et s'ils jouent ; les absents (blessés, suspendus) et s'ils sont titulaires (Transfermarkt, conférences de presse, compositions probables) ;
- dernier match, jours de repos, match de Coupe d'Europe cette semaine (fatigue, rotation) ;
- entraîneur, et s'il est nouveau (effet « nouvel entraîneur ») ;
- classement Elo (ClubElo) ;
- l'enjeu du match, le lien entre les équipes (derby, rivalité), les 5 dernières confrontations, le mouvement de la cote, la météo, l'arbitre, et toute autre info utile (déplacement long, terrain, ambiance, presse locale).
"proba_estimee" : TA propre estimation, en %, des chances de victoire de l'outsider.`;

const JSON_RULES = `Règles pour que mon application puisse lire ta réponse :
- réponds UNIQUEMENT avec le bloc JSON ci-dessous, dans un bloc \`\`\`json, écrit directement dans ta réponse (pas dans un fichier ni un artefact), sans texte avant ou après ;
- guillemets droits " uniquement, jamais de guillemets à l'intérieur d'un texte (utilise « » ou ') ;
- décimales avec un point (6.20), pas de %, pas de commentaires, aucune référence ni source dans le JSON (seulement dans "sources") ;
- n'invente JAMAIS un chiffre : mets null si tu ne trouves pas.`;

export function buildOutsidersPrompt(date: string, s: Settings): string {
  const n = Math.min(Math.max(1, s.maxPicks), 5);
  return `Tu m'aides à repérer des OUTSIDERS (l'équipe qui n'est pas favorite) qui valent le coup. Utilise la recherche web et va chercher loin : je veux des CHIFFRES pour décider moi-même.

Date : ${dayLabel(date)} (${date}), heure de Paris.
Compétitions : ${s.competitions}.

1. Parmi les matchs de cette date, choisis les ${n} outsiders les plus intéressants : cote de victoire d'au moins ${String(s.minOdds).replace('.', ',')} chez ${s.bookmakers}.
2. ${FICHE}

${JSON_RULES}

${OUTSIDERS_FORMAT}`;
}

/** La chasse : toutes les cotes européennes à 3,80 ou plus du jour, et seulement les meilleures bonnes affaires. */
export function buildHuntPrompt(date: string, s: Settings): string {
  const min = s.huntMinOdds.toFixed(2).replace('.', ',');
  const n = Math.min(Math.max(1, s.huntCount), 8);
  return `Tu es mon analyste de paris « value ». Mission : trouver les MEILLEURES BONNES AFFAIRES du jour sur des cotes d'au moins ${min}, uniquement sur des matchs EUROPÉENS. Utilise la recherche web et prends le temps de tout passer en revue.

Date : ${dayLabel(date)} (${date}), heure de Paris.
Compétitions : ${EUROPE_COMPETITIONS}.
Bookmakers : ${s.bookmakers}.

Méthode, étape par étape :
1. Fais la liste de TOUS les matchs européens de cette date (pas seulement les plus connus).
2. Garde chaque équipe dont la cote de victoire est d'au moins ${min} chez un de ces bookmakers.
3. Pour chacune, compare à Pinnacle (OddsPortal ou un autre comparateur) : retire la marge de Pinnacle (normalise les 3 cotes 1-N-2) pour obtenir la vraie chance, puis calcule la value = vraie chance × cote du bookmaker − 1. Si Pinnacle est introuvable, estime la vraie chance avec le classement Elo (ClubElo), les xG, la forme, les absents et l'enjeu.
4. Élimine tout ce qui n'a pas de value positive. Puis vérifie les infos qui font gagner un outsider : absents chez le favori, fatigue et rotation (Coupe d'Europe en semaine, long déplacement), motivation (maintien, derby, rien à perdre), nouvel entraîneur, bons xG malgré des défaites serrées, cote qui baisse.
5. Classe et garde au maximum les ${n} meilleures bonnes affaires (la plus grosse value d'abord). S'il y en a moins de ${n}, n'en invente pas : donne seulement les vraies.
6. ${FICHE}

${JSON_RULES}

${OUTSIDERS_FORMAT}`;
}

export function buildResultsPrompt(bets: Bet[]): string {
  const list = bets.map((b) => `- id "${b.id}" : ${b.match}, le ${b.date}${b.league ? ` (${b.league})` : ''}, pari : ${b.pick || 'voir le match'}`).join('\n');
  return `Donne-moi les résultats de ces matchs de foot. Utilise la recherche web.

${list}

Pour chaque ligne : le score final et si le pari est gagné (true), perdu (false), ou null si le match n'est pas encore joué ou reporté.
Réponds UNIQUEMENT avec ce bloc JSON, écrit directement dans ta réponse, sans texte avant ou après :
{ "resultats": [ { "id": "…", "score": "2-1", "gagne": true } ] }`;
}

// ---------- Lecture de la réponse ----------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const num = (x: unknown): number | null => {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x.replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const str = (x: unknown): string => (typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : '');
const bool = (x: unknown): boolean | null => {
  if (x === true || x === false) return x;
  if (typeof x === 'string') {
    const t = x.toLowerCase();
    if (/^(oui|yes|true|disponible)/.test(t)) return true;
    if (/^(non|no|false|absent|bless|suspend|forfait)/.test(t)) return false;
  }
  return null;
};

const SKIP_OUTSIDE = new Set(['%', '~', '≈', '…', '*', '#', '`', '>']);

function prevSignificant(out: string): string {
  for (let i = out.length - 1; i >= 0; i--) if (!/\s/.test(out[i])) return out[i];
  return '';
}

function nextSignificant(src: string, i: number): string {
  for (let j = i; j < src.length; j++) if (!/\s/.test(src[j])) return src[j];
  return '';
}

/**
 * Répare ce que l'app Claude (ou Claude lui-même) peut abîmer dans un JSON :
 * références de sources « (Wikipedia) », « 【1】 », « [3] », commentaires, guillemets non échappés dans un texte,
 * retours à la ligne dans un texte, virgules décimales (8,40), mots comme N/A, %, ~, virgules manquantes ou en trop,
 * et réponse coupée (on referme ce qui est ouvert).
 */
export function repairJson(input: string): string {
  let src = input.replace(/ /g, ' ').replace(/\r/g, '');
  if (!src.includes('"')) src = src.replace(/[“”«»]/g, '"');
  let out = '';
  let inStr = false;
  let esc = false;
  let depth = 0;
  const stack: string[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) {
        out += ch;
        esc = false;
      } else if (ch === '\\') {
        out += ch;
        esc = true;
      } else if (ch === '"') {
        const nx = nextSignificant(src, i + 1);
        if (nx === '' || nx === ',' || nx === '}' || nx === ']' || nx === ':' || nx === '(' || nx === '【' || nx === '[') {
          out += ch;
          inStr = false;
        } else out += '\\"';
      } else if (ch === '\n') out += '\\n';
      else if (ch === '\t') out += ' ';
      else out += ch;
      continue;
    }
    if (depth > 0) {
      if (ch === '(' || ch === '【') depth++;
      else if (ch === ')' || ch === '】') depth--;
      continue;
    }
    if (ch === '"' || ch === '“' || ch === '”') {
      inStr = true;
      out += '"';
      continue;
    }
    if (ch === '(' || ch === '【') {
      depth = 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 1;
      continue;
    }
    if (ch === '[') {
      const cite = src.slice(i).match(/^\[\d+(?:[,\s]+\d+)*\]/);
      const prev = prevSignificant(out);
      if (cite && prev !== ':' && prev !== ',' && prev !== '[') {
        i += cite[0].length - 1;
        continue;
      }
      stack.push(']');
      out += ch;
      continue;
    }
    if (ch === '{') {
      stack.push('}');
      out += ch;
      continue;
    }
    if (ch === '}' || ch === ']') {
      if (stack.length && stack[stack.length - 1] === ch) stack.pop();
      out += ch;
      continue;
    }
    if (/[0-9]/.test(ch) && prevSignificant(out) === ':') {
      const m = src.slice(i).match(/^\d+,\d+(?=\s*[,}\]\n%])/);
      if (m) {
        out += m[0].replace(',', '.');
        i += m[0].length - 1;
        continue;
      }
    }
    if (/[A-Za-zÀ-ÿ_]/.test(ch)) {
      const m = src.slice(i).match(/^[A-Za-zÀ-ÿ_/.-]+/);
      const word = m ? m[0] : ch;
      i += word.length - 1;
      if (word === 'true' || word === 'false' || word === 'null') out += word;
      else {
        const prev = prevSignificant(out);
        if (prev === ':' || prev === '[' || prev === ',') {
          const w = word.toLowerCase();
          out += w === 'oui' || w === 'yes' || w === 'vrai' ? 'true' : w === 'non' || w === 'no' || w === 'faux' ? 'false' : 'null';
        }
      }
      continue;
    }
    if (SKIP_OUTSIDE.has(ch)) continue;
    out += ch;
  }
  if (inStr) out += '"';
  // Virgules manquantes entre deux éléments sur des lignes différentes, ou entre deux objets.
  out = out.replace(/}\s*{/g, '},{').replace(/]\s*\[/g, '],[');
  out = out.replace(/(["\d}\]]|true|false|null)([ \t]*\n\s*)(")/g, '$1,$2$3');
  // Virgules en trop.
  out = out.replace(/,(\s*[}\]])/g, '$1').replace(/,\s*$/, '');
  // Réponse coupée : on referme ce qui est encore ouvert.
  const open: string[] = [];
  let s2 = false;
  let e2 = false;
  for (const c of out) {
    if (s2) {
      if (e2) e2 = false;
      else if (c === '\\') e2 = true;
      else if (c === '"') s2 = false;
      continue;
    }
    if (c === '"') s2 = true;
    else if (c === '{') open.push('}');
    else if (c === '[') open.push(']');
    else if ((c === '}' || c === ']') && open[open.length - 1] === c) open.pop();
  }
  if (open.length) out = out.replace(/[,:]\s*$/, '') + open.reverse().join('');
  return out;
}

/** Ancien nom gardé pour la compatibilité. */
export const cleanJson = repairJson;

const KEYS = /"(date|matchs|outsiders|resultats|results)"\s*:/;

/** Trouve le début du JSON utile dans un texte (bloc ```json, sinon l'accolade qui précède "date" / "matchs"…). */
function jsonBody(text: string): string {
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)(```|$)/);
  let body = fence && fence[1].includes('{') ? fence[1] : text;
  const k = body.search(KEYS);
  let a = k >= 0 ? body.lastIndexOf('{', k) : body.indexOf('{');
  if (a < 0) a = body.indexOf('{');
  if (a < 0) throw new Error('Je ne trouve pas de données dans ce texte. As-tu bien copié la réponse de Claude ?');
  body = body.slice(a);
  const b = body.lastIndexOf('}');
  return b > 0 ? body.slice(0, b + 1) + body.slice(b + 1).replace(/[^\]}]/g, '') : body;
}

/** Découpe un tableau JSON en objets, pour sauver ceux qui sont lisibles quand un seul est abîmé. */
function salvageArray(body: string, key: string): Json[] {
  const k = body.search(new RegExp(`"${key}"\\s*:\\s*\\[`));
  if (k < 0) return [];
  const start = body.indexOf('[', k);
  const items: Json[] = [];
  let depth = 0;
  let from = -1;
  let inStr = false;
  let esc = false;
  for (let i = start + 1; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') {
      if (depth === 0) from = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && from >= 0) {
        const chunk = body.slice(from, i + 1);
        for (const t of [chunk, repairJson(chunk)]) {
          try {
            items.push(JSON.parse(t));
            break;
          } catch {
            /* objet abîmé : on le saute */
          }
        }
        from = -1;
      }
    } else if (c === ']' && depth === 0) break;
  }
  return items;
}

export class ParseError extends Error {
  constructor(
    message: string,
    public excerpt: string,
  ) {
    super(message);
  }
}

/** Extrait et lit le JSON d'une réponse de Claude, en réparant ce qui peut l'être. */
export function extractJson(text: string): Json {
  const body = jsonBody(text);
  let lastErr: unknown = null;
  for (const t of [body, repairJson(body)]) {
    try {
      return JSON.parse(t);
    } catch (e) {
      lastErr = e;
    }
  }
  // Dernier recours : on sauve les matchs lisibles un par un.
  const repaired = repairJson(body);
  for (const key of ['matchs', 'outsiders', 'resultats', 'results']) {
    const items = salvageArray(repaired, key);
    if (items.length) {
      const date = repaired.match(/"date"\s*:\s*"([^"]+)"/);
      return { date: date ? date[1] : undefined, [key]: items, _salvaged: true };
    }
  }
  const pos = Number(String(lastErr instanceof Error ? lastErr.message : '').match(/position (\d+)/)?.[1] ?? NaN);
  const excerpt = Number.isFinite(pos) ? repaired.slice(Math.max(0, pos - 40), pos + 40) : repaired.slice(0, 80);
  throw new ParseError('La réponse est coupée ou abîmée. Dans Claude, touche « Copier » sous la réponse (pas une sélection à la main), puis réessaie.', excerpt);
}

function list(x: unknown): string[] {
  return Array.isArray(x) ? x.map(str).filter(Boolean).slice(0, 6) : typeof x === 'string' && x.trim() ? [x.trim()] : [];
}

function move(x: unknown): Outsider['signals']['oddsMove'] {
  const t = str(x).toLowerCase();
  if (t.startsWith('bai')) return 'baisse';
  if (t.startsWith('hau')) return 'hausse';
  if (t.startsWith('sta')) return 'stable';
  return 'inconnu';
}

function venue(x: Json): Venue | null {
  if (!x || typeof x !== 'object') return null;
  const v: Venue = { played: num(x.joues ?? x.played), w: num(x.v ?? x.w), d: num(x.n ?? x.d), l: num(x.d !== undefined && x.n !== undefined ? x.d : x.l), gf: num(x.bp ?? x.gf), ga: num(x.bc ?? x.ga) };
  return Object.values(v).some((n) => n !== null) ? v : null;
}

function team(x: Json, fallbackName: string): TeamFacts {
  const t = x && typeof x === 'object' ? x : {};
  const scorers = Array.isArray(t.buteurs) ? t.buteurs.map((b: Json) => ({ name: str(b?.nom ?? b?.name), goals: num(b?.buts ?? b?.goals), available: bool(b?.disponible ?? b?.available) })).filter((b: { name: string }) => b.name).slice(0, 4) : [];
  const absents = Array.isArray(t.absents)
    ? t.absents
        .map((a: Json) => (typeof a === 'string' ? { name: a, reason: '', key: null } : { name: str(a?.nom ?? a?.name), reason: str(a?.raison ?? a?.reason), key: bool(a?.titulaire ?? a?.key) }))
        .filter((a: { name: string }) => a.name)
        .slice(0, 8)
    : [];
  return {
    name: str(t.nom ?? t.name) || fallbackName,
    odds: num(t.cote ?? t.odds),
    pinnacle: num(t.cote_pinnacle ?? t.pinnacle),
    rank: num(t.classement ?? t.rank),
    points: num(t.points),
    played: num(t.matchs ?? t.played),
    zoneGap: num(t.ecart_zone_rouge ?? t.zone_gap),
    goal: str(t.objectif ?? t.goal),
    form: str(t.forme ?? t.form).toUpperCase().replace(/[^VND]/g, '').slice(0, 5),
    venue: venue(t.lieu ?? t.venue),
    scored: num(t.buts_marques ?? t.scored),
    conceded: num(t.buts_encaisses ?? t.conceded),
    xgFor: num(t.xg_pour ?? t.xg_for),
    xgAgainst: num(t.xg_contre ?? t.xg_against),
    scorers,
    absents,
    lastMatch: str(t.dernier_match ?? t.last_match),
    restDays: num(t.jours_repos ?? t.rest_days),
    europe: bool(t.coupe_europe_semaine ?? t.europe),
    coach: str(t.entraineur ?? t.coach),
    newCoach: bool(t.nouvel_entraineur ?? t.new_coach),
    elo: num(t.elo),
  };
}

/** Lit les outsiders proposés par Claude (fiche détaillée, ou ancien format simple). */
export function parseOutsiders(text: string, fallbackDate: string): { picks: Outsider[]; date: string; salvaged: boolean } {
  const j = extractJson(text);
  const arr: Json[] = Array.isArray(j) ? j : Array.isArray(j.matchs) ? j.matchs : Array.isArray(j.outsiders) ? j.outsiders : j.outsider ? [j] : [];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(j.date)) ? str(j.date) : fallbackDate;
  const now = new Date().toISOString();
  const picks = arr
    .map((m): Outsider => {
      const detailed = m.outsider && typeof m.outsider === 'object';
      const out = detailed ? team(m.outsider, '') : undefined;
      const fav = detailed ? team(m.favori, '') : undefined;
      const pin = m.cotes_pinnacle ?? m.pinnacle ?? {};
      let est = num(m.proba_estimee ?? m.estimate);
      if (est !== null && est > 1) est = est / 100;
      const teamName = (out?.name || str(detailed ? '' : m.outsider ?? m.equipe)) || str(m.domicile);
      const home = str(m.domicile ?? m.home);
      const awayName = str(m.exterieur ?? m.away);
      const ctx: MatchContext | undefined = detailed
        ? {
            stakes: str(m.enjeu),
            link: str(m.lien),
            h2h: list(m.confrontations),
            oddsMoveDetail: str(m.mouvement_detail),
            weather: str(m.meteo),
            referee: str(m.arbitre),
            extra: list(m.infos_en_plus),
            drawOdds: num(m.cote_nul),
          }
        : undefined;
      const absentsFav = fav ? fav.absents.map((a) => `${a.name}${a.reason ? ` (${a.reason})` : ''}`) : list(m.absents_favori);
      return {
        id: uid(),
        date: /^\d{4}-\d{2}-\d{2}$/.test(str(m.date)) ? str(m.date) : date,
        time: str(m.heure ?? m.time),
        competition: str(m.competition) || 'Compétition',
        home,
        away: awayName,
        team: teamName,
        bet: str(m.pari) || `Victoire de ${teamName}`,
        odds: out?.odds ?? num(m.cote ?? m.odds),
        bookmaker: str(m.bookmaker),
        pinnacle: detailed
          ? { out: out?.pinnacle ?? null, draw: num(m.pinnacle_nul), fav: fav?.pinnacle ?? null }
          : { out: num(pin.outsider ?? pin.out), draw: num(pin.nul ?? pin.draw), fav: num(pin.favori ?? pin.fav) },
        estimate: est !== null && est > 0 && est < 1 ? est : null,
        reasonsFor: list(m.raisons_pour),
        reasonsAgainst: list(m.raisons_contre),
        signals: {
          xg: detailed ? '' : str(m.xg),
          absentsFav,
          fatigueFav: detailed ? (fav?.europe === true || (fav?.restDays !== null && fav?.restDays !== undefined && fav.restDays <= 3) ? true : fav?.europe === false ? false : null) : bool(m.fatigue_favori),
          motivation: detailed ? str(m.enjeu) : str(m.motivation),
          oddsMove: move(m.mouvement_cote),
        },
        sources: list(m.sources),
        importedAt: now,
        out,
        fav,
        ctx,
      };
    })
    .filter((p) => p.team && (p.home || p.away));
  if (!picks.length) throw new Error('Aucun outsider lisible dans la réponse. Redemande à Claude, puis recopie toute sa réponse.');
  return { picks, date, salvaged: !!j._salvaged };
}

/** Lit les résultats renvoyés par Claude. */
export function parseResults(text: string): { id: string; score: string; won: boolean | null }[] {
  const j = extractJson(text);
  const arr: Json[] = Array.isArray(j) ? j : Array.isArray(j.resultats) ? j.resultats : Array.isArray(j.results) ? j.results : [];
  const out = arr.map((r) => ({ id: str(r.id), score: str(r.score), won: bool(r.gagne ?? r.won) })).filter((r) => r.id);
  if (!out.length) throw new Error('Aucun résultat lisible dans la réponse. Recopie toute la réponse de Claude.');
  return out;
}
