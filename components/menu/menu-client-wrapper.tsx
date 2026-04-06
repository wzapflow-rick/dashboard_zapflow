'use client';

import { CartProvider } from './cart-context';
import Cart from './cart';

interface UpsellProduct {
  id: number;
  nome: string;
  preco: number;
  imagem?: string | null;
  descricao?: string;
}

interface MenuClientWrapperProps {
  children: React.ReactNode;
  whatsappNumber: string;
  empresaNome: string;
  empresaId?: number;
  pontosPorReal?: number;
  upsellProducts?: UpsellProduct[];
}

export default function MenuClientWrapper({ 
  children, 
  whatsappNumber, 
  empresaNome,
  empresaId,
  pontosPorReal = 1,
  upsellProducts = []
}: MenuClientWrapperProps) {
  return (
    <CartProvider pontosPorReal={pontosPorReal} empresaId={empresaId}>
      {children}
      <Cart 
        whatsappNumber={whatsappNumber} 
        empresaNome={empresaNome}
        empresaId={empresaId}
        upsellProducts={upsellProducts}
      />
    </CartProvider>
  );
}
