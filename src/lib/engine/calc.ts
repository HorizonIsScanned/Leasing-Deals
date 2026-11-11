// Bewertung eines Angebots: Effektivrate (inkl. Einmalkosten auf die Laufzeit umgelegt), Gesamtkostenfaktor und
// Vergleich mit dem Zielwert der passenden Kundengruppe (Privat brutto, Gewerbe netto).

import { EINMAL_ANNAHME, GKF_TOP, GUT_SPIELRAUM, KUNDENGRUPPE, modell } from '../../data/watchlist';
import type { Angebot, Bewertung } from '../core/types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const MWST = 1.19;

export function effektiv(a: Angebot): { brutto: number | null; netto: number | null; geschaetzt: boolean } {
  // 1. Effektivrate, die die Quelle selbst nennt (mydealz: Titel oder Gesamtbetrag / Laufzeit)
  if (a.effektivQuelle != null) {
    const brutto = a.effektivQuelleNetto ? a.effektivQuelle * MWST : a.effektivQuelle;
    return { brutto: r2(brutto), netto: r2(brutto / MWST), geschaetzt: false };
  }
  if (a.rateBrutto == null || !a.laufzeit) return { brutto: null, netto: null, geschaetzt: false };
  // 2. Rate + Einmalkosten / Laufzeit; fehlen die Einmalkosten, mit vorsichtiger Annahme
  const geschaetzt = a.einmalBrutto == null;
  const einmal = a.einmalBrutto ?? EINMAL_ANNAHME;
  const brutto = a.rateBrutto + einmal / a.laufzeit;
  const netto = (a.rateNetto ?? a.rateBrutto / MWST) + einmal / MWST / a.laufzeit;
  return { brutto: r2(brutto), netto: r2(netto), geschaetzt };
}

export function bewerte(a: Angebot): Bewertung {
  const eff = effektiv(a);
  // Bei Gebrauchten bezieht sich der Listenpreis auf den Neuwagen – der Faktor wäre geschönt, daher keiner
  const gkf = eff.brutto != null && a.listenpreis && a.zustand !== 'gebraucht' ? r2((eff.brutto / a.listenpreis) * 100) : null;
  const m = modell(a.modell);
  if (eff.brutto == null || eff.netto == null) {
    return { effBrutto: null, effNetto: null, gkf: null, geschaetzt: eff.geschaetzt, ziel: null, stufe: 'normal', grund: 'Rate oder Laufzeit unbekannt' };
  }
  // Bewertet wird immer aus Sicht der eigenen Kundengruppe (KUNDENGRUPPE): privat = brutto, gewerbe = netto
  const privat = { gruppe: 'privat' as const, wert: m.ziel.privat, ist: eff.brutto, basis: 'brutto' as const };
  const gewerbe = { gruppe: 'gewerbe' as const, wert: m.ziel.gewerbe, ist: eff.netto, basis: 'netto' as const };
  const ziel = KUNDENGRUPPE === 'privat' ? privat : gewerbe;
  const fremd = KUNDENGRUPPE === 'privat' ? a.kunden === 'gewerbe' : a.kunden === 'privat';
  const quote = ziel.ist / ziel.wert;
  let stufe: Bewertung['stufe'] = 'normal';
  let grund = `${ziel.ist.toFixed(0)} € ${ziel.basis} effektiv, Ziel ${ziel.gruppe} ${ziel.wert} €`;
  if (quote <= 1) stufe = 'top';
  else if (gkf != null && gkf <= GKF_TOP) {
    stufe = 'top';
    grund = `Gesamtkostenfaktor ${gkf.toFixed(2)} (≤ ${GKF_TOP}) – ${grund}`;
  } else if (quote <= GUT_SPIELRAUM) stufe = 'gut';
  // Angebot nur für die andere Kundengruppe: nie melden
  if (fremd && stufe !== 'normal') {
    stufe = 'normal';
    grund += ` (nur ${a.kunden === 'gewerbe' ? 'Gewerbe' : 'Privat'})`;
  }
  // Gegenprüfung mit der Angebotsseite fehlgeschlagen: höchstens „gut“
  if (a.pruefung && !a.pruefung.ok && a.pruefung.rate === a.rateBrutto && stufe === 'top') {
    stufe = 'gut';
    grund += ` (Prüfung: ${a.pruefung.hinweis})`;
  }
  // Geschätzte Einmalkosten: höchstens „gut“, bis die Angebotsseite gelesen ist
  if (eff.geschaetzt && stufe === 'top') {
    stufe = 'gut';
    grund += ' (Überführung geschätzt)';
  }
  // Nur für bestimmte Gruppen (Fahrschulen, Behörden …): höchstens „gut“, nicht melden
  if (stufe === 'top' && a.bedingungen.includes('Nur für bestimmte Gruppen')) {
    stufe = 'gut';
    grund += ' (nur für bestimmte Gruppen)';
  }
  return { effBrutto: eff.brutto, effNetto: eff.netto, gkf, geschaetzt: eff.geschaetzt, ziel, stufe, grund };
}

/** Vorauswahl ohne Angebotsseite: lohnt es sich, die Einmalkosten nachzulesen? */
export function lohntDetail(a: Angebot): boolean {
  const b = bewerte(a);
  if (!b.ziel) return false;
  return b.ziel.ist / b.ziel.wert <= 1.2 || (b.gkf != null && b.gkf <= GKF_TOP + 0.05);
}
