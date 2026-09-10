# Demo

Everything needed to run and record `ocs` against **synthetic** sessions. No
real session history is read, and nothing is ever launched.

## Try it

```bash
npm run demo
```

That builds the fixture and drops you into the real picker. Type to filter,
`Ctrl+T` / `Shift+Tab` to cycle the target across OpenCode, both Claude accounts
and both Codex accounts, `Enter` or `Tab` to "open", which prints the command it
*would* have run instead of running it.

## What the fixture is

`npm run demo:build` turns [`data.mjs`](data.mjs) into a complete fake home
under `demo/.fixture/home`, laid out exactly where `ocs` looks by default:

```
.local/share/opencode/opencode.db   OpenCode's SQLite store
.claude-cc1/projects/...            Claude account "cc1"
.claude-cc2/projects/...            Claude account "cc2"
.codex-cx1/sessions/...             Codex account "cx1"
.codex-cx2/sessions/...             Codex account "cx2"
.config/ocs/config.json             ocs config naming every account
```

Running the demo is then just `HOME=<that>`, with no path overrides and nothing
pointing back at the real machine. The fixture home path is hardcoded in
`build-fixtures.mjs` rather than read from `$HOME`, so the builder cannot write
into a real home directory. `demo/.fixture/` is gitignored.

Timestamps are relative to build time, so the picker always shows a plausible
recent history.

## Adding sessions

Edit [`data.mjs`](data.mjs). Each entry is:

```js
{
  tool: "opencode",   // or "cc1" / "cc2" / "cx1" / "cx2"
  ago: 41,            // minutes before now
  dir: "~/code/aurora-web",
  title: "Auth redirect loops on expired session",
  turns: [["user", "..."], ["assistant", "..."]],
}
```

Search matches titles, directories and **user** prompts by default (assistant
text only with `--assistant`), so if you want a query to match in the recording,
put the term in a user turn or the title.

## Re-recording the README GIF

```bash
npm run demo:record   # -> docs/demo.cast   (needs asciinema)
npm run demo:gif      # -> docs/demo.gif    (needs agg, or docker)
```

`record.sh` pipes [`keys.mjs`](keys.mjs) into `asciinema rec`. asciinema
forwards its stdin to the recorded process's pty, so the picker sees a genuine
interactive session; the pauses in `keys.mjs` become the typing rhythm in the
recording. To change what the demo does, edit the `script` array there.

`gif.sh` renders the cast with [agg](https://github.com/asciinema/agg), using a
local binary if present and the official container image otherwise.

Both scripts unset `CLAUDE_CONFIG_DIR`, `CLAUDE_PROJECTS_PATH`, `CODEX_HOME`,
`CODEX_SESSIONS_PATH`, `OPENCODE_DB_PATH` and `OCS_CONFIG_PATH` so nothing from
the recorder's own environment leaks into the recording.
