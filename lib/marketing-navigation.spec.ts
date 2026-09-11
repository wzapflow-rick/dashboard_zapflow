import { getMarketingPath, normalizeMarketingTab } from './marketing-navigation';

describe('normalizeMarketingTab', () => {
  it('keeps the campaigns tab when requested', () => {
    expect(normalizeMarketingTab('campanhas')).toBe('campanhas');
    expect(normalizeMarketingTab(['campanhas'])).toBe('campanhas');
  });

  it('defaults missing or invalid values to disclosure', () => {
    expect(normalizeMarketingTab(undefined)).toBe('divulgacao');
    expect(normalizeMarketingTab('invalida')).toBe('divulgacao');
  });
});

describe('getMarketingPath', () => {
  it('creates canonical paths for both marketing tabs', () => {
    expect(getMarketingPath('divulgacao')).toBe('/dashboard/marketing?tab=divulgacao');
    expect(getMarketingPath('campanhas')).toBe('/dashboard/marketing?tab=campanhas');
  });
});
