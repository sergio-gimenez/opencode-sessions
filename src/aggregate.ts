import { getClaudeSessions } from "./claude.js"
import { getSessionPreviews } from "./sessions.js"
import type { ClaudeAccount, SessionPreview, SessionSearchScope } from "./types.js"

export function mergeSessions(...groups: SessionPreview[][]): SessionPreview[] {
  return groups.flat().sort((a, b) => b.updatedAtMs - a.updatedAtMs)
}

export function getAllSessions(options?: {
  search?: SessionSearchScope
  limit?: number
  claudeAccounts?: ClaudeAccount[]
}): SessionPreview[] {
  const scope = options?.search ?? "user"

  let opencode: SessionPreview[] = []
  try {
    opencode = getSessionPreviews({ search: scope })
  } catch {
    // OpenCode db missing or unreadable — keep going with Claude sessions only.
  }

  let claude: SessionPreview[] = []
  try {
    claude = options?.claudeAccounts
      ? options.claudeAccounts.flatMap((account) => getClaudeSessions({ search: scope, account }))
      : getClaudeSessions({ search: scope })
  } catch {
    // Claude projects dir missing — keep going with OpenCode sessions only.
  }

  const merged = mergeSessions(opencode, claude)
  return typeof options?.limit === "number" ? merged.slice(0, options.limit) : merged
}
