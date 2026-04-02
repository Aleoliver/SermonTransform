import type {Metadata} from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'SermonTransform AI - De Pregação a Conteúdo Edificante',
  description: 'Transforme suas pregações em estudos, devocionais e muito mais.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${outfit.variable} dark`}>
      <body suppressHydrationWarning className="bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
        {children}
      </body>
    </html>
  );
}
