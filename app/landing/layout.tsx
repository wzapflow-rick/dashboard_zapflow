import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZapFlow - Sistema de Delivery Completo',
  description: 'Cardapio digital, pedidos pelo WhatsApp, gestao completa e muito mais. Tudo que seu restaurante precisa para vender mais.',
  openGraph: {
    title: 'ZapFlow - Sistema de Delivery Completo',
    description: 'Cardapio digital, pedidos pelo WhatsApp, gestao completa e muito mais.',
    type: 'website',
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
