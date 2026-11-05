import assert from 'node:assert/strict';
import { test } from 'node:test';
import { angebotAus, bestesOffer, leseDetail, leseListe, modellFuer, objektNach } from '../src/lib/adapters/leasingmarkt';
import { angebotAusRss, leseDealSeite, leseRss, leseTitel } from '../src/lib/adapters/mydealz';
import { zahl } from '../src/lib/core/http';
import { LM_LISTE, lmDetailSeite, lmListenSeite, MD_DEAL_ABGELAUFEN, MD_DEAL_AKTIV, MD_RSS } from './fixtures';

test('zahl: deutsche Beträge', () => {
  assert.equal(zahl('1.590,00 €'), 1590);
  assert.equal(zahl('5.976€'), 5976);
  assert.equal(zahl('345,25'), 345.25);
  assert.equal(zahl('0,58'), 0.58);
  assert.equal(zahl('199'), 199);
  assert.equal(zahl(''), null);
});

test('objektNach: Klammern in Zeichenketten stören nicht', () => {
  const t = 'x "a":{"s":"} { ]","n":[1,{"b":2}]} y';
  assert.deepEqual(objektNach(t, 'a'), { s: '} { ]', n: [1, { b: 2 }] });
});

test('LeasingMarkt: Liste aus den Next.js-Datenblöcken', () => {
  const r = leseListe(lmListenSeite());
  assert.ok(r);
  assert.equal(r.totalPages, 13);
  assert.equal(r.listings.length, 3);
  assert.equal(r.listings[0].leasingOffer.monthlyRate, 199);
  assert.equal(r.listings[0].headline, 'Sportstourer 2.0 TSI 245kW VZ DSG {Sonder}');
});

test('LeasingMarkt: Modellzuordnung Leon / Leon VZ nach PS', () => {
  assert.equal(modellFuer(LM_LISTE.listings[0], ['cupra-leon', 'cupra-leon-vz']), 'cupra-leon-vz');
  assert.equal(modellFuer(LM_LISTE.listings[2], ['cupra-leon', 'cupra-leon-vz']), 'cupra-leon');
});

test('LeasingMarkt: Angebotsseite mit Überführung, Zulassung, Anzahlung (brutto)', () => {
  const d = leseDetail(lmDetailSeite({ transfer: 1590, zulassung: '{}', anzahlung: '' }));
  assert.ok(d);
  assert.equal(d.transferCosts, 1590);
  assert.equal(d.registrationCosts, null);
  assert.equal(d.downpayment, null);
  assert.equal(d.offers.length, 2);
  assert.match(d.bank ?? '', /SEAT Bank/);
  const d2 = leseDetail(lmDetailSeite({ transfer: 1329, zulassung: 200, anzahlung: 500 }));
  assert.equal(d2?.registrationCosts, 200);
  assert.equal(d2?.downpayment, 500);
});

test('LeasingMarkt: bestes Angebot mit mindestens 10.000 km', () => {
  const o = bestesOffer(LM_LISTE.listings[0].offers!, 1590);
  assert.equal(o?.duration, 24);
  assert.equal(o?.includedMileage, 10000);
});

test('LeasingMarkt: Angebot mit Einmalkosten', () => {
  const l = LM_LISTE.listings[0];
  const d = leseDetail(lmDetailSeite({ transfer: 1590, zulassung: null, anzahlung: '' }));
  const a = angebotAus(l, 'cupra-leon-vz', d);
  assert.equal(a.id, 'lm:13342515');
  assert.equal(a.url, 'https://www.leasingmarkt.de/leasing/pkw/cupra-leon/13342515');
  assert.equal(a.kunden, 'privat');
  assert.equal(a.einmalBrutto, 1590);
  assert.equal(a.rateBrutto, 199);
  assert.equal(a.verfuegbarkeit, 'Sofort');
  const g = angebotAus(LM_LISTE.listings[1], 'cupra-leon-vz', null);
  assert.equal(g.kunden, 'gewerbe');
  assert.equal(g.zustand, 'vorlauf');
  assert.equal(g.einmalBrutto, null);
});

test('mydealz: RSS lesen', () => {
  const r = leseRss(MD_RSS);
  assert.equal(r.length, 5);
  assert.equal(r[0].haendler, '9drive');
  assert.equal(r[0].gesamt, 8286);
  assert.equal(r[2].link, 'https://www.mydealz.de/deals/privatleasingvw-volkswagen-golf-gti-black-style-2862711');
  assert.match(r[0].beschreibung, /Monatsrate: 279,00 €/);
});

test('mydealz: Titel mit Rate, LF, Laufzeit, km, ÜF', () => {
  const t = leseTitel('[Privatleasing]VW Volkswagen Golf GTI Black Style inkl. Sonderausstattung|sofort verfügbar|199€/M|LF 0,37|24M|10.000km/Jahr|1.200€ ÜF');
  assert.equal(t.kunden, 'privat');
  assert.equal(t.rate, 199);
  assert.equal(t.lf, 0.37);
  assert.equal(t.laufzeit, 24);
  assert.equal(t.kmJahr, 10000);
  assert.equal(t.ueberfuehrung, 1200);
  assert.equal(t.netto, false);
});

test('mydealz: Effektivrate und netto bei Gewerbe', () => {
  const t = leseTitel('[Gewerbe] Cupra Leon Sportstourer VZ 2.0 TSI 4Drive (333 PS, DSG) für 99 € netto/Monat – effektiv 157 € netto, 24 Monate');
  assert.equal(t.kunden, 'gewerbe');
  assert.equal(t.netto, true);
  assert.equal(t.rate, 99);
  assert.equal(t.effektiv, 157);
  assert.equal(t.ps, 333);
  assert.equal(t.laufzeit, 24);
  const p = leseTitel('Privatleasing CUPRA Leon Sportstourer VZ 2.0 TSI 4Drive (333 PS, Allrad, DSG) für eff. 345,25€ mtl. (GF: 0,58)', 'Monatsrate: 279,00 €\nLaufzeit: 24 Monate');
  assert.equal(p.effektiv, 345.25);
  assert.equal(p.rate, 279);
  assert.equal(p.gf, 0.58);
  assert.equal(p.laufzeit, 24);
  const b = leseTitel('[Privatleasing] BMW 220i Gran Coupé | 266€ mtl. | 24 Mo. | 10.000 km p.a. | 1.395€ ÜF | LF 0,62');
  assert.equal(b.rate, 266);
  assert.equal(b.laufzeit, 24);
  assert.equal(b.ueberfuehrung, 1395);
  assert.equal(b.kmJahr, 10000);
});

test('mydealz: nur beobachtete Modelle, Effektivrate aus Gesamtbetrag', () => {
  const r = leseRss(MD_RSS);
  const a = r.map((e) => angebotAusRss(e));
  assert.equal(a[3], null, 'VW Taigo ist kein beobachtetes Modell');
  assert.equal(a[4], null, 'BMW 220i ist kein 1er');
  assert.equal(a[0]?.modell, 'cupra-leon-vz');
  assert.equal(a[0]?.effektivQuelle, 345.25);
  assert.equal(a[1]?.modell, 'cupra-leon-vz');
  assert.equal(a[1]?.effektivQuelleNetto, true);
  assert.ok(a[1]?.bedingungen.some((b) => /Loyalität/.test(b)));
  assert.equal(a[2]?.modell, 'golf-gti');
  assert.equal(a[2]?.id, 'md:2862711');
  // 5.976 € / 24 Monate = 249 € effektiv (= 199 € + 1.200 € / 24)
  assert.equal(a[2]?.effektivQuelle, 249);
  assert.equal(a[0]?.listenpreis, 59540);
});

test('mydealz: Deal-Seite abgelaufen / aktiv', () => {
  assert.deepEqual(leseDealSeite(MD_DEAL_ABGELAUFEN), { abgelaufen: true, temperatur: 1132 });
  assert.deepEqual(leseDealSeite(MD_DEAL_AKTIV), { abgelaufen: false, temperatur: 412 });
});
