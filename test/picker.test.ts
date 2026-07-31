import { describe, expect, it } from "vitest"

import { sessionBadgeText } from "../src/picker.js"
import type { ClaudeAccount, SessionPreview } from "../src/types.js"

const cc1: ClaudeAccount = { name: "cc1" }
const cc2: ClaudeAccount = { name: "cc2", configDir: "/tmp/.claude-cc2" }

const session: SessionPreview = {
  id: "sid",
  title: "Old session",
  directory: "/tmp/project",
  projectId: "",
  source: "claude",
  updatedAtMs: 1,
  updatedAtLabel: "",
  prompts: [],
  assistantSnippets: [],
  searchText: "",
  claudeAccount: cc1,
}

describe("Claude account route badge", () => {
  it("shows source to target when opening across accounts", () => {
    expect(sessionBadgeText(session, cc2)).toBe("[CC1→CC2]")
  })

  it("shows one account when source and target match", () => {
    expect(sessionBadgeText(session, cc1)).toBe("[CC1]")
  })

  it("reverses the route when the target changes", () => {
    expect(sessionBadgeText({ ...session, claudeAccount: cc2 }, cc1)).toBe("[CC2→CC1]")
  })

  it("keeps OpenCode badges unchanged", () => {
    expect(sessionBadgeText({ ...session, source: "opencode" }, cc2)).toBe("[OC]")
  })
})
