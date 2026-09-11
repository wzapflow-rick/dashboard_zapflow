import { permanentRedirect } from 'next/navigation';

export default function CampaignsRedirectPage() {
  permanentRedirect('/dashboard/marketing?tab=campanhas');
}
