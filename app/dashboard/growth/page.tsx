import { permanentRedirect } from 'next/navigation';

export default function GrowthRedirectPage() {
  permanentRedirect('/dashboard/marketing?tab=divulgacao');
}
