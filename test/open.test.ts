import os from "node:os"
import { describe, expect, it, vi } from "vitest"

import { assertDirectory, renderCommand } from "../src/open.js"

describe("assertDirectory", () => {
  it("accepts a directory that exists", () => {
    expect(() => assertDirectory(os.tmpdir())).not.toThrow()
  })

  it("names the missing directory instead of failing as a spawn ENOENT", () => {
    expect(() => assertDirectory("/tmp/ocs-does-not-exist-9f3a")).toThrow(
      /Session directory no longer exists: \/tmp\/ocs-does-not-exist-9f3a/,
    )
  })
})

describe("renderCommand", () => {
  it("renders a native resume", () => {
    expect(renderCommand("claude", ["--resume", "sid"], "/tmp/project")).toBe(
      "claude --resume sid\n  in /tmp/project",
    )
  })

  it("prefixes the account's config dir", () => {
    const rendered = renderCommand("claude", ["--resume", "sid"], "/tmp/project", {
      CLAUDE_CONFIG_DIR: "/tmp/.claude-cc2",
    })

    expect(rendered).toBe("CLAUDE_CONFIG_DIR=/tmp/.claude-cc2 claude --resume sid\n  in /tmp/project")
  })

  it("shortens paths under the home directory", () => {
    vi.spyOn(os, "homedir").mockReturnValue("/home/dev")

    const rendered = renderCommand("claude", ["--resume", "sid"], "/home/dev/code/app", {
      CLAUDE_CONFIG_DIR: "/home/dev/.claude-cc2",
    })

    expect(rendered).toBe("CLAUDE_CONFIG_DIR=~/.claude-cc2 claude --resume sid\n  in ~/code/app")

    vi.restoreAllMocks()
  })

  it("summarizes a seeded transcript instead of printing it", () => {
    const seed = `Continue a prior conversation.\n${"x".repeat(500)}`
    const rendered = renderCommand("claude", [seed], "/tmp/project")

    expect(rendered).toBe(`claude <transcript seed, ${seed.length} chars>\n  in /tmp/project`)
  })

  it("quotes short arguments containing whitespace", () => {
    expect(renderCommand("opencode", ["run", "--dir", "/tmp/a b"], "/tmp/a b")).toBe(
      'opencode run --dir "/tmp/a b"\n  in /tmp/a b',
    )
  })
})
