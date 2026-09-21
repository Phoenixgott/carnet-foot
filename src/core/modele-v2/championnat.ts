/**
 * Chiffres d'un championnat tirés des historiques CSV (football-data.co.uk) :
 * avantage du terrain, moyenne de buts, part des buts en 1re mi-temps.
 * Sans historique, des valeurs par défaut prudentes sont utilisées et signalées.
 */
import type { Resultat } from "../types";

/** Rapport buts à domicile / buts à l'extérieur, moyenne des grands championnats européens. */
export const AVANTAGE_TERRAIN_DEFAUT = 1.25;
/** En dessous de ce nombre de matchs, une saison ne suffit pas : on regroupe les saisons disponibles. */
export const MATCHS_MIN_SAISON = 30;

export interface StatsChampionnat {
  championnat: string;
  /** Saison utilisée (« 2025-2026 »), ou plusieurs (« 2023-2024 à 2025-2026 »). */
  saisons: string;
  nb: number;
  /** Buts par match (total). */
  moyenneButs: number;
  butsDomicile: number;
  butsExterieur: number;
  /** Buts domicile / buts extérieur. */
  avantageTerrain: number;
  /** Part des buts marqués en 1re mi-temps (null si les mi-temps manquent). */
  partPremiereMiTemps: number | null;
}

const normaliser = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * Chiffres du championnat demandé (nom de la compétition du match : « Ligue 1 », « LaLiga »…).
 * Saison la plus récente avec assez de matchs ; sinon toutes les saisons disponibles.
 */
export function statsChampionnat(resultats: readonly Resultat[], championnat: string | null | undefined): StatsChampionnat | null {
  if (!championnat) return null;
  const cle = normaliser(championnat);
  const rs = resultats.filter((r) => normaliser(r.championnat) === cle);
  if (!rs.length) return null;
  const saisons = [...new Set(rs.map((r) => r.saison))].sort().reverse();
  const recente = saisons.find((s) => rs.filter((r) => r.saison === s).length >= MATCHS_MIN_SAISON);
  const choisis = recente ? rs.filter((r) => r.saison === recente) : rs;
  const nb = choisis.length;
  const bd = choisis.reduce((s, r) => s + r.butsDomicile, 0);
  const be = choisis.reduce((s, r) => s + r.butsExterieur, 0);
  const avecMt = choisis.filter((r) => r.butsMiTempsDomicile !== null && r.butsMiTempsExterieur !== null);
  const butsMt = avecMt.reduce((s, r) => s + (r.butsMiTempsDomicile ?? 0) + (r.butsMiTempsExterieur ?? 0), 0);
  const butsAvecMt = avecMt.reduce((s, r) => s + r.butsDomicile + r.butsExterieur, 0);
  const liste = recente ? recente : saisons.length > 1 ? `${saisons[saisons.length - 1]} à ${saisons[0]}` : saisons[0];
  return {
    championnat: choisis[0].championnat,
    saisons: liste,
    nb,
    moyenneButs: (bd + be) / nb,
    butsDomicile: bd / nb,
    butsExterieur: be / nb,
    avantageTerrain: be > 0 ? bd / be : AVANTAGE_TERRAIN_DEFAUT,
    partPremiereMiTemps: avecMt.length >= 20 && butsAvecMt > 0 ? butsMt / butsAvecMt : null,
  };
}
