import { describe, expect, it } from "vitest"

import { mergeSessions } from "../src/aggregate.js"
import { parseClaudeSession } from "../src/claude.js"
import type { SessionPreview } from "../src/types.js"

function jsonl(lines: unknown[]) {
  return lines.map((line) => JSON.stringify(line)).join("\n")
}

const raw = jsonl([
  { type: "mode", mode: "normal" },
  { type: "ai-title", aiTitle: "Refactor the picker" },
  {
    type: "user",
    cwd: "/home/dev/project",
    message: { role: "user", content: "How do I make the picker responsive?" },
  },
  {
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text: "Use terminal width." }] },
  },
  {
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", text: "ignored" }] },
  },
  {
    type: "user",
    message: { role: "user", content: [{ type: "text", text: "Add source badges too." }] },
  },
])

describe("parseClaudeSession", () => {
  it("extracts title, directory, prompts and source", () => {
    const preview = parseClaudeSession(raw, {
      sessionId: "abc-123",
      updatedAtMs: 1000,
      scope: "user",
    })

    expect(preview).not.toBeNull()
    expect(preview?.source).toBe("claude")
    expect(preview?.id).toBe("abc-123")
    expect(preview?.title).toBe("Refactor the picker")
    expect(preview?.directory).toBe("/home/dev/project")
    expect(preview?.prompts).toEqual([
      "How do I make the picker responsive?",
      "Add source badges too.",
    ])
    expect(preview?.searchText).toContain("responsive")
    expect(preview?.searchText).not.toContain("Use terminal width")
  })

  it("skips tool-result-only user messages", () => {
    const preview = parseClaudeSession(raw, { sessionId: "x", updatedAtMs: 1, scope: "user" })
    expect(preview?.prompts).not.toContain("ignored")
  })

  it("includes assistant text when scope is all", () => {
    const preview = parseClaudeSession(raw, { sessionId: "x", updatedAtMs: 1, scope: "all" })
    expect(preview?.searchText).toContain("Use terminal width")
  })

  it("returns null for a session with no title and no user prompts", () => {
    const empty = jsonl([{ type: "mode", mode: "normal" }])
    expect(parseClaudeSession(empty, { sessionId: "x", updatedAtMs: 1, scope: "user" })).toBeNull()
  })

  it("falls back to first prompt when no ai-title", () => {
    const noTitle = jsonl([
      { type: "user", cwd: "/tmp", message: { role: "user", content: "First real question" } },
    ])
    const preview = parseClaudeSession(noTitle, { sessionId: "x", updatedAtMs: 1, scope: "user" })
    expect(preview?.title).toBe("First real question")
  })
})

describe("mergeSessions", () => {
  it("interleaves sources sorted by updatedAt desc", () => {
    const opencode: SessionPreview[] = [
      { id: "o1", title: "oc", directory: "/a", projectId: "p", source: "opencode", updatedAtMs: 300, updatedAtLabel: "", prompts: [], assistantSnippets: [], searchText: "" },
    ]
    const claude: SessionPreview[] = [
      { id: "c1", title: "cc", directory: "/b", projectId: "", source: "claude", updatedAtMs: 500, updatedAtLabel: "", prompts: [], assistantSnippets: [], searchText: "" },
      { id: "c2", title: "cc2", directory: "/c", projectId: "", source: "claude", updatedAtMs: 100, updatedAtLabel: "", prompts: [], assistantSnippets: [], searchText: "" },
    ]

    const merged = mergeSessions(opencode, claude)
    expect(merged.map((s) => s.id)).toEqual(["c1", "o1", "c2"])
  })
})
