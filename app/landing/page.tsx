import Image from 'next/image';
import { ArrowDown, Check, Smartphone, Columns3, CreditCard, MessageCircle, Truck, ChartNoAxesCombined } from 'lucide-react';
import { LandingHeader, Brand, CommercialLink } from '@/components/landing/landing-controls';
import { FoodStory } from '@/components/landing/food-story';
import { plans } from '@/lib/landing-content';
import styles from './landing.module.css';

const features = [
  { icon: Smartphone, title: 'Seu cardápio. Sua identidade.', text: 'Compartilhe seu cardápio digital por link ou QR Code. Produtos, fotos e preços no mesmo lugar.' },
  { icon: Columns3, title: 'Cada pedido no seu lugar.', text: 'Acompanhe os pedidos com o painel Kanban e organize as etapas da sua operação.' },
  { icon: CreditCard, title: 'Mais formas de pagar.', text: 'Pix e cartões para atender às preferências de quem compra com você.' },
  { icon: MessageCircle, title: 'Conectado ao WhatsApp.', text: 'Notificações e agente de IA no WhatsApp nos planos PRO e ELITE.' },
  { icon: Truck, title: 'Da cozinha à entrega.', text: 'Taxas de entrega por bairro no Start, cálculo pelo Google Maps no PRO e app de entregadores no ELITE.' },
  { icon: ChartNoAxesCombined, title: 'Olhe além do pedido.', text: 'Relatórios de performance no ELITE para acompanhar os resultados do seu negócio.' },
];

export default function LandingPage() {
  return <div className={`${styles.root} font-sans`}><LandingHeader /><main><FoodStory />
    <section id="produto" className={styles.product}>
      <div className={styles.productIntro}><p className={styles.eyebrow}>SABOR É COM VOCÊ. GESTÃO É COM ZAPFLOW.</p><h2>Do cardápio<br />à gestão dos pedidos.</h2><p>Na frente, uma experiência para o seu cliente.<br />Nos bastidores, organização para você.</p><a href="#features" className={styles.textLink}>Veja como tudo se conecta <ArrowDown size={17} /></a></div>
      <figure className={styles.productVisual}><div className={styles.previewBar}><span className={styles.statusDot} /><span>Seu cardápio digital</span><span>Zapflow</span></div><div className={styles.screenshot}><Image src="/images/menu-screenshot.png" alt="Exemplo real de cardápio digital Zapflow com produtos, categorias e preços" width={760} height={1400} sizes="(max-width: 760px) 90vw, 45vw" /></div><figcaption>Uma amostra do cardápio. A identidade é do seu negócio.</figcaption></figure>
    </section>
    <section id="features" className={styles.features}><div className={styles.sectionHeading}><p className={styles.eyebrow}>MENOS COMPLICAÇÃO. MAIS CONEXÃO.</p><h2>Seu delivery inteiro.<br /><span>No mesmo fluxo.</span></h2><p>Ferramentas que acompanham o pedido,<br />sem tirar o foco do que você faz de melhor.</p></div><div className={styles.featureGrid}>{features.map(({ icon: Icon, title, text }) => <article key={title} className={styles.feature}><Icon size={26} strokeWidth={1.4} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section id="pricing" className={styles.pricing}><div className={styles.sectionHeading}><p className={styles.eyebrow}>O PRÓXIMO PASSO DO SEU DELIVERY</p><h2>Um plano para<br />o seu momento.</h2><p>Escolha as ferramentas que fazem sentido para sua operação.</p></div><div className={styles.planGrid}>{plans.map(plan => <article className={`${styles.plan} ${plan.name === 'PRO' ? styles.proPlan : ''}`} key={plan.name}><div className={styles.planTop}><h3>{plan.name}</h3>{plan.name === 'PRO' && <span>MAIS POSSIBILIDADES</span>}</div><p>{plan.description}</p><div className={styles.price}><span>R$</span><strong>{plan.price}</strong><span>/mês</span></div><CommercialLink secondary={plan.name !== 'PRO'}>{plan.name === 'PRO' ? 'Começar com PRO' : `Escolher ${plan.name}`}</CommercialLink><ul>{plan.features.map(feature => <li key={feature}><Check size={17} aria-hidden="true" /><span>{feature}</span></li>)}</ul></article>)}</div></section>
    <section className={styles.closing}><p className={styles.eyebrow}>SEU SABOR. SEU NEGÓCIO. SEU FLUXO.</p><h2>O próximo pedido<br />começa aqui<span>.</span></h2><CommercialLink track /></section>
  </main><footer className={styles.footer}><Brand /><p>© {new Date().getFullYear()} Zapflow. Todos os direitos reservados.</p><a href="#pricing">Encontre seu plano</a></footer></div>;
}
