import { describe, expect, it } from "vitest"

import { enterDestination, isSubmitKey, queryInput, sessionBadgeText } from "../src/picker.js"
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

describe("Submit key", () => {
  it("accepts carriage return", () => {
    expect(isSubmitKey({ sequence: "\r", name: "return" })).toBe(true)
  })

  it("accepts line feed, which some terminals send instead", () => {
    expect(isSubmitKey({ sequence: "\n", name: "enter" })).toBe(true)
  })

  it("ignores ordinary characters", () => {
    expect(isSubmitKey({ sequence: "a", name: "a" })).toBe(false)
  })
})

describe("Query input", () => {
  it("keeps printable characters", () => {
    expect(queryInput({ sequence: "a", name: "a" })).toBe("a")
  })

  it("drops Enter so it never lands in the query", () => {
    expect(queryInput({ sequence: "\r", name: "return" })).toBe("")
    expect(queryInput({ sequence: "\n", name: "enter" })).toBe("")
  })

  it("drops control and modified keys", () => {
    expect(queryInput({ sequence: "", name: "d", ctrl: true })).toBe("")
    expect(queryInput({ sequence: "b", name: "b", meta: true })).toBe("")
    expect(queryInput({ name: "left" })).toBe("")
  })
})

describe("Enter destination", () => {
  it("opens a Claude session in the displayed target account", () => {
    expect(enterDestination(session, cc2)).toEqual({
      session,
      tool: "claude",
      mode: "resume",
      claudeAccount: cc2,
    })
  })

  it("keeps OpenCode sessions native", () => {
    const opencode = { ...session, source: "opencode" as const }
    expect(enterDestination(opencode, cc2)).toEqual({
      session: opencode,
      tool: "opencode",
      mode: "resume",
    })
  })

  it("carries the fork mode down the same route", () => {
    expect(enterDestination(session, cc1, "fork")).toEqual({
      session,
      tool: "claude",
      mode: "fork",
      claudeAccount: cc1,
    })
  })

  it("forks OpenCode sessions in OpenCode", () => {
    const opencode = { ...session, source: "opencode" as const }
    expect(enterDestination(opencode, cc2, "fork")).toEqual({
      session: opencode,
      tool: "opencode",
      mode: "fork",
    })
  })
})
