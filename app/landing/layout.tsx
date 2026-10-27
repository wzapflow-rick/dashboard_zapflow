import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'wZapFlow — Cardápio digital com pedidos no WhatsApp e zero comissão',
  description:
    'Crie um cardápio digital com fotos, receba pedidos organizados no WhatsApp e atenda com um agente de IA. Sem comissão por venda: o lucro é 100% seu.',
  openGraph: {
    title: 'wZapFlow — Cardápio digital com pedidos no WhatsApp',
    description: 'Cardápio com fotos, pedidos no WhatsApp, agente de IA e zero comissão por venda.',
    type: 'website',
    url: 'https://wzapflow.com.br',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={bricolage.variable}>{children}</div>;
}
