#!/usr/bin/env node

import { parseArgs } from "./cli-options.js"
import { printHelp, printSessions } from "./cli-output.js"
import { openSession } from "./open.js"
import { pickSession } from "./picker.js"
import { getSessionPreviews } from "./sessions.js"

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const sessions = getSessionPreviews({ search: args.search })

  if (args.print) {
    printSessions(sessions.slice(0, 25))
    return
  }

  const session = await pickSession(sessions, args.query)
  const exitCode = await openSession(session.id, session.directory)
  process.exitCode = exitCode
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
