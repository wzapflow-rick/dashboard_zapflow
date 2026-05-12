'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    console.error('[Dashboard Error]', error);
    
    // Detecta erro de Server Action desatualizada (deploy novo)
    const isStaleDeployError = 
      error?.message?.includes('Failed to find Server Action') ||
      error?.message?.includes('failed to find server action') ||
      error?.message?.includes('older or newer deployment');
    
    if (isStaleDeployError) {
      // Forca reload completo da pagina para pegar o novo deploy
      console.log('[Dashboard Error] Deploy desatualizado detectado, recarregando...');
      window.location.reload();
      return;
    }
  }, [error]);

  const handleReload = () => {
    setIsReloading(true);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto size-16 bg-red-500/10 rounded-full flex items-center justify-center">
          <AlertCircle className="size-8 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Ops! Algo deu errado
          </h1>
          <p className="text-muted-foreground">
            Nao foi possivel carregar esta pagina. Isso pode ser um problema temporario de conexao.
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
            onClick={() => window.location.href = '/dashboard'}
            className="gap-2"
          >
            <Home className="size-4" />
            Voltar ao inicio
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <details className="mt-6 text-left bg-muted/50 rounded-lg p-4">
            <summary className="text-sm font-medium cursor-pointer text-muted-foreground">
              Detalhes tecnicos
            </summary>
            <pre className="mt-2 text-xs text-red-500 whitespace-pre-wrap break-all">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
