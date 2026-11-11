// Gemeinsame Typen für Lauf (scripts/scan.ts) und Website (app/).

export type Quelle = 'leasingmarkt' | 'mydealz';
export type Kunden = 'privat' | 'gewerbe' | 'beide';
export type Zustand = 'neu' | 'vorlauf' | 'gebraucht' | 'unbekannt';
export type Status = 'aktiv' | 'abgelaufen' | 'weg';
export type Stufe = 'top' | 'gut' | 'normal';

export type ModellId = 'golf-gti' | 'cupra-leon' | 'cupra-leon-vz' | 'bmw-1er' | 'bmw-m135i' | 'audi-a3' | 'audi-s3';

export interface Aenderung {
  datum: string;
  feld: 'neu' | 'preis' | 'status' | 'gemeldet';
  alt?: string;
  neu?: string;
}

/** Ein Angebot, wie es die Quelle liefert – alle Beträge in Euro, Herkunft der Einmalkosten getrennt vermerkt */
/** Kostenposten wie auf der Angebotsseite: Betrag brutto, „enthalten“ oder unbekannt („keine Angabe“) */
export type Posten = number | 'enthalten' | null;

export interface Kosten {
  anzahlung: Posten;
  ueberfuehrung: Posten;
  zulassung: Posten;
  /** Optionale Lieferung bis vor die Haustür (nicht eingerechnet, nur angezeigt) */
  lieferungOptional: number | null;
}

/** Gegenprüfung: stimmen die eigenen Werte mit der Zusammenfassung überein, die die Angebotsseite selbst zeigt? */
export interface Pruefung {
  datum: string;
  ok: boolean;
  hinweis: string;
  /** Rate, für die die Prüfung gilt – ändert sich die Rate, muss neu geprüft werden */
  rate: number | null;
}

export interface Angebot {
  /** quellenübergreifend eindeutig, z. B. lm:13342515 oder md:2862711 */
  id: string;
  quelle: Quelle;
  modell: ModellId;
  titel: string;
  url: string;
  kunden: Kunden;
  zustand: Zustand;
  ps: number | null;
  /** Bruttolistenpreis */
  listenpreis: number | null;
  rateBrutto: number | null;
  rateNetto: number | null;
  laufzeit: number | null;
  kmJahr: number | null;
  /** Einmalkosten brutto (Anzahlung + Überführung + Zulassung); null = unbekannt */
  einmalBrutto: number | null;
  /** Effektivrate laut Quelle (mydealz nennt sie oft im Titel), Basis wie die Rate (netto bei Gewerbe-Deals) */
  effektivQuelle: number | null;
  /** true, wenn effektivQuelle ein Nettobetrag ist */
  effektivQuelleNetto: boolean;
  lf: number | null;
  verfuegbarkeit: string | null;
  haendler: string | null;
  /** Bedingungen, die nicht für jeden gelten (Loyalität, Eroberung, Werksabholung …) */
  bedingungen: string[];
  temperatur: number | null;
  veroeffentlicht: string | null;
  status: Status;
  /** Einmalkosten einzeln (nur LeasingMarkt-Angebotsseite) */
  kosten?: Kosten | null;
  /** Händler-/Fahrzeugstandort, z. B. „96215 Lichtenfels“ */
  ort?: string | null;
  pruefung?: Pruefung | null;
}

export interface Bewertung {
  /** Effektivrate brutto inkl. Einmalkosten (umgelegt auf die Laufzeit) */
  effBrutto: number | null;
  effNetto: number | null;
  /** Gesamtkostenfaktor = effBrutto / Listenpreis × 100 */
  gkf: number | null;
  /** true, wenn die Einmalkosten geschätzt wurden */
  geschaetzt: boolean;
  /** Vergleich mit dem Zielwert der passenden Kundengruppe */
  ziel: { gruppe: 'privat' | 'gewerbe'; wert: number; ist: number; basis: 'brutto' | 'netto' } | null;
  stufe: Stufe;
  grund: string;
}

export interface Deal extends Angebot {
  bewertung: Bewertung;
  erstGesehen: string;
  zuletztGesehen: string;
  /** Zeitpunkt der letzten Meldung per Telegram/Mail und der dabei gemeldete Vergleichswert */
  gemeldet: string | null;
  gemeldetWert: number | null;
  /** Zeitpunkt, zu dem die Angebotsseite zuletzt gelesen wurde (LeasingMarkt) */
  detailGelesen?: string | null;
  /** Zeitpunkt, zu dem eine Korrektur zur früheren Meldung verschickt wurde */
  korrigiert?: string | null;
  verlauf: Aenderung[];
}

export interface QuellenStand {
  ok: boolean;
  gesperrt: boolean;
  abfragen: number;
  angebote: number;
  fehler: string[];
}

export interface Stand {
  lauf: string;
  dauerSek: number;
  quellen: Record<Quelle, QuellenStand>;
  gemeldet: number;
  hinweise: string[];
}
