import { describe, expect, it } from "vitest"

import { collapseWhitespace } from "../src/format.js"
import { buildFreshPrompt } from "../src/fresh-from.js"
import { parseArgs } from "../src/cli-options.js"
import { buildSessionPreviews, searchSessions } from "../src/sessions.js"
import type { PromptRow, SessionRow } from "../src/types.js"

const sessions: SessionRow[] = [
  {
    id: "ses_1",
    title: "Mesh VPN troubleshooting",
    directory: "/tmp/project-a",
    project_id: "proj-a",
    time_updated: 100,
  },
]

const userPrompts: PromptRow[] = [
  {
    session_id: "ses_1",
    text: JSON.stringify({ text: "How do I configure the mental model for the lab?" }),
  },
  {
    session_id: "ses_1",
    text: JSON.stringify({ text: "Need to fix the VPN gateway route" }),
  },
]

const assistantPrompts: PromptRow[] = [
  {
    session_id: "ses_1",
    text: JSON.stringify({ text: "Try checking the WireGuard peer configuration." }),
  },
]

describe("buildSessionPreviews", () => {
  it("builds compact previews and full search text", () => {
    const previews = buildSessionPreviews(sessions, userPrompts, assistantPrompts, "user")

    expect(previews).toHaveLength(1)
    expect(previews[0].prompts).toHaveLength(2)
    expect(previews[0].assistantSnippets).toHaveLength(1)
    expect(previews[0].searchText).toContain("mental model")
    expect(previews[0].searchText).not.toContain("WireGuard peer")
  })

  it("can include assistant text in the search corpus", () => {
    const previews = buildSessionPreviews(sessions, userPrompts, assistantPrompts, "all")
    expect(previews[0].searchText).toContain("WireGuard peer")
  })
})

describe("searchSessions", () => {
  it("matches text from full user prompts, not only title", () => {
    const previews = buildSessionPreviews(sessions, userPrompts, assistantPrompts, "user")
    expect(searchSessions(previews, "mental model")).toHaveLength(1)
  })

  it("matches assistant text only when enabled", () => {
    const withoutAssistant = buildSessionPreviews(sessions, userPrompts, assistantPrompts, "user")
    const withAssistant = buildSessionPreviews(sessions, userPrompts, assistantPrompts, "all")

    expect(searchSessions(withoutAssistant, "wireguard peer")).toHaveLength(0)
    expect(searchSessions(withAssistant, "wireguard peer")).toHaveLength(1)
  })
})

describe("format helpers", () => {
  it("normalizes whitespace consistently for matching", () => {
    expect(collapseWhitespace("mesh\n\n vpn\t gateway ")).toBe("mesh vpn gateway")
  })
})

describe("fresh-from recovery", () => {
  it("builds a recovery prompt from recent turns", () => {
    const prompt = buildFreshPrompt(
      {
        sessionId: "ses_1",
        title: "Architecture discussion",
        directory: "/tmp/project-a",
        prompt: "",
      },
      [
        { info: { role: "user" }, parts: [{ type: "text", text: "We need a CLI-first interface." }] },
        { info: { role: "assistant" }, parts: [{ type: "text", text: "CLI-first is the right MVP." }] },
      ],
    )

    expect(prompt).toContain("Original session: ses_1")
    expect(prompt).toContain("CLI-first")
    expect(prompt).toContain("Continue naturally from this context")
  })
})

describe("cli args", () => {
  it("parses the fresh-from session option", () => {
    expect(parseArgs(["--fresh-from", "ses_123"]).freshFrom).toBe("ses_123")
  })
})
