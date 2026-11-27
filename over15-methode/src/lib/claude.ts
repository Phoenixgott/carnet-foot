// « Demander à Claude » : l'app prépare une demande, tu la colles dans l'app Claude
// (avec la recherche web), puis tu recolles sa réponse ici. Gratuit avec ton abonnement Claude.
import { uid } from './defaults';
import type { Bet, Outsider, Settings } from './types';

function dayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const OUTSIDERS_FORMAT = `{
  "date": "AAAA-MM-JJ",
  "outsiders": [
    {
      "competition": "Saudi Pro League",
      "heure": "18:00",
      "domicile": "Al Feiha",
      "exterieur": "Al Hilal",
      "outsider": "Al Feiha",
      "pari": "Victoire de Al Feiha",
      "cote": 8.40,
      "bookmaker": "Winamax",
      "cotes_pinnacle": { "outsider": 7.00, "nul": 4.90, "favori": 1.42 },
      "proba_estimee": 14,
      "raisons_pour": ["phrase courte"],
      "raisons_contre": ["phrase courte"],
      "xg": "phrase courte sur les xG de l'outsider",
      "absents_favori": ["Joueur (blessé)"],
      "fatigue_favori": true,
      "motivation": "phrase courte",
      "mouvement_cote": "baisse",
      "sources": ["https://…"]
    }
  ]
}`;

export function buildOutsidersPrompt(date: string, s: Settings): string {
  return `Tu m'aides à trouver des paris « value » sur des OUTSIDERS (l'équipe qui n'est pas favorite). Utilise la recherche web.

Date : ${dayLabel(date)} (${date}), heure de Paris.
Compétitions : ${s.competitions}.

1. Parmi les matchs de cette date, trouve les ${s.maxPicks} outsiders les plus intéressants : cote de victoire d'au moins ${String(s.minOdds).replace('.', ',')} chez ${s.bookmakers}.
2. Pour chacun :
- "cote" : la cote de l'outsider chez un de ces bookmakers (indique lequel dans "bookmaker") ;
- "cotes_pinnacle" : les cotes Pinnacle 1-N-2 du même match (OddsPortal ou un autre comparateur). C'est le plus important : Pinnacle a les cotes les plus justes. Mets null pour celles que tu ne trouves pas ;
- "proba_estimee" : TA propre estimation, en %, des chances de victoire de l'outsider, en t'appuyant sur : classement Elo (ClubElo), xG (buts attendus), forme sur 5 à 10 matchs à domicile/à l'extérieur, absents du favori (surtout gardien et buteur), fatigue et rotation du favori (match européen en semaine), motivation (maintien, derby, fin de saison), mouvement des cotes ;
- "raisons_pour" et "raisons_contre" : 3 phrases courtes maximum chacune ;
- "xg", "absents_favori", "fatigue_favori" (true/false/null), "motivation", "mouvement_cote" (baisse, hausse, stable ou inconnu).
3. Garde les outsiders même si tu penses que ce n'est pas de la value : l'app fera le calcul.

Règles : n'invente JAMAIS un chiffre (mets null si tu ne trouves pas), ne mets aucune référence ni source à l'intérieur du JSON (seulement dans "sources"), et réponds UNIQUEMENT avec le bloc JSON ci-dessous, écrit directement dans ta réponse (pas dans un fichier ni un artefact), sans aucun texte avant ou après.

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

/**
 * Nettoie ce que l'app Claude ajoute en copiant : références de sources « (Wikipedia) », « 【1】 »,
 * commentaires « // … », virgules en trop. Ne touche jamais au texte entre guillemets.
 */
export function cleanJson(body: string): string {
  let out = '';
  let inStr = false;
  let esc = false;
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (depth > 0) {
      if (ch === '(' || ch === '【') depth++;
      else if (ch === ')' || ch === '】') depth--;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
    } else if (ch === '(' || ch === '【') {
      depth = 1;
    } else if (ch === '/' && body[i + 1] === '/') {
      while (i < body.length && body[i] !== '\n') i++;
      out += '\n';
    } else {
      out += ch;
    }
  }
  // Virgules en trop avant } ou ] (hors guillemets : les textes n'en contiennent pas à cet endroit).
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** Extrait le JSON d'une réponse (bloc ```json, ou du premier { au dernier }). */
export function extractJson(text: string): Json {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = fence ? fence[1] : text;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Je ne trouve pas de données dans ce texte. As-tu bien copié la réponse de Claude ?');
  body = body.slice(a, b + 1);
  const cleaned = cleanJson(body);
  const attempts = [body, cleaned, cleanJson(body.replace(/[“”]/g, '"'))];
  for (const t of attempts) {
    try {
      return JSON.parse(t);
    } catch {
      /* essai suivant */
    }
  }
  throw new Error('La réponse est coupée ou abîmée. Dans Claude, touche « Copier » sous la réponse (pas une sélection à la main), puis réessaie.');
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

/** Lit les outsiders proposés par Claude. */
export function parseOutsiders(text: string, fallbackDate: string): { picks: Outsider[]; date: string } {
  const j = extractJson(text);
  const arr: Json[] = Array.isArray(j) ? j : Array.isArray(j.outsiders) ? j.outsiders : Array.isArray(j.matchs) ? j.matchs : j.outsider ? [j] : [];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(j.date)) ? str(j.date) : fallbackDate;
  const now = new Date().toISOString();
  const picks = arr
    .map((m): Outsider => {
      const pin = m.cotes_pinnacle ?? m.pinnacle ?? {};
      let est = num(m.proba_estimee ?? m.estimate);
      if (est !== null && est > 1) est = est / 100;
      const team = str(m.outsider ?? m.equipe) || str(m.domicile);
      return {
        id: uid(),
        date: /^\d{4}-\d{2}-\d{2}$/.test(str(m.date)) ? str(m.date) : date,
        time: str(m.heure ?? m.time),
        competition: str(m.competition) || 'Compétition',
        home: str(m.domicile ?? m.home),
        away: str(m.exterieur ?? m.away),
        team,
        bet: str(m.pari) || `Victoire de ${team}`,
        odds: num(m.cote ?? m.odds),
        bookmaker: str(m.bookmaker),
        pinnacle: { out: num(pin.outsider ?? pin.out), draw: num(pin.nul ?? pin.draw), fav: num(pin.favori ?? pin.fav) },
        estimate: est !== null && est > 0 && est < 1 ? est : null,
        reasonsFor: list(m.raisons_pour),
        reasonsAgainst: list(m.raisons_contre),
        signals: { xg: str(m.xg), absentsFav: list(m.absents_favori), fatigueFav: bool(m.fatigue_favori), motivation: str(m.motivation), oddsMove: move(m.mouvement_cote) },
        sources: list(m.sources),
        importedAt: now,
      };
    })
    .filter((p) => p.team && (p.home || p.away));
  if (!picks.length) throw new Error('Aucun outsider lisible dans la réponse. Redemande à Claude, puis recopie toute sa réponse.');
  return { picks, date };
}

/** Lit les résultats renvoyés par Claude. */
export function parseResults(text: string): { id: string; score: string; won: boolean | null }[] {
  const j = extractJson(text);
  const arr: Json[] = Array.isArray(j) ? j : Array.isArray(j.resultats) ? j.resultats : Array.isArray(j.results) ? j.results : [];
  const out = arr.map((r) => ({ id: str(r.id), score: str(r.score), won: bool(r.gagne ?? r.won) })).filter((r) => r.id);
  if (!out.length) throw new Error('Aucun résultat lisible dans la réponse. Recopie toute la réponse de Claude.');
  return out;
}
