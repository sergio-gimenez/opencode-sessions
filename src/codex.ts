import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { collapseWhitespace, formatUpdatedAt, truncate } from "./format.js"
import type { Account, SessionPreview, SessionSearchScope } from "./types.js"

const PROMPT_LIMIT = 3
const JSONL_EXT = ".jsonl"
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function codexHome(account?: Account) {
  return account?.home ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex")
}

// Codex splits rollouts by state: active sessions live under `sessions/`,
// archived ones under `archived_sessions/`. Only the active ones are listed,
// which is how OpenCode's archived sessions are treated too.
export function resolveSessionsPath(account?: Account) {
  if (account?.home) return path.join(account.home, "sessions")
  return process.env.CODEX_SESSIONS_PATH ?? path.join(codexHome(), "sessions")
}

export type Turn = { role: "user" | "assistant"; text: string }

type RolloutLine = {
  type?: string
  role?: string
  content?: unknown
  payload?: RolloutPayload
  // Pre-envelope rollouts put the session metadata on the first bare line.
  id?: string
  cwd?: string
}

type RolloutPayload = {
  type?: string
  role?: string
  content?: unknown
  message?: unknown
  id?: string
  cwd?: string
}

type ContentPart = { type?: string; text?: unknown }

const TEXT_PARTS = new Set(["input_text", "output_text", "text"])

function extractText(content: unknown): string {
  if (typeof content === "string") return collapseWhitespace(content)

  if (Array.isArray(content)) {
    return collapseWhitespace(
      (content as ContentPart[])
        .filter((part) => part && TEXT_PARTS.has(part.type ?? "") && typeof part.text === "string")
        .map((part) => part.text as string)
        .join(" "),
    )
  }

  return ""
}

// Codex opens a session by feeding itself context — the AGENTS.md files, the
// environment block, the tool preamble — as user turns. They are markup, never
// something the person typed, so they must not become the title or match a
// search for what you actually asked.
function isNoise(text: string) {
  return text.startsWith("<") || text.startsWith("## My request for Codex:")
}

// Both the structured `response_item` messages and the UI-level `event_msg`
// events describe the same turn, so counting both would duplicate every line.
// Response items are the richer record; events are the fallback for rollouts
// that only carry them.
function collectTurns(items: Turn[], events: Turn[]) {
  return items.length > 0 ? items : events
}

export function parseCodexRollout(raw: string): {
  id?: string
  directory: string
  turns: Turn[]
} {
  let id: string | undefined
  let directory = ""
  const items: Turn[] = []
  const events: Turn[] = []

  const push = (into: Turn[], role: string | undefined, text: string) => {
    if (role !== "user" && role !== "assistant") return
    if (!text) return
    if (role === "user" && isNoise(text)) return
    into.push({ role, text })
  }

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue

    let entry: RolloutLine
    try {
      entry = JSON.parse(line) as RolloutLine
    } catch {
      continue
    }

    const payload = entry.payload ?? {}

    if (!id && typeof (payload.id ?? entry.id) === "string") id = payload.id ?? entry.id
    if (!directory && typeof (payload.cwd ?? entry.cwd) === "string") {
      directory = (payload.cwd ?? entry.cwd) as string
    }

    if (entry.type === "event_msg") {
      const role =
        payload.type === "user_message" ? "user" : payload.type === "agent_message" ? "assistant" : undefined
      push(events, role, extractText(payload.message))
      continue
    }

    // `response_item` wraps the item; the oldest rollouts wrote it bare.
    const item = entry.type === "response_item" ? payload : entry
    if (item.type === "message") push(items, item.role, extractText(item.content))
  }

  return { id, directory, turns: collectTurns(items, events) }
}

export function parseCodexSession(
  raw: string,
  meta: {
    sessionId: string
    updatedAtMs: number
    scope: SessionSearchScope
    account?: Account
    filePath?: string
  },
): SessionPreview | null {
  const { id, directory, turns } = parseCodexRollout(raw)

  const userTexts = turns.filter((turn) => turn.role === "user").map((turn) => turn.text)
  const assistantTexts = turns.filter((turn) => turn.role === "assistant").map((turn) => turn.text)

  // A rollout with no prompt is a session that was opened and abandoned.
  if (userTexts.length === 0) return null

  return {
    id: id ?? meta.sessionId,
    // Codex records no title of its own, so the opening prompt names the
    // session — the same fallback the Claude reader uses for untitled sessions.
    title: truncate(userTexts[0], 80),
    directory: directory || "unknown",
    projectId: "",
    source: "codex",
    updatedAtMs: meta.updatedAtMs,
    updatedAtLabel: formatUpdatedAt(meta.updatedAtMs),
    prompts: userTexts.slice(-PROMPT_LIMIT).map((text) => truncate(text)),
    assistantSnippets: assistantTexts.slice(-PROMPT_LIMIT).map((text) => truncate(text)),
    account: meta.account,
    filePath: meta.filePath,
    searchText: [
      directory,
      meta.account?.name ?? "",
      ...userTexts,
      ...(meta.scope === "all" ? assistantTexts : []),
    ].join("\n"),
  }
}

// Rollouts are filed under sessions/YYYY/MM/DD/, so the walk has to recurse
// rather than read one flat directory of projects.
function walkRollouts(root: string, found: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return found
  }

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) walkRollouts(entryPath, found)
    else if (entry.isFile() && entry.name.endsWith(JSONL_EXT)) found.push(entryPath)
  }

  return found
}

// rollout-2025-06-01T09-30-00-<uuid>.jsonl — the id is the trailing UUID, used
// only until the file's own session metadata supplies it.
function sessionIdFromName(fileName: string) {
  return UUID.exec(fileName)?.[0] ?? fileName.slice(0, -JSONL_EXT.length)
}

export function getCodexSessions(options?: {
  sessionsPath?: string
  search?: SessionSearchScope
  account?: Account
}): SessionPreview[] {
  const root = options?.sessionsPath ?? resolveSessionsPath(options?.account)
  const scope = options?.search ?? "user"
  const previews: SessionPreview[] = []

  for (const filePath of walkRollouts(root)) {
    try {
      const stat = fs.statSync(filePath)
      const preview = parseCodexSession(fs.readFileSync(filePath, "utf8"), {
        sessionId: sessionIdFromName(path.basename(filePath)),
        updatedAtMs: stat.mtimeMs,
        scope,
        account: options?.account,
        filePath,
      })
      if (preview) previews.push(preview)
    } catch {
      continue
    }
  }

  return previews
}
