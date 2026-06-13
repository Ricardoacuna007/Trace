# Contributing to Trace

Trace is local-first, self-host friendly, and built to stay simple for real users. Contributions should protect that direction: fewer moving parts, clear UX, and no surprise network dependency.

## Good First Contributions

- Reproduce and document bugs from testers.
- Improve empty, loading, and error states.
- Add focused tests around changed behavior.
- Improve docs for install, self-host, or release workflows.
- Polish UI details without changing backend contracts.

## Before Opening a PR

Run the checks that match your change:

```bash
npm run lint
npm run test
npm run build
cargo check --workspace
```

If you change Rust behavior, also run:

```bash
cargo clippy --workspace -- -D warnings
cargo test --workspace
```

Do not run installer builds for every small change. Release builds are handled separately.

## Code Guidelines

- Keep frontend changes typed. Do not use explicit `any`.
- Keep Rust warnings clean under clippy.
- Do not edit existing SQL migrations. Add a new migration when schema changes are needed.
- Do not change `src-tauri/src/commands/` unless the desktop runtime contract really needs it.
- Keep self-host all-in-one: one server, one volume, no required extra services.
- Preserve local-first behavior. Notes should not leave the user's machine unless the user explicitly configures self-host/sync.

## Reporting Bugs

Use the GitHub bug template and include:

- Trace version or commit.
- OS and install method.
- Exact steps to reproduce.
- What happened.
- What you expected.
- Screenshots or logs when useful.

For UI issues, include the viewport size and whether it happened in desktop or web/self-host.

## Proposing Improvements

Use the improvement template and describe:

- The workflow you are trying to make better.
- The current friction.
- The smallest useful change.
- Any tradeoff, especially around local-first, privacy, or self-host simplicity.

## Commit Style

Use short, concrete messages:

```text
Fix long note title wrapping
Add graph appearance controls
Document Docker install flow
```

Each commit should represent one meaningful change that can be reviewed on its own.
