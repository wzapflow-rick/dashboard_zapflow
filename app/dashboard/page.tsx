'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import DashboardOverview from '@/components/dashboard-overview';

export default function DashboardPage() {
  return (
    <SidebarProvider>
      <DashboardLayout>
        <DashboardOverview />
      </DashboardLayout>
    </SidebarProvider>
  );
}
