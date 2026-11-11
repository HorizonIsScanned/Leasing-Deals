# Leasing-Radar

Findet Leasing-Schnäppchen für **VW Golf GTI, Cupra Leon (inkl. VZ), BMW 1er (inkl. M135i) und Audi A3/S3** auf
**mydealz** und **LeasingMarkt**, rechnet jede Rate auf den Effektivpreis um und meldet Top-Angebote **sofort per
Telegram und/oder E-Mail**. Aufgebaut mit Next.js, Passwortschutz und
stündlichem Lauf über GitHub Actions (Daten im Repository; die Website liest sie beim Aufruf, Cache 5 Minuten).

## Aufbau

```
src/data/watchlist.ts    Modelle, LeasingMarkt-Seiten, Erkennung in mydealz-Titeln, Zielwerte (hier anpassen)
src/lib/core/            Typen, HTTP (Abstand je Host, Wiederholungen, Erkennung von Bot-Sperren)
src/lib/adapters/        leasingmarkt.ts  Modellseiten + Angebotsseite (JSON aus den Next.js-Datenblöcken)
                         mydealz.ts       RSS „Auto-Leasing“ + Deal-Seite (abgelaufen, Temperatur), Titel-Parser
src/lib/engine/          calc.ts (Effektivrate, Gesamtkostenfaktor, Stufe), changes.ts (Verlauf), ki.ts (optional)
src/lib/notify.ts        Telegram-Bot und Resend-Mail, keine Doppelmeldungen
scripts/scan.ts          ein Lauf (GitHub Actions, .github/workflows/scan.yml)
data/                    deals.json, stand.json (öffentlich – keine Zugangsdaten im Repository)
app/                     Website: alle Angebote, Filter, Sortierung, Zielwerte, Rechenweg
tests/                   Unit-Tests mit nachgebauten Seitenausschnitten (Aufbau geprüft am 05.11.2026)
```

## Bewertung

- **Effektiv** = Monatsrate + (Überführung + Zulassung + Anzahlung) ÷ Laufzeit. Privat brutto, Gewerbe netto.
- **Top** = effektiv ≤ Zielwert (siehe `watchlist.ts`) oder Gesamtkostenfaktor ≤ 0,40. **Gut** = bis 10 % darüber.
- Fehlen die Einmalkosten, wird mit 1.300 € gerechnet und der Wert als geschätzt markiert – nie als Top gemeldet.
- LeasingMarkt: bei mehreren Laufzeit-/km-Varianten zählt die günstigste mit ≥ 10.000 km und ≤ 48 Monaten.
- mydealz: Effektivrate aus dem Titel, sonst Gesamtbetrag ÷ Laufzeit, sonst Rate + Überführung ÷ Laufzeit.
- Bedingungen wie Loyalität, Eroberung, Werksabholung werden erkannt und im Alarm angezeigt.

## Abfragen und Bot-Schutz

Pro Lauf ca. 20 Seiten LeasingMarkt (je Modell 2 Seiten „Rate aufsteigend“ + 1 Seite „neueste“, dazu
Angebotsseiten nur für aussichtsreiche neue Angebote) und ca. 10 Seiten mydealz, mit 2,5–4 s Abstand. Nur Pfade,
die robots.txt erlaubt. Ehrlicher User-Agent. **Bot-Schutz wird nicht umgangen:** Antwortet eine Seite mit
Prüfseite/403/429, wird sie für diesen Lauf ausgelassen und auf der Website als „gesperrt“ angezeigt.

## Einrichtung

1. **Vercel**: Projekt ohne Git-Verknüpfung; deployt wird aus GitHub Actions (`deploy.yml`, Secrets `VERCEL_TOKEN`,
   `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`), nur bei Code-Änderungen. In Vercel `SITE_PASSWORD` und `DATEN_URL`
   (Rohdateien-Adresse des Ordners `data/` im Repository) setzen; nach einer Änderung einmal „Website deployen“ starten.
2. **Telegram** (kostenlos): @BotFather → `/newbot` → Token als Secret `TELEGRAM_BOT_TOKEN`. Dem Bot einmal
   `/start` schreiben – der nächste Lauf erkennt die Chat-ID, hält sie im Actions-Cache und schickt
   „Leasing-Radar ist verbunden“ mit der ID; diese als Secret `TELEGRAM_CHAT_ID` eintragen.
3. **Push ohne Telegram** (optional): App „ntfy“ installieren, ein langes zufälliges Thema abonnieren und als Secret
   `NTFY_TOPIC` eintragen.
4. **Mail** (optional): `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO`.
4. Variable `SITE_URL` (Adresse der Website) für den Link im Alarm.
5. Actions → „Leasing-Scan“ → Run workflow (Häkchen „Probelauf“ für einen Test ohne Meldungen).

## Lokal

```bash
npm install
npm test
npm run probe     # echter Lauf ohne Meldungen und ohne Schreiben
npm run scan      # kompletter Lauf
npm run dev       # http://localhost:3000
```

Optionen: `NUR=leasingmarkt|mydealz`, `MAX_DETAILS=25`, `MAX_DEALSEITEN=12`, `KEIN_ALARM=1`, `TROCKEN=1`.
