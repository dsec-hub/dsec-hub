<!-- Keep this short. A reviewer should understand the change in under a minute. -->

## What & why

<!-- One or two sentences. Link the issue: Closes #123 -->

## How to test

<!-- The exact steps a reviewer runs to confirm this works. -->

## Checklist

- [ ] `npm run typecheck && npm run lint && npm run build` pass locally
- [ ] No secrets, `.env` files, tokens, real member names, or student IDs in the diff
- [ ] Database schema untouched — **or** the change follows the schema rules in `CONTRIBUTING.md`
- [ ] If this serves or links a user-supplied build/binary, it complies with the no-binary-hosting rule in `CONTRIBUTING.md`
