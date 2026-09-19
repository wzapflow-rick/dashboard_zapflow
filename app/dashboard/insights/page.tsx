import { ZapflowInsightsClient } from '@/components/insights/zapflow-insights-client';

export const metadata = {
  title: 'Inteligência | ZapFlow',
  description: 'Análise completa do seu negócio com o Consultor ZapFlow.',
};

export default function InsightsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 pb-8">
      <header>
        <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Inteligência
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          A análise completa do seu negócio, com recomendações, desempenho e comparativos.
        </p>
      </header>

      <ZapflowInsightsClient />
    </div>
  );
}
