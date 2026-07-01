import { redirect } from 'next/navigation';

// A tela de cadastro grátis foi desativada: novos cadastros são feitos apenas
// pela Landing Page (fluxo com plano -> checkout -> ativação em /signup).
// A raiz agora leva direto ao login para evitar autocadastro por aqui.
export default function Home() {
  redirect('/login');
}
