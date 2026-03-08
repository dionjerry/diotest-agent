import React from "react";
import { cn } from "../../lib/utils";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" }
) {
  const { variant = "default", className, ...rest } = props;
  return (
    <button
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50",
        variant === "default" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-100",
        className
      )}
      {...rest}
    />
  );
}
