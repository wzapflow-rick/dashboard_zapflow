'use client';

import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';

export default function DashboardSegmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </SidebarProvider>
  );
}
