<h1 align="center">ocs</h1>

<p align="center">
  <b>One picker for every OpenCode and Claude Code session on your machine.</b><br>
  Search across all your projects and Claude accounts, then jump back in — or carry the conversation into the other tool.
</p>

<p align="center">
  <a href="https://github.com/sergio-gimenez/opencode-sessions/actions/workflows/cnpm run typecheck && npm test && npm run buildi.yml"><img alt="CI" src="https://github.com/sergio-gimenez/opencode-sessions/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Node >=20" src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg">
  <img alt="Zero TUI dependencies" src="https://img.shields.io/badge/deps-1-lightgrey.svg">
</p>

<p align="center">
  <img src="docs/demo.gif" alt="ocs listing OpenCode and Claude Code sessions side by side, filtering them, and forking one into a second Claude account" width="100%">
</p>

<p align="center"><sub>The demo runs against synthetic sessions — see <a href="demo/README.md">demo/</a>.</sub></p>

## Why

Your work is scattered. Some of it is in OpenCode, some in Claude Code, some in
a second Claude account, and all of it is split across a dozen project
directories. Finding the session where you actually solved that thing means
remembering which tool you were in, `cd`-ing to the right repo, and paging
through a resume list per tool per account.

`ocs` reads both tools' stores directly and puts everything in one list, newest
first, searchable by what you actually typed.

## Install

Needs Node 20+ and, obviously, OpenCode and/or Claude Code.

```bash
git clone https://github.com/sergio-gimenez/opencode-sessions.git
cd opencode-sessions
npm install
npm run build
npm run install:local     # puts `ocs` in ~/.local/bin, no root needed
```

Then just:

```bash
ocs
```

## Try it without touching your own sessions

```bash
npm run demo
```

This builds a synthetic history — two Claude accounts, an OpenCode store, four
fake projects — and runs the real picker against it with opening stubbed out.
Nothing of yours is read and nothing is launched. Details in
[`demo/README.md`](demo/README.md).

## Keys

| Key | What it does |
| --- | --- |
| type | Filter by title, directory and your prompts |
| `↑` `↓` | Move the selection |
| `PgUp` `PgDn` `Home` `End` | Jump |
| `Enter` | Follow the displayed route |
| `Tab` | Open in the *other* tool, as a transcript-seeded fork |
| `Ctrl+T` | Cycle the target Claude account |
| `Shift+Tab` | Open into the displayed target Claude account |
| `Esc` `Ctrl+C` | Cancel |

## Reading the list

Each row carries a badge telling you where the session lives and where `Enter`
will take it:

| Badge | Meaning |
| --- | --- |
| `[OC]` | An OpenCode session. `Enter` resumes it natively. |
| `[CC1]` | A Claude session in account `cc1`, and `cc1` is the current target. `Enter` resumes it. |
| `[CC1→CC2]` | A Claude session in `cc1` while `cc2` is the target. `Enter` forks it into `cc2`. |

The right column previews the selected session: title, directory, id, your most
recent prompts, and — with `--assistant` — recent assistant replies. Search
terms are highlighted in both columns.

## Migration is a fork, not a move

Cross-tool and cross-account opens do **not** migrate a session. Session ids are
not portable between OpenCode and Claude Code, or between two Claude accounts,
so `ocs` starts a **new** session in the target and pastes the old transcript in
as context. Consequences worth knowing:

- The original session still exists in its own tool, untouched.
- Ping-ponging (CC → OC → CC …) leaves a **chain of partial copies**, and every
  hop reconstructs state from a transcript rather than resuming real state.
- Always fork from the **most recent** node (top of the list) so you carry the
  latest work forward, not a stale branch.

Best practice: drive migration deliberately, at a natural boundary — a task is
finished and you want to keep the general context while continuing in the other
tool. Don't treat `Tab` as a live round-trip; treat it as "start fresh over
there, with this history."

## Multiple Claude accounts

Use Claude Code's normal home for the first account and an isolated
`CLAUDE_CONFIG_DIR` for each additional one:

```bash
cc1() { command claude "$@"; }
cc2() { CLAUDE_CONFIG_DIR="$HOME/.claude-cc2" command claude "$@"; }
```

Authenticate each once (`cc1 auth login`, `cc2 auth login`), then tell `ocs`
about them in `~/.config/ocs/config.json`:

```json
{
  "skipPermissions": false,
  "claudeAccounts": [
    { "name": "cc1" },
    { "name": "cc2", "configDir": "~/.claude-cc2" }
  ],
  "defaultClaudeAccount": "cc1"
}
```

Omit `configDir` for Claude Code's normal default account. `ocs` scans each
account's `projects` directory and preserves account ownership when resuming, so
a `cc1` session resumes in `cc1` unless you deliberately retarget it.

Pick the starting target from the command line when useful:

```bash
ocs --claude-account cc2
```

Full Linux, macOS and PowerShell setup, verification and troubleshooting lives in
[Using multiple Claude Code accounts](docs/multiple-claude-accounts.md).

## Permissions

Launch the target tool with permission checks bypassed
(`claude --dangerously-skip-permissions` / `opencode --auto`):

```bash
ocs --dangerous     # also --skip-permissions / --yolo
ocs --safe          # force checks back on, overriding the config default
```

Set the default in `~/.config/ocs/config.json` with `"skipPermissions": true`.
The CLI flag wins per run.

> **Note**
> Skipping permission checks lets the agent act on your filesystem without
> prompting. Turn it on only for directories where you accept that.

## Command line

| Flag | Effect |
| --- | --- |
| `--print` | List the 25 most recent sessions and exit, no picker |
| `--query <text>` | Start the picker with a filter already applied |
| `--assistant` | Search assistant replies too, not just your prompts |
| `--claude-account <name>` | Start with this Claude account as the target |
| `--dangerous`, `--skip-permissions`, `--yolo` | Bypass permission checks |
| `--safe`, `--no-skip-permissions` | Force permission checks on |
| `--help`, `-h` | Usage |

### Dry run

Set `OCS_DRY_RUN=1` and `ocs` prints what it *would* launch — command, Claude
account, working directory — instead of launching it. Useful for checking how a
route resolves, and for bug reports:

```console
$ OCS_DRY_RUN=1 ocs
would run CLAUDE_CONFIG_DIR=~/.claude-cc2 claude <transcript seed, 1297 chars>
  in ~/code/pixel-forge
```

## Where the data comes from

`ocs` reads both tools' existing stores. It never writes to them.

| Source | Path | Override |
| --- | --- | --- |
| OpenCode | `~/.local/share/opencode/opencode.db` (SQLite) | `OPENCODE_DB_PATH` |
| Claude Code | `~/.claude/projects/**/*.jsonl`, plus each account's `configDir` | `CLAUDE_PROJECTS_PATH` |
| `ocs` config | `~/.config/ocs/config.json` | `OCS_CONFIG_PATH` |

A missing or unreadable source is skipped rather than fatal — if OpenCode isn't
installed you still get your Claude sessions, and vice versa.

## Development

```bash
npm run dev          # run the picker from source
npm run print        # list recent sessions, no TUI
npm run demo         # picker against synthetic sessions, opening stubbed out
npm run typecheck
npm test
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Sergio Gimenez
