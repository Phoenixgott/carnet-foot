/**
 * Critères des méthodes +1.5 et +2.5 du carnet d'origine, repris à l'identique
 * (seuils, textes et verdicts). Les seuils deviendront réglables en phase 3.
 */
import { estNombre, fr } from "../format";
import type { Equipe, Match } from "../types";
import { moyennes } from "./modele";

/** Verdict : ok = « On joue », mid = « À revoir », ko = « On passe ». */
export type Verdict = "ok" | "mid" | "ko";

/**
 * État d'un critère : true (validé), false (bloquant), null (donnée inconnue),
 * "soft" (point d'attention) ou "plus" (bonus).
 */
export type EtatCritere = true | false | null | "soft" | "plus";

export interface Critere {
  ok: EtatCritere;
  /** Texte court du critère. */
  t: string;
  /** Détail chiffré, quand il existe. */
  d?: string;
}

export interface Evaluation {
  c: Critere[];
  v: Verdict;
  /** Explication du verdict en une phrase. */
  why: string;
}

export const CONTEXTES: Readonly<Record<string, string>> = {
  normal: "Match classique",
  finale: "Finale",
  derby: "Derby",
  maintien: "Lutte pour le maintien",
  montee: "Course à la montée",
  sans_enjeu: "Match sans enjeu",
  retour_coupe_retard: "Match retour, une équipe doit remonter",
};

const minusculeInitiale = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Méthode +1.5 (le `evalM1` du carnet). */
export function evaluerPlus15(m: Match): Evaluation {
  const h: Equipe = m.domicile || {};
  const a: Equipe = m.exterieur || {};
  const H = moyennes(h);
  const A = moyennes(a);
  const c: Critere[] = [];
  const surDix = m.selection ? " Sur leurs 10 derniers matchs." : "";

  if ([H.s, H.c, A.s, A.c].some((v) => !Number.isFinite(v))) {
    c.push({ ok: null, t: "Buts marqués et encaissés inconnus" });
  } else {
    const f: string[] = [];
    if (H.s <= 1) f.push(`${h.nom} marque peu`);
    if (H.c <= 1) f.push(`${h.nom} encaisse peu`);
    if (A.s <= 1) f.push(`${a.nom} marque peu`);
    if (A.c <= 1) f.push(`${a.nom} encaisse peu`);
    c.push({
      ok: !f.length,
      t: f.length ? f.join(", ") : "Les deux équipes marquent et encaissent plus d'1 but par match",
      d: `${h.nom} : ${fr(H.s, 1)} marqué(s) et ${fr(H.c, 1)} encaissé(s) par match. ${a.nom} : ${fr(A.s, 1)} et ${fr(A.c, 1)}.${surDix}`,
    });
  }

  if (!estNombre(h.pctOver15) || !estNombre(a.pctOver15)) {
    c.push({ ok: null, t: "% de matchs à 2 buts ou plus inconnu" });
  } else {
    const ok = h.pctOver15 >= 70 && a.pctOver15 >= 70;
    c.push({
      ok,
      t: ok ? "Leurs matchs ont presque toujours 2 buts ou plus" : "Trop de matchs à 0 ou 1 but",
      d: `${h.nom} : ${h.pctOver15} % de matchs à 2 buts ou plus. ${a.nom} : ${a.pctOver15} %. Minimum : 70 %.${surDix}`,
    });
  }

  c.push({
    ok: m.absenceOffensive ? "soft" : true,
    t: m.absenceOffensive ? "Un attaquant important est absent" : "Les buteurs jouent",
  });

  const cx = m.contexte || "normal";
  const ok4 = cx === "normal" || cx === "retour_coupe_retard";
  c.push({ ok: ok4, t: ok4 ? "Pas de pression particulière" : CONTEXTES[cx] + " : match imprévisible" });

  const echecs = c.filter((x) => x.ok === false).length;
  const soft = c.some((x) => x.ok === "soft");
  const inconnu = c.some((x) => x.ok === null);
  const v: Verdict = echecs ? "ko" : soft || inconnu ? "mid" : "ok";
  const premierEchec = c.find((x) => x.ok === false);
  const why =
    v === "ok"
      ? "Oui : attends 0-0 vers la 15ᵉ minute, puis entre en live."
      : v === "ko"
        ? "Non : " + minusculeInitiale(premierEchec!.t) + "."
        : soft
          ? "À vérifier : un attaquant important manque."
          : "À vérifier : il manque des infos.";
  return { c, v, why };
}

/** Méthode +2.5 (le `evalM3` du carnet). */
export function evaluerPlus25(m: Match): Evaluation {
  const h: Equipe = m.domicile || {};
  const a: Equipe = m.exterieur || {};
  const c: Critere[] = [];
  let bloquant = false;
  let score = 0;
  let inconnus = 0;

  const lg = m.moyenneButsLigue;
  if (!estNombre(lg)) {
    inconnus++;
    c.push({ ok: null, t: "Moyenne de buts de la compétition inconnue" });
  } else {
    const ok = lg > 2.7;
    if (ok) score++;
    c.push({
      ok,
      t: ok ? "Compétition où ça marque beaucoup" : "Compétition où ça marque peu",
      d: `${m.ligue || "Compétition"} : ${fr(lg)} buts par match en moyenne. Minimum : 2,7.`,
    });
  }

  for (const t of [h, a]) {
    const l = (t.derniersButsMarques || []).filter(estNombre).slice(0, 4);
    const S = moyennes(t).s;
    if (!l.length || !Number.isFinite(S)) {
      inconnus++;
      c.push({ ok: null, t: `Forme de ${t.nom || "?"} inconnue` });
      continue;
    }
    const formeActuelle = l.reduce((s, x) => s + x, 0) / l.length;
    const ok = formeActuelle >= 0.7 * S;
    if (ok) score++;
    else bloquant = true;
    c.push({
      ok,
      t: ok ? `${t.nom} marque bien en ce moment` : `${t.nom} ne marque plus`,
      d: `Buts sur ses derniers matchs : ${l.join(", ")}. D'habitude : ${fr(S, 1)} par match.`,
    });
  }

  const hh = m.h2h;
  if (hh && estNombre(hh.joues) && hh.joues >= 3 && estNombre(hh.over25)) {
    const r = hh.over25 / hh.joues;
    if (r >= 0.6) {
      score++;
      c.push({ ok: true, t: "Leurs matchs entre eux donnent souvent 3 buts ou plus", d: `${hh.over25} fois sur ${hh.joues}.` });
    } else if (r < 0.4) {
      bloquant = true;
      c.push({
        ok: false,
        t: "Leurs matchs entre eux sont souvent fermés",
        d: `Seulement ${hh.over25} fois sur ${hh.joues} à 3 buts ou plus.`,
      });
    } else {
      c.push({ ok: "soft", t: "Leurs matchs entre eux : résultats moyens", d: `${hh.over25} fois sur ${hh.joues} à 3 buts ou plus.` });
    }
  } else {
    inconnus++;
    c.push({ ok: null, t: "Pas assez de matchs entre eux pour juger" });
  }

  if (m.meilleurButeurAbsent) {
    bloquant = true;
    c.push({ ok: false, t: "Le meilleur buteur est absent" });
  } else {
    c.push({ ok: true, t: "Le meilleur buteur joue" });
  }
  if (m.defenseAffaiblie) {
    score++;
    c.push({ ok: "plus", t: "Bonus : gardien ou défenseurs absents" });
  }
  if (m.contexte === "retour_coupe_retard") {
    score++;
    c.push({ ok: "plus", t: "Bonus : une équipe doit attaquer pour remonter" });
  }

  const v: Verdict = bloquant ? "ko" : score >= 4 ? "ok" : score + inconnus >= 4 || score >= 3 ? "mid" : "ko";
  const f = c.find((x) => x.ok === false);
  const why =
    v === "ok"
      ? "Oui : vérifie les compositions 1 h avant, puis la cote."
      : v === "ko"
        ? "Non : " + (f ? minusculeInitiale(f.t) : "pas assez de signaux favorables") + "."
        : inconnus
          ? "À vérifier : il manque des infos."
          : "À vérifier : bons signaux, mais pas tous.";
  return { c, v, why };
}
