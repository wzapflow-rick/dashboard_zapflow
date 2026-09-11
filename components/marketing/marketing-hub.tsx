'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Megaphone, Share2 } from 'lucide-react';
import CampaignsPanel from '@/components/marketing/campaigns-panel';
import DisclosurePanel from '@/components/marketing/disclosure-panel';
import {
  MARKETING_TABS,
  getMarketingPath,
  normalizeMarketingTab,
  type MarketingTab,
} from '@/lib/marketing-navigation';
import { cn } from '@/lib/utils';

const TAB_OPTIONS = [
  { value: 'divulgacao', label: 'Divulgação', icon: Share2 },
  { value: 'campanhas', label: 'Campanhas', icon: Megaphone },
] as const;

interface MarketingHubProps {
  initialTab: MarketingTab;
}

export function MarketingHub({ initialTab }: MarketingHubProps) {
  const [activeTab, setActiveTab] = useState<MarketingTab>(initialTab);
  const tabRefs = useRef<Record<MarketingTab, HTMLButtonElement | null>>({
    divulgacao: null,
    campanhas: null,
  });

  useEffect(() => {
    const handlePopState = () => {
      const tab = new URL(window.location.href).searchParams.get('tab');
      setActiveTab(normalizeMarketingTab(tab));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function activateTab(nextTab: MarketingTab) {
    if (nextTab === activeTab) return;

    setActiveTab(nextTab);
    window.history.pushState(window.history.state, '', getMarketingPath(nextTab));
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: MarketingTab) {
    const currentIndex = MARKETING_TABS.indexOf(currentTab);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % MARKETING_TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + MARKETING_TABS.length) % MARKETING_TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = MARKETING_TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = MARKETING_TABS[nextIndex];
    activateTab(nextTab);
    requestAnimationFrame(() => tabRefs.current[nextTab]?.focus());
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Megaphone aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Central de crescimento</p>
            <h1 className="text-balance text-2xl font-bold text-foreground">Marketing</h1>
          </div>
        </div>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Compartilhe seu cardápio e mantenha seus clientes próximos com campanhas automáticas.
        </p>
      </header>

      <div
        aria-label="Áreas de marketing"
        className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-border bg-muted p-1.5 sm:w-fit"
        role="tablist"
      >
        {TAB_OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = activeTab === value;

          return (
            <button
              aria-controls={`marketing-panel-${value}`}
              aria-selected={isActive}
              className={cn(
                'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )}
              id={`marketing-tab-${value}`}
              key={value}
              onClick={() => activateTab(value)}
              onKeyDown={(event) => handleTabKeyDown(event, value)}
              ref={(element) => {
                tabRefs.current[value] = element;
              }}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </button>
          );
        })}
      </div>

      <section
        aria-labelledby="marketing-tab-divulgacao"
        className="min-w-0 outline-none"
        hidden={activeTab !== 'divulgacao'}
        id="marketing-panel-divulgacao"
        role="tabpanel"
        tabIndex={0}
      >
        <DisclosurePanel />
      </section>

      <section
        aria-labelledby="marketing-tab-campanhas"
        className="min-w-0 outline-none"
        hidden={activeTab !== 'campanhas'}
        id="marketing-panel-campanhas"
        role="tabpanel"
        tabIndex={0}
      >
        <CampaignsPanel />
      </section>
    </div>
  );
}
