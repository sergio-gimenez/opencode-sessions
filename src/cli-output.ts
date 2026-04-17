import type { SessionPreview } from "./types.js"

export function printHelp() {
  process.stdout.write([
    "opencode-sessions",
    "",
    "Usage:",
    "  ocs",
    "  ocs --print",
    "  ocs --query \"mesh vpn\"",
    "  ocs --assistant",
    "",
    "Options:",
    "  --print       print recent sessions without opening picker",
    "  --query TEXT  start with a search query",
    "  --assistant   include assistant text in search",
    "  -h            show help",
    "  --help        show help",
    "",
  ].join("\n"))
}

export function printSessions(sessions: SessionPreview[]) {
  for (const session of sessions) {
    process.stdout.write(`${session.title}\n`)
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
