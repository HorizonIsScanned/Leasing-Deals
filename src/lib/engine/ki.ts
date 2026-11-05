// Optional (ANTHROPIC_API_KEY): fehlende Kennzahlen eines mydealz-Deals aus Titel und Beschreibung lesen,
// wenn die Regeln nichts finden. Die KI ergänzt nur Lücken und überschreibt keine gelesenen Werte.

import type { TitelDaten } from '../adapters/mydealz';

const MODELL = process.env.KI_MODELL || 'claude-haiku-5-5';

export async function kiErgaenze(titel: string, text: string): Promise<Partial<TitelDaten> | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const prompt = `Lies aus diesem deutschen Leasing-Deal die Konditionen. Antworte NUR mit JSON:
{"kunden":"privat"|"gewerbe"|"beide"|null,"netto":true|false,"rate":Zahl|null,"effektiv":Zahl|null,"laufzeit":Monate|null,"kmJahr":Zahl|null,"ueberfuehrung":Zahl|null,"listenpreis":Zahl|null,"ps":Zahl|null}
rate = monatliche Leasingrate, effektiv = Effektivrate inkl. Überführung (nur wenn genannt), netto = true wenn die Beträge netto sind. Unbekanntes = null.

Titel: ${titel}
Text: ${text.slice(0, 3500)}`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { content?: { type: string; text?: string }[] };
    const t = j.content?.find((c) => c.type === 'text')?.text ?? '';
    const m = t.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as Partial<TitelDaten>) : null;
  } catch {
    return null;
  }
}
