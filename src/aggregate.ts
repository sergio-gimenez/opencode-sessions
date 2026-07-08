import { getClaudeSessions } from "./claude.js"
import { getSessionPreviews } from "./sessions.js"
import type { SessionPreview, SessionSearchScope } from "./types.js"

export function mergeSessions(...groups: SessionPreview[][]): SessionPreview[] {
  return groups.flat().sort((a, b) => b.updatedAtMs - a.updatedAtMs)
}

export function getAllSessions(options?: {
  search?: SessionSearchScope
  limit?: number
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
    claude = getClaudeSessions({ search: scope })
  } catch {
    // Claude projects dir missing — keep going with OpenCode sessions only.
  }

  const merged = mergeSessions(opencode, claude)
  return typeof options?.limit === "number" ? merged.slice(0, options.limit) : merged
}
