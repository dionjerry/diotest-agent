import path from "node:path";
import fs from "node:fs";
import { build } from "esbuild";

const aliasMap = {
  "@diotest/domain": path.resolve("packages/domain/src"),
  "@diotest/engine": path.resolve("packages/engine/src"),
  "@diotest/providers": path.resolve("packages/providers/src"),
  "@diotest/renderers": path.resolve("packages/renderers/src"),
};

const workspaceAliasPlugin = {
  name: "workspace-alias",
  setup(buildApi) {
    buildApi.onResolve({ filter: /^@diotest\// }, (args) => {
      for (const [prefix, target] of Object.entries(aliasMap)) {
        if (args.path === prefix || args.path.startsWith(`${prefix}/`)) {
          const suffix = args.path.slice(prefix.length + 1);
          const base = path.join(target, suffix);
          const candidates = [
            base,
            `${base}.ts`,
            `${base}.tsx`,
            path.join(base, "index.ts"),
            path.join(base, "index.tsx"),
          ];
          const resolved = candidates.find((candidate) => fs.existsSync(candidate));
          return {
            path: resolved ?? base,
          };
        }
      }
      return null;
    });
  }
};

const common = {
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
  plugins: [workspaceAliasPlugin]
};

await build({
  ...common,
  platform: "browser",
  entryPoints: {
    "apps/extension/background/index": "apps/extension/background/index.ts",
    "apps/extension/content/pr-observer": "apps/extension/content/pr-observer.ts",
    "apps/extension/content/ui-recorder": "apps/extension/content/ui-recorder.ts",
    "apps/extension/sidepanel/main": "apps/extension/sidepanel/main.tsx",
    "apps/extension/popup/main": "apps/extension/popup/main.ts"
  },
  outbase: ".",
  outdir: ".",
  splitting: false,
  minify: false
});

console.log("Built extension bundles.");
