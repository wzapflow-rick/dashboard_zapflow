'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { MorphingInfinity } from '@/components/ui/morphing-infinity';

const STALE_DEPLOY_PATTERNS = ['failed to find server action', 'older or newer deployment'];

function isStaleDeployError(error: Error) {
  const message = error?.message?.toLowerCase() ?? '';
  return STALE_DEPLOY_PATTERNS.some((pattern) => message.includes(pattern));
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error('[Dashboard Error]', error);
    // Após um deploy novo, Server Actions antigas deixam de existir: só um reload resolve.
    if (isStaleDeployError(error)) window.location.reload();
  }, [error]);

  const handleRetry = () => {
    setRetrying(true);
    // reset() re-renderiza o segmento sem perder o estado do layout; se falhar de novo, o boundary volta.
    reset();
    setTimeout(() => setRetrying(false), 600);
  };

  return (
    <div className="flex min-h-96 items-center justify-center p-4" data-testid="dashboard-error">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-2xl font-semibold text-foreground">Algo deu errado nesta página</h1>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Pode ser uma instabilidade temporária de conexão. Seus dados estão seguros.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground/70">Código: {error.digest}</p>
          )}
        </div>

        <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            data-testid="dashboard-error-retry"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {retrying ? (
              <MorphingInfinity className="size-4" aria-hidden="true" />
            ) : (
              <RotateCcw className="size-4" aria-hidden="true" />
            )}
            {retrying ? 'Tentando...' : 'Tentar novamente'}
          </button>
          <Link
            href="/dashboard"
            data-testid="dashboard-error-home"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Home className="size-4" aria-hidden="true" />
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
