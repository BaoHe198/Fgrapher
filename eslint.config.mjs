import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees created for the local AI worker (docs/ops/local-ai-worker.md)
    // live inside the repo, so each one is a second full checkout — complete
    // with its own .next build output. The ignores above are anchored at this
    // config's directory and so do not reach into them, which meant a single
    // worktree turned `pnpm lint` into ~1,300 files of noise and buried the
    // handful of findings that are actually about this checkout.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
