import { shortenHome } from "./format.js"
import type { SessionPreview } from "./types.js"

export function printHelp() {
  process.stdout.write([
    "opencode-sessions",
    "",
    "Browse OpenCode and Claude Code sessions, then open the picked one",
    "with OpenCode or a configured Claude Code account.",
    "",
    "Usage:",
    "  ocs",
    "  ocs --print",
    "  ocs --query \"mesh vpn\"",
    "  ocs --assistant",
    "  ocs --dangerous",
    "  ocs --claude-account cc2",
    "",
    "Options:",
    "  --print               print recent sessions without opening picker",
    "  --query TEXT          start with a search query",
    "  --assistant           include assistant text in search",
    "  --dangerous           bypass permission checks when opening",
    "                        (claude --dangerously-skip-permissions / opencode --auto)",
    "  --safe                force permission checks on (overrides config)",
    "  --claude-account NAME set the initial Claude target account",
    "  -h, --help            show help",
    "",
    "Keys in the picker:",
    "  type                  filter by title, directory and your prompts",
    "  up/down, PgUp/PgDn    move the selection",
    "  Enter                 follow the route shown in the badge",
    "  Ctrl+F                fork: branch that route into a new session",
    "  Tab                   open in the other tool, as a seeded fork",
    "  Ctrl+T                cycle the target Claude account",
    "  Shift+Tab             open into the target Claude account",
    "  Esc                   cancel",
    "",
    "Config: ~/.config/ocs/config.json",
    "  Sets permission and Claude account defaults; CLI flags override per run.",
    "",
    "Environment:",
    "  OCS_DRY_RUN=1         print what would be launched instead of launching it",
    "  OCS_CONFIG_PATH       override the config file location",
    "  OPENCODE_DB_PATH      override the OpenCode database location",
    "  CLAUDE_PROJECTS_PATH  override the default Claude projects directory",
    "",
  ].join("\n"))
}

export function printSessions(sessions: SessionPreview[]) {
  for (const session of sessions) {
    const tag = session.source === "claude"
      ? `[${session.claudeAccount?.name.toUpperCase() ?? "CC"}]`
      : "[OC]"
    process.stdout.write(`${tag} ${session.title}\n`)
    process.stdout.write(`  ${shortenHome(session.directory)}\n`)
    process.stdout.write(`  ${session.updatedAtLabel}  ${session.id}\n`)

    for (const prompt of session.prompts) {
      process.stdout.write(`  ${prompt}\n`)
    }

    if (session.assistantSnippets.length > 0) {
      process.stdout.write("  assistant:\n")

      for (const snippet of session.assistantSnippets) {
        process.stdout.write(`    ${snippet}\n`)
      }
    }

    process.stdout.write("\n")
  }
}
