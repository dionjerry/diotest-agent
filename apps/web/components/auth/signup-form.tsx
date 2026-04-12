'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ActionState } from '@/app/actions';
import { signupAction } from '@/app/actions';
import { GoogleSigninLink } from '@/components/auth/google-signin-link';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: ActionState = {};

export function SignupForm({ googleEnabled, googleSource }: { googleEnabled: boolean; googleSource: 'database' | 'environment' | 'none' }) {
  const [state, formAction] = useActionState(signupAction, initialState);

  return (
    <div className="text-white">
      <div className="mb-8">
        <h2 className="text-[2.25rem] font-bold tracking-[-0.05em] text-white">Create your account</h2>
        <p className="mt-3 text-base leading-7 text-[#7f8088]">Join the next generation of automated engineering.</p>
      </div>

      <div className="space-y-4">
        <GoogleSigninLink label="Sign up with Google" enabled={googleEnabled} source={googleSource} callbackUrl="/dashboard" />
        <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#54565d]">
          <span className="h-px flex-1 bg-white/6" />
          <span>Or continue with email</span>
          <span className="h-px flex-1 bg-white/6" />
        </div>
      </div>

      <form action={formAction} className="mt-8 space-y-5">
        <div>
          <Label>Full name</Label>
          <Input name="name" placeholder="John Doe" required className="rounded-[2px] border border-white/5 bg-[#14151a] px-4 text-[#8b8d94]" />
        </div>
        <div>
          <Label>Work email</Label>
          <Input name="email" type="email" placeholder="name@company.com" required className="rounded-[2px] border border-white/5 bg-[#14151a] px-4 text-[#8b8d94]" />
        </div>
        <div>
          <Label>Password</Label>
          <Input name="password" type="password" placeholder="••••••••" required className="rounded-[2px] border border-white/5 bg-[#14151a] px-4 text-[#8b8d94]" />
          <div className="mt-2 text-xs text-[#666870]">Min. 12 characters, include 1 symbol and 1 number</div>
        </div>
        <div>
          <Label>Confirm password</Label>
          <Input name="confirmPassword" type="password" placeholder="••••••••" required className="rounded-[2px] border border-white/5 bg-[#14151a] px-4 text-[#8b8d94]" />
        </div>
        <div>
          <Label>Company</Label>
          <Input name="company" placeholder="Engineering Corp" className="rounded-[2px] border border-white/5 bg-[#14151a] px-4 text-[#8b8d94]" />
        </div>
        <FormMessage>{state.error}</FormMessage>
        <SubmitButton idleLabel="Create Technical Account" pendingLabel="Creating account..." className="mt-2 h-12 w-full rounded-[2px] bg-[#53dca4] font-semibold text-[#103223] hover:bg-[#63e3af]" />
      </form>

      <div className="mt-6 text-center text-sm text-[#8f9097]">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-[#53dca4]">
          Sign in to Studio
        </Link>
      </div>

      <div className="mt-8 text-center text-[11px] leading-5 text-[#585a62]">
        By clicking continue, you agree to our{' '}
        <Link href="#" className="text-[#8f9097] underline underline-offset-2">Terms of Service</Link> and{' '}
        <Link href="#" className="text-[#8f9097] underline underline-offset-2">Privacy Policy</Link>
      </div>
    </div>
  );
}
