import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { CtaLink } from './cta-link';
import { SIGNUP_URL, display, formatBRL, plans } from './content';

export function Pricing() {
  return (
    <section id="planos" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className={`${display} text-balance text-4xl font-bold tracking-[-0.02em] text-zinc-50 sm:text-5xl`}>
            Mensalidade fixa. Nenhum centavo por pedido.
          </h2>
          <p className="mt-4 text-lg text-zinc-400">Escolha pelo tamanho da sua operação e mude quando crescer.</p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3 lg:items-stretch">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex flex-col rounded-3xl border p-7 ${
                plan.popular
                  ? 'border-emerald-500/50 bg-gradient-to-b from-emerald-500/10 to-zinc-900/70 shadow-[0_30px_80px_-40px_rgba(16,185,129,0.6)]'
                  : 'border-zinc-800/80 bg-zinc-900/60'
              }`}
            >
              {plan.popular ? (
                <span className="absolute -top-3 left-7 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-emerald-950">
                  Mais escolhido
                </span>
              ) : null}

              <div className="flex items-center gap-4">
                <Image
                  src={plan.mascot}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 rounded-full border border-zinc-700 object-cover"
                />
                <div>
                  <h3 className={`${display} text-2xl font-bold text-zinc-50`}>{plan.name}</h3>
                  <p className="text-sm text-zinc-400">{plan.summary}</p>
                </div>
              </div>

              <p className="mt-6 flex items-baseline gap-1 text-zinc-50">
                <span className={`${display} text-4xl font-bold tabular-nums`}>{formatBRL(plan.price)}</span>
                <span className="text-zinc-400">/mês</span>
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-zinc-300">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.popular ? (
                <CtaLink className="mt-8 w-full">Começar com o PRO</CtaLink>
              ) : (
                <Link
                  href={SIGNUP_URL}
                  className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-700 font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
                >
                  Escolher {plan.name}
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
