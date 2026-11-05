'use client';

import { useMemo, useState } from 'react';
import type { Deal, ModellId, Stand } from '@/lib/core/types';

type Ziel = { id: ModellId; name: string; privat: number; gewerbe: number };
type Sortierung = 'ziel' | 'effektiv' | 'gkf' | 'neu';
type Gruppe = 'alle' | 'privat' | 'gewerbe';

const eur = (n: number | null | undefined, d = 0) => (n == null ? '–' : `${n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} €`);
const datum = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }) : '–';
const kundenText = { privat: 'Privat', gewerbe: 'Gewerbe', beide: 'Privat & Gewerbe' } as const;
const zustandText = { neu: 'Neuwagen', vorlauf: 'Vorlauf/Vorführer', gebraucht: 'Gebraucht', unbekannt: '' } as const;

export default function Uebersicht({ deals, stand, ziele, gkfTop }: { deals: Deal[]; stand: Stand | null; ziele: Ziel[]; gkfTop: number }) {
  const [modelle, setModelle] = useState<Set<ModellId>>(new Set());
  const [gruppe, setGruppe] = useState<Gruppe>('alle');
  const [nurTop, setNurTop] = useState(false);
  const [nurNeu, setNurNeu] = useState(false);
  const [inaktiv, setInaktiv] = useState(false);
  const [sort, setSort] = useState<Sortierung>('ziel');

  const liste = useMemo(() => {
    const f = deals.filter((d) => {
      if (!inaktiv && d.status !== 'aktiv') return false;
      if (modelle.size && !modelle.has(d.modell)) return false;
      if (gruppe === 'privat' && d.kunden === 'gewerbe') return false;
      if (gruppe === 'gewerbe' && d.kunden === 'privat') return false;
      if (nurTop && d.bewertung.stufe !== 'top') return false;
      if (nurNeu && d.zustand === 'gebraucht') return false;
      return true;
    });
    const quote = (d: Deal) => (d.bewertung.ziel ? d.bewertung.ziel.ist / d.bewertung.ziel.wert : 99);
    const by: Record<Sortierung, (a: Deal, b: Deal) => number> = {
      ziel: (a, b) => quote(a) - quote(b),
      effektiv: (a, b) => (a.bewertung.effBrutto ?? 1e9) - (b.bewertung.effBrutto ?? 1e9),
      gkf: (a, b) => (a.bewertung.gkf ?? 99) - (b.bewertung.gkf ?? 99),
      neu: (a, b) => b.erstGesehen.localeCompare(a.erstGesehen),
    };
    return f.sort(by[sort]);
  }, [deals, modelle, gruppe, nurTop, nurNeu, inaktiv, sort]);

  const anzahlTop = deals.filter((d) => d.status === 'aktiv' && d.bewertung.stufe === 'top').length;
  const toggle = (id: ModellId) =>
    setModelle((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <header className="kopf">
        <div className="kopf-inner">
          <div className="marke">
            <img src="/icon.svg" alt="" width={36} height={36} />
            <span>Leasing-Radar</span>
          </div>
          <form method="post" action="/api/logout">
            <button className="link-hell" type="submit">
              Abmelden
            </button>
          </form>
        </div>
        <div className="kopf-inner kopf-info">
          <div>
            <strong>{anzahlTop}</strong> Top-Angebote aktiv · {deals.filter((d) => d.status === 'aktiv').length} beobachtet
          </div>
          <div className="quellen">
            Letzter Lauf {datum(stand?.lauf)}
            {stand &&
              (['leasingmarkt', 'mydealz'] as const).map((q) => {
                const s = stand.quellen[q];
                const cls = s.gesperrt ? 'warn' : s.ok ? 'ok' : 'aus';
                return (
                  <span key={q} className={`quelle ${cls}`} title={s.fehler.join('\n')}>
                    {q === 'leasingmarkt' ? 'LeasingMarkt' : 'mydealz'} {s.gesperrt ? 'gesperrt' : s.ok ? `✓ ${s.angebote}` : '–'}
                  </span>
                );
              })}
          </div>
        </div>
      </header>

      <main className="seite">
        {stand?.hinweise.length ? (
          <div className="hinweis">
            {stand.hinweise.map((h) => (
              <p key={h}>{h}</p>
            ))}
          </div>
        ) : null}

        <section className="filter" aria-label="Filter">
          <div className="chips">
            {ziele.map((z) => (
              <button key={z.id} className={`chip ${modelle.has(z.id) ? 'an' : ''}`} onClick={() => toggle(z.id)} type="button">
                {z.name}
              </button>
            ))}
          </div>
          <div className="filter-zeile">
            <div className="segment" role="group" aria-label="Kundengruppe">
              {(['alle', 'privat', 'gewerbe'] as const).map((g) => (
                <button key={g} className={gruppe === g ? 'an' : ''} onClick={() => setGruppe(g)} type="button">
                  {g === 'alle' ? 'Alle' : g === 'privat' ? 'Privat' : 'Gewerbe'}
                </button>
              ))}
            </div>
            <label className="schalter">
              <input type="checkbox" checked={nurTop} onChange={(e) => setNurTop(e.target.checked)} /> Nur Top
            </label>
            <label className="schalter">
              <input type="checkbox" checked={nurNeu} onChange={(e) => setNurNeu(e.target.checked)} /> Keine Gebrauchten
            </label>
            <label className="schalter">
              <input type="checkbox" checked={inaktiv} onChange={(e) => setInaktiv(e.target.checked)} /> Abgelaufene zeigen
            </label>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sortierung)} aria-label="Sortierung">
              <option value="ziel">Bester im Verhältnis zum Ziel</option>
              <option value="effektiv">Effektivrate aufsteigend</option>
              <option value="gkf">Gesamtkostenfaktor</option>
              <option value="neu">Neueste zuerst</option>
            </select>
          </div>
        </section>

        <p className="treffer">{liste.length} Angebote</p>
        <div className="karten">
          {liste.map((d) => (
            <Karte key={d.id} d={d} name={ziele.find((z) => z.id === d.modell)?.name ?? d.modell} />
          ))}
          {!liste.length && <p className="leer">Keine Angebote für diese Auswahl. {deals.length ? '' : 'Der erste Lauf steht noch aus.'}</p>}
        </div>

        <section className="erklaerung">
          <h2>Zielwerte und Rechenweg</h2>
          <table>
            <thead>
              <tr>
                <th>Modell</th>
                <th>Privat (brutto)</th>
                <th>Gewerbe (netto)</th>
              </tr>
            </thead>
            <tbody>
              {ziele.map((z) => (
                <tr key={z.id}>
                  <td>{z.name}</td>
                  <td>≤ {eur(z.privat)}</td>
                  <td>≤ {eur(z.gewerbe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <strong>Effektiv</strong> = Monatsrate + (Überführung + Zulassung + Anzahlung) ÷ Laufzeit. <strong>Top</strong> = effektiv auf oder unter dem Zielwert,
            oder Gesamtkostenfaktor (effektiv brutto ÷ Listenpreis × 100) ≤ {gkfTop.toFixed(2)}. <strong>Gut</strong> = bis 10 % über dem Ziel. Fehlen die Einmalkosten,
            rechnet der Radar vorsichtig mit 1.300 € und markiert den Wert als geschätzt; solche Angebote werden nicht als Top gemeldet.
          </p>
          <p>
            Top-Angebote gehen sofort per Telegram/E-Mail raus; dasselbe Angebot erneut erst, wenn es mindestens 5 % günstiger wird. Daten: LeasingMarkt-Modellseiten
            (günstigste und neueste Angebote) und der mydealz-Feed „Auto-Leasing“, stündlich 7–23 Uhr. Konditionen immer beim Anbieter prüfen.
          </p>
        </section>
      </main>
    </>
  );
}

function Karte({ d, name }: { d: Deal; name: string }) {
  const b = d.bewertung;
  const z = b.ziel;
  const unter = z ? Math.round((1 - z.ist / z.wert) * 100) : null;
  return (
    <article className={`karte stufe-${b.stufe} ${d.status !== 'aktiv' ? 'inaktiv' : ''}`}>
      <div className="karte-kopf">
        <span className="modell">{name}</span>
        {b.stufe !== 'normal' && <span className={`badge ${b.stufe}`}>{b.stufe === 'top' ? 'Top' : 'Gut'}</span>}
        {d.status !== 'aktiv' && <span className="badge grau">{d.status === 'abgelaufen' ? 'abgelaufen' : 'nicht mehr online'}</span>}
        <span className="quelle-name">{d.quelle === 'mydealz' ? 'mydealz' : 'LeasingMarkt'}</span>
      </div>
      <h3>
        <a href={d.url} target="_blank" rel="noopener noreferrer">
          {d.titel}
        </a>
      </h3>
      <div className="preis">
        <div>
          <span className="gross">{eur(z?.ist ?? b.effBrutto)}</span>
          <span className="klein">
            {z?.basis ?? 'brutto'} effektiv{b.geschaetzt ? ' (geschätzt)' : ''}
          </span>
        </div>
        {z && (
          <div className={`ziel ${unter != null && unter >= 0 ? 'drunter' : ''}`}>
            Ziel {z.gruppe} {eur(z.wert)}
            <br />
            {unter != null && (unter >= 0 ? `${unter} % darunter` : `${-unter} % darüber`)}
          </div>
        )}
      </div>
      <dl className="fakten">
        <div>
          <dt>Rate</dt>
          <dd>
            {eur(d.rateBrutto, 2)} <small>brutto</small> · {eur(d.rateNetto, 2)} <small>netto</small>
          </dd>
        </div>
        <div>
          <dt>Einmalig</dt>
          <dd>{d.einmalBrutto != null ? eur(d.einmalBrutto) : d.effektivQuelle != null ? 'in Effektivrate enthalten' : 'unbekannt'}</dd>
        </div>
        <div>
          <dt>Vertrag</dt>
          <dd>
            {d.laufzeit ? `${d.laufzeit} Monate` : '–'} · {d.kmJahr ? `${d.kmJahr.toLocaleString('de-DE')} km/Jahr` : '– km'}
          </dd>
        </div>
        <div>
          <dt>Faktoren</dt>
          <dd>
            GKF {b.gkf?.toFixed(2) ?? '–'} · LF {d.lf?.toFixed(2) ?? '–'}
          </dd>
        </div>
      </dl>
      <div className="tags">
        <span>{kundenText[d.kunden]}</span>
        {zustandText[d.zustand] && <span>{zustandText[d.zustand]}</span>}
        {d.ps && <span>{d.ps} PS</span>}
        {d.verfuegbarkeit && <span>verfügbar: {d.verfuegbarkeit}</span>}
        {d.listenpreis && <span>BLP {eur(d.listenpreis)}</span>}
        {d.temperatur != null && <span>{d.temperatur}°</span>}
        {d.haendler && d.quelle === 'mydealz' && <span>{d.haendler}</span>}
      </div>
      {d.bedingungen.length > 0 && <p className="bedingung">⚠️ {d.bedingungen.join(' · ')}</p>}
      <p className="fuss">
        Gefunden {datum(d.erstGesehen)}
        {d.gemeldet ? ` · gemeldet ${datum(d.gemeldet)}` : ''}
        {d.verlauf.filter((v) => v.feld === 'preis').length ? ` · Preis geändert: ${d.verlauf.filter((v) => v.feld === 'preis').at(-1)?.alt} → ${d.verlauf.filter((v) => v.feld === 'preis').at(-1)?.neu}` : ''}
      </p>
    </article>
  );
}
