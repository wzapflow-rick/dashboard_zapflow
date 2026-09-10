'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { chapters } from '@/lib/landing-content';
import { CommercialLink } from './landing-controls';
import styles from '@/app/landing/landing.module.css';

export function FoodStory() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress: progress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [chapter, setChapter] = useState(0);
  useMotionValueEvent(progress, 'change', value => setChapter(value < .2 ? 0 : value < .36 ? 1 : value < .54 ? 2 : value < .72 ? 3 : 4));
  const [position, setPosition] = useState(0);
  useMotionValueEvent(progress, 'change', setPosition);
  const ramp = (start: number, end: number) => Math.max(0, Math.min(1, (position - start) / (end - start)));
  const pizzaOpacity = 1 - ramp(.24, .4);
  const ingredientsOpacity = ramp(.27, .43) * (1 - ramp(.66, .8));
  const burgerOpacity = ramp(.67, .84);
  const pizzaStyle = { opacity: pizzaOpacity, transform: `translateY(${-65 * ramp(0, .4)}px) scale(${1 + .12 * ramp(0, .4)})` };
  const ingredientsStyle = { opacity: ingredientsOpacity, transform: `translateY(${40 - 75 * ramp(.3, .75)}px)` };
  const burgerStyle = { opacity: burgerOpacity, transform: `scale(${.92 + .08 * ramp(.7, 1)})` };
  return <section ref={ref} className={`${styles.story} ${reduced ? styles.reduced : ''}`} aria-label="Seu delivery em um novo fluxo"><div className={styles.stage}>
    <div className={styles.stageInner}>
      <div className={styles.storyCopy}>
        <p className={styles.eyebrow}><span className={styles.statusDot} /> FEITO PARA O SEU DELIVERY</p>
        <div hidden={!reduced && chapter !== 0}>
          <h1>Seu delivery,<br />em um <br /><span>novo fluxo.</span></h1>
          <p className={styles.lead}>Você cuida do sabor.<br />O Zapflow conecta o resto.</p>
          <p className={styles.heroDescription}>Cardápio digital e gestão de pedidos para restaurantes e delivery.</p>
          <div className={styles.heroActions}><CommercialLink track /><a href="#produto" className={styles.textLink}>Conhecer o Zapflow <ArrowDown size={16} /></a></div>
        </div>
        {!reduced && chapters.map((item, i) => <div key={item.title} hidden={chapter !== i + 1}><h2 className={styles.chapterTitle}>{item.title}</h2><p className={styles.lead}>{item.description}</p>{i === 3 && <a className={styles.button} href="#features">Explorar recursos <ArrowUpRight size={18} /></a>}</div>)}
      </div>
      <div className={styles.foodStage} aria-hidden="true">
        <div className={styles.foodLayer} style={reduced ? undefined : pizzaStyle}><Image src="/landing/pizza.png" alt="" fill priority sizes="(max-width: 760px) 100vw, 60vw" /></div>
        {!reduced && <><div className={styles.foodLayer} style={ingredientsStyle}><Image src="/landing/ingredients.png" alt="" fill sizes="(max-width: 760px) 100vw, 60vw" /></div><div className={styles.foodLayer} style={burgerStyle}><Image src="/landing/burger.png" alt="" fill sizes="(max-width: 760px) 100vw, 60vw" /></div></>}
      </div>
    </div>
    <div className={styles.storyBottom}><span>DO PRIMEIRO CLIQUE À ÚLTIMA ENTREGA</span><a href="#produto">Pular animação <ArrowDown size={15} /></a></div>
    {!reduced && <motion.div className={styles.progress} style={{ scaleX: progress }} />}
  </div></section>;
}
