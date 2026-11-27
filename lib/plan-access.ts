import { normalizePlanName, type SubscriptionPlanId } from '@/lib/constants';

export interface PlanFeatureAccess {
  deliveryMaps: boolean;
  whatsappAutomation: boolean;
  coupons: boolean;
  campaigns: boolean;
  drivers: boolean;
  loyalty: boolean;
  performanceReports: boolean;
  menuCustomization: boolean;
}

export interface PlanAccess {
  plan: SubscriptionPlanId;
  isTestAccount: boolean;
  features: PlanFeatureAccess;
}

const NO_PREMIUM_FEATURES: PlanFeatureAccess = {
  deliveryMaps: false,
  whatsappAutomation: false,
  coupons: false,
  campaigns: false,
  drivers: false,
  loyalty: false,
  performanceReports: false,
  menuCustomization: false,
};

const PLAN_FEATURES: Record<SubscriptionPlanId, PlanFeatureAccess> = {
  iniciante: NO_PREMIUM_FEATURES,
  // O Trial Parceria libera os recursos do produto durante os sete dias.
  // O cálculo pelo Google Maps é a exceção definida para o ZapFlash.
  parceria: {
    deliveryMaps: false,
    whatsappAutomation: true,
    coupons: true,
    campaigns: true,
    drivers: true,
    loyalty: true,
    performanceReports: true,
    menuCustomization: true,
  },
  start: NO_PREMIUM_FEATURES,
  pro: {
    deliveryMaps: true,
    whatsappAutomation: true,
    coupons: true,
    campaigns: true,
    drivers: false,
    loyalty: false,
    performanceReports: false,
    menuCustomization: false,
  },
  elite: {
    deliveryMaps: true,
    whatsappAutomation: true,
    coupons: true,
    campaigns: true,
    drivers: true,
    loyalty: true,
    performanceReports: true,
    menuCustomization: true,
  },
};

function isEnabledFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== 'string') return false;
  return ['true', '1', 'sim', 'yes'].includes(value.trim().toLowerCase());
}

/** Detecta somente marcadores explícitos de conta de teste, sem inferir pelo nome da loja. */
export function isTestCompanyRecord(company: Record<string, unknown> | null | undefined): boolean {
  if (!company) return false;
  return [
    'conta_teste',
    'is_teste',
    'teste',
    'is_test',
    'test_account',
    'conta_demo',
  ].some((key) => isEnabledFlag(company[key]));
}

export function getPlanAccess(
  planValue: string | null | undefined,
  isTestAccount = false,
): PlanAccess {
  const normalized = normalizePlanName(planValue?.trim().toLowerCase()).trim().toLowerCase();
  const plan = (normalized in PLAN_FEATURES ? normalized : 'iniciante') as SubscriptionPlanId;
  const features = { ...PLAN_FEATURES[plan] };

  // O Maps fica indisponível no Trial/Parceria e em contas de teste,
  // mesmo que uma conta de teste esteja associada a um plano superior.
  if (plan === 'parceria' || isTestAccount) {
    features.deliveryMaps = false;
  }

  return { plan, isTestAccount, features };
}
