// Alarm: Top-Angebote sofort per Telegram (kostenlos, Push aufs Handy) und/oder E-Mail (Resend).
// Telegram: TELEGRAM_BOT_TOKEN genügt – die Chat-ID wird beim ersten Lauf aus der /start-Nachricht an den Bot
// gelesen und im Actions-Cache (.cache/telegram.json, nicht im Repository – das ist öffentlich) gehalten.
// Dauerhaft: TELEGRAM_CHAT_ID als Secret setzen (die Begrüßungsnachricht nennt die ID).
// Mail: RESEND_API_KEY, MAIL_FROM, MAIL_TO.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { modell } from '../data/watchlist';
import type { Deal, Posten } from './core/types';

const TG_DATEI = path.join(process.cwd(), '.cache', 'telegram.json');

/** Soll dieser Deal gemeldet werden? Neu „Top“, oder seit der letzten Meldung mindestens 5 % günstiger */
/** Ist das Angebot frisch gegen die Angebotsseite geprüft (gleiche Rate)? mydealz: Prüfung beim Lesen des Deals */
export function geprueft(d: Deal): boolean {
  return !!d.pruefung?.ok && d.pruefung.rate === d.rateBrutto;
}

export function sollMelden(d: Deal): boolean {
  if (d.status !== 'aktiv' || d.bewertung.stufe !== 'top' || !d.bewertung.ziel) return false;
  if (!geprueft(d)) return false;
  if (!d.gemeldet || d.gemeldetWert == null) return true;
  return d.bewertung.ziel.ist <= d.gemeldetWert * 0.95;
}

/** HTTP-Header dürfen nur ASCII enthalten: Umlaute/Emoji nach RFC 2047 kodieren */
const enc = (s: string) => `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const eur = (n: number | null | undefined, d = 0) => (n == null ? '–' : `${n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} €`);
const kundenText = { privat: 'Privat', gewerbe: 'Gewerbe', beide: 'Privat & Gewerbe' } as const;

const postenText = (name: string, p: Posten | undefined) => (p === undefined ? null : p === 'enthalten' ? `${name} enthalten` : p == null ? `${name} keine Angabe` : `${name} ${eur(p)}`);
const zustandHinweis = { gebraucht: '⚠️ Gebrauchtwagen – kein Neuwagen; Leasingfaktor bezieht sich auf den Neupreis', vorlauf: 'ℹ️ Vorführ-/Vorlauffahrzeug', neu: null, unbekannt: null } as const;

/** Meldungstext: alle Zahlen so, wie sie auf der Angebotsseite stehen (brutto), dazu Rechenweg */
export function zeile(d: Deal) {
  const b = d.bewertung;
  const z = b.ziel!;
  const k = d.kosten;
  const einmalTeile = k
    ? [postenText('Anzahlung', k.anzahlung ?? 0), postenText('Überführung', k.ueberfuehrung), postenText('Zulassung', k.zulassung)].filter(Boolean)
    : d.einmalBrutto != null
      ? [`${eur(d.einmalBrutto)}`]
      : d.effektivQuelle != null
        ? ['laut Deal im Effektivpreis enthalten']
        : ['unbekannt'];
  const umgelegt = d.einmalBrutto != null && d.laufzeit ? ` (= +${eur(d.einmalBrutto / d.laufzeit)}/Monat)` : '';
  const vertrag = [d.laufzeit ? `${d.laufzeit} Monate` : null, d.kmJahr ? `${d.kmJahr.toLocaleString('de-DE')} km/Jahr` : null, d.verfuegbarkeit ? `verfügbar: ${d.verfuegbarkeit}` : null].filter(Boolean).join(' · ');
  const ort = [d.ort ? `📍 Händler: ${d.ort}` : null, k?.lieferungOptional ? `Lieferung optional +${eur(k.lieferungOptional)}` : null].filter(Boolean).join(' · ');
  return {
    kopf: `${modell(d.modell).name}: ${eur(b.effBrutto)} effektiv/Monat`,
    titel: d.titel,
    details: [
      `Rate ${eur(d.rateBrutto, 2)} inkl. MwSt. · ${vertrag}`,
      `Einmalig: ${einmalTeile.join(' · ')}${umgelegt}`,
      d.kunden === 'beide' ? `Privat & Gewerbe (netto effektiv ${eur(b.effNetto)})` : d.kunden === 'privat' ? 'Nur Privatkunden' : 'Nur Gewerbekunden',
    ].join('\n'),
    ziel: `Ziel ${z.gruppe}: ${eur(z.wert)} → ${Math.round((1 - z.ist / z.wert) * 100)} % darunter`,
    zustand: zustandHinweis[d.zustand],
    ort: ort || null,
    bedingungen: d.bedingungen.length ? `⚠️ ${d.bedingungen.join(', ')}` : null,
    quelle: d.quelle === 'mydealz' ? `mydealz${d.haendler ? ` (${d.haendler})` : ''}` : 'LeasingMarkt',
  };
}

export function telegramText(d: Deal, siteUrl?: string) {
  const z = zeile(d);
  return [
    `🔥 <b>${esc(z.kopf)}</b>`,
    esc(z.titel),
    esc(z.details),
    z.zustand ? esc(z.zustand) : null,
    z.ort ? esc(z.ort) : null,
    `✅ ${esc(z.ziel)}`,
    z.bedingungen ? esc(z.bedingungen) : null,
    `<a href="${esc(d.url)}">Zum Angebot bei ${esc(z.quelle)}</a>${siteUrl ? ` · <a href="${esc(siteUrl)}">Radar</a>` : ''}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function tgApi<T>(token: string, methode: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${methode}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!j.ok) throw new Error(`Telegram ${methode}: ${j.description ?? res.status}`);
  return j.result as T;
}

let letzteDiagnose = '';

/** Chat-ID: Umgebungsvariable, gespeicherte Datei oder die letzte /start-Nachricht an den Bot */
async function chatId(token: string, log: (m: string) => void): Promise<{ id: string; neu: boolean } | null> {
  if (process.env.TELEGRAM_CHAT_ID) return { id: process.env.TELEGRAM_CHAT_ID, neu: false };
  if (existsSync(TG_DATEI)) {
    try {
      const j = JSON.parse(readFileSync(TG_DATEI, 'utf8')) as { chatId?: string };
      if (j.chatId) return { id: j.chatId, neu: false };
    } catch {
      /* neu ermitteln */
    }
  }
  // Ein gesetzter Webhook blockiert getUpdates – dann entfernen (der Radar braucht keinen)
  const hook = await tgApi<{ url?: string }>(token, 'getWebhookInfo');
  if (hook.url) {
    log('Telegram: Webhook gesetzt – wird entfernt, damit /start gelesen werden kann');
    await tgApi(token, 'deleteWebhook');
  }
  const updates = await tgApi<{ message?: { chat: { id: number; type: string } } }[]>(token, 'getUpdates');
  letzteDiagnose = `Bot-ID …${token.split(':')[0].slice(-4)}, ${updates.length} ungelesene Nachrichten${hook.url ? ', Webhook entfernt' : ''}`;
  const privat = updates
    .map((u) => u.message?.chat)
    .filter((c): c is { id: number; type: string } => !!c && c.type === 'private')
    .pop();
  if (!privat) {
    log('Telegram: noch keine Chat-ID – bitte dem Bot einmal /start schreiben');
    return null;
  }
  mkdirSync(path.dirname(TG_DATEI), { recursive: true });
  writeFileSync(TG_DATEI, `${JSON.stringify({ chatId: String(privat.id), seit: new Date().toISOString() }, null, 2)}\n`);
  return { id: String(privat.id), neu: true };
}

export interface MeldeErgebnis {
  telegram: 'ok' | 'aus' | 'kein-chat' | 'fehler';
  diagnose?: string;
  mail: 'ok' | 'aus' | 'fehler';
  push: 'ok' | 'aus' | 'fehler';
  gemeldet: string[];
}

/** Frühere Meldung, die nach neuen Informationen nicht mehr „Top“ ist und noch nicht korrigiert wurde */
export function sollKorrigieren(d: Deal): boolean {
  // Nicht korrigieren, wenn ein Angebot nur wegen der Kundengruppe herausfällt (keine falsche Rechnung)
  return !!d.gemeldet && !d.korrigiert && d.status === 'aktiv' && d.bewertung.stufe !== 'top' && !/\(nur (Gewerbe|Privat)\)/.test(d.bewertung.grund);
}

export function korrekturText(deals: Deal[]) {
  const zeilen = deals.map((d) => {
    const z = d.bewertung.ziel;
    const neu = z ? `${Math.round(z.ist)} € ${z.basis}` : 'unbekannt';
    const grund = d.pruefung && !d.pruefung.ok ? `Prüfung: ${d.pruefung.hinweis}` : d.bewertung.geschaetzt ? 'Überführung nicht angegeben, mit 1.300 € geschätzt' : 'Konditionen geändert';
    return `• ${modell(d.modell).name}: gemeldet ${Math.round(d.gemeldetWert ?? 0)} € → richtig ca. ${neu} effektiv (${grund})${z ? `, Ziel ${z.wert} €` : ''}\n  ${d.url}`;
  });
  return `Diese ${deals.length === 1 ? 'Meldung war' : `${deals.length} Meldungen waren`} zu günstig berechnet und ${deals.length === 1 ? 'ist' : 'sind'} kein Top-Angebot:\n\n${zeilen.join('\n')}`;
}

/** Korrektur zu früheren Meldungen über dieselben Kanäle (eine Sammelnachricht) */
export async function meldeKorrektur(deals: Deal[], log: (m: string) => void): Promise<boolean> {
  const text = korrekturText(deals);
  const titel = `⚠️ Korrektur: ${deals.length} frühere Meldung${deals.length === 1 ? '' : 'en'}`;
  let ok = false;
  if (process.env.NTFY_TOPIC) {
    try {
      const res = await fetch(`https://ntfy.sh/${encodeURIComponent(process.env.NTFY_TOPIC)}`, {
        method: 'POST',
        headers: { Title: enc(titel), Tags: 'warning', Priority: '3' },
        body: text,
        signal: AbortSignal.timeout(15_000),
      });
      ok = ok || res.ok;
    } catch (e) {
      log(`Korrektur per Push fehlgeschlagen: ${(e as Error).message}`);
    }
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      const chat = await chatId(token, log);
      if (chat) {
        await tgApi(token, 'sendMessage', { chat_id: chat.id, text: `${titel}\n\n${text}`, disable_web_page_preview: true });
        ok = true;
      }
    } catch (e) {
      log(`Korrektur per Telegram fehlgeschlagen: ${(e as Error).message}`);
    }
  }
  return ok;
}

export async function melde(deals: Deal[], log: (m: string) => void, opts: { maxEinzeln?: number } = {}): Promise<MeldeErgebnis> {
  const siteUrl = process.env.SITE_URL || undefined;
  const sortiert = [...deals].sort((a, b) => a.bewertung.ziel!.ist / a.bewertung.ziel!.wert - b.bewertung.ziel!.ist / b.bewertung.ziel!.wert);
  const erg: MeldeErgebnis = { telegram: 'aus', mail: 'aus', push: 'aus', gemeldet: [] };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      const chat = await chatId(token, log);
      if (chat) {
        if (chat.neu) await tgApi(token, 'sendMessage', { chat_id: chat.id, text: `✅ Leasing-Radar ist verbunden. Top-Angebote kommen ab jetzt hier an.\n\nDeine Chat-ID: ${chat.id}\nTrag sie bei GitHub als Secret TELEGRAM_CHAT_ID ein, dann bleibt die Verbindung dauerhaft bestehen.` });
        const max = opts.maxEinzeln ?? 8;
        for (const d of sortiert.slice(0, max)) {
          await tgApi(token, 'sendMessage', { chat_id: chat.id, text: telegramText(d, siteUrl), parse_mode: 'HTML', disable_web_page_preview: true });
          await new Promise((r) => setTimeout(r, 400));
        }
        if (sortiert.length > max) {
          await tgApi(token, 'sendMessage', { chat_id: chat.id, text: `… und ${sortiert.length - max} weitere Top-Angebote${siteUrl ? `: ${siteUrl}` : ''}` });
        }
        erg.telegram = 'ok';
      } else {
        erg.telegram = 'kein-chat';
        erg.diagnose = letzteDiagnose;
      }
    } catch (e) {
      erg.telegram = 'fehler';
      log(`Telegram-Fehler: ${(e as Error).message}`);
    }
  }

  // ntfy.sh: kostenlose Push-Nachrichten aufs Handy (App „ntfy“, Thema abonnieren), kein Konto nötig.
  // NTFY_TOPIC ist zugleich das Passwort – lang und zufällig wählen.
  const topic = process.env.NTFY_TOPIC;
  if (topic) {
    try {
      for (const d of sortiert.slice(0, opts.maxEinzeln ?? 8)) {
        const z = zeile(d);
        const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
          method: 'POST',
          headers: { Title: enc(`🔥 ${z.kopf}`), Click: d.url, Tags: 'car', Priority: '4' },
          body: [z.titel, z.details, z.zustand, z.ort, z.ziel, z.bedingungen].filter(Boolean).join('\n'),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
      }
      erg.push = 'ok';
    } catch (e) {
      erg.push = 'fehler';
      log(`Push-Fehler: ${(e as Error).message}`);
    }
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  const to = process.env.MAIL_TO;
  if (key && from && to && sortiert.length) {
    try {
      const html = mailHtml(sortiert, siteUrl);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to: to.split(',').map((s) => s.trim()),
          subject: `🔥 ${sortiert.length === 1 ? zeile(sortiert[0]).kopf : `${sortiert.length} Top-Leasingangebote`}`,
          html,
          text: sortiert.map((d) => `${zeile(d).kopf}\n${d.titel}\n${d.url}`).join('\n\n'),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      erg.mail = res.ok ? 'ok' : 'fehler';
      if (!res.ok) log(`Mail-Fehler: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    } catch (e) {
      erg.mail = 'fehler';
      log(`Mail-Fehler: ${(e as Error).message}`);
    }
  }

  // Als gemeldet gilt, was über mindestens einen Kanal rausging (sonst im nächsten Lauf erneut versuchen)
  if (erg.telegram === 'ok' || erg.mail === 'ok' || erg.push === 'ok') erg.gemeldet = sortiert.map((d) => d.id);
  return erg;
}

function mailHtml(deals: Deal[], siteUrl?: string) {
  const karten = deals
    .map((d) => {
      const z = zeile(d);
      return `<div style="border:1px solid #e5e5ea;border-radius:12px;padding:14px 16px;margin:0 0 12px">
<div style="font-size:17px;font-weight:700;color:#0b6b3a">${esc(z.kopf)}</div>
<div style="margin:4px 0 6px">${esc(z.titel)}</div>
<div style="color:#555;font-size:13px;white-space:pre-line">${esc(z.details)}</div>
${z.zustand ? `<div style="font-size:13px;color:#b45309;margin-top:4px">${esc(z.zustand)}</div>` : ''}
${z.ort ? `<div style="font-size:13px;margin-top:4px">${esc(z.ort)}</div>` : ''}
<div style="font-size:13px;margin-top:6px">${esc(z.ziel)}</div>
${z.bedingungen ? `<div style="font-size:13px;color:#b45309;margin-top:4px">${esc(z.bedingungen)}</div>` : ''}
<div style="margin-top:8px"><a href="${esc(d.url)}">Zum Angebot bei ${esc(z.quelle)}</a></div></div>`;
    })
    .join('');
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px">${karten}${siteUrl ? `<p><a href="${esc(siteUrl)}">Alle Angebote im Leasing-Radar</a></p>` : ''}<p style="color:#888;font-size:12px">Effektiv = Rate + Einmalkosten (Überführung, Zulassung, Anzahlung) auf die Laufzeit umgelegt. Konditionen beim Anbieter prüfen.</p></div>`;
}
