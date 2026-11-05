import './globals.css';

export const metadata = {
  title: 'Leasing-Radar',
  description: 'Leasing-Schnäppchen für Golf GTI, Cupra Leon, BMW 1er und Audi A3 von mydealz und LeasingMarkt',
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0e3b2e' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
