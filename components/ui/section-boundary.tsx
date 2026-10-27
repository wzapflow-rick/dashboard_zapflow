'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface SectionBoundaryProps {
  /** Nome legível da seção, exibido no fallback e no log. */
  name: string;
  children: ReactNode;
  className?: string;
}

interface SectionBoundaryState {
  error: Error | null;
}

/**
 * Isola falhas de renderização de um bloco da tela: se um widget quebrar,
 * só ele mostra o fallback e o resto do painel continua funcionando.
 */
export class SectionBoundary extends Component<SectionBoundaryProps, SectionBoundaryState> {
  state: SectionBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SectionBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SectionBoundary:${this.props.name}]`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    const slug = this.props.name.toLowerCase().replace(/\s+/g, '-');

    return (
      <div
        role="alert"
        data-testid={`section-error-${slug}`}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 px-6 py-8 text-center ${this.props.className ?? ''}`}
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <div className="max-w-xs">
          <p className="text-sm font-semibold text-foreground">Não foi possível exibir {this.props.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">O restante do painel continua funcionando normalmente.</p>
        </div>
        <button
          type="button"
          onClick={this.reset}
          data-testid={`section-retry-${slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Tentar novamente
        </button>
      </div>
    );
  }
}
