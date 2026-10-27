import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { Pillars } from '@/components/landing/pillars';
import { DemoSection } from '@/components/landing/demo-section';
import { Pricing } from '@/components/landing/pricing';
import { Faq, FinalCta, MobileCtaBar, SiteFooter } from '@/components/landing/closing';

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#09090b] text-zinc-100 antialiased">
      <SiteHeader />
      <main>
        <Hero />
        <Pillars />
        <DemoSection />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <MobileCtaBar />
    </div>
  );
}
