import { cn } from '@/lib/utils';

const stepLabels = ['Organization', 'Project', 'GitHub', 'Setup'];

export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="space-y-4">
      {stepLabels.map((label, index) => {
        const step = index + 1;
        const complete = step < currentStep;
        const active = step === currentStep;

        return (
          <div key={label} className="flex items-start gap-3">
            <span
              className={cn(
                'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                complete || active
                  ? 'border-[#53dca4] bg-[#53dca4] text-[#082118]'
                  : 'border-white/10 bg-transparent text-[#5f6168]',
              )}
            >
              {step}
            </span>
            <div>
              <div className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', active || complete ? 'text-[#53dca4]' : 'text-[#52545b]')}>Step {String(step).padStart(2, '0')}</div>
              <div className={cn('mt-1 text-base font-medium', active ? 'text-white' : complete ? 'text-[#d4d4d8]' : 'text-[#666870]')}>
                {label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
