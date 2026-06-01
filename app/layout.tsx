// app/layout.tsx
import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingButtons from '@/components/FloatingButtons';
import { AuthProvider } from '@/lib/AuthContext';
import { Toaster } from 'react-hot-toast';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display-next',
  display: 'swap',
  weight: ['400', '600', '700', '900'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body-next',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-next',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: {
    default: 'Igbobuigbo — Igbo Business Union International',
    template: '%s | Igbobuigbo',
  },
  description:
    'Igbo Business Union International (IBI) — Connecting Igbo entrepreneurs, traders, and professionals across Nigeria and the diaspora.',
  keywords: ['Igbo', 'business', 'union', 'Nigeria', 'entrepreneurs', 'IBI', 'Igbobuigbo'],
  authors: [{ name: 'Igbobuigbo', url: 'https://igbobuigbo.org.ng' }],
  openGraph: {
    title: 'Igbobuigbo — Igbo Business Union International',
    description: 'Connecting Igbo entrepreneurs, traders, and professionals worldwide.',
    url: 'https://igbobuigbo.org.ng',
    siteName: 'Igbobuigbo',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Igbobuigbo — Igbo Business Union International',
    description: 'Connecting Igbo entrepreneurs, traders, and professionals worldwide.',
    images: ['/og-image.jpg'],
  },
  robots: { index: true, follow: true },
  metadataBase: new URL('https://igbobuigbo.org.ng'),
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${jetbrains.variable}`}
    >
      <body>
        <AuthProvider>
          <Navbar />
          <main id="main-content" style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </main>
          <Footer />
          <FloatingButtons />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-gold)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.9rem',
              },
              success: {
                iconTheme: { primary: 'var(--ibi-gold)', secondary: 'var(--bg-primary)' },
              },
              error: {
                iconTheme: { primary: 'var(--ibi-red)', secondary: '#fff' },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
