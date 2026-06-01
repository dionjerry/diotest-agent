'use client';

import { useState } from 'react';

export function ExtensionConnectionCard({
  apiKey,
  apiBaseUrl,
  extensionConnectedAt,
}: {
  apiKey: string;
  apiBaseUrl: string;
  extensionConnectedAt: string | null;
}) {
  const [copied, setCopied] = useState<'url' | 'key' | null>(null);

  function copy(value: string, field: 'url' | 'key') {
    void navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="settings-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="settings-kicker">Extension</div>
          <h2 className="mt-3 text-xl font-semibold text-text">Browser extension connection</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Copy these credentials into the DioTest Extension Settings panel to connect it to this project.
            The API key is project-scoped and never expires unless regenerated.
          </p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${extensionConnectedAt ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-muted'}`}>
          {extensionConnectedAt ? 'Connected' : 'Not connected'}
        </div>
      </div>

      {extensionConnectedAt ? (
        <p className="mt-2 text-xs text-soft">Last verified: {new Date(extensionConnectedAt).toLocaleString()}</p>
      ) : null}

      <div className="mt-6 settings-card-muted divide-y divide-line rounded-md">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs text-soft">API Base URL</div>
            <div className="mt-0.5 truncate font-mono text-sm text-text">{apiBaseUrl || '—'}</div>
          </div>
          <button
            type="button"
            onClick={() => copy(apiBaseUrl, 'url')}
            disabled={!apiBaseUrl}
            className="shrink-0 rounded-[6px] bg-white/6 px-3 py-1.5 text-xs text-muted transition hover:text-text disabled:opacity-40"
          >
            {copied === 'url' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs text-soft">API Key</div>
            <div className="mt-0.5 font-mono text-sm text-text">
              {apiKey ? `${apiKey.slice(0, 12)}••••••••` : '—'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => copy(apiKey, 'key')}
            disabled={!apiKey}
            className="shrink-0 rounded-[6px] bg-white/6 px-3 py-1.5 text-xs text-muted transition hover:text-text disabled:opacity-40"
          >
            {copied === 'key' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
