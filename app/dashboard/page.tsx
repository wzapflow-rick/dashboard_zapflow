'use client';

import React from 'react';
import DashboardOverview from '@/components/dashboard/dashboard-overview';
import OnboardingTutorial from '@/components/onboarding/onboarding-tutorial';

export default function DashboardPage() {
  return (
    <>
      <DashboardOverview />
      <OnboardingTutorial />
    </>
  );
}
