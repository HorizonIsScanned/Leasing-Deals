// Passwortschutz der Website. Das Passwort steht nur in der Umgebungsvariable SITE_PASSWORD (in Vercel setzen).
// Das Cookie enthält einen Hash, nicht das Passwort; ändert sich das Passwort, sind alle Sitzungen ungültig.
// Läuft in der Middleware (Edge) und in Route-Handlern (Node), daher nur Web Crypto.

export const AUTH_COOKIE = 'leasing_session';
export const AUTH_MAX_AGE = 30 * 86_400;

export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`leasing-radar:v1:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Vergleich ohne frühen Abbruch (Zeitverhalten unabhängig vom Inhalt) */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
