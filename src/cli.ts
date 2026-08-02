#!/usr/bin/env node

import { getAllSessions } from "./aggregate.js"
import { parseArgs } from "./cli-options.js"
import { printHelp, printSessions } from "./cli-output.js"
import { loadConfig } from "./config.js"
import { openClaudeFresh, openClaudeSession, openOpencodeFresh, openSession } from "./open.js"
import { pickSession } from "./picker.js"
import { buildSessionSeed } from "./seed.js"
import type { ClaudeAccount, SessionPreview, SessionSource } from "./types.js"

function sameAccount(left?: ClaudeAccount, right?: ClaudeAccount) {
  return (left?.configDir ?? "") === (right?.configDir ?? "")
}

async function openWith(
  tool: SessionSource,
  session: SessionPreview,
  opts: { skipPermissions: boolean; claudeAccount?: ClaudeAccount },
) {
  // Native tool and account: resume the real session by id.
  if (
    tool === session.source &&
    (tool !== "claude" || sameAccount(session.claudeAccount, opts.claudeAccount))
  ) {
    return tool === "claude"
      ? openClaudeSession(session.id, session.directory, {
          ...opts,
          account: opts.claudeAccount ?? session.claudeAccount,
        })
      : openSession(session.id, session.directory, opts)
  }

  // Cross-tool and cross-account ids are not portable; seed a fresh session.
  const seed = await buildSessionSeed(session)
  return tool === "claude"
    ? openClaudeFresh(seed.directory, seed.prompt, { ...opts, account: opts.claudeAccount })
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
  const targetName = args.claudeAccount ?? config.defaultClaudeAccount
  const claudeAccount = config.claudeAccounts.find((account) => account.name === targetName)

  if (!claudeAccount) {
    throw new Error(
      `Unknown Claude account "${targetName}". Configured: ${config.claudeAccounts.map((account) => account.name).join(", ")}.`,
    )
  }

  const sessions = getAllSessions({ search: args.search, claudeAccounts: config.claudeAccounts })

  if (args.print) {
    printSessions(sessions.slice(0, 25))
    return
  }

  const picked = await pickSession(sessions, args.query, {
    claudeAccounts: config.claudeAccounts,
    initialClaudeAccount: claudeAccount,
  })

  process.exitCode = await openWith(picked.tool, picked.session, {
    skipPermissions,
    claudeAccount: picked.claudeAccount,
  })
}

// `ocs --print | head` closes the pipe early; that is the caller getting what
// they asked for, not a failure worth a stack trace.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(0)
  throw error
})

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
