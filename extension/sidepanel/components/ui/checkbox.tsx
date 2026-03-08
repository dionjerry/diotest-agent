import React from "react";

export function Checkbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input type="checkbox" className={["dt-checkbox", className].filter(Boolean).join(" ")} {...rest} />;
}
