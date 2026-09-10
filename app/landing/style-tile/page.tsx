import type { Metadata } from 'next';
import { Brand, CommercialLink } from '@/components/landing/landing-controls';
import styles from '../landing.module.css';

export const metadata: Metadata = { title: 'Zapflow — Identidade visual', robots: { index: false, follow: false } };
export default function StyleTile() {
  return <main className={`${styles.root} ${styles.tile} font-sans`}><Brand /><p className={styles.eyebrow}>SISTEMA VISUAL · LANDING</p><h1>Seu delivery,<br />em um novo fluxo.</h1><p>Inter · Tipografia de títulos e leitura. Identidade verde-floresta, imagens reais e espaço para respirar.</p><div className={styles.swatches}>{['forest', 'deep', 'accent', 'paper', 'muted'].map(color => <div key={color} className={styles.swatch} style={{ background: `var(--${color})`, color: ['forest', 'deep'].includes(color) ? 'var(--paper)' : 'var(--deep)' }}>{color}</div>)}</div><CommercialLink /><CommercialLink secondary>Conhecer os planos</CommercialLink><article className={styles.feature}><h3>Cada pedido no seu lugar.</h3><p>Cardápio digital e organização para a sua operação.</p></article><a href="/landing" className={styles.textLink}>Voltar à landing</a></main>;
}
