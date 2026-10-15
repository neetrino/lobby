import { Inter, Noto_Sans, Noto_Sans_Armenian, Nunito } from 'next/font/google';
import localFont from 'next/font/local';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

const display = localFont({
  src: '../fonts/MomoTrustDisplay-Regular.ttf',
  variable: '--font-display',
  weight: '400',
  display: 'swap',
});

const outfit = localFont({
  src: '../fonts/Outfit-VariableFont_wght.ttf',
  variable: '--font-outfit',
  weight: '100 900',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

const heading = Nunito({
  subsets: ['latin', 'cyrillic'],
  weight: ['700', '800'],
  variable: '--font-heading',
});

const sans = Noto_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const armenian = Noto_Sans_Armenian({
  subsets: ['armenian'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-armenian',
});

export const metadata: Metadata = {
  title: 'lobi',
  description: 'Multi-tenant CRM and task management',
  icons: {
    icon: '/favicon-pod-v3.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${outfit.variable} ${heading.variable} ${inter.variable} ${armenian.variable} ${sans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
