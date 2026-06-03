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
  empresaCidade?: string | null;
  empresaEstado?: string | null;
  pontosPorReal?: number;
  upsellProducts?: UpsellProduct[];
  pagamentoIntegrado?: boolean;
}

export default function MenuClientWrapper({ 
  children, 
  whatsappNumber, 
  empresaNome,
  empresaId,
  empresaCidade,
  empresaEstado,
  pontosPorReal = 1,
  upsellProducts = [],
  pagamentoIntegrado = true
}: MenuClientWrapperProps) {
  return (
    <CartProvider pontosPorReal={pontosPorReal} empresaId={empresaId}>
      {children}
      <Cart 
        whatsappNumber={whatsappNumber} 
        empresaNome={empresaNome}
        empresaId={empresaId}
        empresaCidade={empresaCidade}
        empresaEstado={empresaEstado}
        upsellProducts={upsellProducts}
        pagamentoIntegrado={pagamentoIntegrado}
      />
    </CartProvider>
  );
}
