import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GKF_TOP, MODELLE } from '@/data/watchlist';
import type { Deal, Stand } from '@/lib/core/types';
import Uebersicht from './uebersicht';

// Die Daten kommen aus dem letzten Lauf (data/*.json im Repository); jeder Commit baut die Seite neu.
export const dynamic = 'force-static';

function lies<T>(datei: string, leer: T): T {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), 'data', datei), 'utf8')) as T;
  } catch {
    return leer;
  }
}

export default function Seite() {
  const deals = lies<Deal[]>('deals.json', []);
  const stand = lies<Stand | null>('stand.json', null);
  const ziele = MODELLE.map((m) => ({ id: m.id, name: m.name, privat: m.ziel.privat, gewerbe: m.ziel.gewerbe }));
  return <Uebersicht deals={deals} stand={stand} ziele={ziele} gkfTop={GKF_TOP} />;
}
