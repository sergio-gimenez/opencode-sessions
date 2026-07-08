#!/usr/bin/env node

import { getAllSessions } from "./aggregate.js"
import { chooseTool } from "./chooser.js"
import { parseArgs } from "./cli-options.js"
import { printHelp, printSessions } from "./cli-output.js"
<<<<<<< Updated upstream
import { openSession } from "./open.js"
=======
import { createFreshSessionSeed } from "./fresh-from.js"
import { openClaudeSession, openFreshSession, openSession } from "./open.js"
>>>>>>> Stashed changes
import { pickSession } from "./picker.js"

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

<<<<<<< Updated upstream
  const sessions = getSessionPreviews({ search: args.search })
=======
  if (args.freshFrom) {
    const recovered = await createFreshSessionSeed(args.freshFrom)
    const exitCode = await openFreshSession(recovered.directory, recovered.prompt)
    process.exitCode = exitCode
    return
  }

  const sessions = getAllSessions({ search: args.search })
>>>>>>> Stashed changes

  if (args.print) {
    printSessions(sessions.slice(0, 25))
    return
  }

  const session = await pickSession(sessions, args.query)
  const tool = await chooseTool(session)

  const exitCode =
    tool === "claude"
      ? await openClaudeSession(session.id, session.directory)
      : await openSession(session.id, session.directory)

  process.exitCode = exitCode
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
