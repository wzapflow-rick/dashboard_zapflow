'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import CustomerBase from '@/components/customer-base';

export default function CustomersPage() {
  return (
    <SidebarProvider>
      <DashboardLayout>
        <div className="dark:bg-slate-800">
          <CustomerBase />
        </div>
      </DashboardLayout>
    </SidebarProvider>
  );
}
