'use client';

import React from 'react';
import { MotionConfig } from 'motion/react';
import { useLowPowerMode } from '@/hooks/use-low-power-mode';

/**
 * Controla globalmente as animacoes da biblioteca `motion`.
 * - Em maquinas normais: animacoes completas (reducedMotion="never" respeita o usuario via media query nao,
 *   mas mantemos o comportamento padrao do app).
 * - Em maquinas fracas ou com prefers-reduced-motion: desativa animacoes de transform/layout
 *   (reducedMotion="always"), reduzindo drasticamente o uso de CPU.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const lowPower = useLowPowerMode();

  return (
    <MotionConfig reducedMotion={lowPower ? 'always' : 'user'}>
      {children}
    </MotionConfig>
  );
}
