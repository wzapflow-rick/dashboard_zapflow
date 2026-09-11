import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-current opacity-10 motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
