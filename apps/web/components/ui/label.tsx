import type { ReactNode } from 'react';

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-sm font-medium text-zinc-200">{children}</label>;
}
