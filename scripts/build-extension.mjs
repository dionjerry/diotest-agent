import { build } from "esbuild";

const common = {
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: false,
  legalComments: "none",
  logLevel: "info"
};

await build({
  ...common,
  platform: "browser",
  entryPoints: {
    "extension/background/index": "extension/background/index.ts",
    "extension/content/pr-observer": "extension/content/pr-observer.ts",
    "extension/content/ui-recorder": "extension/content/ui-recorder.ts",
    "extension/sidepanel/main": "extension/sidepanel/main.tsx",
    "extension/popup/main": "extension/popup/main.ts"
  },
  outbase: ".",
  outdir: ".",
  splitting: false,
  minify: false
});

console.log("Built extension bundles.");
