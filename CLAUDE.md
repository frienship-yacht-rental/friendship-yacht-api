@AGENTS.md

# Claude Code notes

`AGENTS.md` above is the engineering contract and applies in full. This file
adds what is specific to working here with Claude Code.

## Orientation

- Read `docs/adr/` before proposing a structural change. If the change
  contradicts an accepted ADR, write a superseding ADR in the same commit
  rather than editing the old one.
- The sibling repository `../friendship-yacht-web` consumes this API. A change
  to any `schema.ts` or to an error `code` has a matching change there; make
  both or say explicitly that the web side is left out.
- Do not narrow a task to the API when the request spans both repositories.

## Verification

Run the full gate, not a subset, before reporting completion:

```bash
pnpm type-check && pnpm lint && pnpm format:check && pnpm test
```

For anything touching `src/app.ts`, `src/server.ts` or middleware, also boot
it and hit an endpoint — supertest bypasses `server.ts`:

```bash
NODE_ENV=production pnpm exec tsx src/server.ts &
curl -i -H "Origin: http://localhost:3000" http://localhost:8000/health
```

Report what was run and what the output was. If a check was skipped, say so.

## Conventions the hooks enforce

- Commits are Conventional Commits; commitlint rejects anything else.
- `git push --no-verify` bypasses type-check, lint and tests. Do not use it
  without the user asking for it by name.
- `prettier --write` runs on staged files at commit; do not hand-format.

## When adding a dependency

- Runtime dependency only if it executes in the served process. Types, build
  and test tooling go in `devDependencies`.
- Prefer a dependency the web repo already uses when both need the same
  thing (zod, vitest, prettier, eslint-config-prettier), and keep the major
  version aligned.
- If it runs an install script, it must be listed under `allowBuilds` in
  `pnpm-workspace.yaml` or pnpm 11 will skip the script silently.

## Review checklist

Before opening or approving a change, confirm:

- [ ] New input is validated with `validate()`; no raw `req.body`/`req.query`
- [ ] Failures throw `AppError` subclasses; no `res.status(4xx)` in handlers
- [ ] Services have no HTTP imports
- [ ] New env vars are in `src/config/env.ts` **and** `.env.example`
- [ ] New `code` values are reflected in the web client
- [ ] A supertest spec covers the happy path and one failure with `details`
- [ ] Coverage did not drop below the floor
