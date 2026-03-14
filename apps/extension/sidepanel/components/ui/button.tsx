import React from "react";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "ghost" }
) {
  const { variant = "default", className = "", ...rest } = props;
  const classes = ["dt-btn", `dt-btn--${variant}`, className].filter(Boolean).join(" ");

  return <button className={classes} {...rest} />;
}
