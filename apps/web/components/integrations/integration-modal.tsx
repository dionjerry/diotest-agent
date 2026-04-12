'use client';

import { useRef, useState } from 'react';

export type IntegrationProvider = 'JIRA' | 'TRELLO' | 'GOOGLE_SHEETS';

// ─── Types ───────────────────────────────────────────────────────────────────

type TrelloPreview = { boardName: string; lists: Array<{ id: string; name: string }>; sampleCardUrl?: string; sampleCardError?: string };
type JiraPreview = { displayName: string; projectName?: string; sampleIssueKey?: string; sampleIssueUrl?: string };
type SheetsPreview = { title: string; sheets: string[]; sampleRowAdded?: boolean };
type PreviewData = TrelloPreview | JiraPreview | SheetsPreview;

type ModalState = 'form' | 'testing' | 'verified' | 'error' | 'saving' | 'saved';

const PROVIDER_META: Record<IntegrationProvider, { label: string; description: string; icon: string; color: string }> = {
  JIRA: {
    label: 'Jira',
    description: 'Issue Management — automatically create and update bug reports on test failures.',
    icon: 'J',
    color: 'bg-[#0052CC]',
  },
  TRELLO: {
    label: 'Trello',
    description: 'Agile Board Sync — push test outcomes directly to your Trello board.',
    icon: 'T',
    color: 'bg-[#0052CC]',
  },
  GOOGLE_SHEETS: {
    label: 'Google Sheets',
    description: 'Ticket Export — export test results and bug logs to a shared spreadsheet.',
    icon: 'G',
    color: 'bg-[#0F9D58]',
  },
};

// ─── Per-provider field helpers ───────────────────────────────────────────────

function JiraFields({ defaults }: { defaults?: Record<string, string> }) {
  return (
    <>
      <FieldGroup label="Jira base URL" hint="e.g. https://your-team.atlassian.net">
        <input name="baseUrl" defaultValue={defaults?.baseUrl} placeholder="https://your-team.atlassian.net" className={inputCls} />
      </FieldGroup>
      <FieldRow>
        <FieldGroup label="Project key" hint="e.g. DIO">
          <input name="projectKey" defaultValue={defaults?.projectKey} placeholder="DIO" className={inputCls} />
        </FieldGroup>
        <FieldGroup label="Issue type" hint="Task, Bug, Story…">
          <input name="issueType" defaultValue={defaults?.issueType ?? 'Task'} placeholder="Task" className={inputCls} />
        </FieldGroup>
      </FieldRow>
      <div className="mt-2 rounded-[6px] border border-white/6 bg-[#111216] px-4 py-3 text-xs text-[#8a8d94]">
        Credentials — stored encrypted and never logged
      </div>
      <FieldGroup label="Atlassian account email">
        <input name="email" type="email" defaultValue={defaults?.email} placeholder="name@company.com" className={inputCls} />
      </FieldGroup>
      <FieldGroup label="Jira API token">
        <input name="apiToken" type="password" placeholder="Paste your Atlassian API token" className={inputCls} autoComplete="off" />
      </FieldGroup>
    </>
  );
}

function TrelloFields({ defaults }: { defaults?: Record<string, string> }) {
  return (
    <>
      <FieldGroup label="Board ID" hint="From your board URL: trello.com/b/BOARD_ID/board-name">
        <input name="boardId" defaultValue={defaults?.boardId} placeholder="e.g. aBcDeF12" className={inputCls} />
      </FieldGroup>
      <FieldGroup label="Default list ID" hint="Optional — which column to create cards in">
        <input name="defaultListId" defaultValue={defaults?.defaultListId} placeholder="Optional list ID" className={inputCls} />
      </FieldGroup>
      <div className="mt-2 rounded-[6px] border border-white/6 bg-[#111216] px-4 py-3 text-xs text-[#8a8d94]">
        Credentials — stored encrypted and never logged
      </div>
      <FieldGroup label="Trello API key" hint="From trello.com/app-key → Key">
        <input name="apiKey" type="password" placeholder="Paste your Trello API key" className={inputCls} autoComplete="off" />
      </FieldGroup>
      <FieldGroup label="Trello token" hint="From your API Tokens page">
        <input name="token" type="password" placeholder="Paste your Trello token" className={inputCls} autoComplete="off" />
      </FieldGroup>
    </>
  );
}

function SheetsFields({ defaults }: { defaults?: Record<string, string> }) {
  return (
    <>
      <FieldRow>
        <FieldGroup label="Spreadsheet ID" hint="From the spreadsheet URL">
          <input name="spreadsheetId" defaultValue={defaults?.spreadsheetId} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" className={inputCls} />
        </FieldGroup>
        <FieldGroup label="Sheet (tab) name">
          <input name="sheetName" defaultValue={defaults?.sheetName} placeholder="Tickets" className={inputCls} />
        </FieldGroup>
      </FieldRow>
      <div className="mt-2 rounded-[6px] border border-white/6 bg-[#111216] px-4 py-3 text-xs text-[#8a8d94]">
        Credentials — stored encrypted and never logged
      </div>
      <FieldGroup label="Service account JSON">
        <textarea
          name="serviceAccountJson"
          placeholder={`{"type":"service_account","client_email":"...","private_key":"..."}`}
          className={`${inputCls} min-h-[120px] resize-none`}
          autoComplete="off"
        />
      </FieldGroup>
    </>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-[6px] border border-white/8 bg-[#0d0e12] px-4 py-3 text-sm text-white placeholder:text-[#4f5259] outline-none focus:border-[#53dca4]/50 focus:ring-2 focus:ring-[#53dca4]/10 transition';

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[#8f929c]">
        {label}
        {hint ? <span className="ml-2 normal-case tracking-normal text-[#555861]">— {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

// ─── Preview panels ───────────────────────────────────────────────────────────

function TrelloPreviewPanel({
  preview,
  onCreateSample,
  onSave,
  onReset,
}: {
  preview: TrelloPreview;
  onCreateSample: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[8px] border border-[#2f6d55] bg-[#0f2b22] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-[#53dca4]">✓</span>
          <span className="text-sm font-semibold text-white">Connected to board "{preview.boardName}"</span>
        </div>
        {preview.sampleCardUrl ? (
          <div className="mt-3 text-sm text-[#8fdaaf]">
            Sample card created →{' '}
            <a href={preview.sampleCardUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
              View on Trello ↗
            </a>
          </div>
        ) : preview.sampleCardError ? (
          <div className="mt-3 flex items-start gap-2 rounded-[6px] bg-amber-950/40 border border-amber-800/40 px-3 py-2 text-xs text-amber-400">
            <span className="shrink-0">⚠</span>
            <span>Sample card could not be created: {preview.sampleCardError}</span>
          </div>
        ) : null}
      </div>

      {preview.lists.length > 0 ? (
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#7f828a]">Board lists</div>
          <div className="flex flex-wrap gap-2">
            {preview.lists.slice(0, 8).map((list) => (
              <span key={list.id} className="rounded-[4px] border border-white/8 bg-[#1a1b20] px-3 py-1.5 text-xs text-[#c6c8cf]">
                {list.name}
              </span>
            ))}
            {preview.lists.length > 8 ? (
              <span className="rounded-[4px] bg-white/5 px-3 py-1.5 text-xs text-[#666870]">+{preview.lists.length - 8} more</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <PreviewActions onCreateSample={onCreateSample} onSave={onSave} onReset={onReset} />
    </div>
  );
}

function JiraPreviewPanel({
  preview,
  onCreateSample,
  onSave,
  onReset,
}: {
  preview: JiraPreview;
  onCreateSample: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[8px] border border-[#2f6d55] bg-[#0f2b22] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-[#53dca4]">✓</span>
          <span className="text-sm font-semibold text-white">Connected as {preview.displayName}</span>
        </div>
        {preview.projectName ? (
          <div className="mt-2 text-sm text-[#8fdaaf]">Project: {preview.projectName}</div>
        ) : null}
        {preview.sampleIssueUrl ? (
          <div className="mt-3 text-sm text-[#8fdaaf]">
            Sample issue {preview.sampleIssueKey} created →{' '}
            <a href={preview.sampleIssueUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
              View in Jira ↗
            </a>
          </div>
        ) : null}
      </div>
      <PreviewActions onCreateSample={onCreateSample} onSave={onSave} onReset={onReset} />
    </div>
  );
}

function SheetsPreviewPanel({
  preview,
  onCreateSample,
  onSave,
  onReset,
}: {
  preview: SheetsPreview;
  onCreateSample: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[8px] border border-[#2f6d55] bg-[#0f2b22] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-[#53dca4]">✓</span>
          <span className="text-sm font-semibold text-white">Connected to "{preview.title}"</span>
        </div>
        {preview.sampleRowAdded ? (
          <div className="mt-2 text-sm text-[#8fdaaf]">Verification row appended successfully.</div>
        ) : null}
      </div>

      {preview.sheets.length > 0 ? (
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#7f828a]">Sheets (tabs)</div>
          <div className="flex flex-wrap gap-2">
            {preview.sheets.map((s) => (
              <span key={s} className="rounded-[4px] border border-white/8 bg-[#1a1b20] px-3 py-1.5 text-xs text-[#c6c8cf]">
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <PreviewActions onCreateSample={onCreateSample} onSave={onSave} onReset={onReset} />
    </div>
  );
}

function PreviewActions({
  onCreateSample,
  onSave,
  onReset,
}: {
  onCreateSample: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={onCreateSample}
        className="h-11 rounded-[6px] border border-white/8 px-4 text-sm font-semibold text-[#c8cad0] transition hover:border-white/20 hover:text-white"
      >
        Create Sample Record
      </button>
      <button
        type="button"
        onClick={onSave}
        className="flex h-11 items-center gap-2 rounded-[6px] bg-[#53dca4] px-6 text-sm font-semibold text-[#063523] transition hover:bg-[#66e6b1]"
      >
        Save & Connect →
      </button>
      <button
        type="button"
        onClick={onReset}
        className="h-11 rounded-[6px] border border-white/8 px-4 text-sm text-[#9a9da5] transition hover:border-white/20 hover:text-white"
      >
        Edit credentials
      </button>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function IntegrationModal({
  projectId,
  provider,
  existingConfig,
  hasStoredSecret = false,
  onClose,
  onSaved,
}: {
  projectId: string;
  provider: IntegrationProvider;
  existingConfig?: Record<string, string>;
  hasStoredSecret?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [pendingConfig, setPendingConfig] = useState<Record<string, string>>({});
  const [pendingSecret, setPendingSecret] = useState<Record<string, string>>({});

  const meta = PROVIDER_META[provider];

  function extractFields(): { config: Record<string, string> | null; secret: Record<string, string> | null } {
    if (!formRef.current) return { config: null, secret: null };
    const data = new FormData(formRef.current);

    if (provider === 'JIRA') {
      const baseUrl = String(data.get('baseUrl') ?? '');
      if (!baseUrl) return { config: null, secret: null };
      return {
        config: { baseUrl, projectKey: String(data.get('projectKey') ?? ''), issueType: String(data.get('issueType') ?? 'Task') },
        secret: { email: String(data.get('email') ?? ''), apiToken: String(data.get('apiToken') ?? '') },
      };
    }
    if (provider === 'TRELLO') {
      const boardId = String(data.get('boardId') ?? '');
      if (!boardId) return { config: null, secret: null };
      return {
        config: { boardId, defaultListId: String(data.get('defaultListId') ?? '') },
        secret: { apiKey: String(data.get('apiKey') ?? ''), token: String(data.get('token') ?? '') },
      };
    }
    // GOOGLE_SHEETS
    const spreadsheetId = String(data.get('spreadsheetId') ?? '');
    if (!spreadsheetId) return { config: null, secret: null };
    return {
      config: { spreadsheetId, sheetName: String(data.get('sheetName') ?? '') },
      secret: { serviceAccountJson: String(data.get('serviceAccountJson') ?? '') },
    };
  }

  async function runTest(createSample: boolean) {
    const { config, secret } = extractFields();

    if (config) setPendingConfig(config);
    if (secret && Object.values(secret).some(v => v !== '')) setPendingSecret(secret);

    setModalState('testing');
    setErrorMsg('');

    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          type: provider, 
          config: config ?? undefined, 
          secret: secret && Object.values(secret).some(v => v !== '') ? secret : undefined, 
          projectId,
          createSample,
        }),
      });
      const data = (await res.json()) as { ok: boolean; message: string; preview?: PreviewData };

      if (data.ok) {
        setPreview(data.preview ?? null);
        setModalState('verified');
      } else {
        setErrorMsg(data.message);
        setModalState('error');
      }
    } catch {
      setErrorMsg('Request failed. Check your network connection.');
      setModalState('error');
    }
  }

  async function handleSave() {
    if (Object.keys(pendingConfig).length === 0 || Object.keys(pendingSecret).length === 0) {
      setErrorMsg('Run a successful connection test before saving.');
      setModalState('error');
      return;
    }

    setModalState('saving');
    setErrorMsg('');

    try {
      const response = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          type: provider,
          config: pendingConfig,
          secret: pendingSecret,
        }),
      });
      const data = (await response.json()) as { ok: boolean; message: string };

      if (!data.ok) {
        setErrorMsg(data.message);
        setModalState('error');
        return;
      }

      setModalState('saved');
      setTimeout(() => onSaved(), 400);
    } catch {
      setErrorMsg('Save failed. Try again.');
      setModalState('error');
    }
  }

  const isTesting = modalState === 'testing';
  const isSaving = modalState === 'saving' || modalState === 'saved';

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-[660px] flex-col overflow-hidden rounded-[12px] border border-white/8 bg-[#15161b] shadow-[0_40px_120px_rgba(0,0,0,0.7)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/6 px-7 py-5">
          <div className="flex items-center gap-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-[8px] ${meta.color} text-base font-bold text-white`}>
              {meta.icon}
            </div>
            <div>
              <div className="text-lg font-semibold text-white">Connect {meta.label}</div>
              <div className="text-xs text-[#7f828a]">{meta.description}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#787b83] transition hover:bg-white/8 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {/* Step indicators */}
          <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
            {['Credentials', 'Test & Verify', 'Save'].map((step, i) => {
              const stepIdx = modalState === 'form' || modalState === 'testing' || modalState === 'error' ? 0 : modalState === 'verified' ? 1 : 2;
              const active = i === stepIdx;
              const complete = i < stepIdx;
              return (
                <div key={step} className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${active ? 'border-[#53dca4] text-[#53dca4]' : complete ? 'border-[#53dca4] bg-[#53dca4] text-[#063523]' : 'border-white/15 text-[#555861]'}`}>
                    {complete ? '✓' : i + 1}
                  </span>
                  <span className={active || complete ? 'text-white' : 'text-[#555861]'}>{step}</span>
                  {i < 2 ? <span className="text-[#333538]">—</span> : null}
                </div>
              );
            })}
          </div>

          {/* Form (shown in form / error states) */}
          {(modalState === 'form' || modalState === 'testing' || modalState === 'error') ? (
            <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-4">
              {provider === 'JIRA' && <JiraFields defaults={existingConfig} />}
              {provider === 'TRELLO' && <TrelloFields defaults={existingConfig} />}
              {provider === 'GOOGLE_SHEETS' && <SheetsFields defaults={existingConfig} />}

              {hasStoredSecret ? (
                <div className="rounded-[6px] border border-[#2f6d55]/35 bg-[#0f2b22]/60 px-4 py-3 text-sm text-[#8fdaaf]">
                  Stored encrypted credentials were found for this provider. Leave the secret fields blank to retest the saved connection, or paste new credentials to replace them after saving.
                </div>
              ) : (
                <div className="rounded-[6px] border border-[#5f4719]/40 bg-[#1e1708]/70 px-4 py-3 text-sm text-[#ebb04e]">
                  Credentials are not saved yet. If you refresh before clicking <span className="font-semibold text-white">Save &amp; Connect</span>, you will need to enter them again.
                </div>
              )}

              {modalState === 'error' ? (
                <div className="flex items-start gap-3 rounded-[6px] border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                  <span className="mt-0.5 shrink-0">✗</span>
                  <span>{errorMsg}</span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => runTest(false)}
                disabled={isTesting}
                className={`mt-2 flex h-12 w-full items-center justify-center gap-3 rounded-[6px] text-sm font-semibold transition ${
                  isTesting
                    ? 'cursor-not-allowed bg-[#1c1e24] text-[#5a5d66]'
                    : 'bg-[#1e3d31] text-[#53dca4] hover:bg-[#243f35]'
                }`}
              >
                {isTesting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2a3830] border-t-[#53dca4]" />
                    Testing connection…
                  </>
                ) : (
                  <>
                    <span>⟳</span>
                    Test Connection
                  </>
                )}
              </button>
            </form>
          ) : null}

          {/* Preview (shown after successful test) */}
          {modalState === 'verified' && preview ? (
            <>
              {provider === 'TRELLO' && (
                <TrelloPreviewPanel
                  preview={preview as TrelloPreview}
                  onCreateSample={() => runTest(true)}
                  onSave={handleSave}
                  onReset={() => setModalState('form')}
                />
              )}
              {provider === 'JIRA' && (
                <JiraPreviewPanel
                  preview={preview as JiraPreview}
                  onCreateSample={() => runTest(true)}
                  onSave={handleSave}
                  onReset={() => setModalState('form')}
                />
              )}
              {provider === 'GOOGLE_SHEETS' && (
                <SheetsPreviewPanel
                  preview={preview as SheetsPreview}
                  onCreateSample={() => runTest(true)}
                  onSave={handleSave}
                  onReset={() => setModalState('form')}
                />
              )}
            </>
          ) : null}

          {/* Saving state */}
          {isSaving ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {modalState === 'saved' ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#2f6d55] bg-[#0f2b22] text-3xl text-[#53dca4]">✓</div>
                  <div className="mt-4 text-lg font-semibold text-white">{meta.label} connected!</div>
                  <div className="mt-2 text-sm text-[#8a8d94]">Credentials saved and encrypted.</div>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#1e3225] border-t-[#53dca4]" />
                  <div className="mt-4 text-sm text-[#8a8d94]">Saving credentials…</div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
