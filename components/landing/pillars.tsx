import { Bot, ImageIcon, MessageCircle, PiggyBank } from 'lucide-react';
import { display } from './content';

const pillars = [
  {
    icon: ImageIcon,
    title: 'Cardápio com fotos e categorias',
    body: 'Seus pratos organizados por categoria, com foto, descrição e adicionais. O cliente encontra rápido e pede sem ligar.',
  },
  {
    icon: MessageCircle,
    title: 'Pedidos direto no WhatsApp',
    body: 'Cada pedido chega completo, com endereço e pagamento, e o cliente recebe atualizações automáticas a cada etapa.',
  },
  {
    icon: Bot,
    title: 'IA que atende e vende',
    body: 'O agente responde dúvidas, envia o cardápio e sugere adicionais, mesmo quando a cozinha está no pico.',
  },
  {
    icon: PiggyBank,
    title: 'Zero comissão por venda',
    body: 'Mensalidade fixa e nada mais. Vendeu R$ 10 mil no mês? Os R$ 10 mil são do seu restaurante.',
    highlight: true,
  },
];

export function Pillars() {
  return (
    <section id="recursos" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className={`${display} text-balance text-4xl font-bold tracking-[-0.02em] text-zinc-50 sm:text-5xl`}>
            Do primeiro olhar ao pedido pago, sem intermediário.
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Tudo o que um delivery precisa para vender pelo próprio canal, com a sua marca.
          </p>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <li
              key={p.title}
              className={`flex flex-col rounded-2xl border p-6 backdrop-blur ${
                p.highlight
                  ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-zinc-900/60'
                  : 'border-zinc-800/80 bg-zinc-900/60'
              }`}
            >
              <span
                className={`flex size-11 items-center justify-center rounded-xl ${
                  p.highlight ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-800 text-amber-400'
                }`}
                aria-hidden
              >
                <p.icon className="size-5" />
              </span>
              <h3 className={`${display} mt-6 text-xl font-semibold text-zinc-50`}>{p.title}</h3>
              <p className="mt-2 leading-relaxed text-zinc-400">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
