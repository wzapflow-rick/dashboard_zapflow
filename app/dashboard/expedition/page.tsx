'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import ExpeditionMonitor from '@/components/expedition/expedition-monitor';

export default function ExpeditionPage() {
  return (
    <SidebarProvider>
      <DashboardLayout>
        <ExpeditionMonitor />
      </DashboardLayout>
    </SidebarProvider>
  );
}
