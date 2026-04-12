import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardStrong } from '@/components/ui/card';

const metrics = [
  { label: 'Risk scored PR reviews', value: 'PR / Commit' },
  { label: 'Recorder output modes', value: 'Manual + Playwright' },
  { label: 'Provider choice', value: 'OpenAI / OpenRouter' },
];

export function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 pb-14 pt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)] lg:px-10 lg:pb-24 lg:pt-12">
      <div className="max-w-3xl">
        <Badge tone="brand" className="mb-6">Community edition live now</Badge>
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight text-text md:text-6xl lg:text-7xl">
          The testing workspace that keeps QA in step with every code change.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted md:text-xl">
          Start with the DioTest browser extension today for PR review and recorder-driven test generation. Move into the hosted Dashboard and Studio next, without throwing away the testing knowledge you already built.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto">Start Community Setup</Button>
          </Link>
          <a href="#community" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full">Install The Extension</Button>
          </a>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {metrics.map((metric) => (
            <Card key={metric.label} className="p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-soft">{metric.label}</div>
              <div className="mt-3 text-lg font-semibold text-text">{metric.value}</div>
            </Card>
          ))}
        </div>
      </div>
      <CardStrong className="relative overflow-hidden p-6 lg:p-8">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
        <div className="grid gap-4">
          <div className="rounded-3xl border border-danger/20 bg-danger/10 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-red-100">PR #47 · Checkout flow</span>
              <Badge tone="danger">High risk 87/100</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-red-50/85">
              Payment route touched with zero existing coverage. DioTest generated 12 candidate tests and isolated one redirect failure before QA had to reproduce it manually.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-soft">Recorder session</div>
              <div className="mt-3 text-lg font-semibold text-text">Checkout smoke capture</div>
              <p className="mt-2 text-sm leading-6 text-muted">Reviewed browser steps, screenshots, page summaries, and generated cases from the kept flow.</p>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-soft">Future Studio</div>
              <div className="mt-3 text-lg font-semibold text-text">Dashboard + agent workspace</div>
              <p className="mt-2 text-sm leading-6 text-muted">Webhook-driven PR intake, review-first actions, hosted browser runs, and team integrations without losing the extension-first path.</p>
            </Card>
          </div>
          <Card className="p-5">
            <div className="flex items-center justify-between text-sm text-muted">
              <span>What ships in this phase</span>
              <span className="text-brand">Phase 1 web foundation</span>
            </div>
            <ul className="mt-4 grid gap-3 text-sm text-zinc-200">
              <li>• Landing page that reflects the real Community Edition</li>
              <li>• Email/password auth with Google OAuth-ready wiring</li>
              <li>• Onboarding that persists organization, project, GitHub, and basic system settings</li>
              <li>• Minimal signed-in shell ready for Dashboard and Studio expansion</li>
            </ul>
          </Card>
        </div>
      </CardStrong>
    </section>
  );
}
