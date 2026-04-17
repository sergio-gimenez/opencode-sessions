import type BetterSqlite3 from "better-sqlite3"

import { collapseWhitespace, formatUpdatedAt, parseTextPart, truncate } from "./format.js"
import { openDatabase } from "./db.js"
import type { PromptRow, SessionPreview, SessionRow, SessionSearchScope } from "./types.js"

const SESSION_LIMIT = 200
const PROMPT_LIMIT = 3

function listSessions(db: BetterSqlite3.Database, limit: number): SessionRow[] {
  const stmt = db.prepare<unknown[], SessionRow>(`
    select id, title, directory, project_id, time_updated
    from session
    where time_archived is null
    order by time_updated desc
    limit ?
  `)

  return stmt.all(limit)
}

function listPromptRows(db: BetterSqlite3.Database, sessionIds: string[], role: "user" | "assistant"): PromptRow[] {
  if (sessionIds.length === 0) return []

  const placeholders = sessionIds.map(() => "?").join(",")
  const stmt = db.prepare<unknown[], PromptRow>(`
    select ranked.session_id, ranked.text
    from (
      select
        m.session_id as session_id,
        p.data as text,
        row_number() over (
          partition by m.session_id
          order by m.time_created desc, p.time_created desc, p.id desc
        ) as rank
      from message m
      join part p on p.message_id = m.id
      where m.session_id in (${placeholders})
        and json_extract(m.data, '$.role') = ?
        and json_extract(p.data, '$.type') = 'text'
    ) ranked
    where ranked.rank <= ?
    order by ranked.session_id, ranked.rank
  `)

  return stmt.all(...sessionIds, role, PROMPT_LIMIT)
}

function collectTexts(rows: PromptRow[]) {
  const previewBySession = new Map<string, string[]>()
  const searchBySession = new Map<string, string[]>()

  for (const row of rows) {
    const text = parseTextPart(row.text)
    if (!text) continue

    const preview = previewBySession.get(row.session_id) ?? []
    const search = searchBySession.get(row.session_id) ?? []

    preview.push(truncate(text))
    search.push(text)

    previewBySession.set(row.session_id, preview)
    searchBySession.set(row.session_id, search)
  }

  return { previewBySession, searchBySession }
}

export function buildSessionPreviews(
  sessions: SessionRow[],
  userRows: PromptRow[],
  assistantRows: PromptRow[],
  scope: SessionSearchScope,
) {
  const userTexts = collectTexts(userRows)
  const assistantTexts = collectTexts(assistantRows)

  return sessions.map<SessionPreview>((session) => ({
    id: session.id,
    title: session.title,
    directory: session.directory,
    projectId: session.project_id,
    updatedAtMs: session.time_updated,
    updatedAtLabel: formatUpdatedAt(session.time_updated),
    prompts: userTexts.previewBySession.get(session.id) ?? [],
    assistantSnippets: assistantTexts.previewBySession.get(session.id) ?? [],
    searchText: [
      session.title,
      session.directory,
      ...(userTexts.searchBySession.get(session.id) ?? []),
      ...(scope === "all" ? (assistantTexts.searchBySession.get(session.id) ?? []) : []),
    ].join("\n"),
  }))
}

export function getSessionPreviews(options?: { dbPath?: string; limit?: number; search?: SessionSearchScope }) {
  const db = openDatabase(options?.dbPath)

  try {
    const sessions = listSessions(db, options?.limit ?? SESSION_LIMIT)
    const sessionIds = sessions.map((session) => session.id)
    const userRows = listPromptRows(db, sessionIds, "user")
    const assistantRows = listPromptRows(db, sessionIds, "assistant")

    return buildSessionPreviews(sessions, userRows, assistantRows, options?.search ?? "user")
  } finally {
    db.close()
  }
}

export function searchSessions(sessions: SessionPreview[], query: string) {
  const normalized = collapseWhitespace(query).toLowerCase()
  if (!normalized) return sessions

  const terms = normalized.split(" ")

  return sessions.filter((session) => {
    const haystack = session.searchText.toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}
