import React from "react";
import { cn } from "../../lib/utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100", props.className)} {...props} />;
}
