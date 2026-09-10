import { describe, expect, it } from "vitest"

import { badgeTarget, enterDestination, isSubmitKey, queryInput, sessionBadgeText } from "../src/picker.js"
import { OPENCODE_ACCOUNT, nextTarget, nextToolTarget } from "../src/targets.js"
import type { Account, SessionPreview } from "../src/types.js"

const cc1: Account = { tool: "claude", name: "cc1" }
const cc2: Account = { tool: "claude", name: "cc2", home: "/tmp/.claude-cc2" }
const cx1: Account = { tool: "codex", name: "cx1" }
const cx2: Account = { tool: "codex", name: "cx2", home: "/tmp/.codex-cx2" }
const targets = [OPENCODE_ACCOUNT, cc1, cc2, cx1]

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
  account: cc1,
}

const codexSession: SessionPreview = { ...session, source: "codex", account: cx1 }
const opencodeSession: SessionPreview = { ...session, source: "opencode", account: undefined }

describe("route badge", () => {
  it("shows source to target when opening across accounts", () => {
    expect(sessionBadgeText(session, cc2)).toBe("[CC1→CC2]")
  })

  it("shows one account when source and target match", () => {
    expect(sessionBadgeText(session, cc1)).toBe("[CC1]")
  })

  it("reverses the route when the target changes", () => {
    expect(sessionBadgeText({ ...session, account: cc2 }, cc1)).toBe("[CC2→CC1]")
  })

  it("routes across tools too, now that Enter can cross them", () => {
    expect(sessionBadgeText(opencodeSession, cx1)).toBe("[OC→CX1]")
    expect(sessionBadgeText(codexSession, cc2)).toBe("[CX1→CC2]")
    expect(sessionBadgeText(session, OPENCODE_ACCOUNT)).toBe("[CC1→OC]")
  })

  it("keeps OpenCode native whichever OpenCode target is displayed", () => {
    expect(sessionBadgeText(opencodeSession, OPENCODE_ACCOUNT)).toBe("[OC]")
  })

  it("keeps a Codex session native in its own account", () => {
    expect(sessionBadgeText(codexSession, cx1)).toBe("[CX1]")
    expect(sessionBadgeText(codexSession, cx2)).toBe("[CX1→CX2]")
  })
})

describe("badge target", () => {
  // A row only shows a route once you have deliberately pinned a destination.
  // While the target follows the cursor, an unselected row would otherwise
  // advertise a hop it is not going to make.
  it("drops the target while it still follows the selection", () => {
    expect(badgeTarget(cx1, false)).toBeUndefined()
    expect(sessionBadgeText(opencodeSession, badgeTarget(cx1, false))).toBe("[OC]")
  })

  it("keeps it once pinned, so every row shows the route", () => {
    expect(badgeTarget(cx1, true)).toEqual(cx1)
    expect(sessionBadgeText(opencodeSession, badgeTarget(cx1, true))).toBe("[OC→CX1]")
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
    expect(queryInput({ sequence: "", name: "d", ctrl: true })).toBe("")
    expect(queryInput({ sequence: "b", name: "b", meta: true })).toBe("")
    expect(queryInput({ name: "left" })).toBe("")
  })
})

describe("Enter destination", () => {
  it("opens a session in the displayed target account", () => {
    expect(enterDestination(session, cc2)).toEqual({ session, target: cc2, mode: "resume" })
  })

  it("sends an OpenCode session to a Codex target", () => {
    expect(enterDestination(opencodeSession, cx1)).toEqual({
      session: opencodeSession,
      target: cx1,
      mode: "resume",
    })
  })

  it("carries the fork mode down the same route", () => {
    expect(enterDestination(session, cc1, "fork")).toEqual({
      session,
      target: cc1,
      mode: "fork",
    })
  })

  it("falls back to the session's own account with no target configured", () => {
    expect(enterDestination(codexSession)).toEqual({
      session: codexSession,
      target: cx1,
      mode: "resume",
    })
  })
})

describe("target cycling", () => {
  it("wraps forwards and backwards", () => {
    expect(nextTarget(targets, 3, 1)).toBe(0)
    expect(nextTarget(targets, 0, -1)).toBe(3)
  })

  it("stays put when nothing is configured", () => {
    expect(nextTarget([], 0, 1)).toBe(0)
  })

  it("skips the other accounts of the current tool when Tab jumps tools", () => {
    // From OpenCode the next tool is Claude, and with no Claude target held it
    // takes the first configured Claude account rather than walking to cc2.
    expect(nextToolTarget(targets, "opencode")).toEqual(cc1)
    // A held target on the tool being jumped to wins over the first account.
    expect(nextToolTarget(targets, "opencode", cc2)).toEqual(cc2)
    // From Codex it wraps back round to OpenCode.
    expect(nextToolTarget(targets, "codex", cx1)).toEqual(OPENCODE_ACCOUNT)
  })

  it("skips a tool that has no configured target", () => {
    expect(nextToolTarget([OPENCODE_ACCOUNT, cx1], "claude")).toEqual(cx1)
    expect(nextToolTarget([], "claude")).toBeUndefined()
  })
})
