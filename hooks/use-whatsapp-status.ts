'use client';

import useSWR from 'swr';
import { getMyWhatsappStatus } from '@/app/actions/whatsapp-status';

export function useWhatsappStatus() {
  const { data, isLoading, mutate } = useSWR('whatsapp-status', () => getMyWhatsappStatus(), {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  return { status: data?.state ?? null, isLoading, refresh: mutate };
}
