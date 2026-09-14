# Git hooks

Managed by [husky](https://typicode.github.io/husky/) and activated by the
`prepare` script, so a plain `pnpm install` wires them up.

| Hook         | Runs                                             |
| ------------ | ------------------------------------------------ |
| `pre-commit` | `lint-staged` — eslint --fix + prettier on staged files |
| `commit-msg` | `commitlint` against the conventional-commit rules |
| `pre-push`   | `type-check`, `lint`, `test`                     |

Type checking and tests run on push rather than commit: they need the whole
project, so they cannot be scoped to staged files, and running them on every
commit makes small commits expensive.

## Skipping a hook

```bash
git commit --no-verify   # one-off escape hatch
HUSKY=0 git push         # disable husky for the whole command
```
