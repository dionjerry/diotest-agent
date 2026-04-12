'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ActionState } from '@/app/actions';
import { resetPasswordAction } from '@/app/actions';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: ActionState = {};

export function ResetPasswordForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const action = resetPasswordAction.bind(null, token);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div className="text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[4px] border border-white/8 bg-[#18191d] text-[#53dca4]">
        {'>_'}
      </div>
      <h2 className="mt-6 text-[2.25rem] font-bold tracking-[-0.05em] text-white">Reset your password</h2>
      <p className="mx-auto mt-3 max-w-[24rem] text-base leading-7 text-[#8b8d94]">
        Set a new password for <span className="text-white">{email}</span> using the active recovery token.
      </p>
      <form action={formAction} className="mx-auto mt-10 max-w-[460px] rounded-[4px] border border-white/6 bg-[#17181d] p-7 text-left">
        <div>
          <Label>Account email</Label>
          <Input
            name="email"
            type="email"
            required
            readOnly
            defaultValue={email}
            className="rounded-[2px] border-0 bg-[#0d0d10] px-4 text-[#8b8d94] read-only:cursor-not-allowed read-only:text-[#b7bac3]"
          />
        </div>
        <div>
          <Label>New password</Label>
          <Input name="password" type="password" placeholder="Minimum 8 characters" required className="rounded-[2px] border-0 bg-black px-4 text-[#8b8d94]" />
        </div>
        <div>
          <Label>Confirm password</Label>
          <Input name="confirmPassword" type="password" placeholder="Repeat password" required className="rounded-[2px] border-0 bg-black px-4 text-[#8b8d94]" />
        </div>
        <FormMessage>{state.error}</FormMessage>
        <FormMessage tone="success">{state.success}</FormMessage>
        <SubmitButton idleLabel="Update Password" pendingLabel="Updating password..." className="mt-4 h-12 w-full rounded-[2px] bg-[#53dca4] font-semibold text-[#103223] hover:bg-[#63e3af]" />
        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-[#8f9097] hover:text-white">← Back to Login</Link>
        </div>
      </form>
    </div>
  );
}

export function InvalidResetTokenState() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[4px] border border-[#5a2424] bg-[#1a1113] text-[#ff8780]">
        {'!'}
      </div>
      <h2 className="mt-6 text-[2.25rem] font-bold tracking-[-0.05em] text-white">Reset link unavailable</h2>
      <p className="mx-auto mt-3 max-w-[24rem] text-base leading-7 text-[#8b8d94]">
        This password reset link is invalid, expired, or has already been used. Request a new one to continue.
      </p>
      <div className="mx-auto mt-10 max-w-[460px] rounded-[4px] border border-white/6 bg-[#17181d] p-7 text-left">
        <FormMessage tone="error">The current recovery token can no longer be used.</FormMessage>
        <div className="mt-6 flex gap-3">
          <Link
            href="/forgot-password"
            className="flex h-12 flex-1 items-center justify-center rounded-[2px] bg-[#53dca4] font-semibold text-[#103223] hover:bg-[#63e3af]"
          >
            Request New Link
          </Link>
          <Link
            href="/login"
            className="flex h-12 flex-1 items-center justify-center rounded-[2px] border border-white/10 bg-[#111216] text-sm font-medium text-white hover:bg-[#16181d]"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
