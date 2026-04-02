'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import InsumosManagement from '@/components/insumos/insumos-management';

export default function InsumosPage() {
    return (
        <SidebarProvider>
            <DashboardLayout>
                <div className="dark:bg-slate-800">
                    <InsumosManagement />
                </div>
            </DashboardLayout>
        </SidebarProvider>
    );
}
