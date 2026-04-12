'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';

export function SubmitButton({
  idleLabel,
  pendingLabel,
  className,
}: {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
