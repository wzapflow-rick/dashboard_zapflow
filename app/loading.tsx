import { LoadingScreen } from '@/components/ui/loading-screen';

export default function Loading() {
  return (
    <LoadingScreen
      className="min-h-dvh bg-background-light dark:bg-background-dark"
      label="Carregando o ZapFlow..."
    />
  );
}
