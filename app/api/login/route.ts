import { NextResponse } from 'next/server';
import { AUTH_COOKIE, AUTH_MAX_AGE, safeEqual, sessionToken } from '@/lib/auth';

export const runtime = 'nodejs';

const safeNext = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/');

export async function POST(req: Request) {
  const form = await req.formData();
  const pw = process.env.SITE_PASSWORD;
  const given = String(form.get('password') ?? '');
  const next = safeNext(form.get('next'));
  const base = new URL(req.url);
  if (!pw) return NextResponse.redirect(new URL('/login?error=config', base), 303);
  const ok = safeEqual(await sessionToken(given), await sessionToken(pw));
  if (!ok) {
    // Bremst Durchprobieren von Passwörtern
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.redirect(new URL(`/login?error=1${next !== '/' ? `&next=${encodeURIComponent(next)}` : ''}`, base), 303);
  }
  const res = NextResponse.redirect(new URL(next, base), 303);
  res.cookies.set(AUTH_COOKIE, await sessionToken(pw), {
    httpOnly: true,
    secure: base.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
