'use client';

import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import { MotionProvider } from '@/components/providers/motion-provider';

export default function DashboardSegmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <SidebarProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </SidebarProvider>
    </MotionProvider>
  );
}
