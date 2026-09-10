import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Zapflow — Seu delivery, em um novo fluxo',
  description: 'Cardápio digital e gestão de pedidos para restaurantes e delivery. Conheça os recursos e planos do Zapflow.',
  openGraph: { title: 'Zapflow — Seu delivery, em um novo fluxo', description: 'Cardápio digital e gestão de pedidos para restaurantes e delivery.', type: 'website' },
};
export const viewport: Viewport = { themeColor: '#073c2f', width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true };
export default function LandingLayout({ children }: { children: React.ReactNode }) { return children; }
