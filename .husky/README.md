# Git hooks

These hooks are managed by [husky](https://typicode.github.io/husky/).

| Hook         | Runs                                                          |
| ------------ | ------------------------------------------------------------- |
| `pre-commit` | `lint-staged` (prettier + eslint --fix), `type-check`, `build` |
| `commit-msg` | `commitlint` against the conventional-commit rules            |
| `pre-push`   | `type-check`, `lint`, `test`                                  |

## Activating them

The hooks are **not active yet**. Husky works by pointing git's `core.hooksPath`
at this folder, and `core.hooksPath` is a repository-wide setting — this
`backend/` folder is currently nested inside a much larger repository, so
enabling it here would fire these hooks on every commit made anywhere in that
tree.

Once `backend/` is its own repository:

```bash
git init          # only if it isn't a repo yet
pnpm run husky:setup
```

`husky:setup` is deliberately not wired to the `prepare` lifecycle script, so a
plain `pnpm install` never rewrites your git config behind your back. Add
`"prepare": "husky"` to `package.json` if you would rather it run automatically
once this folder stands on its own.

## Skipping a hook

```bash
git commit --no-verify        # one-off escape hatch
HUSKY=0 git commit            # disable husky for the whole session
```
