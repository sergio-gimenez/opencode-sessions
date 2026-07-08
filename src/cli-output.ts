import type { SessionPreview } from "./types.js"

export function printHelp() {
  process.stdout.write([
    "opencode-sessions",
    "",
    "Browse OpenCode and Claude Code sessions, then open the picked one",
    "with either tool ([o] opencode / [c] claude code).",
    "",
    "Usage:",
    "  ocs",
    "  ocs --print",
    "  ocs --query \"mesh vpn\"",
    "  ocs --assistant",
    "  ocs --dangerous",
    "",
    "Options:",
    "  --print               print recent sessions without opening picker",
    "  --query TEXT          start with a search query",
    "  --assistant           include assistant text in search",
    "  --dangerous           bypass permission checks when opening",
    "                        (claude --dangerously-skip-permissions / opencode --auto)",
    "  --safe                force permission checks on (overrides config)",
    "  -h, --help            show help",
    "",
    "Config: ~/.config/ocs/config.json  ->  { \"skipPermissions\": true }",
    "  Sets the default; --dangerous / --safe override per run.",
    "",
  ].join("\n"))
}

export function printSessions(sessions: SessionPreview[]) {
  for (const session of sessions) {
    const tag = session.source === "claude" ? "[CC]" : "[OC]"
    process.stdout.write(`${tag} ${session.title}\n`)
    process.stdout.write(`  ${session.directory}\n`)
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
