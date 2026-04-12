'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ActionState } from '@/app/actions';
import { requestPasswordResetAction } from '@/app/actions';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: ActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialState);

  return (
    <div className="text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[4px] border border-white/8 bg-[#18191d] text-[#53dca4]">
        {'>_'}
      </div>
      <h2 className="mt-6 text-[2.25rem] font-bold tracking-[-0.05em] text-white">DioTestStudio</h2>
      <p className="mx-auto mt-3 max-w-[22rem] text-base leading-7 text-[#8b8d94]">
        Enter your email to receive a recovery link for your testing environment.
      </p>
      <form action={formAction} className="mx-auto mt-10 max-w-[460px] rounded-[4px] border border-white/6 bg-[#17181d] p-7 text-left">
        <div>
          <Label>Work email address</Label>
          <Input name="email" type="email" placeholder="name@company.com" required className="rounded-[2px] border-0 bg-black px-4 text-[#8b8d94]" />
        </div>
        <FormMessage>{state.error}</FormMessage>
        <FormMessage tone="success">{state.success}</FormMessage>
        <SubmitButton idleLabel="Send Recovery Link →" pendingLabel="Preparing link..." className="mt-4 h-12 w-full rounded-[2px] bg-[#53dca4] font-semibold text-[#103223] hover:bg-[#63e3af]" />
        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-[#8f9097] hover:text-white">← Back to Login</Link>
        </div>
      </form>
      <div className="mx-auto mt-6 max-w-[460px] border-t border-white/6 pt-6 text-center text-[10px] uppercase tracking-[0.18em] text-[#54565d]">
        <div className="flex items-center justify-center gap-8">
          <span>System: Stable</span>
          <span>Node: US-East-1</span>
        </div>
        <div className="mt-6 text-[11px] tracking-[0.14em] text-[#46484f]">
          © 2024 DioTest Systems Inc. All rights reserved.
        </div>
      </div>
    </div>
  );
}
