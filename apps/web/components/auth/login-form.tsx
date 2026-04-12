'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ActionState } from '@/app/actions';
import { loginAction } from '@/app/actions';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { GoogleSigninLink } from '@/components/auth/google-signin-link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: ActionState = {};

export function LoginForm({ googleEnabled, googleSource }: { googleEnabled: boolean; googleSource: 'database' | 'environment' | 'none' }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <div className="text-white">
      <div className="mb-8">
        <h2 className="text-[2.25rem] font-bold tracking-[-0.05em] text-white">Welcome Back</h2>
        <p className="mt-3 text-base leading-7 text-[#7f8088]">Enter your credentials to access your testing environment.</p>
      </div>

      <div className="space-y-4">
        <GoogleSigninLink label="Continue with Google" enabled={googleEnabled} source={googleSource} />
        <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#54565d]">
          <span className="h-px flex-1 bg-white/6" />
          <span>Or use email</span>
          <span className="h-px flex-1 bg-white/6" />
        </div>
      </div>

      <form action={formAction} className="mt-8 space-y-5">
        <div>
          <Label>Work Email</Label>
          <Input name="email" type="email" placeholder="name@company.com" required className="rounded-[2px] border-0 bg-black px-4 text-[#8b8d94]" />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Password</Label>
            <Link href="/forgot-password" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#53dca4]">
              Forgot Password?
            </Link>
          </div>
          <Input name="password" type="password" placeholder="••••••••" required className="rounded-[2px] border-0 bg-black px-4 text-[#8b8d94]" />
        </div>
        <FormMessage>{state.error}</FormMessage>
        <SubmitButton idleLabel="Sign In to Studio" pendingLabel="Signing in..." className="h-12 w-full rounded-[2px] bg-[#53dca4] font-semibold text-[#103223] hover:bg-[#63e3af]" />
      </form>

      <div className="mt-6 text-center text-sm text-[#8f9097]">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-semibold text-white">
          Request Access
        </Link>
      </div>

      <div className="mt-10 rounded-[4px] border border-white/6 bg-[#17181d] px-5 py-4 text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="h-5 w-5 rounded-full bg-[#8c6f57]" />
          <span className="h-5 w-5 rounded-full bg-[#556d84]" />
          <span className="h-5 w-5 rounded-full bg-[#2b2f38] text-[10px] leading-5 text-white">+</span>
        </div>
        <div className="mt-2 text-xs text-[#8f9097]">Joined by 2.4k+ engineers this week</div>
      </div>

    </div>
  );
}
