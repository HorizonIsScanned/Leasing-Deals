// mydealz: RSS-Feed der Gruppe „Auto-Leasing“ (die letzten 30 Deals) und für passende Deals die Deal-Seite
// (abgelaufen? Temperatur). Die Titel sind halb strukturiert („… 199€/M | LF 0,37 | 24M | 10.000km/Jahr | 1.200€ ÜF“),
// pepper:merchant price ist der Gesamtbetrag über die Laufzeit (inkl. Überführung, Basis wie die Rate).
// Nur Pfade, die robots.txt erlaubt (/rss, /deals); /search und die interne API werden nicht genutzt.

import { modellAusTitel } from '../../data/watchlist';
import { type Http, zahl } from '../core/http';
import type { Angebot, Kunden } from '../core/types';

export const MD_FEED = 'https://www.mydealz.de/rss/gruppe/auto-leasing';

export interface RssEintrag {
  titel: string;
  link: string;
  datum: string | null;
  beschreibung: string;
  haendler: string | null;
  gesamt: number | null;
}

const entity = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? entity(m[1]).trim() : '';
};

export function leseRss(xml: string): RssEintrag[] {
  const out: RssEintrag[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const merchant = it.match(/<pepper:merchant\s+([^>]*)\/?>/);
    const attr = (n: string) => (merchant ? (merchant[1].match(new RegExp(`${n}="([^"]*)"`))?.[1] ?? null) : null);
    const datum = tag(it, 'pubDate');
    out.push({
      titel: tag(it, 'title'),
      link: tag(it, 'link').split('?')[0],
      datum: datum ? new Date(datum).toISOString() : null,
      beschreibung: tag(it, 'description')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim(),
      haendler: attr('name') ? entity(attr('name')!) : null,
      gesamt: zahl(attr('price')),
    });
  }
  return out;
}

export interface TitelDaten {
  kunden: Kunden | null;
  netto: boolean;
  rate: number | null;
  effektiv: number | null;
  lf: number | null;
  gf: number | null;
  laufzeit: number | null;
  kmJahr: number | null;
  ueberfuehrung: number | null;
  ps: number | null;
  listenpreis: number | null;
}

const BETRAG = String.raw`(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur(?:o)?\b)`;

/** Kennzahlen aus Titel (und Beschreibung als Ergänzung) lesen */
export function leseTitel(titel: string, text = ''): TitelDaten {
  const t = titel.replace(/\s+/g, ' ');
  const alles = `${t}\n${text}`;
  const privat = /privat/i.test(t);
  const gewerbe = /gewerbe|geschäftskund|business-?leasing/i.test(t);
  const kunden: Kunden | null = privat && gewerbe ? 'beide' : gewerbe ? 'gewerbe' : privat ? 'privat' : null;

  // Effektivrate: „eff. 345,25€“, „effektiv 157 € netto“, „Effektivpreis/Monat: 173€“
  const effM = t.match(new RegExp(String.raw`eff(?:ektiv)?(?:preis)?\.?\s*(?:/\s*monat)?:?\s*${BETRAG}`, 'i')) ?? text.match(new RegExp(String.raw`effektiv(?:preis)?(?:\s*/\s*monat)?:?\s*${BETRAG}`, 'i'));
  const effektiv = effM ? zahl(effM[1]) : null;

  // Monatsrate: erster Betrag mit „mtl./Monat/M/p.M.“ dahinter, der nicht die Effektivrate ist
  let rate: number | null = null;
  const rateRe = new RegExp(String.raw`(?<!eff(?:ektiv)?\.?\s{0,2})(?<![\d.,])${BETRAG}\s*(?:netto\s*)?(?:/\s*)?(?:mtl\.?|monat(?:lich)?|im monat|pro monat|p\.\s?m\.?|/\s*m\b|m\b)`, 'gi');
  for (const m of t.matchAll(rateRe)) {
    const v = zahl(m[1]);
    if (v != null && v >= 40 && v <= 2500) {
      rate = v;
      break;
    }
  }
  if (rate == null) {
    const m = text.match(new RegExp(String.raw`(?:monatsrate|leasingrate|rate)\s*:?\s*${BETRAG}`, 'i'));
    if (m) rate = zahl(m[1]);
  }

  const netto = /netto/i.test(t) || (gewerbe && !privat && !/brutto|inkl\.?\s*mwst/i.test(t));
  const lfM = alles.match(/\bLF:?\s*(\d[.,]\d{1,2})/);
  const gfM = alles.match(/\bGF:?\s*(\d[.,]\d{1,2})/);
  const lzM = t.match(/\b(\d{2})\s*(?:Monate|Monaten|Mon\.?|Mo\.?|M)\b(?!\s*\w*\s*€)/i) ?? text.match(/(?:laufzeit|leasingdauer)\s*:?\s*(\d{2})\s*Monat/i);
  const laufzeit = lzM ? Number(lzM[1]) : null;
  const kmM = alles.match(/(\d{1,2}[.,]?\d{3})\s*km\s*(?:\/|p\.?\s?a\.?|pro|im|jährl|jahr)/i) ?? alles.match(/(?:fahrleistung|laufleistung)\s*:?\s*(\d{1,2}[.,]?\d{3})/i);
  const ufM = alles.match(new RegExp(String.raw`${BETRAG}\s*(?:ÜF|Überführung|Bereitstellung)`, 'i')) ?? alles.match(new RegExp(String.raw`(?:ÜF|Überführung(?:skosten)?|Bereitstellung(?:skosten)?)\s*:?\s*${BETRAG}`, 'i'));
  const psM = alles.match(/(\d{2,3})\s*PS\b/i);
  const lpM = text.match(/(?:BLP|Bruttolistenpreis|Listenpreis|UVP)[^\d\n]{0,20}(\d{2}\.?\d{3}(?:,\d{2})?)/i);
  return {
    kunden,
    netto,
    rate,
    effektiv,
    lf: lfM ? zahl(lfM[1]) : null,
    gf: gfM ? zahl(gfM[1]) : null,
    laufzeit: laufzeit && laufzeit >= 6 && laufzeit <= 60 ? laufzeit : null,
    kmJahr: kmM ? zahl(kmM[1]) : null,
    ueberfuehrung: ufM ? zahl(ufM[1]) : null,
    ps: psM ? Number(psM[1]) : null,
    listenpreis: lpM ? zahl(lpM[1]) : null,
  };
}

export function bedingungenAusText(s: string): string[] {
  const t = s.toLowerCase();
  const b: string[] = [];
  if (/loyal|bestandskund|treueprämie|treue-?prämie/.test(t)) b.push('Loyalität (eigenes Fahrzeug der Marke nötig)');
  if (/eroberung|fremdfabrikat/.test(t)) b.push('Eroberung (Fremdfabrikat nötig)');
  if (/werksabholung/.test(t)) b.push('Werksabholung');
  if (/kleingewerbe/.test(t)) b.push('Kleingewerbe reicht');
  if (/bestellaktion|bestellfahrzeug/.test(t)) b.push('Bestellfahrzeug');
  if (/vorführ|tageszulassung|vorlauf/.test(t)) b.push('Vorführ-/Vorlauffahrzeug');
  if (/gebraucht|jahreswagen/.test(t)) b.push('Gebrauchtwagen');
  if (/schwerbehindert|azubi|student|mitglied|adac|beamte|öffentlicher dienst|sozialer|fahrschul|pflegedienst|taxi|ärzte|apotheke/.test(t)) b.push('Nur für bestimmte Gruppen');
  return b;
}

const dealId = (link: string) => link.match(/-(\d{5,})(?:[/?#]|$)/)?.[1] ?? link;

/** RSS-Eintrag → Angebot (null, wenn kein beobachtetes Modell) */
export function angebotAusRss(e: RssEintrag, ergaenzung?: Partial<TitelDaten> | null): Angebot | null {
  const d = leseTitel(e.titel, e.beschreibung);
  if (ergaenzung) {
    for (const k of Object.keys(d) as (keyof TitelDaten)[]) {
      const v = ergaenzung[k];
      if (d[k] == null && v != null) (d as unknown as Record<string, unknown>)[k] = v;
    }
  }
  const modell = modellAusTitel(e.titel, d.ps);
  if (!modell) return null;
  const kunden = d.kunden ?? (/gewerbe/i.test(e.beschreibung.slice(0, 400)) ? 'gewerbe' : 'privat');
  // Effektivrate: Titel > Gesamtbetrag/Laufzeit > Rate + Überführung/Laufzeit (immer in der Basis des Deals)
  let eff = d.effektiv;
  if (eff == null && e.gesamt != null && d.laufzeit) eff = Math.round((e.gesamt / d.laufzeit) * 100) / 100;
  if (eff == null && d.rate != null && d.laufzeit && d.ueberfuehrung != null) eff = Math.round((d.rate + d.ueberfuehrung / d.laufzeit) * 100) / 100;
  const netto = d.netto && kunden !== 'privat';
  const zustand = /gebraucht|jahreswagen/i.test(e.titel) ? 'gebraucht' : /vorführ|tageszul|vorlauf/i.test(e.titel) ? 'vorlauf' : 'neu';
  return {
    id: `md:${dealId(e.link)}`,
    quelle: 'mydealz',
    modell,
    titel: e.titel,
    url: e.link,
    kunden,
    zustand,
    ps: d.ps,
    listenpreis: d.listenpreis,
    rateBrutto: d.rate != null ? (netto ? Math.round(d.rate * 1.19 * 100) / 100 : d.rate) : null,
    rateNetto: d.rate != null ? (netto ? d.rate : Math.round((d.rate / 1.19) * 100) / 100) : null,
    laufzeit: d.laufzeit,
    kmJahr: d.kmJahr,
    einmalBrutto: d.ueberfuehrung != null ? (netto ? Math.round(d.ueberfuehrung * 1.19) : d.ueberfuehrung) : null,
    effektivQuelle: eff,
    effektivQuelleNetto: netto,
    lf: d.lf,
    verfuegbarkeit: /sofort/i.test(e.titel + e.beschreibung.slice(0, 600)) ? 'Sofort' : null,
    haendler: e.haendler,
    bedingungen: bedingungenAusText(`${e.titel}\n${e.beschreibung}`),
    temperatur: null,
    veroeffentlicht: e.datum,
    status: 'aktiv',
  };
}

export interface DealSeite {
  abgelaufen: boolean;
  temperatur: number | null;
}

export function leseDealSeite(html: string, id?: string): DealSeite {
  // Der Server liefert den Status als JSON („isExpired“) beim Deal-Objekt; zusätzlich gibt es einen Banner-Text.
  // Mehrere Deals auf der Seite (ähnliche Deals): den „isExpired“-Wert nehmen, der der Deal-ID am nächsten folgt
  let json: boolean | null = null;
  let best = Infinity;
  for (const m of html.matchAll(/\\?"isExpired\\?":(true|false)/g)) {
    const i = m.index ?? 0;
    const k = id ? html.lastIndexOf(id, i) : 0;
    const abstand = k < 0 ? Infinity : i - k;
    if (abstand < best && abstand < 1500) {
      best = abstand;
      json = m[1] === 'true';
    }
  }
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  const banner = /(?:dieser|der) Deal (?:ist )?(?:mittlerweile |vor [^.]{1,20} )?abgelaufen|abgelaufen am \d/i.test(text);
  const abgelaufen = json === true || banner;
  const temp = text.match(/(-?\d{1,5})\s?°/);
  return { abgelaufen, temperatur: temp ? Number(temp[1]) : null };
}

export async function leseFeed(http: Http): Promise<RssEintrag[]> {
  const { status, body } = await http.text(MD_FEED, { accept: 'application/rss+xml,application/xml;q=0.9,*/*;q=0.5' });
  if (status >= 400) throw new Error(`RSS HTTP ${status}`);
  return leseRss(body);
}

export async function pruefeDeal(http: Http, url: string): Promise<DealSeite | 'weg'> {
  const { status, body } = await http.text(url);
  if (status === 404 || status === 410) return 'weg';
  return leseDealSeite(body, dealId(url));
}
