import { redirect } from 'next/navigation';
import { getAdminSession } from '@/app/actions/admin-auth';
import AdminSidebar from '@/components/admin/admin-sidebar';

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    redirect('/admin');
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <AdminSidebar username={session.username} />
      <main className="lg:ml-64 pt-20 lg:pt-0 p-4 lg:p-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}
