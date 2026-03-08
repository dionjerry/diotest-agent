import React, { useMemo } from "react";
import { js as beautifyJs } from "js-beautify";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import ts from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";

SyntaxHighlighter.registerLanguage("typescript", ts);
SyntaxHighlighter.registerLanguage("json", json);

interface Props {
  value: string;
  language?: "text" | "typescript" | "json";
  expanded?: boolean;
}

function maybeBeautify(value: string, language: "text" | "typescript" | "json"): string {
  if (!value.trim()) {
    return value;
  }

  try {
    if (language === "json") {
      return JSON.stringify(JSON.parse(value), null, 2);
    }

    if (language === "typescript") {
      return beautifyJs(value, {
        indent_size: 2,
        preserve_newlines: true,
        max_preserve_newlines: 2,
        wrap_line_length: 120
      });
    }
  } catch {
    return value;
  }

  return value;
}

export function CodeViewer({ value, language = "text", expanded = false }: Props) {
  const formatted = useMemo(() => maybeBeautify(value, language), [value, language]);

  return (
    <div className={`code-viewer ${expanded ? "expanded" : ""}`}>
      <SyntaxHighlighter
        language={language === "text" ? "typescript" : language}
        style={atomOneDark}
        customStyle={{
          margin: 0,
          borderRadius: 10,
          background: "#050b17",
          fontSize: 12,
          lineHeight: 1.45,
          padding: 12,
          border: "1px solid #2a3a59"
        }}
        wrapLongLines
        showLineNumbers={expanded}
      >
        {formatted}
      </SyntaxHighlighter>
    </div>
  );
}
