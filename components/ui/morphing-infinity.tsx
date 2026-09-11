'use client';

import type { ComponentProps } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { useLowPowerMode } from '@/hooks/use-low-power-mode';

const circleA =
  'M 12 8 C 14.21 8 16 9.79 16 12 C 16 14.21 14.21 16 12 16 C 9.79 16 8 14.21 8 12 C 8 9.79 9.79 8 12 8 Z';

const infinity =
  'M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z';

const circleB =
  'M 12 16 C 14.21 16 16 14.21 16 12 C 16 9.79 14.21 8 12 8 C 9.79 8 8 9.79 8 12 C 8 14.21 9.79 16 12 16 Z';

type MorphingInfinityProps = ComponentProps<'svg'> & {
  label?: string;
};

function MorphingInfinity({
  label = 'Carregando',
  role,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
  ...props
}: MorphingInfinityProps) {
  const reduceMotion = useReducedMotion();
  const lowPower = useLowPowerMode();
  const decorative = ariaHidden === true || ariaHidden === 'true';
  const showStaticPath = reduceMotion || lowPower;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={decorative ? undefined : (role ?? 'status')}
      aria-hidden={ariaHidden}
      aria-label={decorative ? undefined : (ariaLabel ?? label)}
      data-slot="morphing-infinity"
      {...props}
    >
      {showStaticPath ? (
        <path d={infinity} />
      ) : (
        <motion.path
          animate={{
            d: [circleA, infinity, circleB, infinity, circleA],
          }}
          transition={{
            d: {
              duration: 5,
              ease: 'easeInOut',
              repeat: Infinity,
              times: [0, 0.25, 0.5, 0.75, 1],
            },
          }}
        />
      )}
    </svg>
  );
}

export { MorphingInfinity };
export default MorphingInfinity;
