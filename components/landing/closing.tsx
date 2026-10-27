import { ChevronDown } from 'lucide-react';
import { CtaLink } from './cta-link';
import { Logo } from './site-header';
import { display, faqs } from './content';

export function Faq() {
  return (
    <section id="duvidas" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <h2 className={`${display} text-balance text-4xl font-bold tracking-[-0.02em] text-zinc-50 sm:text-5xl`}>
          Dúvidas frequentes
        </h2>
        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium text-zinc-100 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown aria-hidden className="size-5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 max-w-prose leading-relaxed text-zinc-400">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-zinc-900 to-zinc-950 px-6 py-16 text-center sm:px-12">
        <h2 className={`${display} mx-auto max-w-3xl text-balance text-4xl font-bold tracking-[-0.02em] text-zinc-50 sm:text-5xl`}>
          Seu próximo pedido pode chegar pelo seu próprio cardápio.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-300">
          Cadastre seus pratos, compartilhe o link e comece a receber pedidos no WhatsApp.
        </p>
        <CtaLink size="lg" className="mt-9">
          Criar meu cardápio
        </CtaLink>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800/60 pt-10 pb-28 md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row">
        <Logo />
        <p className="text-sm text-zinc-500">&copy; {new Date().getFullYear()} wZapFlow. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}

export function MobileCtaBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-[#09090b]/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
      <CtaLink className="w-full">Criar meu cardápio</CtaLink>
    </div>
  );
}
