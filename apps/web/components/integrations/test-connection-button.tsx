'use client';

import { useState } from 'react';

type TestState = 'idle' | 'loading' | 'success' | 'error';

export function TestConnectionButton({
  projectId,
  type,
}: {
  projectId: string;
  type: 'JIRA' | 'TRELLO' | 'GOOGLE_SHEETS';
}) {
  const [testState, setTestState] = useState<TestState>('idle');
  const [message, setMessage] = useState('');

  async function handleTest() {
    setTestState('loading');
    setMessage('');

    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, type }),
      });

      const data = (await response.json()) as { ok: boolean; message: string };
      setTestState(data.ok ? 'success' : 'error');
      setMessage(data.message);
    } catch {
      setTestState('error');
      setMessage('Request failed. Check your network connection.');
    }

    // Auto-clear success message after 6s
    setTimeout(() => {
      setTestState((current) => (current === 'success' ? 'idle' : current));
    }, 6000);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleTest}
        disabled={testState === 'loading'}
        className={`inline-flex h-9 items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition ${
          testState === 'loading'
            ? 'cursor-not-allowed border-zinc-700 bg-zinc-900 text-zinc-500'
            : testState === 'success'
              ? 'border-emerald-700/50 bg-emerald-950/60 text-emerald-400 hover:bg-emerald-950'
              : testState === 'error'
                ? 'border-red-700/40 bg-red-950/40 text-red-400 hover:bg-red-950/60'
                : 'border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500 hover:text-white'
        }`}
      >
        {testState === 'loading' ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
            Testing…
          </>
        ) : testState === 'success' ? (
          <>
            <span>✓</span>
            Connected
          </>
        ) : testState === 'error' ? (
          <>
            <span>✗</span>
            Failed – retry
          </>
        ) : (
          <>
            <span className="opacity-60">⟳</span>
            Test Connection
          </>
        )}
      </button>

      {message && testState !== 'idle' && testState !== 'loading' ? (
        <p
          className={`text-xs leading-5 ${
            testState === 'success' ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
