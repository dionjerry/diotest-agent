import Link from 'next/link';

import { Button } from '@/components/ui/button';

const navLinks = ['Product', 'Solutions', 'Docs', 'Pricing'];

const heroLogs = [
  { time: '09:42:11', level: 'INFO', message: 'Detected change in /src/api/auth.ts.' },
  { time: '09:42:12', level: 'AGENT', message: 'Generating contextual test vectors.' },
  { time: '09:42:15', level: 'WARN', message: 'Legacy session-handler identified. Injecting fallback suite.' },
  { time: '09:42:18', level: 'RUN', message: 'Executing 14 parallel runners in region: us-east-1' },
];

const heroStats = [
  { label: 'Coverage', value: '94.2%', tone: 'text-brand' },
  { label: 'Time Saved', value: '1.4h', tone: 'text-brand' },
  { label: 'Risk Score', value: 'LOW', tone: 'text-[#ee7d77]' },
  { label: 'Agents Active', value: '128', tone: 'text-brand' },
];

const socialProofBlocks = [128, 96, 160, 112, 144];

const footerLinks = ['Privacy', 'Terms', 'Status', 'Twitter'];

export function LandingPage() {
  return (
    <main className="bg-[#0e0e10] text-text">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-[#0e0e10]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold tracking-[-0.05em] text-text">
              DioTest
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              {navLinks.map((item) => (
                <a
                  key={item}
                  href="#"
                  className="text-sm font-medium tracking-[-0.025em] text-zinc-400 transition hover:text-text"
                >
                  {item}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-medium tracking-[-0.025em] text-zinc-400 transition hover:text-text md:inline-flex">
              Login
            </Link>
            <Link href="/signup">
              <Button
                size="sm"
                className="rounded-md bg-brand px-4 text-sm font-semibold text-[#004a31] hover:bg-emerald-400"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="overflow-hidden px-6 pb-24 pt-20 md:pt-24 lg:px-6">
        <div className="mx-auto max-w-[1280px]">
          <div className="relative">
            <div className="absolute right-0 top-[-8rem] h-[32rem] w-[38rem] rounded-full bg-[rgba(78,222,163,0.05)] blur-[90px]" />
            <div className="relative grid gap-12 xl:grid-cols-[768px_minmax(0,1fr)] xl:items-start">
              <div className="max-w-[768px]">
                <div className="inline-flex items-center gap-2 rounded-xl border border-[rgba(78,222,163,0.2)] bg-[rgba(0,82,54,0.3)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-brand">
                  <span className="h-2 w-2 rounded-full bg-brand" />
                  v2.4.0 Engine Live
                </div>

                <h1 className="mt-8 max-w-[768px] text-[3.25rem] font-bold leading-[0.96] tracking-[-0.06em] text-text sm:text-[4.25rem] lg:text-[5.1rem]">
                  <span className="block">The testing-agent</span>
                  <span className="block">platform that turns code</span>
                  <span className="block">
                    changes into <span className="text-brand">reusable</span>
                  </span>
                  <span className="block text-brand">test knowledge</span>
                </h1>

                <p className="mt-8 max-w-[36rem] text-base leading-[1.65] text-[#9d9da6] sm:text-lg">
                  DioTest autonomously analyzes pull requests, orchestrates containerized test runs, and synchronizes browser recordings into a permanent knowledge base for your engineering team.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="h-[62px] rounded-md bg-brand px-8 text-base font-bold text-[#004a31] hover:bg-emerald-400"
                    >
                      Start Deploying Free
                    </Button>
                  </Link>
                  <a href="#docs">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="h-[62px] rounded-md border-lineStrong bg-transparent px-8 text-base font-semibold"
                    >
                      View Documentation
                    </Button>
                  </a>
                </div>
              </div>

              <div className="relative">
                <div className="rounded-[6px] border border-[rgba(39,39,42,0.8)] bg-black/90 p-4 shadow-panel">
                  <div className="rounded-[2px] border border-[rgba(71,71,78,0.25)] bg-[#131316] p-4">
                    <div className="space-y-3 font-mono text-[13px]">
                      {heroLogs.map((line) => (
                        <div key={`${line.time}-${line.level}`} className="flex flex-wrap gap-x-4 gap-y-1 leading-[1.625]">
                          <span className="text-[#52525b]">{line.time}</span>
                          <span
                            className={
                              line.level === 'AGENT'
                                ? 'text-[#4edea3]'
                                : line.level === 'WARN'
                                  ? 'text-[#ffb148]'
                                  : 'text-[#d4d4d8]'
                            }
                          >
                            [{line.level}]
                          </span>
                          <span className="text-[#d4d4d8]">{line.message}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {heroStats.map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-[2px] border border-[rgba(78,222,163,0.1)] bg-[#1f1f24] px-4 py-4"
                        >
                          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#71717a]">
                            {stat.label}
                          </div>
                          <div className={`mt-1 font-mono text-[20px] font-bold leading-7 ${stat.tone}`}>
                            {stat.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#18181b] bg-black py-12">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#52525b]">
            Trusted by Technical Teams at
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-12 opacity-40">
            {socialProofBlocks.map((width, index) => (
              <div key={index} className="h-6 rounded-[2px] bg-[#3f3f46]" style={{ width }} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-[1280px] gap-4 md:grid-cols-12">
          <article className="rounded-[4px] border border-[rgba(71,71,78,0.1)] bg-[#19191d] p-10 md:col-span-8">
            <div className="text-brand">◌</div>
            <h2 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-text">Autonomous PR Analysis</h2>
            <p className="mt-4 max-w-[32rem] text-base leading-[1.65] text-[#9d9da6]">
              Every time a developer pushes code, DioTest dissects the AST changes to determine exactly which user flows are affected, automatically generating targeted regression tests.
            </p>
            <div className="mt-8 rounded-[2px] border border-[rgba(71,71,78,0.2)] bg-black p-[17px]">
              <div className="h-48 rounded-[2px] bg-[radial-gradient(circle_at_top_left,rgba(78,222,163,0.28),transparent_35%),linear-gradient(135deg,#05110d_0%,#0b1f18_35%,#07110d_100%)]">
                <div className="h-full w-full bg-[linear-gradient(120deg,transparent_0%,rgba(78,222,163,0.15)_25%,transparent_55%),repeating-linear-gradient(0deg,rgba(255,255,255,0.02),rgba(255,255,255,0.02)_1px,transparent_1px,transparent_20px)]" />
              </div>
            </div>
          </article>

          <article className="rounded-[4px] border border-[rgba(71,71,78,0.1)] bg-[#19191d] p-10 md:col-span-4">
            <div className="text-brand">⌙</div>
            <h2 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-text">Recorder Sync</h2>
            <p className="mt-4 text-base leading-[1.65] text-[#9d9da6]">
              Turn manual browser interactions into immutable test scripts. Sync directly from Chrome to your CI/CD.
            </p>
            <div className="mt-6 space-y-3">
              {['auth_flow_v2.mp4 -> .ts', 'checkout_retry.mp4 -> .ts'].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-[2px] border border-[rgba(71,71,78,0.2)] bg-[#1f1f24] p-3"
                >
                  <span className="h-3 w-3 rounded-full bg-brand/80" />
                  <span className="font-mono text-xs text-[#a1a1aa]">{item}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[4px] border border-[rgba(71,71,78,0.1)] bg-[#19191d] p-10 md:col-span-4">
            <div className="text-brand">▣</div>
            <h2 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-text">Run Orchestration</h2>
            <p className="mt-4 text-base leading-[1.65] text-[#9d9da6]">
              Parallelize thousands of tests across a global container grid. Zero configuration required for horizontal scaling.
            </p>
          </article>

          <article className="rounded-[4px] border border-[rgba(71,71,78,0.1)] bg-[#19191d] p-10 md:col-span-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_347px]">
              <div>
                <div className="text-brand">◫</div>
                <h2 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-text">The Test Knowledge Base</h2>
                <p className="mt-4 max-w-[22rem] text-base leading-[1.65] text-[#9d9da6]">
                  DioTest doesn't just run tests; it learns your application. It builds a graph of dependencies that prevents duplicate testing and accelerates developer feedback loops.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['Latency', '14ms'],
                  ['Uptime', '99.99%'],
                  ['Isolation', 'L3 Pod'],
                  ['Engine', 'V8-Dio'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[2px] bg-[#1f1f24] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#71717a]">{label}</div>
                    <div className="mt-1 font-mono text-base text-text">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-[1024px] overflow-hidden rounded-[8px] bg-brand px-8 py-12 text-center text-[#004a31] sm:px-12">
          <div className="absolute" />
          <h2 className="text-[2rem] font-extrabold tracking-[-0.05em] sm:text-5xl">
            Ready to automate your test knowledge?
          </h2>
          <p className="mx-auto mt-6 max-w-[30rem] text-lg leading-7 text-[#004a31]/80">
            Join 1,200+ engineering teams reducing their test-suite maintenance by 85% with DioTest agents.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button className="rounded-md bg-[#004a31] px-8 text-[#4edea3] hover:bg-[#00563a]">
                Deploy Now
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="rounded-md border-2 border-[#004a31] px-8 text-[#004a31] hover:bg-[#004a31]/10"
            >
              Schedule Technical Demo
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#18181b] px-6 py-12">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-bold lowercase tracking-[-0.05em] text-[#d4d4d8]">diotest.io</div>
            <div className="mt-4 text-xs uppercase tracking-[0.1em] text-[#52525b]">
              © 2024 DioTest Inc. Technical Excellence.
            </div>
          </div>
          <div className="flex flex-wrap gap-8">
            {footerLinks.map((item) => (
              <a key={item} href="#" className="text-xs uppercase tracking-[0.1em] text-[#71717a] transition hover:text-text">
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
