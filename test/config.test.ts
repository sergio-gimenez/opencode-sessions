import { describe, expect, it } from "vitest"

import { parseArgs } from "../src/cli-options.js"
import { parseConfig } from "../src/config.js"
import { buildContinuationPrompt } from "../src/seed.js"
import type { SessionPreview } from "../src/types.js"

const session: SessionPreview = {
  id: "sid",
  title: "Improve the picker",
  directory: "/home/dev/proj",
  projectId: "",
  source: "claude",
  updatedAtMs: 1,
  updatedAtLabel: "",
  prompts: [],
  assistantSnippets: [],
  searchText: "",
}

describe("skip-permissions flag", () => {
  it("defaults to undefined so config decides", () => {
    expect(parseArgs([]).skipPermissions).toBeUndefined()
  })

  it("enables via --dangerous / --skip-permissions / --yolo", () => {
    expect(parseArgs(["--dangerous"]).skipPermissions).toBe(true)
    expect(parseArgs(["--skip-permissions"]).skipPermissions).toBe(true)
    expect(parseArgs(["--yolo"]).skipPermissions).toBe(true)
  })

  it("forces off via --safe", () => {
    expect(parseArgs(["--safe"]).skipPermissions).toBe(false)
  })

  it("selects an initial Claude account", () => {
    expect(parseArgs(["--claude-account", "CC2"]).claudeAccount).toBe("cc2")
  })
})

describe("parseConfig", () => {
  it("reads skipPermissions", () => {
    expect(parseConfig('{"skipPermissions":true}').skipPermissions).toBe(true)
  })

  it("defaults skipPermissions to false", () => {
    expect(parseConfig("{}").skipPermissions).toBe(false)
  })

  it("reads Claude accounts and validates the default", () => {
    const config = parseConfig(JSON.stringify({
      claudeAccounts: [
        { name: "CC1" },
        { name: "cc2", configDir: "/tmp/cc2" },
      ],
      defaultClaudeAccount: "CC2",
    }))

    expect(config.claudeAccounts).toEqual([
      { name: "cc1" },
      { name: "cc2", configDir: "/tmp/cc2" },
    ])
    expect(config.defaultClaudeAccount).toBe("cc2")
  })
})

describe("buildContinuationPrompt", () => {
  it("labels source, seeds latest turn, and includes the full transcript", () => {
    const prompt = buildContinuationPrompt(session, [
      { role: "user", text: "How do I make the picker responsive?" },
      { role: "assistant", text: "Use terminal width." },
      { role: "user", text: "Add badges too." },
    ])

    expect(prompt).toContain("prior Claude Code conversation")
    expect(prompt).toContain("Original session: sid")
    expect(prompt).toContain("Latest user message: Add badges too.")
    expect(prompt).toContain("Reply directly to the latest user message first")
    // full transcript, not just the last few turns
    expect(prompt).toContain("USER: How do I make the picker responsive?")
    expect(prompt).toContain("ASSISTANT: Use terminal width.")
    expect(prompt).toContain("=== TRANSCRIPT ===")
  })

  it("drops oldest turns when over the char budget", () => {
    const big = "x".repeat(5000)
    const turns = Array.from({ length: 40 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      text: `TURN${i}::${big}`,
    }))
    const prompt = buildContinuationPrompt(session, turns)

    expect(prompt).toContain("earlier turns omitted for length")
    // newest turn kept, oldest dropped
    expect(prompt).toContain("TURN39::")
    expect(prompt).not.toContain("TURN0::")
  })
})
