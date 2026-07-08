#!/usr/bin/env node

import { getAllSessions } from "./aggregate.js"
import { parseArgs } from "./cli-options.js"
import { printHelp, printSessions } from "./cli-output.js"
import { loadConfig } from "./config.js"
import { openClaudeFresh, openClaudeSession, openOpencodeFresh, openSession } from "./open.js"
import { pickSession } from "./picker.js"
import { buildSessionSeed } from "./seed.js"
import type { SessionPreview, SessionSource } from "./types.js"

async function openWith(
  tool: SessionSource,
  session: SessionPreview,
  opts: { skipPermissions: boolean },
) {
  // Native tool: resume the real session by id.
  if (tool === session.source) {
    return tool === "claude"
      ? openClaudeSession(session.id, session.directory, opts)
      : openSession(session.id, session.directory, opts)
  }

  // Cross-tool: ids are not portable, so seed a fresh session with the transcript.
  const seed = await buildSessionSeed(session)
  return tool === "claude"
    ? openClaudeFresh(seed.directory, seed.prompt, opts)
    : openOpencodeFresh(seed.directory, seed.prompt, opts)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const config = loadConfig()
  const skipPermissions = args.skipPermissions ?? config.skipPermissions

  const sessions = getAllSessions({ search: args.search })

  if (args.print) {
    printSessions(sessions.slice(0, 25))
    return
  }

  const { session, tool } = await pickSession(sessions, args.query)

  process.exitCode = await openWith(tool, session, { skipPermissions })
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
