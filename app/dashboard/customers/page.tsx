'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import CustomerBase from '@/components/customer-base';

export default function CustomersPage() {
  return (
    <SidebarProvider>
      <DashboardLayout>
        <div className="">
          <CustomerBase />
        </div>
      </DashboardLayout>
    </SidebarProvider>
  );
}
