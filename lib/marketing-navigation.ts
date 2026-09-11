export const MARKETING_TABS = ['divulgacao', 'campanhas'] as const;

export type MarketingTab = (typeof MARKETING_TABS)[number];

export function normalizeMarketingTab(tab: string | string[] | null | undefined): MarketingTab {
  const value = Array.isArray(tab) ? tab[0] : tab;

  return value === 'campanhas' ? 'campanhas' : 'divulgacao';
}

export function getMarketingPath(tab: MarketingTab) {
  return `/dashboard/marketing?tab=${tab}` as const;
}
