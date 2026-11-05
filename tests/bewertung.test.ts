import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modellAusTitel } from '../src/data/watchlist';
import type { Angebot } from '../src/lib/core/types';
import { bewerte, effektiv } from '../src/lib/engine/calc';
import { fuehreZusammen } from '../src/lib/engine/changes';
import { sollMelden, telegramText } from '../src/lib/notify';

const basis: Angebot = {
  id: 'lm:1',
  quelle: 'leasingmarkt',
  modell: 'cupra-leon-vz',
  titel: 'Cupra Leon Sportstourer VZ',
  url: 'https://www.leasingmarkt.de/leasing/pkw/cupra-leon/1',
  kunden: 'privat',
  zustand: 'neu',
  ps: 333,
  listenpreis: 62145,
  rateBrutto: 199,
  rateNetto: 167.23,
  laufzeit: 24,
  kmJahr: 10000,
  einmalBrutto: 1590,
  effektivQuelle: null,
  effektivQuelleNetto: false,
  lf: 0.32,
  verfuegbarkeit: 'Sofort',
  haendler: null,
  bedingungen: [],
  temperatur: null,
  veroeffentlicht: null,
  status: 'aktiv',
};

test('Effektivrate = Rate + Einmalkosten / Laufzeit', () => {
  const e = effektiv(basis);
  assert.equal(e.brutto, 265.25);
  assert.equal(e.geschaetzt, false);
});

test('Leon VZ privat 265 € effektiv ist Top (Ziel 300 €)', () => {
  const b = bewerte(basis);
  assert.equal(b.stufe, 'top');
  assert.equal(b.ziel?.gruppe, 'privat');
  assert.equal(b.gkf, 0.43);
});

test('Geschätzte Überführung: höchstens „gut“', () => {
  const b = bewerte({ ...basis, einmalBrutto: null });
  assert.equal(b.geschaetzt, true);
  assert.equal(b.stufe, 'gut');
});

test('Gewerbe wird netto mit dem Gewerbe-Ziel verglichen', () => {
  // mydealz: 157 € netto effektiv, Ziel Gewerbe Leon VZ 250 € → Top
  const b = bewerte({ ...basis, quelle: 'mydealz', kunden: 'gewerbe', effektivQuelle: 157, effektivQuelleNetto: true });
  assert.equal(b.ziel?.basis, 'netto');
  assert.equal(b.ziel?.ist, 157);
  assert.equal(b.stufe, 'top');
});

test('„Beide“ nimmt die günstigere Sicht', () => {
  const b = bewerte({ ...basis, kunden: 'beide', rateBrutto: 340, rateNetto: 285.71, einmalBrutto: 1190, listenpreis: 50000 });
  assert.ok(b.ziel);
  assert.equal(b.stufe, 'normal');
});

test('Melden: nur aktive Top-Deals, erneut erst bei 5 % Preissenkung', () => {
  const jetzt = '2026-11-05T10:00:00.000Z';
  const d = fuehreZusammen(undefined, basis, jetzt);
  assert.equal(sollMelden(d), true);
  const gemeldet = { ...d, gemeldet: jetzt, gemeldetWert: d.bewertung.ziel!.ist };
  assert.equal(sollMelden(gemeldet), false);
  const billiger = fuehreZusammen(gemeldet, { ...basis, rateBrutto: 180 }, jetzt);
  assert.equal(sollMelden(billiger), true);
  assert.equal(sollMelden({ ...d, status: 'abgelaufen' }), false);
  assert.equal(billiger.verlauf.at(-1)?.feld, 'preis');
});

test('Telegram-Text enthält Wert, Ziel und Link', () => {
  const t = telegramText(fuehreZusammen(undefined, { ...basis, bedingungen: ['Werksabholung'] }, '2026-11-05T10:00:00Z'));
  assert.match(t, /Cupra Leon VZ: 265 € brutto effektiv/);
  assert.match(t, /Ziel privat: 300 €/);
  assert.match(t, /Werksabholung/);
  assert.match(t, /href="https:\/\/www\.leasingmarkt\.de/);
});

test('Modellerkennung in mydealz-Titeln', () => {
  assert.equal(modellAusTitel('VW Golf GTI Clubsport Edition 50 (325PS)', 325), 'golf-gti');
  assert.equal(modellAusTitel('Golf R 2.0 TSI', 333), null);
  assert.equal(modellAusTitel('Cupra Leon 1.5 eTSI 150 PS', 150), 'cupra-leon');
  assert.equal(modellAusTitel('Seat Leon FR', 150), null);
  assert.equal(modellAusTitel('BMW 120 M Sport Automatik', 170), 'bmw-1er');
  assert.equal(modellAusTitel('BMW M135 xDrive', 300), 'bmw-m135i');
  assert.equal(modellAusTitel('BMW 220i Gran Coupé', 170), null);
  assert.equal(modellAusTitel('Audi A3 Sportback 35 TFSI', 150), 'audi-a3');
  assert.equal(modellAusTitel('Audi S3 Sportback quattro', 333), 'audi-s3');
  assert.equal(modellAusTitel('Audi Q3 Sportback', 150), null);
});
