// Copies MapLibre's web-worker bundle into public/ so Fmap can point
// maplibregl.setWorkerUrl() at a same-origin URL.
//
// MapLibre 6 derives its worker URL from `import.meta.url` of its own
// module. Turbopack rewrites that value, so the derived URL comes back
// empty and the browser starts the worker from the page URL itself — no
// tiles ever get parsed and the map stays blank. Serving the files from
// public/ sidesteps the bundler entirely. The worker imports
// ./maplibre-gl-shared.mjs, so both files are copied side by side.
//
// Runs from `postinstall`, so the copy always matches the installed
// maplibre-gl version, AND from `build`: Vercel restores node_modules from
// its build cache ("Already up to date") and skips postinstall entirely,
// so on 24/09/2026 production shipped without the worker and Fmap stayed
// blank. The output directory is gitignored.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const distDir = dirname(require.resolve("maplibre-gl/package.json"));
const targetDir = join(process.cwd(), "public", "vendor", "maplibre-gl");

mkdirSync(targetDir, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(distDir, "dist", file), join(targetDir, file));
}
