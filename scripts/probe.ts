// Prüft einzelne LeasingMarkt-Angebotsseiten mit der Leselogik des Radars und gibt das Ergebnis aus.
// Aufruf: URLS="https://www.leasingmarkt.de/leasing/pkw/…/123 …" npm run probe-seiten
// Für strittige Meldungen: zeigt, was der Radar liest, was die Seite anzeigt und ob die Gegenprüfung passt.

import { angebotAus, leseDetail, LM_BASIS, type LmListing } from '../src/lib/adapters/leasingmarkt';
import { pruefeGegenSeite } from '../src/lib/adapters/leasingmarkt';
import { Http } from '../src/lib/core/http';
import { bewerte } from '../src/lib/engine/calc';

const urls = (process.env.URLS ?? '').split(/[\s,]+/).filter((u) => u.startsWith(LM_BASIS));

async function main() {
  const http = new Http((m) => console.log(m));
  for (const url of urls) {
    const { status, body } = await http.text(url);
    const d = leseDetail(body);
    console.log(`\n=== ${url} (HTTP ${status})`);
    if (!d) {
      console.log('Keine Angebotsdaten gefunden');
      continue;
    }
    const sel = d.offers[0];
    if (!sel) {
      console.log(JSON.stringify({ seite: d.seite, ort: d.ort, lieferungOptional: d.lieferungOptional, hinweis: 'keine Varianten in den Rohdaten' }, null, 2));
      continue;
    }
    const pfad = new URL(url).pathname;
    const id = Number(pfad.split('/').pop());
    // Minimaler Listeneintrag aus der Seite selbst (gewählte Variante zuerst)
    const listing: LmListing = { id, targetGroup: 'Privat- & Gewerbekunden', url: pfad, leasingOffer: sel, offers: d.offers, brandModelName: pfad.split('/')[3] };
    const a = angebotAus(listing, 'bmw-1er', d);
    const p = pruefeGegenSeite({ ...a, url }, d, new Date().toISOString());
    console.log(JSON.stringify({ seite: d.seite, kosten: a.kosten, ort: d.ort, lieferungOptional: d.lieferungOptional, einmalBrutto: a.einmalBrutto, gewaehlt: { rate: a.rateBrutto, laufzeit: a.laufzeit, km: a.kmJahr, url: a.url }, effektivBrutto: bewerte({ ...a, pruefung: p }).effBrutto, pruefung: p }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
