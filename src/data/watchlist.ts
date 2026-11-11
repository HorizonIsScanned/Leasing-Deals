// Beobachtete Modelle, ihre Seiten bei LeasingMarkt, Erkennung in mydealz-Titeln und die Zielwerte.
// Zielwerte = Effektivrate inkl. Überführung/Zulassung/Anzahlung, umgelegt auf die Laufzeit:
// Privat brutto, Gewerbe netto. Darunter ist ein Angebot „Top“ und wird sofort gemeldet.

import type { ModellId } from '../lib/core/types';

export interface Modell {
  id: ModellId;
  name: string;
  /** Zielwerte in €/Monat (Privat brutto, Gewerbe netto) */
  ziel: { privat: number; gewerbe: number };
  /** Gehört ein Angebot von dieser Seite bzw. mit diesem Titel zum Modell? */
  passt: (titel: string, ps: number | null) => boolean;
}

const hat = (re: RegExp) => (t: string) => re.test(t);

export const MODELLE: Modell[] = [
  { id: 'golf-gti', name: 'VW Golf GTI', ziel: { privat: 260, gewerbe: 200 }, passt: hat(/\bgti\b/i) },
  {
    id: 'cupra-leon',
    name: 'Cupra Leon',
    ziel: { privat: 200, gewerbe: 160 },
    passt: (t, ps) => /\bleon\b/i.test(t) && !istVz(t, ps),
  },
  {
    id: 'cupra-leon-vz',
    name: 'Cupra Leon VZ',
    ziel: { privat: 300, gewerbe: 250 },
    passt: (t, ps) => /\bleon\b/i.test(t) && istVz(t, ps),
  },
  { id: 'bmw-1er', name: 'BMW 1er', ziel: { privat: 260, gewerbe: 220 }, passt: (t) => !/m\s?135/i.test(t) },
  { id: 'bmw-m135i', name: 'BMW M135i', ziel: { privat: 450, gewerbe: 380 }, passt: hat(/m\s?135/i) },
  { id: 'audi-a3', name: 'Audi A3', ziel: { privat: 230, gewerbe: 190 }, passt: (t) => !/\b(r?s3)\b/i.test(t) },
  { id: 'audi-s3', name: 'Audi S3', ziel: { privat: 420, gewerbe: 350 }, passt: hat(/\bs3\b/i) },
];

/** VZ: ab 250 PS oder ausdrücklich „VZ“ (e-Hybrid VZ hat 272 PS) */
function istVz(t: string, ps: number | null) {
  if (ps != null) return ps >= 250;
  return /\bvz\b/i.test(t);
}

export const modell = (id: ModellId) => MODELLE.find((m) => m.id === id)!;

/** Als was geleast wird: „privat“ (Zielwerte brutto, reine Gewerbe-Angebote werden nie gemeldet) oder „gewerbe“ */
export const KUNDENGRUPPE: 'privat' | 'gewerbe' = 'privat';

/** Gesamtkostenfaktor, ab dem ein Angebot unabhängig vom Zielwert „Top“ ist (sehr viel Auto fürs Geld) */
export const GKF_TOP = 0.4;
/** „Gut“: bis 10 % über dem Zielwert */
export const GUT_SPIELRAUM = 1.1;
/** Annahme für unbekannte Einmalkosten (Überführung + Zulassung, brutto), nur für die Vorauswahl */
export const EINMAL_ANNAHME = 1300;
/** Bevorzugte Vertragsdaten, wenn ein Angebot mehrere Varianten hat */
export const MIN_KM = 10_000;
export const MAX_LAUFZEIT = 48;

/** Seiten bei LeasingMarkt je Modellgruppe (geprüft am 05.11.2026) */
export const LM_SEITEN: { pfad: string; modelle: ModellId[] }[] = [
  { pfad: '/leasing-vw-golf-gti', modelle: ['golf-gti'] },
  { pfad: '/leasing-cupra-leon', modelle: ['cupra-leon', 'cupra-leon-vz'] },
  { pfad: '/leasing-bmw-1er', modelle: ['bmw-1er', 'bmw-m135i'] },
  { pfad: '/leasing-BMW-m135i', modelle: ['bmw-m135i'] },
  { pfad: '/leasing-audi-a3', modelle: ['audi-a3'] },
  { pfad: '/leasing-audi-s3', modelle: ['audi-s3'] },
];

/** Modell aus einem mydealz-Titel erkennen (Marke + Modell müssen beide vorkommen) */
export function modellAusTitel(titel: string, ps: number | null): ModellId | null {
  const t = titel;
  if (/\bgolf\b/i.test(t) && /\bgti\b/i.test(t)) return 'golf-gti';
  if (/cupra/i.test(t) && /\bleon\b/i.test(t)) return istVz(t, ps) ? 'cupra-leon-vz' : 'cupra-leon';
  if (/\bbmw\b/i.test(t)) {
    if (/\bm\s?135i?\b/i.test(t)) return 'bmw-m135i';
    if (/\b(1er|11[68][id]?|12[03][id]?)\b/i.test(t)) return 'bmw-1er';
  }
  if (/\baudi\b/i.test(t)) {
    if (/\bs3\b/i.test(t)) return 'audi-s3';
    if (/\ba3\b/i.test(t)) return 'audi-a3';
  }
  return null;
}
