export const metadata = { title: 'Anmelden · Leasing-Radar' };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <main className="login">
      <form method="post" action="/api/login" className="login-card">
        <img src="/icon.svg" alt="" width={80} height={80} />
        <h1>Leasing-Radar</h1>
        <p>Top-Leasingangebote, sofort gemeldet</p>
        <input type="hidden" name="next" value={next ?? '/'} />
        <input type="password" name="password" required autoFocus autoComplete="current-password" placeholder="Passwort" aria-label="Passwort" />
        {error === '1' && <p className="error">Das Passwort stimmt nicht.</p>}
        {error === 'config' && <p className="error">SITE_PASSWORD ist in Vercel nicht gesetzt.</p>}
        <button className="btn primary" type="submit">
          Anmelden
        </button>
      </form>
    </main>
  );
}
