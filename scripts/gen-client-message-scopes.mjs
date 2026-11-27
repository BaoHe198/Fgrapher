// Works out which translation namespaces each area of the app needs IN THE
// BROWSER, and writes src/i18n/client-message-scopes.generated.ts.
//
// Why this exists (27/11/2026): the root layout used to hand the whole
// catalogue (343 KB) to NextIntlClientProvider, so it travelled inside every
// page's HTML — three quarters of each page, admin strings included for a
// first-time visitor — and it grew with every feature. Server Components
// never needed that: they read the catalogue on the server. Only Client
// Components read it from the provider, and each asks for a namespace by
// name: useTranslations("publicPages.browse"). So the names can be collected
// from the source.
//
// How: walk the import graph from every file of an area, keep the files that
// end up in a client bundle (a "use client" file and everything it imports),
// and collect the namespace each of those passes to useTranslations(). The
// result errs towards too much, never too little: a namespace mentioned in a
// comment, or in a file an area imports but never renders, is still included.
//
// Run: `pnpm i18n:scopes` (also runs before `pnpm dev` and inside
// `pnpm build`). src/i18n/__tests__/client-message-scopes.test.ts fails when
// the committed file is behind the source, and tells you to run it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Areas that wrap their pages in <ScopedMessages scope="…"> (their
 * layout.tsx). Everything else under src/app, and the root layout itself,
 * belongs to "root", whose namespaces every page receives.
 */
export const SCOPE_DIRS = {
  admin: "src/app/(admin)",
  auth: "src/app/(auth)",
  dashboard: "src/app/(dashboard)",
  focus: "src/app/(focus)",
  public: "src/app/(public)",
  onboarding: "src/app/onboarding",
};

const SOURCE = /\.(ts|tsx)$/;

function listSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, out);
    else if (
      SOURCE.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

function readFileFacts(file, resolve) {
  const source = fs.readFileSync(file, "utf8");

  // The directive must be the first statement; only comments may precede it.
  const body = source.replace(/^(\s*\/\/[^\n]*\n|\s*\/\*[\s\S]*?\*\/\s*)*/, "");
  const isClient = /^\s*["']use client["']/.test(body);

  // Static imports, re-exports and import("…"). `import type` is skipped: it
  // is erased and pulls nothing into a bundle.
  const imports = new Set();
  const importRe =
    /(?:import|export)\s+(type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  for (let m; (m = importRe.exec(source));) {
    if (m[1]) continue;
    const target = resolve(file, m[2] ?? m[3]);
    if (target) imports.add(target);
  }

  const namespaces = [];
  const unreadable = [];
  const callRe = /\buseTranslations\s*\(\s*([^)]*?)\s*\)/g;
  for (let m; (m = callRe.exec(source));) {
    const arg = m[1].replace(/,\s*$/, "").trim();
    if (/^(["'`])[\w.-]+\1$/.test(arg)) namespaces.push(arg.slice(1, -1));
    // useTranslations() with no namespace can read any key, and a computed
    // namespace cannot be followed from here. Neither is allowed in a client
    // bundle; the test reports them.
    else
      unreadable.push(
        arg === "" ? "useTranslations()" : `useTranslations(${arg})`,
      );
  }

  return { isClient, imports: [...imports], namespaces, unreadable };
}

/** Drops "a.b.c" when "a.b" (or "a") is also in the list. */
function minimal(prefixes) {
  const sorted = [...new Set(prefixes)].sort();
  return sorted.filter(
    (p) => !sorted.some((other) => other !== p && p.startsWith(`${other}.`)),
  );
}

function covers(prefixes, wanted) {
  return prefixes.some((p) => p === wanted || wanted.startsWith(`${p}.`));
}

/**
 * @param {string} rootDir the repository root
 * @returns {{ scopes: Record<string, string[]>, problems: string[] }}
 */
export function computeClientMessageScopes(rootDir) {
  const srcDir = path.join(rootDir, "src");
  const appDir = path.join(srcDir, "app");
  const files = listSourceFiles(srcDir);
  const known = new Set(files);

  const resolve = (from, spec) => {
    let base;
    if (spec.startsWith("@/")) base = path.join(srcDir, spec.slice(2));
    else if (spec.startsWith("."))
      base = path.resolve(path.dirname(from), spec);
    else return null;
    for (const candidate of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
    ]) {
      if (known.has(candidate)) return candidate;
    }
    return null;
  };

  const facts = new Map(files.map((f) => [f, readFileFacts(f, resolve)]));

  const reachableFrom = (entries) => {
    const seen = new Set();
    const stack = [...entries];
    while (stack.length) {
      const file = stack.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      stack.push(...facts.get(file).imports);
    }
    return seen;
  };

  // Everything that can end up running in the browser.
  const clientBundle = reachableFrom(
    files.filter((f) => facts.get(f).isClient),
  );

  const rel = (file) => path.relative(rootDir, file).split(path.sep).join("/");
  const under = (file, dir) =>
    file.startsWith(path.join(rootDir, ...dir.split("/")) + path.sep);

  const scopeEntries = Object.fromEntries(
    Object.entries(SCOPE_DIRS).map(([name, dir]) => [
      name,
      files.filter((f) => under(f, dir)),
    ]),
  );
  const apiDir = path.join(appDir, "api") + path.sep;
  const rootEntries = files.filter(
    (f) =>
      f.startsWith(appDir + path.sep) &&
      !f.startsWith(apiDir) &&
      !Object.values(SCOPE_DIRS).some((dir) => under(f, dir)),
  );

  const problems = [];
  const needs = (entries) => {
    const found = [];
    for (const file of reachableFrom(entries)) {
      if (!clientBundle.has(file)) continue;
      const fact = facts.get(file);
      found.push(...fact.namespaces);
      for (const call of fact.unreadable) {
        problems.push(`${rel(file)}: ${call}`);
      }
    }
    return minimal(found);
  };

  const root = needs(rootEntries);
  const scopes = { root };
  for (const [name, entries] of Object.entries(scopeEntries)) {
    // What the root provider already carries is not sent a second time.
    scopes[name] = needs(entries).filter((p) => !covers(root, p));
  }

  return { scopes, problems: [...new Set(problems)].sort() };
}

function render(scopes) {
  const lines = [
    "// GENERATED by scripts/gen-client-message-scopes.mjs — do not edit by hand.",
    "// Run `pnpm i18n:scopes` after adding or moving a useTranslations() call in",
    "// a Client Component. See that script for what this is and why.",
    "",
    "export const CLIENT_MESSAGE_SCOPES = {",
  ];
  for (const [name, prefixes] of Object.entries(scopes)) {
    lines.push(`  ${name}: [`);
    for (const p of prefixes) lines.push(`    ${JSON.stringify(p)},`);
    lines.push("  ],");
  }
  lines.push(
    "} as const satisfies Record<string, readonly string[]>;",
    "",
    "export type ClientMessageScope = Exclude<",
    "  keyof typeof CLIENT_MESSAGE_SCOPES,",
    '  "root"',
    ">;",
    "",
  );
  return lines.join("\n");
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const { scopes, problems } = computeClientMessageScopes(rootDir);
  if (problems.length) {
    console.error(
      'Client code must name its namespace as a plain string, e.g. useTranslations("a.b"):\n  ' +
        problems.join("\n  "),
    );
    process.exit(1);
  }
  const target = path.join(
    rootDir,
    "src",
    "i18n",
    "client-message-scopes.generated.ts",
  );
  const next = render(scopes);
  const previous = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  // Compare the lists, not the text: prettier may have re-wrapped the file.
  const listsOf = (text) => text.replace(/\s+/g, "");
  if (listsOf(previous) !== listsOf(next)) {
    fs.writeFileSync(target, next);
    console.log(
      "client message scopes: updated src/i18n/client-message-scopes.generated.ts",
    );
  }
}
