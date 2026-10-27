import Image from 'next/image';
import { Check } from 'lucide-react';
import { CtaLink } from './cta-link';
import { display } from './content';

const assurances = ['Zero comissão por pedido', 'Pix e cartão', 'Link e QR Code'];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 lg:pb-28">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.22),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-[-15%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.12),transparent)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="text-center lg:text-left">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
            <span className="size-1.5 rounded-full bg-amber-400" aria-hidden />
            Cardápio digital + WhatsApp + IA
          </p>

          <h1
            className={`${display} text-balance text-5xl leading-[0.95] font-extrabold tracking-[-0.03em] text-zinc-50 sm:text-6xl lg:text-7xl`}
          >
            O cardápio que atende, vende e manda o pedido pro seu WhatsApp.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-zinc-400 lg:mx-0">
            Fotos que abrem o apetite, pedidos organizados e um agente de IA respondendo seus clientes.
            Sem comissão por venda: o que entra no caixa é 100% seu.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <CtaLink size="lg" className="w-full sm:w-auto">
              Criar meu cardápio
            </CtaLink>
            <a
              href="#demonstracao"
              className="inline-flex h-14 w-full items-center justify-center rounded-full border border-zinc-700 px-8 text-lg font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-400 sm:w-auto"
            >
              Ver um exemplo
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-400 lg:justify-start">
            {assurances.map((a) => (
              <li key={a} className="flex items-center gap-1.5">
                <Check aria-hidden className="size-4 text-emerald-400" />
                {a}
              </li>
            ))}
          </ul>
        </div>

        <HeroDevice />
      </div>
    </section>
  );
}

function HeroDevice() {
  return (
    <div className="relative mx-auto w-full max-w-[300px] sm:max-w-[340px]">
      <Image
        src="/images/zapflow-pizza-rocket.png"
        alt=""
        width={1313}
        height={1198}
        priority
        sizes="(min-width: 1024px) 280px, 200px"
        className="absolute -top-10 -left-24 z-20 w-48 -rotate-6 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] sm:-left-32 sm:w-64 lg:-left-44 lg:w-72"
      />
      <div className="relative z-10 rotate-[3deg] rounded-[2.75rem] border border-zinc-700/80 bg-zinc-900 p-2.5 shadow-[0_40px_120px_-30px_rgba(245,158,11,0.45)]">
        <div className="absolute top-4 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden />
        <Image
          src="/images/menu-screenshot.png"
          alt="Cardápio digital de uma hamburgueria aberto no celular, com categorias, fotos e botão de pedir"
          width={390}
          height={854}
          priority
          sizes="(min-width: 640px) 340px, 300px"
          className="h-auto w-full rounded-[2.25rem]"
        />
      </div>
      <div className="absolute -right-4 bottom-16 z-20 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 shadow-xl backdrop-blur sm:-right-10">
        <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-5 fill-current">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" />
          </svg>
        </span>
        <div className="text-left">
          <p className="text-sm font-semibold text-zinc-50">Novo pedido #1042</p>
          <p className="text-xs text-zinc-400">R$ 46,90 · Pix confirmado</p>
        </div>
      </div>
    </div>
  );
}
