// Änderungsverfolgung zwischen zwei Läufen: neu, Preis geändert, Status geändert.

import type { Angebot, Deal } from '../core/types';
import { bewerte } from './calc';

const wert = (d: Pick<Deal, 'bewertung'>) => d.bewertung.ziel?.ist ?? null;

export function fuehreZusammen(alt: Deal | undefined, neu: Angebot, jetzt: string): Deal {
  const bewertung = bewerte(neu);
  if (!alt) {
    return { ...neu, bewertung, erstGesehen: jetzt, zuletztGesehen: jetzt, gemeldet: null, gemeldetWert: null, verlauf: [{ datum: jetzt, feld: 'neu', neu: fmt(bewertung.ziel?.ist) }] };
  }
  const verlauf = [...alt.verlauf];
  const vorher = wert(alt);
  const jetztWert = bewertung.ziel?.ist ?? null;
  if (vorher != null && jetztWert != null && Math.abs(vorher - jetztWert) >= 1) verlauf.push({ datum: jetzt, feld: 'preis', alt: fmt(vorher), neu: fmt(jetztWert) });
  if (alt.status !== neu.status) verlauf.push({ datum: jetzt, feld: 'status', alt: alt.status, neu: neu.status });
  return {
    ...neu,
    // Werte, die nur die Angebots-/Deal-Seite liefert, nicht durch „unbekannt“ überschreiben
    einmalBrutto: neu.einmalBrutto ?? alt.einmalBrutto,
    haendler: neu.haendler ?? alt.haendler,
    temperatur: neu.temperatur ?? alt.temperatur,
    listenpreis: neu.listenpreis ?? alt.listenpreis,
    bewertung: neu.einmalBrutto == null && alt.einmalBrutto != null ? bewerte({ ...neu, einmalBrutto: alt.einmalBrutto }) : bewertung,
    erstGesehen: alt.erstGesehen,
    zuletztGesehen: jetzt,
    gemeldet: alt.gemeldet,
    gemeldetWert: alt.gemeldetWert,
    verlauf: verlauf.slice(-30),
  };
}

/** Status setzen, ohne das Angebot neu zu lesen (abgelaufen/weg) */
export function setzeStatus(d: Deal, status: Deal['status'], jetzt: string): Deal {
  if (d.status === status) return d;
  return { ...d, status, verlauf: [...d.verlauf, { datum: jetzt, feld: 'status' as const, alt: d.status, neu: status }].slice(-30) };
}

/** Alte Einträge entfernen: nicht mehr aktiv seit 14 Tagen oder 45 Tage nicht gesehen */
export function aufraeumen(alle: Deal[], jetzt: string): Deal[] {
  const t = Date.parse(jetzt);
  return alle.filter((d) => {
    const gesehen = Date.parse(d.zuletztGesehen);
    if (d.status !== 'aktiv') return t - gesehen < 14 * 86_400_000;
    return t - gesehen < 45 * 86_400_000;
  });
}

function fmt(n: number | null | undefined) {
  return n == null ? '–' : `${n.toFixed(2)} €`;
}
