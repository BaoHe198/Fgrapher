## What changed

<!-- Short description of the change. -->

## Why

<!-- Link to an issue, or explain the reason if there isn't one. -->

## How to test

<!-- Concrete steps a reviewer can follow to verify this works. -->

1.
2.
3.

## Screenshots

<!-- For UI changes: before and after. Delete this section if not applicable. -->

## Checklist

- [ ] Builds locally (`pnpm build`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Tested on mobile viewport
- [ ] Migration included if the schema changed (`prisma/schema.prisma` +
      `prisma/migrations/`)
- [ ] Translations added to both `src/messages/en.json` and `vi.json` if
      new user-facing strings were added
- [ ] No secrets committed (check `git diff` for anything that looks like
      a key, token, or connection string before pushing)
