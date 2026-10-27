import { OrderDemo } from './order-demo';
import { display } from './content';

export function DemoSection() {
  return (
    <section id="demonstracao" className="scroll-mt-20 border-y border-zinc-800/60 bg-zinc-950/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className={`${display} text-balance text-4xl font-bold tracking-[-0.02em] text-zinc-50 sm:text-5xl`}>
            Faça um pedido de teste agora.
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            À esquerda, o cardápio que seu cliente vê. À direita, o WhatsApp respondendo sozinho.
          </p>
        </div>
        <OrderDemo />
      </div>
    </section>
  );
}
