'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface ScoreRingProps {
  valor: number; // 0-100
  nivel: 'critico' | 'atencao' | 'saudavel' | 'excelente';
  size?: number;
}

const CORES: Record<ScoreRingProps['nivel'], { stroke: string; glow: string; text: string }> = {
  critico: { stroke: '#ef4444', glow: 'rgba(239,68,68,0.45)', text: '#f87171' },
  atencao: { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.45)', text: '#fbbf24' },
  saudavel: { stroke: '#22c55e', glow: 'rgba(34,197,94,0.45)', text: '#4ade80' },
  excelente: { stroke: '#22c55e', glow: 'rgba(34,197,94,0.6)', text: '#4ade80' },
};

const LABEL: Record<ScoreRingProps['nivel'], string> = {
  critico: 'Critico',
  atencao: 'Atencao',
  saudavel: 'Saudavel',
  excelente: 'Excelente',
};

export function ScoreRing({ valor, nivel, size = 160 }: ScoreRingProps) {
  const [display, setDisplay] = useState(0);
  const cor = CORES[nivel];
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (valor / 100) * circ;

  // Anima o numero de 0 ate o valor
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setDisplay(Math.round(valor * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valor]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={cor.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${cor.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black tabular-nums" style={{ color: cor.text }}>
          {display}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{LABEL[nivel]}</span>
      </div>
    </div>
  );
}
