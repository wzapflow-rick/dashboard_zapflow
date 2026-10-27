import Image from 'next/image';
import Link from 'next/link';
import { CtaLink } from './cta-link';
import { display } from './content';

const links = [
  { href: '#recursos', label: 'Recursos' },
  { href: '#demonstracao', label: 'Como funciona' },
  { href: '#planos', label: 'Planos' },
  { href: '#duvidas', label: 'Dúvidas' },
];

export function Logo() {
  return (
    <Link href="/landing" className="flex items-center gap-2" aria-label="wZapFlow, página inicial">
      <Image src="/images/pizza-logo.png" alt="" width={40} height={36} className="h-9 w-auto" priority />
      <span className={`${display} text-xl font-bold tracking-tight text-zinc-50`}>wZapFlow</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800/60 bg-[#09090b]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Seções" className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-zinc-400 transition-colors hover:text-zinc-50">
              {l.label}
            </a>
          ))}
        </nav>
        <CtaLink size="sm" className="hidden sm:inline-flex">
          Criar meu cardápio
        </CtaLink>
      </div>
    </header>
  );
}
