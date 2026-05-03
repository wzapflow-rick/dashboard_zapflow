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
    <div className="min-h-screen bg-[#0a1628] flex">
      <AdminSidebar username={session.username} />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
