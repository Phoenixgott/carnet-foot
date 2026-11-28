// Les signaux d'un outsider : chaque info chiffrée devient 👍 (pour l'outsider) ou 👎 (contre), avec le chiffre.
// L'app ne décide pas à ta place : elle range les chiffres pour que tu voies tout d'un coup d'œil.
import type { Outsider, TeamFacts } from './types';

export type Side = 'pour' | 'contre' | 'info';

export interface Signal {
  icon: string;
  text: string;
  side: Side;
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const f1 = (n: number) => n.toFixed(1).replace('.', ',');

/** Points sur la forme récente : V = 3, N = 1, D = 0. */
export function formPoints(form: string): number | null {
  if (!form) return null;
  return [...form.slice(0, 5)].reduce((s, c) => s + (c === 'V' ? 3 : c === 'N' ? 1 : 0), 0);
}

function perMatch(n: number | null, t: TeamFacts): number | null {
  return isNum(n) && isNum(t.played) && t.played > 0 ? n / t.played : null;
}

const has = (s: string, ...words: string[]) => words.some((w) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(w));

export function computeSignals(p: Outsider): Signal[] {
  const o = p.out;
  const f = p.fav;
  const sig: Signal[] = [];
  const add = (icon: string, text: string, side: Side) => sig.push({ icon, text, side });

  if (o && f) {
    const on = o.name || p.team;
    const fn = f.name || 'le favori';
    // Forme
    const op = formPoints(o.form);
    const fp = formPoints(f.form);
    if (op !== null && fp !== null) {
      const t = `Forme : ${on} ${op} pts sur 15 (${o.form}), ${fn} ${fp} pts (${f.form})`;
      add('📈', t, op >= fp ? 'pour' : op <= fp - 6 ? 'contre' : 'info');
    }
    // Domicile / extérieur
    const ov = o.venue;
    if (ov && isNum(ov.played) && ov.played > 0 && isNum(ov.w) && isNum(ov.d)) {
      const unbeaten = (ov.w + ov.d) / ov.played;
      const where = p.home === on ? 'à domicile' : "à l'extérieur";
      add('🏟️', `${on} ${where} : ${ov.w} V, ${ov.d} N, ${ov.l ?? '?'} D en ${ov.played} matchs`, unbeaten >= 0.5 ? 'pour' : unbeaten <= 0.25 ? 'contre' : 'info');
    }
    const fv = f.venue;
    if (fv && isNum(fv.played) && fv.played > 0 && isNum(fv.w)) {
      const where = p.home === fn ? 'à domicile' : "à l'extérieur";
      const rate = fv.w / fv.played;
      add('🏟️', `${fn} ${where} : ${fv.w} victoire(s) en ${fv.played} matchs`, rate <= 0.4 ? 'pour' : rate >= 0.75 ? 'contre' : 'info');
    }
    // Attaque de l'outsider, défense du favori
    const og = perMatch(o.scored, o);
    if (og !== null) add('⚽', `${on} marque ${f1(og)} but(s) par match`, og >= 1.3 ? 'pour' : og <= 0.8 ? 'contre' : 'info');
    const fc = perMatch(f.conceded, f);
    if (fc !== null) add('🧤', `${fn} encaisse ${f1(fc)} but(s) par match`, fc >= 1.2 ? 'pour' : fc <= 0.6 ? 'contre' : 'info');
    // xG : joue-t-il mieux que ses résultats ?
    if (isNum(o.xgFor) && isNum(o.xgAgainst)) {
      const xgDiff = o.xgFor - o.xgAgainst;
      const real = og !== null && perMatch(o.conceded, o) !== null ? og - (perMatch(o.conceded, o) as number) : null;
      const gap = real === null ? null : xgDiff - real;
      add('🎯', `xG de ${on} : ${f1(o.xgFor)} pour, ${f1(o.xgAgainst)} contre par match${gap !== null && gap >= 0.25 ? ' : joue mieux que ses résultats' : gap !== null && gap <= -0.25 ? ' : résultats meilleurs que son jeu' : ''}`, gap === null ? 'info' : gap >= 0.25 ? 'pour' : gap <= -0.25 ? 'contre' : 'info');
    }
    // Buteurs
    const top = [...o.scorers].sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))[0];
    if (top) {
      if (top.available === false) add('🚑', `Meilleur buteur de ${on} absent : ${top.name} (${top.goals ?? '?'} buts)`, 'contre');
      else add('🥅', `Meilleur buteur de ${on} : ${top.name}, ${top.goals ?? '?'} buts${top.available ? ', il joue' : ''}`, (top.goals ?? 0) >= 5 && top.available !== null ? 'pour' : 'info');
    }
    const ftop = [...f.scorers].sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))[0];
    if (ftop && ftop.available === false) add('🚑', `Meilleur buteur de ${fn} absent : ${ftop.name} (${ftop.goals ?? '?'} buts)`, 'pour');
    // Absents
    const fk = f.absents.filter((a) => a.key !== false);
    if (fk.length) add('🚑', `${fk.length} absent(s) chez ${fn} : ${fk.map((a) => a.name).join(', ')}`, 'pour');
    const ok = o.absents.filter((a) => a.key === true);
    if (ok.length >= 2) add('🚑', `${ok.length} titulaires absents chez ${on} : ${ok.map((a) => a.name).join(', ')}`, 'contre');
    else if (ok.length === 1) add('🚑', `Absent chez ${on} : ${ok[0].name}`, 'info');
    // Fatigue
    if (f.europe === true) add('😴', `${fn} a joué la Coupe d'Europe cette semaine (rotation possible)`, 'pour');
    if (isNum(o.restDays) && isNum(f.restDays)) {
      const d = o.restDays - f.restDays;
      add('🛌', `Repos : ${on} ${o.restDays} jour(s), ${fn} ${f.restDays} jour(s)`, d >= 2 ? 'pour' : d <= -2 ? 'contre' : 'info');
    }
    // Enjeu
    if (has(o.goal, 'maintien', 'releg', 'surv') || (isNum(o.zoneGap) && o.zoneGap <= 3)) {
      add('🔥', `${on} joue sa survie${isNum(o.zoneGap) ? ` (${o.zoneGap >= 0 ? '+' : ''}${o.zoneGap} pt(s) sur la zone rouge)` : ''}`, 'pour');
    } else if (o.goal) add('🎯', `Objectif de ${on} : ${o.goal}`, 'info');
    if (has(f.goal, 'titre', 'champion')) add('🏆', `${fn} joue le titre : très motivé`, 'contre');
    else if (has(f.goal, 'milieu', 'rien', 'aucun', 'sans')) add('😐', `${fn} n'a plus grand-chose à jouer (${f.goal})`, 'pour');
    else if (f.goal) add('🎯', `Objectif de ${fn} : ${f.goal}`, 'info');
    // Entraîneur
    if (o.newCoach) add('🆕', `Nouvel entraîneur chez ${on}${o.coach ? ` (${o.coach})` : ''} : souvent un regain`, 'pour');
    if (f.newCoach) add('🆕', `Nouvel entraîneur chez ${fn}${f.coach ? ` (${f.coach})` : ''} : souvent un regain`, 'contre');
    // Classement et Elo
    if (isNum(o.rank) && isNum(f.rank)) add('📊', `Classement : ${on} ${o.rank}e, ${fn} ${f.rank}e`, 'info');
    if (isNum(o.elo) && isNum(f.elo)) add('📐', `Elo : ${on} ${Math.round(o.elo)}, ${fn} ${Math.round(f.elo)} (écart ${Math.round(Math.abs(f.elo - o.elo))})`, f.elo - o.elo <= 100 ? 'pour' : 'info');
  } else {
    // Ancien format simple
    if (p.signals.xg) add('🎯', p.signals.xg, 'info');
    if (p.signals.absentsFav.length) add('🚑', `Absents chez le favori : ${p.signals.absentsFav.join(', ')}`, 'pour');
    if (p.signals.fatigueFav === true) add('😴', 'Le favori est fatigué ou fait tourner', 'pour');
    if (p.signals.motivation) add('🔥', p.signals.motivation, 'info');
  }

  const c = p.ctx;
  if (c?.link) add('⚔️', `Lien entre les équipes : ${c.link}`, has(c.link, 'derby', 'rival') ? 'pour' : 'info');
  if (p.signals.oddsMove === 'baisse') add('📉', `La cote de l'outsider baisse${c?.oddsMoveDetail ? ` (${c.oddsMoveDetail})` : ''} : des parieurs bien informés misent dessus`, 'pour');
  if (p.signals.oddsMove === 'hausse') add('📈', `La cote de l'outsider monte${c?.oddsMoveDetail ? ` (${c.oddsMoveDetail})` : ''} : le marché y croit moins`, 'contre');
  return sig;
}

export function countSignals(list: Signal[]) {
  return { pour: list.filter((s) => s.side === 'pour').length, contre: list.filter((s) => s.side === 'contre').length };
}
