import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMediaLibrary } from '@/app/actions/media-library';
import { MediaLibraryManager } from '@/components/media/media-library-manager';
import { getMe } from '@/lib/session-server';

export const metadata: Metadata = {
  title: 'Acervo de mídias | Zapflow',
  description: 'Organize e gerencie as imagens dos produtos da sua loja.',
};

export const dynamic = 'force-dynamic';

export default async function MediaLibraryPage() {
  const user = await getMe();
  if (!user?.empresaId) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const { assets, total, setupRequired } = await getMediaLibrary();

  return (
    <MediaLibraryManager
      initialAssets={assets}
      initialTotal={total}
      initialSetupRequired={setupRequired}
    />
  );
}
