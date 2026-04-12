import * as React from 'react';

import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-2xl border border-line bg-zinc-950/70 px-4 text-sm text-text outline-none transition placeholder:text-soft focus:border-brand/70 focus:ring-4 focus:ring-brand/10',
          className,
        )}
        {...props}
      />
    );
  },
);
