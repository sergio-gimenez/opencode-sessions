import { getClaudeSessions } from "./claude.js"
import { getCodexSessions } from "./codex.js"
import { getSessionPreviews } from "./sessions.js"
import type { Account, SessionPreview, SessionSearchScope } from "./types.js"

export function mergeSessions(...groups: SessionPreview[][]): SessionPreview[] {
  return groups.flat().sort((a, b) => b.updatedAtMs - a.updatedAtMs)
}

// A store that is missing or unreadable is skipped rather than fatal: not
// having Codex installed should still get you your Claude and OpenCode
// sessions, and the other way round.
function collect(read: () => SessionPreview[]): SessionPreview[] {
  try {
    return read()
  } catch {
    return []
  }
}

export function getAllSessions(options?: {
  search?: SessionSearchScope
  limit?: number
  claudeAccounts?: Account[]
  codexAccounts?: Account[]
}): SessionPreview[] {
  const scope = options?.search ?? "user"

  const opencode = collect(() => getSessionPreviews({ search: scope }))

  const claude = collect(() =>
    options?.claudeAccounts
      ? options.claudeAccounts.flatMap((account) => getClaudeSessions({ search: scope, account }))
      : getClaudeSessions({ search: scope }),
  )

  const codex = collect(() =>
    options?.codexAccounts
      ? options.codexAccounts.flatMap((account) => getCodexSessions({ search: scope, account }))
      : getCodexSessions({ search: scope }),
  )

  const merged = mergeSessions(opencode, claude, codex)
  return typeof options?.limit === "number" ? merged.slice(0, options.limit) : merged
}
