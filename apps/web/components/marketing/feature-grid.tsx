import { Card } from '@/components/ui/card';

const features = [
  {
    title: 'PR review that stays explainable',
    body: 'Blend deterministic evidence with AI reasoning, surface risk drivers, and keep debug context visible instead of hiding where the result came from.',
  },
  {
    title: 'Recorder sessions become reusable tests',
    body: 'Capture exploratory flows, review noisy steps, keep what matters, and generate both manual cases and Playwright-oriented scenarios from the same session.',
  },
  {
    title: 'Community Edition stays local-first',
    body: 'Run on your own keys, keep your sidepanel workflow, and use OpenAI or OpenRouter without waiting for the cloud product to exist.',
  },
  {
    title: 'Hosted platform comes next',
    body: 'The future Dashboard and Studio add auth, onboarding, organization setup, webhooks, runs, and shared review workflows without changing the core testing model.',
  },
];

export function FeatureGrid() {
  return (
    <section id="workflow" className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-10">
      <div className="mb-10 max-w-3xl">
        <div className="label-kicker">What DioTest already does well</div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-text md:text-4xl">Extension-first today. Platform-ready by design.</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted md:text-lg">
          This first web release should support what exists now, not fake a cloud product that is not shipped. The site has to sell the extension honestly while preparing the path into the hosted Studio.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {features.map((feature) => (
          <Card key={feature.title} className="p-6 lg:p-7">
            <h3 className="text-xl font-semibold text-text">{feature.title}</h3>
            <p className="mt-3 text-sm leading-7 text-muted md:text-base">{feature.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
