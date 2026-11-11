import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GKF_TOP, MODELLE } from '@/data/watchlist';
import type { Deal, Stand } from '@/lib/core/types';
import Uebersicht from './uebersicht';

// Die Daten werden beim Aufruf gelesen, nicht beim Bauen: DATEN_URL zeigt auf den Ordner data/ im Repository
// (Rohdateien). Vercel hält das Ergebnis 5 Minuten im Cache, danach wird beim nächsten Aufruf neu geladen.
// Ein neuer Build ist dadurch nur bei Code-Änderungen nötig. Ohne DATEN_URL oder bei Fehlern: Daten aus dem Build.
export const revalidate = 300;

const CACHE_SEK = 300;

async function lade<T>(datei: string, leer: T): Promise<T> {
  const basis = process.env.DATEN_URL?.replace(/\/$/, '');
  if (basis) {
    try {
      const res = await fetch(`${basis}/${datei}`, { next: { revalidate: CACHE_SEK }, signal: AbortSignal.timeout(8000) });
      if (res.ok) return (await res.json()) as T;
      console.warn(`Daten ${datei}: HTTP ${res.status}, nutze Stand aus dem Build`);
    } catch (e) {
      console.warn(`Daten ${datei} nicht ladbar (${(e as Error).message}), nutze Stand aus dem Build`);
    }
  }
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), 'data', datei), 'utf8')) as T;
  } catch {
    return leer;
  }
}

export default async function Seite() {
  const [deals, stand] = await Promise.all([lade<Deal[]>('deals.json', []), lade<Stand | null>('stand.json', null)]);
  const ziele = MODELLE.map((m) => ({ id: m.id, name: m.name, privat: m.ziel.privat, gewerbe: m.ziel.gewerbe }));
  return <Uebersicht deals={deals} stand={stand} ziele={ziele} gkfTop={GKF_TOP} />;
}
