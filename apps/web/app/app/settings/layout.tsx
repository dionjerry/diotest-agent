import type { ReactNode } from 'react';

import { BackendUnavailable } from '@/components/system/backend-unavailable';
import { SettingsShell } from '@/components/settings/settings-shell';
import { requireOnboardedUser } from '@/lib/guards';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { user, bootstrap, unavailable, unavailableMessage } = await requireOnboardedUser();

  if (unavailable || !bootstrap) {
    return (
      <main className="min-h-screen bg-[#0a0b0e] text-white">
        <BackendUnavailable message={unavailableMessage ?? 'DioTest could not load settings data.'} />
      </main>
    );
  }

  return (
    <SettingsShell user={user} bootstrap={bootstrap}>
      {children}
    </SettingsShell>
  );
}
