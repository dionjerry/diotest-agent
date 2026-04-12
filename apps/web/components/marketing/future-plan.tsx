import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const roadmap = [
  'Account + organization setup',
  'Project onboarding with GitHub and integration boundaries',
  'Dashboard shell for projects, settings, and health visibility',
  'Studio scaffolding for PR workspaces, recorder review, and agent actions',
];

export function FuturePlan() {
  return (
    <section id="future" className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-10">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="p-7 lg:p-8">
          <Badge tone="warn">Future platform direction</Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-text md:text-4xl">The Studio is coming, but this site should not pretend it already shipped.</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted md:text-lg">
            Phase 1 is the honest bridge between the current extension and the hosted platform. It adds auth, onboarding, and a real application shell so the next Dashboard and Studio work lands on stable ground.
          </p>
        </Card>
        <Card className="p-7 lg:p-8">
          <div className="text-xs uppercase tracking-[0.18em] text-soft">Phase 1 foundation</div>
          <ul className="mt-5 grid gap-4 text-sm leading-7 text-zinc-200 md:text-base">
            {roadmap.map((item) => (
              <li key={item} className="flex gap-3 rounded-2xl border border-line/70 bg-zinc-950/40 px-4 py-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
