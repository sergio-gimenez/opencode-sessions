import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { collapseWhitespace, formatUpdatedAt, truncate } from "./format.js"
import type { SessionPreview, SessionSearchScope } from "./types.js"

const PROMPT_LIMIT = 3
const JSONL_EXT = ".jsonl"

function resolveProjectsPath(explicitPath?: string) {
  return (
    explicitPath ??
    process.env.CLAUDE_PROJECTS_PATH ??
    path.join(os.homedir(), ".claude", "projects")
  )
}

type ClaudeLine = {
  type?: string
  aiTitle?: string
  cwd?: string
  message?: { role?: string; content?: unknown }
}

type ClaudePart = { type?: string; text?: unknown }

function extractText(content: unknown): string {
  if (typeof content === "string") return collapseWhitespace(content)

  if (Array.isArray(content)) {
    const text = (content as ClaudePart[])
      .filter((part) => part && part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join(" ")

    return collapseWhitespace(text)
  }

  return ""
}

function isToolResultOnly(content: unknown) {
  return (
    Array.isArray(content) &&
    content.length > 0 &&
    (content as ClaudePart[]).every((part) => part && part.type === "tool_result")
  )
}

function isNoise(text: string) {
  return (
    text.startsWith("<command-") ||
    text.startsWith("<local-command-") ||
    text.startsWith("<system-reminder") ||
    text.startsWith("Caveat:") ||
    text.includes("<local-command-stdout>") ||
    /^\/[a-z][a-z-]*$/.test(text)
  )
}

export function parseClaudeSession(
  raw: string,
  meta: { sessionId: string; updatedAtMs: number; scope: SessionSearchScope },
): SessionPreview | null {
  let title = ""
  let directory = ""
  const userTexts: string[] = []
  const assistantTexts: string[] = []

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue

    let entry: ClaudeLine
    try {
      entry = JSON.parse(line) as ClaudeLine
    } catch {
      continue
    }

    if (entry.type === "ai-title" && typeof entry.aiTitle === "string") {
      title = entry.aiTitle
      continue
    }

    if (!directory && typeof entry.cwd === "string") directory = entry.cwd

    if (entry.type === "user" && entry.message) {
      if (isToolResultOnly(entry.message.content)) continue
      const text = extractText(entry.message.content)
      if (text && !isNoise(text)) userTexts.push(text)
      continue
    }

    if (entry.type === "assistant" && entry.message) {
      const text = extractText(entry.message.content)
      if (text) assistantTexts.push(text)
    }
  }

  if (userTexts.length === 0 && !title) return null

  if (!title) title = truncate(userTexts[0] ?? "Untitled Claude session", 80)
  if (!directory) directory = "unknown"

  return {
    id: meta.sessionId,
    title,
    directory,
    projectId: "",
    source: "claude",
    updatedAtMs: meta.updatedAtMs,
    updatedAtLabel: formatUpdatedAt(meta.updatedAtMs),
    prompts: userTexts.slice(-PROMPT_LIMIT).map((text) => truncate(text)),
    assistantSnippets: assistantTexts.slice(-PROMPT_LIMIT).map((text) => truncate(text)),
    searchText: [
      title,
      directory,
      ...userTexts,
      ...(meta.scope === "all" ? assistantTexts : []),
    ].join("\n"),
  }
}

export function getClaudeSessions(options?: {
  projectsPath?: string
  search?: SessionSearchScope
}): SessionPreview[] {
  const root = resolveProjectsPath(options?.projectsPath)
  const scope = options?.search ?? "user"

  let projectDirs: string[]
  try {
    projectDirs = fs.readdirSync(root)
  } catch {
    return []
  }

  const previews: SessionPreview[] = []

  for (const projectDir of projectDirs) {
    const projectPath = path.join(root, projectDir)

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(projectPath, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(JSONL_EXT)) continue

      const filePath = path.join(projectPath, entry.name)
      const sessionId = entry.name.slice(0, -JSONL_EXT.length)

      try {
        const stat = fs.statSync(filePath)
        const raw = fs.readFileSync(filePath, "utf8")
        const preview = parseClaudeSession(raw, {
          sessionId,
          updatedAtMs: stat.mtimeMs,
          scope,
        })
        if (preview) previews.push(preview)
      } catch {
        continue
      }
    }
  }

  return previews
}
