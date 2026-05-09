'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';

export function SubmitButton({
  idleLabel,
  pendingLabel,
  success,
  className,
}: {
  idleLabel: string;
  pendingLabel: string;
  success?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <Button type="submit" className={className} disabled={pending || showSuccess}>
      {showSuccess ? (
        <>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Saved</span>
        </>
      ) : pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        idleLabel
      )}
    </Button>
  );
}
