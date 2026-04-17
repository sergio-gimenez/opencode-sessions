#!/usr/bin/env node

import { input, search } from "@inquirer/prompts"

import { openSession } from "./open.js"
import { getSessionPreviews, searchSessions } from "./sessions.js"
import type { SessionPreview } from "./types.js"

function formatChoiceName(session: SessionPreview) {
  const promptSummary = session.prompts.length > 0 ? `\n  ${session.prompts.join("\n  ")}` : ""

  return [
    session.title,
    `  ${session.directory}`,
    `  ${session.updatedAtLabel}  ${session.id}`,
    promptSummary,
  ].join("\n")
}

function parseArgs(argv: string[]) {
  const args = new Set(argv)

  return {
    print: args.has("--print"),
    help: args.has("--help") || args.has("-h"),
  }
}

function printHelp() {
  process.stdout.write([
    "opencode-sessions",
    "",
    "Usage:",
    "  npx tsx src/cli.ts",
    "  npx tsx src/cli.ts --print",
    "",
    "Options:",
    "  --print   print recent sessions without opening picker",
    "  -h        show help",
    "  --help    show help",
    "",
  ].join("\n"))
}

function printSessions(sessions: SessionPreview[]) {
  for (const session of sessions) {
    process.stdout.write(`${session.title}\n`)
    process.stdout.write(`  ${session.directory}\n`)
    process.stdout.write(`  ${session.updatedAtLabel}  ${session.id}\n`)

    for (const prompt of session.prompts) {
      process.stdout.write(`  ${prompt}\n`)
    }

    process.stdout.write("\n")
  }
}

async function selectSession(sessions: SessionPreview[]) {
  const query = await input({
    message: "Filter sessions",
    default: "",
  })

  const filtered = searchSessions(sessions, query)

  if (filtered.length === 0) {
    throw new Error("No sessions matched that filter.")
  }

  return search<SessionPreview>({
    message: `Select session (${filtered.length} matches)`,
    source: async (term) => {
      const matches = searchSessions(filtered, term ?? "").slice(0, 30)

      return matches.map((session) => ({
        name: formatChoiceName(session),
        value: session,
        description: session.directory,
      }))
    },
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const sessions = getSessionPreviews()

  if (args.print) {
    printSessions(sessions.slice(0, 25))
    return
  }

  const session = await selectSession(sessions)
  const exitCode = await openSession(session.id, session.directory)
  process.exitCode = exitCode
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
