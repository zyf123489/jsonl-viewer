import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DEFAULT_THEME, themeInitializationScript } from './theme';
import { readingInitializationScript } from './readingPreferences';
import { DEFAULT_LANGUAGE, languageInitializationScript } from './language';

export const metadata: Metadata = {
  title: 'JSONL Viewer',
  description: 'A high-performance JSONL file viewer for logs',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'JSONL Viewer',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={DEFAULT_LANGUAGE} data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
        <script dangerouslySetInnerHTML={{ __html: readingInitializationScript }} />
        <script dangerouslySetInnerHTML={{ __html: languageInitializationScript }} />
        <link rel="icon" href="/icon-192x192.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
