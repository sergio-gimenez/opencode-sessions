# opencode-sessions

Small CLI (`ocs`) to search and reopen **OpenCode and Claude Code** sessions
across all local projects, from a single picker.

## Features

- Lists sessions from both the OpenCode SQLite database and the Claude Code
  JSONL store (`~/.claude/projects`), merged and ordered by most recent update
- `[OC]` / `[CC]` badges mark each session's owning tool
- Searches by title, directory, and all user prompts (optionally assistant text)
- Responsive two-column picker that adapts to the terminal size
- **Enter** resumes the session natively in its owning tool
- **Tab** opens it in the *other* tool as a fresh, transcript-seeded session
- Optional permission bypass (`--dangerous`) with a config-file default

## Picking a session

- `Enter` → resume in the native tool (`opencode --session` / `claude --resume`).
- `Tab` → open in the other tool. Ids are **not** portable between OpenCode and
  Claude Code, so this forks a **new** session in the target tool, seeded with
  the full transcript of the picked one.

### Migration is a fork, not a move — drive it deliberately

Cross-tool open does **not** migrate a session; it creates a new session in the
other tool and pastes the transcript in as context. Consequences:

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
