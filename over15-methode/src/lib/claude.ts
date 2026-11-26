// « Demander à Claude » : l'app prépare une demande, tu la colles dans l'app Claude
// (avec la recherche web), puis tu recolles la réponse ici. Gratuit avec ton abonnement Claude.
import { uid } from './defaults';
import type { Context, MatchData, Scorer, Settings, TeamData } from './types';

const FORMAT = `{
  "date": "AAAA-MM-JJ",
  "matchs": [
    {
      "competition": "Ligue des champions",
      "heure": "21:00",
      "domicile": {
        "nom": "Équipe A",
        "matchs": 20, "marques": 35, "encaisses": 22, "matchs_plus_1_5": 16, "pourcentage_plus_1_5": 80,
        "buteurs": [{ "nom": "Joueur", "buts": 12, "disponible": true }],
        "absents_attaque": ["Joueur blessé"]
      },
      "exterieur": { "nom": "Équipe B", "matchs": 19, "marques": 30, "encaisses": 25, "matchs_plus_1_5": null, "pourcentage_plus_1_5": 79, "buteurs": [], "absents_attaque": [] },
      "confrontations": ["2-1", "1-1", "3-2"],
      "contexte": "normal",
      "contexte_detail": "",
      "cote_avant_match": 1.25,
      "sources": ["https://…"]
    }
  ]
}`;

const RULES = `Pour CHAQUE équipe, sur la saison en cours, toutes compétitions confondues si possible (championnat + coupes d'Europe + coupes ; pour une sélection nationale, ses derniers matchs officiels) :
- "matchs" : matchs joués ; "marques" : buts marqués ; "encaisses" : buts encaissés. C'EST LE PLUS IMPORTANT : ne laisse jamais ces 3 chiffres vides. Si tu ne trouves pas le total toutes compétitions, prends au minimum le classement du championnat (matchs joués, buts pour, buts contre) ;
- "matchs_plus_1_5" : nombre de ses matchs terminés avec au moins 2 buts au total ; sinon "pourcentage_plus_1_5" : le % de ses matchs « Over 1.5 » (FootyStats, SoccerSTATS, Flashscore…) ;
- "buteurs" : ses 2 meilleurs buteurs, avec leurs buts et "disponible" : true (joue), false (blessé, suspendu, forfait) ou null (incertain) ;
- "absents_attaque" : les autres absents importants en attaque.
Pour le match :
- "confrontations" : les scores des 5 dernières confrontations directes, du plus récent au plus ancien (score de l'équipe à domicile de ce jour en premier si possible) ;
- "contexte" : un seul mot parmi normal, finale, derby, maintien, montee, sans_enjeu ; explique en quelques mots dans "contexte_detail" ;
- "cote_avant_match" : la cote « Plus de 1,5 but » avant le match si tu la trouves, sinon null.
Règles : cherche sur le web (sites officiels, L'Équipe, Flashscore, SofaScore, FBref, FootyStats, Transfermarkt…), n'invente JAMAIS un chiffre (mets null si tu ne trouves pas), ne mets aucune référence ni source à l'intérieur du JSON (seulement dans "sources"), et réponds UNIQUEMENT avec le bloc JSON ci-dessous, écrit directement dans ta réponse (pas dans un fichier ni un artefact), sans aucun texte avant ou après.`;

function dayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function buildDayPrompt(date: string, s: Settings): string {
  return `Tu m'aides à appliquer la méthode « Over 1.5 en live » (au moins 2 buts dans le match). Utilise la recherche web.

Date : ${dayLabel(date)} (${date}), heure de Paris.
Compétitions : ${s.competitions}.

1. Trouve les matchs de cette date dans ces compétitions.
2. Garde au maximum ${s.maxMatches} matchs : en priorité ceux entre deux équipes qui marquent beaucoup ET encaissent beaucoup.
3. ${RULES}

${FORMAT}`;
}

export function buildMatchPrompt(home: string, away: string, date: string): string {
  return `Tu m'aides à appliquer la méthode « Over 1.5 en live » (au moins 2 buts dans le match). Utilise la recherche web.

Match : ${home} contre ${away} (${home} reçoit), le ${dayLabel(date)} (${date}). Trouve sa compétition et son heure (heure de Paris).
${RULES}

${FORMAT}`;
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

export function toContext(x: unknown): Context {
  const t = str(x)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!t) return 'inconnu';
  if (t.includes('derby')) return 'derby';
  if (t.includes('finale') || t === 'final') return 'finale';
  if (t.includes('maintien') || t.includes('relegation')) return 'maintien';
  if (t.includes('montee') || t.includes('promotion')) return 'montee';
  if (t.includes('sans') || t.includes('enjeu')) return 'sans_enjeu';
  if (t.includes('normal')) return 'normal';
  return 'inconnu';
}

function team(x: Json): TeamData {
  const t = x ?? {};
  const scorers: Scorer[] = Array.isArray(t.buteurs ?? t.scorers)
    ? (t.buteurs ?? t.scorers)
        .map((b: Json) => ({ name: str(b?.nom ?? b?.name), goals: num(b?.buts ?? b?.goals), available: bool(b?.disponible ?? b?.available) }))
        .filter((b: Scorer) => b.name)
    : [];
  const absents = Array.isArray(t.absents_attaque ?? t.absents) ? (t.absents_attaque ?? t.absents).map(str).filter(Boolean) : [];
  return {
    name: str(t.nom ?? t.name) || '?',
    played: num(t.matchs ?? t.played),
    scored: num(t.marques ?? t.scored),
    conceded: num(t.encaisses ?? t.conceded),
    over15: num(t.matchs_plus_1_5 ?? t.over15),
    over15Pct: num(t.pourcentage_plus_1_5 ?? t.over15_pct),
    scorers,
    absents,
  };
}

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

export function parseClaude(text: string, fallbackDate: string): { matches: MatchData[]; date: string } {
  const j = extractJson(text);
  const list: Json[] = Array.isArray(j) ? j : Array.isArray(j.matchs) ? j.matchs : Array.isArray(j.matches) ? j.matches : j.domicile ? [j] : [];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(j.date)) ? str(j.date) : fallbackDate;
  const now = new Date().toISOString();
  const matches = list
    .map(
      (m): MatchData => ({
        id: uid(),
        date: /^\d{4}-\d{2}-\d{2}$/.test(str(m.date)) ? str(m.date) : date,
        time: str(m.heure ?? m.time),
        competition: str(m.competition) || 'Compétition',
        home: team(m.domicile ?? m.home),
        away: team(m.exterieur ?? m.away),
        h2h: Array.isArray(m.confrontations ?? m.h2h) ? (m.confrontations ?? m.h2h).map(str).filter(Boolean).slice(0, 5) : [],
        context: toContext(m.contexte ?? m.context),
        contextDetail: str(m.contexte_detail ?? m.context_detail),
        preOdds: num(m.cote_avant_match ?? m.odds),
        sources: Array.isArray(m.sources) ? m.sources.map(str).filter(Boolean).slice(0, 6) : [],
        importedAt: now,
      }),
    )
    .filter((m) => m.home.name !== '?' && m.away.name !== '?');
  if (!matches.length) throw new Error('Aucun match lisible dans la réponse. Redemande à Claude, puis recopie toute sa réponse.');
  return { matches, date };
}

/** Complète un match avec une nouvelle réponse de Claude : les nouveaux chiffres remplacent les anciens, les vides sont gardés. */
export function mergeMatch(old: MatchData, fresh: MatchData): MatchData {
  const team = (o: TeamData, f: TeamData): TeamData => ({
    name: o.name,
    played: f.played ?? o.played,
    scored: f.scored ?? o.scored,
    conceded: f.conceded ?? o.conceded,
    over15: f.over15 ?? o.over15,
    over15Pct: f.over15Pct ?? o.over15Pct ?? null,
    scorers: f.scorers.length ? f.scorers : o.scorers,
    absents: f.absents.length ? f.absents : o.absents,
  });
  return {
    ...old,
    time: old.time || fresh.time,
    competition: old.competition || fresh.competition,
    home: team(old.home, fresh.home),
    away: team(old.away, fresh.away),
    h2h: fresh.h2h.length ? fresh.h2h : old.h2h,
    context: fresh.context !== 'inconnu' ? fresh.context : old.context,
    contextDetail: fresh.contextDetail || old.contextDetail,
    preOdds: fresh.preOdds ?? old.preOdds,
    sources: [...new Set([...fresh.sources, ...old.sources])].slice(0, 8),
  };
}
