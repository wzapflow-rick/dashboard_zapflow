'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import CategoryManagement from '@/components/management/category-management';

export default function CategoriesPage() {
    return (
        <SidebarProvider>
            <DashboardLayout>
                <div className="dark:bg-slate-800">
                    <CategoryManagement />
                </div>
            </DashboardLayout>
        </SidebarProvider>
    );
}
