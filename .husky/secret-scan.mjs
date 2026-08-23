#!/usr/bin/env node
// Blocks a commit if any staged file's added lines look like a live
// secret. Deliberately simple pattern matching, not a full secret
// scanner — it's a last-line-of-defense catch for the obvious cases,
// not a replacement for keeping real secrets out of the repo entirely
// (see .gitignore).
import { execFileSync } from "node:child_process";

const PATTERNS = [
  { name: "Stripe live secret key", re: /sk_live_[A-Za-z0-9]+/ },
  { name: "Stripe test secret key", re: /sk_test_[A-Za-z0-9]+/ },
  { name: "Supabase personal access token", re: /sbp_[A-Za-z0-9]+/ },
  { name: "JWT", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "Postgres connection string in DATABASE_URL", re: /DATABASE_URL\s*=\s*.?postgres/ },
];

const stagedFiles = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"])
  .toString()
  .split("\n")
  .filter(Boolean)
  // The scanner's own pattern list would otherwise flag itself.
  .filter((f) => f !== ".husky/secret-scan.mjs");

let found = false;

for (const file of stagedFiles) {
  let content;
  try {
    // execFileSync passes args straight to the process, no shell
    // involved — a plain execSync template string breaks (and used to
    // silently skip the file via the catch below!) on any path
    // containing shell metacharacters, which Next.js route-group/
    // dynamic-segment paths always do: (admin), [id].
    content = execFileSync("git", ["show", `:${file}`], {
      maxBuffer: 1024 * 1024 * 20,
    }).toString();
  } catch {
    continue; // binary file or similar — skip rather than crash the hook
  }

  const lines = content.split("\n");
  lines.forEach((line, index) => {
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) {
        console.error(`\n🚫 Possible ${name} found in ${file}:${index + 1}`);
        console.error(`   ${line.trim().slice(0, 120)}`);
        found = true;
      }
    }
  });
}

if (found) {
  console.error(
    "\nCommit blocked. If this is a false positive, fix the trigger (e.g. " +
      "truncate/redact the example value) rather than bypassing this check.\n",
  );
  process.exit(1);
}
