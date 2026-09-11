import { MarketingHub } from '@/components/marketing/marketing-hub';
import { normalizeMarketingTab } from '@/lib/marketing-navigation';

interface MarketingPageProps {
  searchParams: Promise<{
    tab?: string | string[];
  }>;
}

export default async function MarketingPage({ searchParams }: MarketingPageProps) {
  const params = await searchParams;

  return <MarketingHub initialTab={normalizeMarketingTab(params.tab)} />;
}
