import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, safeEqual, sessionToken } from '@/lib/auth';

// Alle Seiten und APIs außer der Anmeldung sind passwortgeschützt. Ohne SITE_PASSWORD bleibt alles gesperrt.
export async function middleware(req: NextRequest) {
  const pw = process.env.SITE_PASSWORD;
  const isApi = req.nextUrl.pathname.startsWith('/api/');
  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? '';
  if (pw && cookie && safeEqual(cookie, await sessionToken(pw))) return NextResponse.next();
  if (isApi) return NextResponse.json({ error: pw ? 'Nicht angemeldet' : 'SITE_PASSWORD ist nicht gesetzt' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = req.nextUrl.pathname === '/' ? '' : `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|api/login|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};
