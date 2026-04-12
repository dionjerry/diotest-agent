import type { ReactNode } from 'react';
import Link from 'next/link';

import { LogoLockup } from '@/components/ui/logo';

export function AuthShell({
  title,
  description,
  mode,
  children,
}: {
  title: string;
  description: string;
  mode: 'login' | 'signup';
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0d0d10]">
      <div className="mx-auto grid min-h-screen max-w-[1280px] lg:grid-cols-[1fr_1fr]">
        <section className="relative overflow-hidden border-b border-white/5 px-8 py-10 lg:border-b-0 lg:border-r lg:border-white/5 lg:px-12 lg:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_center,rgba(83,220,164,0.18),transparent_16%)]" />
          <div className="absolute bottom-[-14px] left-1/2 h-14 w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(50,255,127,0.9)_0%,rgba(24,255,193,0.85)_30%,rgba(10,20,15,0)_70%)] blur-[14px]" />
          <div className="relative flex h-full flex-col">
            <Link href="/" className="inline-flex">
              <LogoLockup studio />
            </Link>
            <div className="mt-16 max-w-[33rem] lg:mt-36">
              <h1 className="text-[3.2rem] font-bold leading-[0.96] tracking-[-0.07em] text-white lg:text-[4.3rem]">
                {title}
              </h1>
              <p className="mt-8 max-w-[32rem] text-[1.05rem] leading-10 text-[#8f9097]">
                {description}
              </p>
            </div>

            {mode === 'login' ? (
              <>
                <div className="mt-10 flex flex-wrap gap-3">
                  {['SOC2 TYPE II', '99.9% UPTIME', 'ENTERPRISE GRADE'].map((item) => (
                    <div key={item} className="rounded-[2px] bg-[#1e1f24] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b4ba]">
                      <span className="mr-2 text-[#55dba4]">●</span>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap gap-6 pt-12 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#63646b]">
                  <span>© 2024 DioTest Labs</span>
                  <span>Documentation</span>
                  <span>Support</span>
                </div>
              </>
            ) : (
              <div className="mt-auto space-y-6 pt-12">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[4px] border border-white/6 bg-[#18191e] p-5">
                    <div className="mb-4 text-[#53dca4]">⌘</div>
                    <div className="text-lg font-semibold text-white">Autonomous Execution</div>
                    <p className="mt-2 text-sm leading-6 text-[#7f8088]">
                      Zero-latency cloud infrastructure for distributed test runners.
                    </p>
                  </div>
                  <div className="rounded-[4px] border border-white/6 bg-[#18191e] p-5">
                    <div className="mb-4 text-[#53dca4]">◈</div>
                    <div className="text-lg font-semibold text-white">Encrypted Logs</div>
                    <p className="mt-2 text-sm leading-6 text-[#7f8088]">
                      End-to-end trace encryption with strict compliance standards.
                    </p>
                  </div>
                </div>
                <div className="max-w-[29rem] border-l-2 border-[#53dca4] pl-5">
                  <p className="text-lg leading-8 text-[#d3d3d7]">
                    &quot;DioTest transformed our CI/CD pipeline from a bottleneck into a competitive advantage.&quot;
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[linear-gradient(135deg,#3b4c5d,#17222f)]" />
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.12em] text-white">Marcus Chen</div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[#7f8088]">Lead Engineer, Hyperion Labs</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="flex items-center justify-center px-8 py-14 lg:px-14">
          <div className="w-full max-w-[408px]">
            {children}
            {mode === 'signup' ? (
              <div className="mt-12 text-right text-[10px] uppercase tracking-[0.16em] text-[#4f5158]">
                v2.4.0-stable // dio_test_auth_module
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
