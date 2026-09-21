/**
 * Fichier d'agenda (.ics, RFC 5545) pour la date limite d'une offre de freebet.
 *
 * Le téléphone (Google Agenda, Samsung Calendar…) rappelle l'événement même quand l'application
 * est fermée, ce qu'une notification de l'application ne peut pas faire sans serveur.
 * Événement sur la journée de la date limite, avec deux alarmes : la veille à 9 h
 * et 3 jours avant à 9 h (une alarme d'un événement « toute la journée » se compte
 * depuis minuit de ce jour).
 */
import type { OffreFreebet } from "./offres";
import { fr } from "./format";

/** Échappement d'un texte pour un fichier .ics (virgule, point-virgule, barre oblique inverse, retours à la ligne). */
export function echapperIcs(t: string): string {
  return t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Coupe une ligne à 75 octets, comme l'exige la norme (suite : retour à la ligne + espace). */
export function plierLigne(ligne: string): string {
  const enc = new TextEncoder();
  if (enc.encode(ligne).length <= 75) return ligne;
  const morceaux: string[] = [];
  let courant = "";
  let octets = 0;
  let limite = 75;
  for (const c of ligne) {
    const n = enc.encode(c).length;
    if (octets + n > limite) {
      morceaux.push(courant);
      courant = "";
      octets = 0;
      limite = 74; // la ligne de suite commence par une espace
    }
    courant += c;
    octets += n;
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

const compact = (dateIso: string) => dateIso.replace(/-/g, "");

/** Jour suivant AAAA-MM-JJ (fin exclusive d'un événement sur une journée). */
export function jourSuivant(dateIso: string): string {
  const d = new Date(dateIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Horodatage UTC compact : 20260921T153000Z. */
function horodatage(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Contenu du fichier .ics ; null si l'offre n'a pas de date limite. */
export function evenementAgenda(o: OffreFreebet, maintenant: Date): string | null {
  if (!o.dateLimite) return null;
  const nom = [o.bookmaker, o.titre].filter(Boolean).join(" : ");
  const details = [
    o.montant !== null ? `Freebet : ${fr(o.montant, 2)} €` : null,
    o.coteMin !== null ? `Cote minimale : ${fr(o.coteMin)}` : null,
    o.conditions ? `Conditions : ${o.conditions}` : null,
    "Dernier jour pour utiliser le freebet. Ouvre le Carnet de Paris Foot, onglet Freebet.",
  ].filter(Boolean);
  const alarme = (declencheur: string, texte: string) => [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${echapperIcs(texte)}`,
    `TRIGGER:${declencheur}`,
    "END:VALARM",
  ];
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Carnet de Paris Foot//Freebet//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:freebet-${o.id}@carnet-paris-foot`,
    `DTSTAMP:${horodatage(maintenant)}`,
    `DTSTART;VALUE=DATE:${compact(o.dateLimite)}`,
    `DTEND;VALUE=DATE:${compact(jourSuivant(o.dateLimite))}`,
    `SUMMARY:${echapperIcs("Freebet à utiliser : " + nom)}`,
    `DESCRIPTION:${echapperIcs(details.join("\n"))}`,
    "TRANSP:TRANSPARENT",
    ...alarme("-PT15H", "Dernier jour demain pour utiliser ton freebet " + nom),
    ...alarme("-P2DT15H", "Il reste 3 jours pour utiliser ton freebet " + nom),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lignes.map(plierLigne).join("\r\n") + "\r\n";
}

/** Nom de fichier sûr : freebet-unibet-2026-09-25.ics */
export function nomFichierAgenda(o: OffreFreebet): string {
  const base = o.bookmaker
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `freebet-${base || "offre"}-${o.dateLimite ?? "sans-date"}.ics`;
}
