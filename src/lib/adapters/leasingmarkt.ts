// LeasingMarkt.de: Die Modellseiten (z. B. /leasing-cupra-leon) liefern alle Angebote einer Seite als JSON im
// Seitenquelltext (Next.js-Datenblöcke „self.__next_f.push“), Feld „initialResult“. Die Angebotsseite
// (/leasing/pkw/<modell>/<id>) enthält zusätzlich Überführung, Zulassung und Anzahlung (Beträge brutto).
// Parameter (geprüft am 05.11.2026): sort=rate (Rate aufsteigend) | new (neueste) | popularity, p=<Seite>.
// Nur Seiten, die robots.txt erlaubt; /xhr/ und /lmrpc/ werden nicht genutzt.

import { EINMAL_ANNAHME, LM_SEITEN, MAX_LAUFZEIT, MIN_KM, MODELLE } from '../../data/watchlist';
import type { Http } from '../core/http';
import type { Angebot, Kunden, ModellId, Zustand } from '../core/types';

export const LM_BASIS = 'https://www.leasingmarkt.de';

export interface LmOffer {
  id: number;
  duration: number;
  includedMileage: number;
  monthlyRate: number;
  monthlyNetRate: number;
  leasingFactor: number;
  leaseTotalAmount?: number;
}

export interface LmListing {
  id: number;
  targetGroup: string;
  contractType?: string;
  isDeal?: boolean;
  isOnline?: boolean;
  dealPublishedAt?: string | null;
  brandModelName?: string;
  brandModelTitle?: string;
  headline?: string;
  grossListPriceInEUR?: number | null;
  engine?: { power?: { hp?: number } } | null;
  availability?: string | null;
  condition?: { carType?: string; isNewCar?: boolean } | null;
  url?: string;
  leasingOffer: LmOffer;
  offers?: LmOffer[];
  specialConditions?: unknown[];
  isInStock?: boolean;
}

export interface LmErgebnis {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  listings: LmListing[];
}

export interface LmDetail {
  transferCosts: number | null;
  registrationCosts: number | null;
  downpayment: number | null;
  offers: LmOffer[];
  bank: string | null;
}

/** Inhalt aller Next.js-Datenblöcke einer Seite als ein Text */
export function nextDaten(html: string): string {
  const teile: string[] = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      teile.push(JSON.parse(`"${m[1]}"`) as string);
    } catch {
      /* Block überspringen */
    }
  }
  return teile.join('');
}

/** JSON-Objekt ab dem Schlüssel `"name":` lesen (Klammern zählen, Zeichenketten beachten) */
export function objektNach(text: string, name: string, abIndex = 0): unknown | null {
  const k = text.indexOf(`"${name}":`, abIndex);
  if (k < 0) return null;
  let i = k + name.length + 3;
  while (text[i] === ' ') i++;
  const start = i;
  const auf = text[i];
  const zu = auf === '{' ? '}' : auf === '[' ? ']' : null;
  if (!zu) return null;
  let tiefe = 0;
  let inStr = false;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === auf) tiefe++;
    else if (c === zu && --tiefe === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function leseListe(html: string): LmErgebnis | null {
  const r = objektNach(nextDaten(html), 'initialResult') as LmErgebnis | null;
  return r && Array.isArray(r.listings) ? r : null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

export function leseDetail(html: string): LmDetail | null {
  const d = nextDaten(html);
  const k = d.indexOf('"transferCosts"');
  if (k < 0) return null;
  const wert = (name: string, ganz = false) => {
    const m = (ganz ? d : d.slice(Math.max(0, k - 4000), k + 4000)).match(new RegExp(`"${name}":("(?:[^"\\\\]|\\\\.)*"|-?[\\d.]+|null|\\{\\}|true|false)`));
    if (!m) return null;
    try {
      return num(JSON.parse(m[1]));
    } catch {
      return null;
    }
  };
  // „offers“ des Angebots steht im selben Objekt wie transferCosts, kurz davor
  const vorher = d.lastIndexOf('"offers":', k);
  const offers = (vorher >= 0 ? (objektNach(d, 'offers', vorher) as LmOffer[] | null) : null) ?? [];
  const bank = d.slice(k, k + 3000).match(/"bank":"((?:[^"\\]|\\.)*)"/);
  return {
    transferCosts: wert('transferCosts'),
    registrationCosts: wert('registrationCosts'),
    // steht weiter vorn beim Fahrzeug, nicht beim Leasing-Objekt
    downpayment: wert('downpayment', true),
    offers: Array.isArray(offers) ? offers : [],
    bank: bank ? bank[1] : null,
  };
}

const kundenAus = (tg: string): Kunden => (/nur gewerbe/i.test(tg) ? 'gewerbe' : /nur privat/i.test(tg) ? 'privat' : 'beide');

function zustandAus(l: LmListing): Zustand {
  const t = `${l.condition?.carType ?? ''} ${l.contractType ?? ''}`;
  if (/vorlauf|vorführ|tageszul/i.test(t)) return 'vorlauf';
  if (/gebraucht|used|jahreswagen/i.test(t) || l.condition?.isNewCar === false) return 'gebraucht';
  if (/neu|new/i.test(t) || l.condition?.isNewCar) return 'neu';
  return 'unbekannt';
}

function bedingungenAus(text: string): string[] {
  const b: string[] = [];
  const t = text.toLowerCase();
  if (/loyal|bestandskund|treue/.test(t)) b.push('Loyalität (eigenes Fahrzeug der Marke nötig)');
  if (/eroberung|fremdfabrikat|wechsel/.test(t)) b.push('Eroberung (Fremdfabrikat nötig)');
  if (/werksabholung/.test(t)) b.push('Werksabholung');
  if (/bestellaktion|bestellfahrzeug|vorbestell/.test(t)) b.push('Bestellfahrzeug');
  if (/kasko|versicherung/.test(t)) b.push('inkl. Versicherung');
  if (/kleingewerbe/.test(t)) b.push('Kleingewerbe reicht');
  if (/schwerbehindert|azubi|student|mitglied|adac|beamte|öffentlicher dienst|fahrschul|pflegedienst|taxi|ärzte|apotheke/.test(t)) b.push('Nur für bestimmte Gruppen');
  return b;
}

const titelVon = (l: LmListing) => [l.brandModelName, l.brandModelTitle ?? l.headline].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

/** Bestes Angebot: niedrigste Effektivrate bei mindestens MIN_KM und höchstens MAX_LAUFZEIT */
export function bestesOffer(offers: LmOffer[], einmal: number): LmOffer | null {
  const passend = offers.filter((o) => o.includedMileage >= MIN_KM && o.duration <= MAX_LAUFZEIT && o.duration > 0);
  const liste = passend.length ? passend : offers;
  let best: LmOffer | null = null;
  for (const o of liste) if (!best || o.monthlyRate + einmal / o.duration < best.monthlyRate + einmal / best.duration) best = o;
  return best;
}

export function angebotAus(l: LmListing, modellId: ModellId, detail: LmDetail | null): Angebot {
  const einmal = detail ? (detail.transferCosts ?? 0) + (detail.registrationCosts ?? 0) + (detail.downpayment ?? 0) : null;
  const offers = detail?.offers.length ? detail.offers : l.offers?.length ? l.offers : [l.leasingOffer];
  const o = bestesOffer(offers, einmal ?? EINMAL_ANNAHME) ?? l.leasingOffer;
  const titel = titelVon(l);
  const pfad = (l.url ?? '').split('?')[0] || `/leasing/pkw/x/${l.id}`;
  return {
    id: `lm:${l.id}`,
    quelle: 'leasingmarkt',
    modell: modellId,
    titel,
    url: LM_BASIS + pfad,
    kunden: kundenAus(l.targetGroup),
    zustand: zustandAus(l),
    ps: l.engine?.power?.hp ?? null,
    listenpreis: l.grossListPriceInEUR ?? null,
    rateBrutto: o.monthlyRate,
    rateNetto: o.monthlyNetRate,
    laufzeit: o.duration,
    kmJahr: o.includedMileage,
    einmalBrutto: einmal,
    effektivQuelle: null,
    effektivQuelleNetto: false,
    lf: o.leasingFactor,
    verfuegbarkeit: l.availability?.replace(/^Verfügbar:\s*/i, '') ?? null,
    haendler: detail?.bank ?? null,
    bedingungen: bedingungenAus(`${titel} ${l.headline ?? ''} ${JSON.stringify(l.specialConditions ?? [])}`),
    temperatur: null,
    veroeffentlicht: l.dealPublishedAt ?? null,
    status: l.isOnline === false ? 'weg' : 'aktiv',
  };
}

/** Modell eines Eintrags auf einer Modellseite bestimmen (z. B. Leon oder Leon VZ) */
export function modellFuer(l: LmListing, kandidaten: ModellId[]): ModellId | null {
  const t = `${titelVon(l)} ${l.headline ?? ''}`;
  const ps = l.engine?.power?.hp ?? null;
  for (const id of kandidaten) if (MODELLE.find((m) => m.id === id)!.passt(t, ps)) return id;
  return null;
}

export interface LmLauf {
  eintraege: { listing: LmListing; modell: ModellId }[];
  abfragen: number;
  fehler: string[];
}

/** Modellseiten lesen: je Seite die günstigsten (2 Seiten nach Rate) und die neuesten Angebote */
export async function leseModellseiten(http: Http, log: (m: string) => void, seiten = LM_SEITEN): Promise<LmLauf> {
  const gesehen = new Map<number, { listing: LmListing; modell: ModellId }>();
  const fehler: string[] = [];
  let abfragen = 0;
  for (const s of seiten) {
    let seitenGesamt = 2;
    for (const q of ['?sort=rate', '?sort=rate&p=2', '?sort=new']) {
      if (q.includes('p=2') && seitenGesamt < 2) continue;
      const url = LM_BASIS + s.pfad + q;
      abfragen++;
      const { status, body } = await http.text(url);
      if (status === 404) {
        fehler.push(`${s.pfad}: Seite nicht gefunden`);
        break;
      }
      const r = leseListe(body);
      if (!r) {
        fehler.push(`${s.pfad}${q}: keine Angebotsdaten gefunden (Seitenaufbau geändert?)`);
        continue;
      }
      if (q === '?sort=rate') seitenGesamt = r.totalPages;
      for (const l of r.listings) {
        if (!l?.id || !l.leasingOffer) continue;
        const m = modellFuer(l, s.modelle);
        if (m && !gesehen.has(l.id)) gesehen.set(l.id, { listing: l, modell: m });
      }
    }
    log(`LeasingMarkt ${s.pfad}: ${[...gesehen.values()].filter((e) => s.modelle.includes(e.modell)).length} Angebote`);
  }
  return { eintraege: [...gesehen.values()], abfragen, fehler };
}

export async function leseAngebotsseite(http: Http, url: string): Promise<LmDetail | 'weg' | null> {
  const { status, body } = await http.text(url);
  if (status === 404 || status === 410) return 'weg';
  return leseDetail(body);
}
