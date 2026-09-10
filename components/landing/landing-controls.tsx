'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { MetaEvents } from '@/components/meta-pixel';
import { commercialUrl } from '@/lib/landing-content';
import styles from '@/app/landing/landing.module.css';

export function Brand() {
  return <a href="/landing" className={styles.brand} aria-label="Zapflow — início"><span className={styles.brandIcon}><Image src="/logo-z.png" alt="" width={75} height={50} /></span><span>zapflow<span className={styles.brandDot}>.</span></span></a>;
}

export function CommercialLink({ children = 'Começar agora', track = false, secondary = false }: { children?: React.ReactNode; track?: boolean; secondary?: boolean }) {
  return <a className={secondary ? styles.secondaryButton : styles.button} href={commercialUrl} onClick={track ? () => MetaEvents.startTrial() : undefined}>{children}<ArrowUpRight size={18} aria-hidden="true" /></a>;
}

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  return <header className={styles.header}><div className={styles.headerInner}><Brand /><nav className={styles.desktopNav} aria-label="Navegação principal"><a href="#produto">O Zapflow</a><a href="#features">Recursos</a><a href="#pricing">Planos</a></nav><div className={styles.headerActions}><CommercialLink /><button className={styles.menuButton} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} aria-controls="landing-menu" onClick={() => setOpen(!open)} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>{open ? <X size={22} /> : <Menu size={22} />}</button></div></div>{open && <nav id="landing-menu" className={styles.mobileNav} aria-label="Navegação mobile" onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}><a href="#produto" onClick={() => setOpen(false)}>O Zapflow</a><a href="#features" onClick={() => setOpen(false)}>Recursos</a><a href="#pricing" onClick={() => setOpen(false)}>Planos</a></nav>}</header>;
}
