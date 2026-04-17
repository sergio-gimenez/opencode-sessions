import type BetterSqlite3 from "better-sqlite3"

import { openDatabase } from "./db.js"
import type { PromptRow, SessionPreview, SessionRow } from "./types.js"

const SESSION_LIMIT = 200
const PROMPT_LIMIT = 3
const TEXT_LIMIT = 140

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function truncate(value: string, max = TEXT_LIMIT) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}...`
}

function formatUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp))
}

function parseTextPart(value: string) {
  const parsed = JSON.parse(value) as { text?: string }
  return collapseWhitespace(parsed.text ?? "")
}

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

function listPromptRows(db: BetterSqlite3.Database, sessionIds: string[]): PromptRow[] {
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
        and json_extract(m.data, '$.role') = 'user'
        and json_extract(p.data, '$.type') = 'text'
    ) ranked
    where ranked.rank <= ?
    order by ranked.session_id, ranked.rank
  `)

  return stmt.all(...sessionIds, PROMPT_LIMIT)
}

export function getSessionPreviews(options?: { dbPath?: string; limit?: number }) {
  const db = openDatabase(options?.dbPath)

  try {
    const sessions = listSessions(db, options?.limit ?? SESSION_LIMIT)
    const promptRows = listPromptRows(
      db,
      sessions.map((session) => session.id),
    )

    const promptsBySession = new Map<string, string[]>()
    const searchTextBySession = new Map<string, string[]>()

    for (const row of promptRows) {
      const text = parseTextPart(row.text)

      if (!text) continue

      const prompts = promptsBySession.get(row.session_id) ?? []
      const searchTexts = searchTextBySession.get(row.session_id) ?? []

      prompts.push(truncate(text))
      searchTexts.push(text)

      promptsBySession.set(row.session_id, prompts)
      searchTextBySession.set(row.session_id, searchTexts)
    }

    return sessions.map<SessionPreview>((session) => ({
      id: session.id,
      title: session.title,
      directory: session.directory,
      projectId: session.project_id,
      updatedAtMs: session.time_updated,
      updatedAtLabel: formatUpdatedAt(session.time_updated),
      prompts: promptsBySession.get(session.id) ?? [],
      searchText: [
        session.title,
        session.directory,
        ...(searchTextBySession.get(session.id) ?? []),
      ].join("\n"),
    }))
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
