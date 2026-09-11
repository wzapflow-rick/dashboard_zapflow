import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';
import { MorphingInfinity } from '@/components/ui/morphing-infinity';

type LoadingScreenProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
};

function LoadingScreen({
  className,
  label = 'Carregando...',
  ...props
}: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex min-h-64 w-full flex-col items-center justify-center gap-3 text-text-secondary',
        className,
      )}
      {...props}
    >
      <MorphingInfinity className="size-12 text-primary" aria-hidden="true" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export { LoadingScreen };
