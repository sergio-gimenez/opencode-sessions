# Contributing

Thanks for taking a look. This is a small, focused tool — issues and pull
requests are welcome.

## Getting set up

```bash
git clone https://github.com/sergio-gimenez/opencode-sessions.git
cd opencode-sessions
npm install
npm test
```

Run the CLI straight from source without building:

```bash
npm run dev            # the picker
npm run print          # the 25 most recent sessions, no TUI
```

## Working against fake sessions

You do not need real session history — or a second Claude account — to work on
this. `npm run demo` builds a synthetic home under `demo/.fixture/` and runs the
picker against it with opening stubbed out, so nothing is ever launched:

```bash
npm run demo
```

Add or edit sessions in [`demo/data.mjs`](demo/data.mjs). See
[`demo/README.md`](demo/README.md) for how the fixture is laid out and how the
README recording is regenerated.

## Before opening a pull request

```bash
npm run typecheck
npm test
npm run build
```

CI runs the same three on Node 20, 22 and 24, plus a check that the demo
fixture still builds and lists.

## Notes on the code

- `src/sessions.ts` reads OpenCode's SQLite store; `src/claude.ts` reads Claude
  Code's JSONL transcripts. Both produce the same `SessionPreview` shape, and
  `src/aggregate.ts` merges them.
- Session ids are **not** portable between the two tools, or between Claude
  accounts. Anything that crosses those boundaries goes through `src/seed.ts`,
  which builds a fresh session seeded with the old transcript.
- The picker (`src/picker.ts`) writes plain ANSI to stdout with no TUI
  dependency. Every rendered line must fit the terminal width once escape codes
  are stripped, or the layout smears — see the comments in `renderPreview`.
- Tests are colocated in `test/` and use fixtures rather than touching a real
  home directory. Keep it that way: nothing in the suite should read `~`.

## Reporting bugs

Include your OS, Node version, and whether the session was OpenCode or Claude
Code. `npm run print` output (with paths redacted as you see fit) is usually
enough to diagnose listing problems. For issues with opening a session, run with
`OCS_DRY_RUN=1` and paste the command it would have run.
