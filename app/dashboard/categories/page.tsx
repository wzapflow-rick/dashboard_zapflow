'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import CategoryManagement from '@/components/category-management';

export default function CategoriesPage() {
    return (
        <SidebarProvider>
            <DashboardLayout>
                <CategoryManagement />
            </DashboardLayout>
        </SidebarProvider>
    );
}
