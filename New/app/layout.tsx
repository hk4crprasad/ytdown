import type {Metadata} from 'next';
import { Space_Grotesk, Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'YTApi | Media Extractor',
  description: 'Pro-grade YouTube media extraction for the modern web.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} dark`}>
      <body className="antialiased font-sans bg-background text-foreground" suppressHydrationWarning>
        {children}
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
