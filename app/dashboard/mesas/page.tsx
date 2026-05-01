'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import TablesManager from '@/components/tables/tables-manager';

export default function MesasPage() {
  return (
    <SidebarProvider>
      <DashboardLayout>
        <TablesManager />
      </DashboardLayout>
    </SidebarProvider>
  );
}
