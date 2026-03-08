import React from "react";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={["dt-input", className].filter(Boolean).join(" ")} {...rest} />;
}
