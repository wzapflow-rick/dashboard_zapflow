'use client';

import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import { MotionProvider } from '@/components/providers/motion-provider';
import type { PlanAccess } from '@/lib/plan-access';

export default function DashboardClientLayout({
  children,
  planAccess,
}: {
  children: React.ReactNode;
  planAccess: PlanAccess;
}) {
  return (
    <MotionProvider>
      <SidebarProvider>
        <DashboardLayout planAccess={planAccess}>{children}</DashboardLayout>
      </SidebarProvider>
    </MotionProvider>
  );
}
