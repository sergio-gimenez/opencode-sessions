import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { collapseWhitespace, truncate } from "./format.js"
import type { SessionPreview, SessionSource } from "./types.js"

// Full transcript, with guards so a huge session doesn't blow the prompt:
// truncate each turn, then keep the most recent turns within a char budget.
const MAX_TURN_CHARS = 4000
const MAX_TRANSCRIPT_CHARS = 60000
const JSONL_EXT = ".jsonl"

export type Turn = { role: "user" | "assistant"; text: string }

export type SessionSeed = {
  directory: string
  prompt: string
}

function toolName(source: SessionSource) {
  return source === "claude" ? "Claude Code" : "OpenCode"
}

function lastTurn(turns: Turn[], role: "user" | "assistant") {
  return turns.filter((turn) => turn.role === role).at(-1)?.text
}

function renderTranscript(turns: Turn[]) {
  const rendered = turns.map(
    (turn) => `${turn.role === "user" ? "USER" : "ASSISTANT"}: ${truncate(turn.text, MAX_TURN_CHARS)}`,
  )

  // Keep the most recent turns that fit the budget; drop oldest if over.
  const kept: string[] = []
  let total = 0
  let dropped = false

  for (let index = rendered.length - 1; index >= 0; index -= 1) {
    const line = rendered[index]
    if (kept.length > 0 && total + line.length > MAX_TRANSCRIPT_CHARS) {
      dropped = true
      break
    }
    kept.unshift(line)
    total += line.length
  }

  if (dropped) kept.unshift("[... earlier turns omitted for length ...]")
  return kept.length > 0 ? kept.join("\n\n") : "(no transcript found)"
}

export function buildContinuationPrompt(session: SessionPreview, turns: Turn[]) {
  const lastUser = lastTurn(turns, "user")

  return [
    `Continue a prior ${toolName(session.source)} conversation in a new clean session.`,
    "",
    `Original session: ${session.id}`,
    `Original title: ${session.title}`,
    `Original directory: ${session.directory}`,
    "",
    "You are resuming this conversation in a different tool. The full transcript",
    "is below. Reply directly to the latest user message first; do not restart the",
    "conversation from scratch. If some context looks incomplete, say so briefly and",
    "then continue with the most recent thread.",
    ...(lastUser ? ["", `Latest user message: ${truncate(lastUser, 320)}`] : []),
    "",
    "=== TRANSCRIPT ===",
    renderTranscript(turns),
    "=== END TRANSCRIPT ===",
  ].join("\n")
}

// --- OpenCode transcript (via `opencode export`) -------------------------

type ExportedPart = { type?: string; text?: string }
type ExportedMessage = { info?: { role?: string }; parts?: ExportedPart[] }
type ExportedSession = { info?: { directory?: string }; messages?: ExportedMessage[] }

function exportedToTurns(messages: ExportedMessage[]): Turn[] {
  const turns: Turn[] = []

  for (const message of messages) {
    const role = message.info?.role
    if (role !== "user" && role !== "assistant") continue

    const text = collapseWhitespace(
      (message.parts ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join(" "),
    )

    if (text) turns.push({ role, text })
  }

  return turns
}

async function opencodeTranscript(sessionId: string): Promise<{ directory: string; turns: Turn[] }> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ocs-seed-"))
  const exportPath = path.join(tempDir, `${sessionId}.json`)

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("/bin/zsh", ["-lc", `opencode export ${sessionId} > "${exportPath}"`], {
        stdio: "inherit",
      })
      child.on("error", reject)
      child.on("exit", (code) => {
        if ((code ?? 1) !== 0) {
          reject(new Error(`Failed to export OpenCode session ${sessionId}.`))
          return
        }
        resolve()
      })
    })

    const raw = await readFile(exportPath, "utf8")
    const exported = JSON.parse(raw.replace(/^Exporting session:.*\n/, "")) as ExportedSession
    const directory = exported.info?.directory

    if (!directory) throw new Error("Exported OpenCode session has no directory.")

    return { directory, turns: exportedToTurns(exported.messages ?? []) }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

// --- Claude Code transcript (parse the session JSONL) --------------------

type ClaudeLine = { type?: string; cwd?: string; message?: { content?: unknown } }
type ClaudePart = { type?: string; text?: unknown }

function claudeText(content: unknown): string {
  if (typeof content === "string") return collapseWhitespace(content)
  if (Array.isArray(content)) {
    return collapseWhitespace(
      (content as ClaudePart[])
        .filter((part) => part && part.type === "text" && typeof part.text === "string")
        .map((part) => part.text as string)
        .join(" "),
    )
  }
  return ""
}

function findClaudeFile(sessionId: string): string | null {
  const root =
    process.env.CLAUDE_PROJECTS_PATH ?? path.join(os.homedir(), ".claude", "projects")

  let projectDirs: string[]
  try {
    projectDirs = fs.readdirSync(root)
  } catch {
    return null
  }

  for (const projectDir of projectDirs) {
    const candidate = path.join(root, projectDir, `${sessionId}${JSONL_EXT}`)
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}

function claudeTranscript(sessionId: string): { directory: string; turns: Turn[] } {
  const filePath = findClaudeFile(sessionId)
  if (!filePath) throw new Error(`Could not find Claude session ${sessionId}.`)

  const raw = fs.readFileSync(filePath, "utf8")
  let directory = ""
  const turns: Turn[] = []

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue

    let entry: ClaudeLine
    try {
      entry = JSON.parse(line) as ClaudeLine
    } catch {
      continue
    }

    if (!directory && typeof entry.cwd === "string") directory = entry.cwd

    if (entry.type === "user" && entry.message) {
      const content = entry.message.content
      if (Array.isArray(content) && content.every((p: ClaudePart) => p && p.type === "tool_result")) {
        continue
      }
      const text = claudeText(content)
      if (text && !text.startsWith("<") && !text.startsWith("Caveat:")) {
        turns.push({ role: "user", text })
      }
    } else if (entry.type === "assistant" && entry.message) {
      const text = claudeText(entry.message.content)
      if (text) turns.push({ role: "assistant", text })
    }
  }

  if (!directory) directory = process.cwd()
  return { directory, turns }
}

// --- Public: build a seed for cross-tool continuation --------------------

export async function buildSessionSeed(session: SessionPreview): Promise<SessionSeed> {
  const { directory, turns } =
    session.source === "opencode"
      ? await opencodeTranscript(session.id)
      : claudeTranscript(session.id)

  return {
    directory,
    prompt: buildContinuationPrompt({ ...session, directory }, turns),
  }
}
