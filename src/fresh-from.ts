import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { spawn } from "node:child_process"

import { collapseWhitespace, truncate } from "./format.js"

const MAX_USER_TURNS = 6
const MAX_ASSISTANT_TURNS = 3

type ExportedPart = {
  type?: string
  text?: string
}

type ExportedMessage = {
  info?: {
    role?: string
  }
  parts?: ExportedPart[]
}

type ExportedSession = {
  info?: {
    id?: string
    title?: string
    directory?: string
  }
  messages?: ExportedMessage[]
}

export type FreshSessionSeed = {
  sessionId: string
  title: string
  directory: string
  prompt: string
}

function parseExport(raw: string) {
  const content = raw.replace(/^Exporting session:.*\n/, "")
  return JSON.parse(content) as ExportedSession
}

function getTextParts(message: ExportedMessage) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => collapseWhitespace(part.text ?? ""))
    .filter(Boolean)
}

function renderTranscript(messages: ExportedMessage[], role: "user" | "assistant", limit: number) {
  return messages
    .filter((message) => message.info?.role === role)
    .flatMap((message) => getTextParts(message))
    .slice(-limit)
    .map((text) => `- ${truncate(text, 240)}`)
}

export function buildFreshPrompt(session: FreshSessionSeed, messages: ExportedMessage[]) {
  const userTurns = renderTranscript(messages, "user", MAX_USER_TURNS)
  const assistantTurns = renderTranscript(messages, "assistant", MAX_ASSISTANT_TURNS)

  return [
    "Continue a prior OpenCode conversation in a new clean session.",
    "",
    `Original session: ${session.sessionId}`,
    `Original title: ${session.title}`,
    `Original directory: ${session.directory}`,
    "",
    "Recent user turns:",
    ...(userTurns.length > 0 ? userTurns : ["- No recent user turns found."]),
    "",
    "Recent assistant turns:",
    ...(assistantTurns.length > 0 ? assistantTurns : ["- No recent assistant turns found."]),
    "",
    "Continue naturally from this context. If some context appears incomplete, say so briefly and continue with the most recent thread.",
  ].join("\n")
}

export async function createFreshSessionSeed(sessionId: string): Promise<FreshSessionSeed> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ocs-fresh-from-"))
  const exportPath = path.join(tempDir, `${sessionId}.json`)

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("/bin/zsh", ["-lc", `opencode export ${sessionId} > "${exportPath}"`], {
        stdio: "inherit",
      })

      child.on("error", reject)
      child.on("exit", (code) => {
        if ((code ?? 1) !== 0) {
          reject(new Error(`Failed to export session ${sessionId}.`))
          return
        }

        resolve()
      })
    })

    const raw = await readFile(exportPath, "utf8")
    const exported = parseExport(raw)
  const directory = exported.info?.directory

  if (!directory) {
    throw new Error("The exported session does not include a directory.")
  }

  const title = exported.info?.title ?? `Recovered session ${sessionId}`

  return {
    sessionId,
    title,
    directory,
    prompt: buildFreshPrompt(
      {
        sessionId,
        title,
        directory,
        prompt: "",
      },
      exported.messages ?? [],
    ),
  }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
