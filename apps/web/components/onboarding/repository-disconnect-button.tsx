'use client';

import { useState } from 'react';

export function DisconnectRepositoryButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    if (!confirm('Clear the current repository selection? You can select a different one after.')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/disconnect-repository', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (res.ok) {
        // Reload to get fresh bootstrap data
        window.location.reload();
      } else {
        alert('Failed to disconnect');
      }
    } catch (error) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDisconnect}
      disabled={loading}
      className="rounded-[6px] border border-[#d97706] bg-[#78350f]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#fbbf24] transition hover:bg-[#78350f]/40 disabled:opacity-50"
    >
      {loading ? 'Disconnecting...' : 'Clear & Select Different'}
    </button>
  );
}
