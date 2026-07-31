# opencode-sessions

Small CLI (`ocs`) to search and reopen **OpenCode and Claude Code** sessions
across all local projects, from a single picker.

## Features

- Lists sessions from both the OpenCode SQLite database and every configured
  Claude Code account, merged and ordered by most recent update
- `[OC]` / `[CC1]` / `[CC1→CC2]` badges show ownership and target account
- Searches by title, directory, and all user prompts (optionally assistant text)
- Responsive two-column picker that adapts to the terminal size
- **Enter** follows the displayed Claude account route (OpenCode stays native)
- **Tab** opens it in the *other* tool as a fresh, transcript-seeded session
- **Ctrl+T** cycles the target Claude account
- **Shift+Tab** also opens or forks into the displayed target Claude account
- Optional permission bypass (`--dangerous`) with a config-file default

## Picking a session

- `Enter` → follow the displayed route. `[CC1]` resumes CC1; `[CC1→CC2]`
  creates a transcript-seeded CC2 fork. OpenCode sessions resume natively.
- `Tab` → open in the other tool. Ids are **not** portable between OpenCode and
  Claude Code, so this forks a **new** session in the target tool, seeded with
  the full transcript of the picked one.
- `Ctrl+T` → cycle the target Claude account shown above the query.
- `Shift+Tab` → open in the target Claude account. This resumes when the
  selected session already belongs to that account; otherwise it creates a
  transcript-seeded fork.

### Migration is a fork, not a move — drive it deliberately

Cross-tool and cross-account opens do **not** migrate a session; they create a
new session and paste the transcript in as context. Consequences:

- The original session still exists in its own tool, untouched.
- Ping-ponging (CC → OC → CC …) leaves a **chain of partial copies**, and each
  hop reconstructs state from a transcript rather than true resumed state.
- Always fork from the **most recent** node (top of the list) so you carry the
  latest work forward, not a stale branch.

Best practice: **you** drive migration at a natural boundary — e.g. a task is
finished and you want to keep the general context but continue in the other
tool. Don't treat Tab as a live round-trip; treat it as "start fresh over there,
with this history."

## Permissions

Bypass permission checks when opening (`claude --dangerously-skip-permissions`
/ `opencode --auto`):

```bash
ocs --dangerous     # or --skip-permissions / --yolo
ocs --safe          # force checks on, overriding the config default
```

Set the default in `~/.config/ocs/config.json`:

```json
{ "skipPermissions": true }
```

The CLI flag overrides the config per run.

## Multiple Claude accounts

Use Claude Code's normal home for the first account and an isolated
`CLAUDE_CONFIG_DIR` for each additional account. Example shell functions:

```bash
cc1() { command claude "$@"; }
cc2() { CLAUDE_CONFIG_DIR="$HOME/.claude-cc2" command claude "$@"; }
```

Authenticate each account once:

```bash
cc1 auth login
cc2 auth login
```

Then configure `ocs` in `~/.config/ocs/config.json`:

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

`ocs` scans each account's `projects` directory and preserves account ownership
when resuming. A Claude session opened in another Claude account becomes a new,
transcript-seeded fork; the original account's session stays untouched.
Omit `configDir` for Claude Code's normal default account.

Choose the initial target from the command line when useful:

```bash
ocs --claude-account cc2
```

Inside the picker, `Ctrl+T` cycles the target. `Enter` follows the displayed
route; `Shift+Tab` is an equivalent explicit target shortcut. Claude rows show
the route when source and target differ: selecting CC2 changes a CC1 row from
`[CC1]` to `[CC1→CC2]`.

See [Using multiple Claude Code accounts](docs/multiple-claude-accounts.md) for
complete Linux, macOS, and PowerShell setup, verification, usage, and
troubleshooting.

## Usage

```bash
npm install
npm run dev
```

Start with a query:

```bash
npm run dev -- --query "wireguard mesh"
```

Include assistant text in search:

```bash
npm run dev -- --assistant
```

Print recent sessions without opening the picker:

```bash
npm run print
```

Build the CLI:

```bash
npm run build
```

Install `ocs` into `~/.local/bin` without root:

```bash
npm run install:local
```

Run tests:

```bash
npm test
```
