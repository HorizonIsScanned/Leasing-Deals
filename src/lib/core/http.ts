// HTTP-Schicht für den Lauf: Mindestabstand je Host mit etwas
// Zufall, eine Abfrage nach der anderen, wenige Wiederholungen. Erkennt Bot-Schutz (Cloudflare-Prüfseite, 403, 429)
// und meldet ihn als Sperre – es wird nichts umgangen, die Quelle wird für diesen Lauf ausgelassen.

export const UA = 'Mozilla/5.0 (compatible; Leasing-Radar/0.1; private Nutzung, wenige Abfragen pro Stunde)';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ABSTAND_MS: Record<string, number> = {
  'www.leasingmarkt.de': 2500,
  'www.mydealz.de': 3000,
  'api.telegram.org': 300,
  'api.resend.com': 300,
  'api.anthropic.com': 500,
};

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    snippet: string,
  ) {
    super(`HTTP ${status} für ${url}: ${snippet.slice(0, 160)}`);
  }
}

/** Die Seite verlangt eine Browser-Prüfung oder hat die Abfrage abgelehnt */
export class GesperrtError extends Error {
  constructor(
    public host: string,
    grund: string,
  ) {
    super(`${host} blockt automatische Abfragen (${grund})`);
  }
}

export function istSperrseite(status: number, body: string, headers: Headers): string | null {
  if (status === 429) return 'HTTP 429 – zu viele Anfragen';
  const cf = headers.get('cf-mitigated') === 'challenge' || /<title>\s*Just a moment|challenge-platform|cf-chl-|Attention Required!/i.test(body.slice(0, 20_000));
  if (cf) return 'Cloudflare-Prüfseite';
  if (status === 403) return 'HTTP 403';
  return null;
}

export class Http {
  private last = new Map<string, number>();
  readonly abfragen: Record<string, number> = {};

  constructor(private log: (m: string) => void = () => {}) {}

  private async warte(host: string) {
    const abstand = ABSTAND_MS[host] ?? 1000;
    const w = (this.last.get(host) ?? 0) + abstand + Math.random() * 1000 - Date.now();
    if (w > 0) await sleep(w);
    this.last.set(host, Date.now());
    this.abfragen[host] = (this.abfragen[host] ?? 0) + 1;
  }

  async text(url: string, o: { timeoutMs?: number; accept?: string } = {}): Promise<{ status: number; body: string }> {
    const host = new URL(url).host;
    for (let versuch = 1; ; versuch++) {
      await this.warte(host);
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': UA, 'accept-language': 'de-DE,de;q=0.9', accept: o.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
          redirect: 'follow',
          signal: AbortSignal.timeout(o.timeoutMs ?? 45_000),
        });
        const body = await res.text();
        const sperre = istSperrseite(res.status, body, res.headers);
        if (sperre) throw new GesperrtError(host, sperre);
        if (res.status === 404 || res.status === 410) return { status: res.status, body };
        if (res.status >= 400) throw new HttpError(res.status, url, body);
        return { status: res.status, body };
      } catch (e) {
        if (e instanceof GesperrtError) throw e;
        const nochmal = !(e instanceof HttpError) || [500, 502, 503, 504].includes(e.status);
        if (nochmal && versuch < 3) {
          this.log(`Fehler ${host} (Versuch ${versuch}): ${String((e as Error).message ?? e).slice(0, 160)}`);
          await sleep(4000 * versuch);
          continue;
        }
        throw e;
      }
    }
  }
}

/** „1.590,00 €“, „5.976€“, „345,25“, „0,58“ → Zahl */
export function zahl(s: string | null | undefined): number | null {
  if (s == null) return null;
  let t = String(s).replace(/[^\d,.\-]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
