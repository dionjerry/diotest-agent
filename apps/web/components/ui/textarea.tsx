import * as React from 'react';

import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-28 w-full rounded-2xl border border-line bg-zinc-950/70 px-4 py-3 text-sm text-text outline-none transition placeholder:text-soft focus:border-brand/70 focus:ring-4 focus:ring-brand/10',
          className,
        )}
        {...props}
      />
    );
  },
);
