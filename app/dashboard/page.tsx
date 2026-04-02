'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import DashboardOverview from '@/components/dashboard-overview';
import OnboardingTutorial from '@/components/onboarding/onboarding-tutorial';

export default function DashboardPage() {
  return (
    <SidebarProvider>
      <DashboardLayout>
        <DashboardOverview />
        <OnboardingTutorial />
      </DashboardLayout>
    </SidebarProvider>
  );
}
