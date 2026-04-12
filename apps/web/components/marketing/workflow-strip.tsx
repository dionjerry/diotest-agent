const steps = [
  'Install the extension and review GitHub PRs or commits with risk-aware AI assistance.',
  'Record exploratory browser sessions and keep only the meaningful steps before generation.',
  'Generate manual test cases plus a focused Playwright scenario from PR context or recorder evidence.',
  'Move into the web Dashboard and Studio as auth, onboarding, projects, and automation come online.',
];

export function WorkflowStrip() {
  return (
    <section id="community" className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-10">
      <div className="surface-card p-8 lg:p-10">
        <div className="label-kicker">Community Edition</div>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-text md:text-4xl">Use the browser extension now. Keep the cloud path open.</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted md:text-lg">
              Community Edition remains the real product today. This landing page should guide users into installation, local setup, and the future account system without rewriting the story later.
            </p>
          </div>
          <ol className="grid gap-4">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-2xl border border-line/70 bg-zinc-950/50 p-4 text-sm leading-6 text-zinc-200">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
