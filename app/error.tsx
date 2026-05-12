'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    console.error('[Global Error]', error);
    
    // Detecta erro de Server Action desatualizada (deploy novo)
    const isStaleDeployError = 
      error?.message?.includes('Failed to find Server Action') ||
      error?.message?.includes('failed to find server action') ||
      error?.message?.includes('older or newer deployment');
    
    if (isStaleDeployError) {
      console.log('[Global Error] Deploy desatualizado detectado, recarregando...');
      window.location.reload();
      return;
    }
  }, [error]);

  const handleReload = () => {
    setIsReloading(true);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto size-16 bg-red-500/10 rounded-full flex items-center justify-center">
          <AlertCircle className="size-8 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Ops! Algo deu errado
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Nao foi possivel carregar esta pagina. Tente novamente em alguns instantes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            onClick={handleReload}
            disabled={isReloading}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${isReloading ? 'animate-spin' : ''}`} />
            {isReloading ? 'Recarregando...' : 'Tentar novamente'}
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => window.location.href = '/'}
            className="gap-2"
          >
            <Home className="size-4" />
            Pagina inicial
          </Button>
        </div>
      </div>
    </div>
  );
}
