// Ein Lauf des Leasing-Radars (GitHub Actions, stündlich 7–23 Uhr):
// 1. LeasingMarkt: Modellseiten (günstigste + neueste), für aussichtsreiche Angebote die Angebotsseite (Einmalkosten)
// 2. mydealz: RSS der Gruppe Auto-Leasing, für passende Deals die Deal-Seite (abgelaufen?)
// 3. Bewerten, Änderungen verfolgen, Top-Angebote sofort per Telegram/Mail melden
// 4. data/deals.json und data/stand.json schreiben (der Commit baut die Website neu)
//
// Optionen: NUR=leasingmarkt|mydealz  MAX_DETAILS=25  MAX_DEALSEITEN=12  KEIN_ALARM=1  TROCKEN=1 (nichts schreiben)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { angebotAus, leseAngebotsseite, leseModellseiten, type LmDetail } from '../src/lib/adapters/leasingmarkt';
import { angebotAusRss, leseFeed, pruefeDeal, type RssEintrag } from '../src/lib/adapters/mydealz';
import { GesperrtError, Http } from '../src/lib/core/http';
import type { Deal, Quelle, QuellenStand, Stand } from '../src/lib/core/types';
import { lohntDetail } from '../src/lib/engine/calc';
import { aufraeumen, fuehreZusammen, setzeStatus } from '../src/lib/engine/changes';
import { kiErgaenze } from '../src/lib/engine/ki';
import { melde, sollMelden } from '../src/lib/notify';

const DATA = path.join(process.cwd(), 'data');
const env = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);
const MAX_DETAILS = env('MAX_DETAILS', 25);
const MAX_DEALSEITEN = env('MAX_DEALSEITEN', 12);
const MAX_KI = env('MAX_KI', 8);
const nur = (q: Quelle) => !process.env.NUR || process.env.NUR === q;

const hinweise: string[] = [];
const log = (m: string) => {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
};
const lies = <T>(datei: string, leer: T): T => {
  try {
    return existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as T) : leer;
  } catch {
    return leer;
  }
};
const leererStand = (): QuellenStand => ({ ok: false, gesperrt: false, abfragen: 0, angebote: 0, fehler: [] });

async function main() {
  const start = Date.now();
  const jetzt = new Date().toISOString();
  const datei = path.join(DATA, 'deals.json');
  const vorher = lies<Deal[]>(datei, []);
  const deals = new Map(vorher.map((d) => [d.id, d]));
  const http = new Http(log);
  const quellen: Record<Quelle, QuellenStand> = { leasingmarkt: leererStand(), mydealz: leererStand() };
  const gesehen = new Set<string>();

  // ---------- LeasingMarkt ----------
  if (nur('leasingmarkt')) {
    const q = quellen.leasingmarkt;
    try {
      const lauf = await leseModellseiten(http, log);
      q.abfragen += lauf.abfragen;
      q.fehler.push(...lauf.fehler);
      let details = 0;
      for (const { listing, modell } of lauf.eintraege) {
        const id = `lm:${listing.id}`;
        gesehen.add(id);
        const alt = deals.get(id);
        const bekannt: LmDetail | null = alt?.einmalBrutto != null ? { transferCosts: alt.einmalBrutto, registrationCosts: 0, downpayment: 0, offers: [], bank: alt.haendler } : null;
        let angebot = angebotAus(listing, modell, bekannt);
        const rateGeaendert = alt && alt.rateBrutto != null && Math.abs((alt.rateBrutto ?? 0) - (listing.leasingOffer.monthlyRate ?? 0)) >= 1;
        if ((!bekannt || rateGeaendert) && lohntDetail(angebot) && details < MAX_DETAILS) {
          details++;
          q.abfragen++;
          const d = await leseAngebotsseite(http, angebot.url);
          if (d === 'weg') angebot = { ...angebot, status: 'weg' };
          else if (d) angebot = angebotAus(listing, modell, d);
          else q.fehler.push(`${angebot.url}: Einmalkosten nicht gefunden`);
        }
        deals.set(id, fuehreZusammen(alt, angebot, jetzt));
      }
      // Bisherige Top-Angebote, die diesmal nicht in den Listen auftauchen: noch online?
      const offen = [...deals.values()].filter((d) => d.quelle === 'leasingmarkt' && d.status === 'aktiv' && d.bewertung.stufe === 'top' && !gesehen.has(d.id)).slice(0, 8);
      for (const d of offen) {
        q.abfragen++;
        const r = await leseAngebotsseite(http, d.url);
        if (r === 'weg') deals.set(d.id, setzeStatus(d, 'weg', jetzt));
        else if (r) deals.set(d.id, { ...d, zuletztGesehen: jetzt });
      }
      q.angebote = lauf.eintraege.length;
      q.ok = lauf.eintraege.length > 0;
      log(`LeasingMarkt: ${lauf.eintraege.length} Angebote, ${details} Angebotsseiten gelesen`);
    } catch (e) {
      werteFehler(q, e, 'LeasingMarkt');
    }
  }

  // ---------- mydealz ----------
  if (nur('mydealz')) {
    const q = quellen.mydealz;
    try {
      q.abfragen++;
      const feed: RssEintrag[] = await leseFeed(http);
      let ki = 0;
      const zuPruefen: string[] = [];
      for (const e of feed) {
        let a = angebotAusRss(e);
        if (!a) continue;
        if (a.effektivQuelle == null && a.rateBrutto == null && ki < MAX_KI) {
          ki++;
          a = angebotAusRss(e, await kiErgaenze(e.titel, e.beschreibung)) ?? a;
        }
        const alt = deals.get(a.id);
        // Status von der Deal-Seite gilt, bis sie erneut geprüft wird
        if (alt && alt.status !== 'aktiv') a = { ...a, status: alt.status };
        deals.set(a.id, fuehreZusammen(alt, a, jetzt));
        gesehen.add(a.id);
        q.angebote++;
        if (!alt || alt.status === 'aktiv') zuPruefen.push(a.id);
      }
      // Deal-Seite prüfen: neue Deals und aktive Top/Gut-Deals zuerst (abgelaufen? Temperatur)
      const reihenfolge = [...new Set([...zuPruefen, ...[...deals.values()].filter((d) => d.quelle === 'mydealz' && d.status === 'aktiv' && d.bewertung.stufe !== 'normal').map((d) => d.id)])]
        .map((id) => deals.get(id)!)
        .sort((a, b) => rang(a) - rang(b))
        .slice(0, MAX_DEALSEITEN);
      for (const d of reihenfolge) {
        q.abfragen++;
        const s = await pruefeDeal(http, d.url);
        if (s === 'weg') deals.set(d.id, setzeStatus(d, 'weg', jetzt));
        else deals.set(d.id, { ...setzeStatus(d, s.abgelaufen ? 'abgelaufen' : 'aktiv', jetzt), temperatur: s.temperatur ?? d.temperatur });
      }
      q.ok = true;
      log(`mydealz: ${feed.length} Deals im Feed, ${q.angebote} passend, ${reihenfolge.length} Deal-Seiten geprüft${ki ? `, ${ki}× KI` : ''}`);
    } catch (e) {
      werteFehler(q, e, 'mydealz');
    }
  }

  // ---------- Melden ----------
  let liste = aufraeumen([...deals.values()], jetzt);
  const neuTop = liste.filter(sollMelden);
  let gemeldet = 0;
  if (neuTop.length && !process.env.KEIN_ALARM) {
    const erg = await melde(neuTop, log);
    log(`Alarm: ${neuTop.length} Top-Angebote · Telegram ${erg.telegram} · Push ${erg.push} · Mail ${erg.mail}`);
    if (erg.telegram === 'aus') hinweise.push('Telegram: Secret TELEGRAM_BOT_TOKEN fehlt im Lauf');
    if (erg.telegram === 'kein-chat') hinweise.push(`Telegram: Token ok, aber keine /start-Nachricht an den Bot gefunden (${erg.diagnose ?? ''}) – dem Bot /start schreiben`);
    if (erg.telegram === 'fehler') hinweise.push('Telegram: Fehler beim Senden (Token prüfen)');
    const ids = new Set(erg.gemeldet);
    gemeldet = ids.size;
    liste = liste.map((d) =>
      ids.has(d.id) ? { ...d, gemeldet: jetzt, gemeldetWert: d.bewertung.ziel!.ist, verlauf: [...d.verlauf, { datum: jetzt, feld: 'gemeldet' as const, neu: `${d.bewertung.ziel!.ist.toFixed(2)} €` }].slice(-30) } : d,
    );
  }

  // ---------- Schreiben ----------
  liste.sort((a, b) => rang(a) - rang(b));
  const stand: Stand = { lauf: jetzt, dauerSek: Math.round((Date.now() - start) / 1000), quellen, gemeldet, hinweise };
  for (const [host, n] of Object.entries(http.abfragen)) log(`Abfragen ${host}: ${n}`);
  if (process.env.TROCKEN) {
    log(`Trockenlauf: ${liste.length} Angebote, davon ${liste.filter((d) => d.bewertung.stufe === 'top').length} Top – nichts geschrieben`);
    for (const d of liste.filter((x) => x.bewertung.stufe !== 'normal').slice(0, 15)) log(`  ${d.bewertung.stufe.toUpperCase()} ${d.modell} ${d.bewertung.grund} – ${d.titel.slice(0, 70)}`);
    return;
  }
  mkdirSync(DATA, { recursive: true });
  writeFileSync(datei, `${JSON.stringify(liste, null, 1)}\n`);
  writeFileSync(path.join(DATA, 'stand.json'), `${JSON.stringify(stand, null, 2)}\n`);
  log(`Fertig: ${liste.length} Angebote, ${liste.filter((d) => d.bewertung.stufe === 'top' && d.status === 'aktiv').length} Top, ${gemeldet} gemeldet (${stand.dauerSek} s)`);
}

/** Sortierung: aktive Top-Angebote zuerst, dann nach Abstand zum Zielwert */
function rang(d: Deal) {
  const stufe = { top: 0, gut: 1, normal: 2 }[d.bewertung.stufe];
  const status = d.status === 'aktiv' ? 0 : 10;
  const quote = d.bewertung.ziel ? d.bewertung.ziel.ist / d.bewertung.ziel.wert : 9;
  return status + stufe + quote / 10;
}

function werteFehler(q: QuellenStand, e: unknown, name: string) {
  if (e instanceof GesperrtError) {
    q.gesperrt = true;
    q.fehler.push(e.message);
    hinweise.push(`${name} hat automatische Abfragen gesperrt – Quelle in diesem Lauf ausgelassen, keine Umgehung.`);
    log(`${name} gesperrt: ${e.message}`);
  } else {
    q.fehler.push(String((e as Error)?.message ?? e).slice(0, 300));
    log(`${name} Fehler: ${(e as Error)?.stack ?? e}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
