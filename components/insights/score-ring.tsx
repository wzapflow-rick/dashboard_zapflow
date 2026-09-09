'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface ScoreRingProps {
  valor: number;
  nivel: 'critico' | 'atencao' | 'saudavel' | 'excelente';
  size?: number;
}

const CORES: Record<ScoreRingProps['nivel'], { stroke: string; glow: string; text: string }> = {
  critico: { stroke: '#ef4444', glow: 'rgba(239,68,68,0.45)', text: '#ef4444' },
  atencao: { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.45)', text: '#f59e0b' },
  saudavel: { stroke: '#22c55e', glow: 'rgba(34,197,94,0.45)', text: '#22c55e' },
  excelente: { stroke: '#22c55e', glow: 'rgba(34,197,94,0.6)', text: '#22c55e' },
};

const LABEL: Record<ScoreRingProps['nivel'], string> = {
  critico: 'Crítico',
  atencao: 'Atenção',
  saudavel: 'Saudável',
  excelente: 'Excelente',
};

export function ScoreRing({ valor, nivel, size = 160 }: ScoreRingProps) {
  const [display, setDisplay] = useState(0);
  const cor = CORES[nivel];
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (valor / 100) * circumference;

  useEffect(() => {
    let animationFrame: number;
    const start = performance.now();
    const duration = 900;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(valor * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [valor]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Saúde do negócio: ${valor} de 100, nível ${LABEL[nivel]}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200 dark:text-slate-700"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={cor.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${cor.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black tabular-nums" style={{ color: cor.text }}>
          {display}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{LABEL[nivel]}</span>
      </div>
    </div>
  );
}
