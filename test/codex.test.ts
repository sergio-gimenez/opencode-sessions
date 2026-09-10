import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { getCodexSessions, parseCodexRollout, parseCodexSession } from "../src/codex.js"
import { buildSessionSeed } from "../src/seed.js"
import type { Account } from "../src/types.js"

function jsonl(lines: unknown[]) {
  return lines.map((line) => JSON.stringify(line)).join("\n")
}

function item(role: string, type: string, text: string) {
  return {
    timestamp: "2025-06-01T09:30:00.000Z",
    type: "response_item",
    payload: { type: "message", role, content: [{ type, text }] },
  }
}

const raw = jsonl([
  {
    timestamp: "2025-06-01T09:30:00.000Z",
    type: "session_meta",
    payload: {
      id: "7c1e5c40-2f6a-4a0b-9c3d-0f1a2b3c4d5e",
      timestamp: "2025-06-01T09:30:00.000Z",
      cwd: "/home/dev/project",
      cli_version: "0.154.0",
    },
  },
  item("user", "input_text", "<environment_context>cwd=/home/dev/project</environment_context>"),
  item("user", "input_text", "Why does the mesh VPN handshake time out?"),
  { timestamp: "x", type: "response_item", payload: { type: "function_call", name: "shell" } },
  item("assistant", "output_text", "The WireGuard keepalive is unset."),
  item("user", "input_text", "Set it to 25 seconds then."),
])

describe("parseCodexRollout", () => {
  it("reads the id, cwd and turns out of the envelope format", () => {
    const rollout = parseCodexRollout(raw)

    expect(rollout.id).toBe("7c1e5c40-2f6a-4a0b-9c3d-0f1a2b3c4d5e")
    expect(rollout.directory).toBe("/home/dev/project")
    expect(rollout.turns).toEqual([
      { role: "user", text: "Why does the mesh VPN handshake time out?" },
      { role: "assistant", text: "The WireGuard keepalive is unset." },
      { role: "user", text: "Set it to 25 seconds then." },
    ])
  })

  it("drops the context Codex feeds itself as an opening user turn", () => {
    expect(parseCodexRollout(raw).turns.map((turn) => turn.text)).not.toContain(
      "<environment_context>cwd=/home/dev/project</environment_context>",
    )
  })

  it("reads pre-envelope rollouts that wrote items bare", () => {
    const legacy = jsonl([
      { id: "legacy-id", timestamp: "2025-01-01T00:00:00.000Z", cwd: "/tmp/legacy" },
      { type: "message", role: "user", content: [{ type: "input_text", text: "Old format" }] },
      { type: "message", role: "assistant", content: [{ type: "output_text", text: "Still read." }] },
    ])
    const rollout = parseCodexRollout(legacy)

    expect(rollout.id).toBe("legacy-id")
    expect(rollout.directory).toBe("/tmp/legacy")
    expect(rollout.turns).toHaveLength(2)
  })

  it("falls back to the UI events when a rollout carries only those", () => {
    const events = jsonl([
      { type: "session_meta", payload: { id: "e1", cwd: "/tmp/e" } },
      { type: "event_msg", payload: { type: "user_message", message: "Event only" } },
      { type: "event_msg", payload: { type: "agent_message", message: "Answered" } },
    ])

    expect(parseCodexRollout(events).turns).toEqual([
      { role: "user", text: "Event only" },
      { role: "assistant", text: "Answered" },
    ])
  })

  it("does not count a turn twice when both records are present", () => {
    const both = jsonl([
      { type: "session_meta", payload: { id: "b1", cwd: "/tmp/b" } },
      item("user", "input_text", "Only once"),
      { type: "event_msg", payload: { type: "user_message", message: "Only once" } },
    ])

    expect(parseCodexRollout(both).turns).toEqual([{ role: "user", text: "Only once" }])
  })
})

describe("parseCodexSession", () => {
  it("builds a preview titled by the opening prompt", () => {
    const preview = parseCodexSession(raw, {
      sessionId: "from-filename",
      updatedAtMs: 1000,
      scope: "user",
    })

    expect(preview?.source).toBe("codex")
    // The rollout's own id wins over the one guessed from the file name.
    expect(preview?.id).toBe("7c1e5c40-2f6a-4a0b-9c3d-0f1a2b3c4d5e")
    expect(preview?.title).toBe("Why does the mesh VPN handshake time out?")
    expect(preview?.directory).toBe("/home/dev/project")
    expect(preview?.prompts).toEqual([
      "Why does the mesh VPN handshake time out?",
      "Set it to 25 seconds then.",
    ])
    expect(preview?.searchText).toContain("handshake")
    expect(preview?.searchText).not.toContain("keepalive")
  })

  it("includes assistant text when scope is all", () => {
    const preview = parseCodexSession(raw, { sessionId: "x", updatedAtMs: 1, scope: "all" })
    expect(preview?.searchText).toContain("keepalive")
  })

  it("returns null for a rollout with no prompt of your own", () => {
    const empty = jsonl([{ type: "session_meta", payload: { id: "x", cwd: "/tmp" } }])
    expect(parseCodexSession(empty, { sessionId: "x", updatedAtMs: 1, scope: "user" })).toBeNull()
  })
})

describe("getCodexSessions", () => {
  it("walks the dated rollout tree and records account and path", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "ocs-codex-"))

    try {
      const dayDir = path.join(home, "sessions", "2025", "06", "01")
      fs.mkdirSync(dayDir, { recursive: true })
      const filePath = path.join(dayDir, "rollout-2025-06-01T09-30-00-7c1e5c40-2f6a-4a0b-9c3d-0f1a2b3c4d5e.jsonl")
      fs.writeFileSync(filePath, raw)

      // Archived rollouts live in a sibling tree and must stay out of the list.
      const archived = path.join(home, "archived_sessions", "2025", "06", "01")
      fs.mkdirSync(archived, { recursive: true })
      fs.writeFileSync(path.join(archived, "rollout-old.jsonl"), raw)

      const account: Account = { tool: "codex", name: "cx2", home }
      const sessions = getCodexSessions({ account })

      expect(sessions).toHaveLength(1)
      expect(sessions[0].account).toEqual(account)
      expect(sessions[0].filePath).toBe(filePath)
    } finally {
      fs.rmSync(home, { recursive: true, force: true })
    }
  })

  it("returns nothing when Codex is not installed", () => {
    expect(getCodexSessions({ sessionsPath: "/tmp/ocs-no-codex-here-4f2a" })).toEqual([])
  })
})

describe("buildSessionSeed", () => {
  it("carries a Codex rollout into another tool as a transcript", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "ocs-codex-seed-"))

    try {
      const filePath = path.join(home, "rollout.jsonl")
      fs.writeFileSync(filePath, raw)

      const preview = parseCodexSession(raw, {
        sessionId: "x",
        updatedAtMs: 1,
        scope: "user",
        filePath,
      })

      const seed = await buildSessionSeed(preview!)

      expect(seed.directory).toBe("/home/dev/project")
      expect(seed.prompt).toContain("prior Codex conversation")
      expect(seed.prompt).toContain("USER: Why does the mesh VPN handshake time out?")
      expect(seed.prompt).toContain("ASSISTANT: The WireGuard keepalive is unset.")
      expect(seed.prompt).toContain("Latest user message: Set it to 25 seconds then.")
    } finally {
      fs.rmSync(home, { recursive: true, force: true })
    }
  })
})
