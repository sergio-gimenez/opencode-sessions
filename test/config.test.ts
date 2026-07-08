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
})

describe("parseConfig", () => {
  it("reads skipPermissions", () => {
    expect(parseConfig('{"skipPermissions":true}').skipPermissions).toBe(true)
  })

  it("defaults skipPermissions to false", () => {
    expect(parseConfig("{}").skipPermissions).toBe(false)
  })
})

describe("buildContinuationPrompt", () => {
  it("labels the source tool and seeds latest turn", () => {
    const prompt = buildContinuationPrompt(session, [
      { role: "user", text: "How do I make the picker responsive?" },
      { role: "assistant", text: "Use terminal width." },
      { role: "user", text: "Add badges too." },
    ])

    expect(prompt).toContain("prior Claude Code conversation")
    expect(prompt).toContain("Original session: sid")
    expect(prompt).toContain("Latest user message: Add badges too.")
    expect(prompt).toContain("Reply directly to the latest user message first")
  })
})
