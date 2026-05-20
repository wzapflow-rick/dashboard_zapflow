'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Sidebar } from './layout/sidebar';
import { Header } from './layout/header';
import { PaymentAlert } from './dashboard/payment-alert';
import { TrialWarningBanner } from './dashboard/trial-warning-banner';
import { OfflineIndicator } from './offline-indicator';
import { cn } from '@/lib/utils';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Component, ReactNode, ErrorInfo } from 'react';

// Error Boundary para capturar erros nos componentes filhos
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DashboardErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[v0] Dashboard Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8 min-h-[400px]">
          <div className="text-center max-w-md">
            <AlertTriangle className="size-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Erro ao carregar conteudo
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
              {this.state.error?.message || 'Ocorreu um erro inesperado'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="size-4" />
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface SidebarContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within SidebarProvider');
  return context;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isOpen, setIsOpen } = useSidebar();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Timeout de 15 segundos - se demorar mais, mostra opcao de recarregar
    timeoutId = setTimeout(() => {
      if (isLoading) {
        setLoadingTimeout(true);
        console.error('[v0] Dashboard timeout - loading took more than 15s');
      }
    }, 15000);

    import('@/app/actions/auth').then(({ getMe }) => {
      getMe().then((userData) => {
        setUser(userData);
        setIsLoading(false);
        clearTimeout(timeoutId);
      }).catch((err) => {
        console.error('[v0] Error loading user:', err);
        setError('Erro ao carregar dados do usuario');
        setIsLoading(false);
        clearTimeout(timeoutId);
      });
    }).catch((err) => {
      console.error('[v0] Error importing auth:', err);
      setError('Erro ao carregar modulo de autenticacao');
      setIsLoading(false);
      clearTimeout(timeoutId);
    });

    return () => clearTimeout(timeoutId);
  }, []);

  const isCozinheiro = user?.role === 'cozinheiro';

  // Se houve erro, mostra tela de erro
  if (error) {
    return (
      <div className="flex min-h-screen bg-background-light dark:bg-[#0a1628] items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="size-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Ops! Algo deu errado
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="size-5" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Se demorou muito, mostra opcao de recarregar
  if (loadingTimeout && isLoading) {
    return (
      <div className="flex min-h-screen bg-background-light dark:bg-[#0a1628] items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Carregando...
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Isso esta demorando mais do que o esperado. Pode ser um problema de conexao.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="size-5" />
            Recarregar Pagina
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-[#0a1628]">
      {!isLoading && !isCozinheiro && (
        <Sidebar
          isOpen={isOpen}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          user={user}
        />
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 min-w-0 flex flex-col min-h-screen",
        isCozinheiro ? "ml-0" : (isOpen ? "lg:ml-64" : "lg:ml-20"),
        "ml-0"
      )}>
        <Header
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 flex-1 dark:bg-[#0a1628]">
          {user?.empresaId && <PaymentAlert empresaId={user.empresaId} />}
          {user && (
            <TrialWarningBanner 
              plano={user.plano} 
              dataInicio={user.dataInicio || user.created_at} 
              empresaId={user.empresaId} 
            />
          )}
          <DashboardErrorBoundary>
            {children}
          </DashboardErrorBoundary>
        </div>
      </main>
      
      {/* Indicador global de status offline */}
      <OfflineIndicator />
    </div>
  );
}
