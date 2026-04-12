import * as React from 'react';

import { cn } from '@/lib/utils';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand text-emerald-950 hover:bg-emerald-400 focus-visible:ring-brand/40',
  secondary: 'border border-line bg-panelStrong text-text hover:border-lineStrong hover:bg-zinc-800/90 focus-visible:ring-lineStrong/40',
  ghost: 'text-text hover:bg-zinc-800/70 focus-visible:ring-lineStrong/30',
  danger: 'bg-danger text-white hover:bg-red-400 focus-visible:ring-danger/30',
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-[0.95rem]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
