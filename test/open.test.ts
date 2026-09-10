import os from "node:os"
import { describe, expect, it, vi } from "vitest"

import {
  assertDirectory,
  openClaudeSession,
  openCodexFresh,
  openCodexSession,
  openSession,
  renderCommand,
} from "../src/open.js"

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

describe("fork flags", () => {
  const dryRun = async (open: () => Promise<number>) => {
    const written: string[] = []
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(String(chunk))
        return true
      })

    vi.stubEnv("OCS_DRY_RUN", "1")
    try {
      await open()
    } finally {
      spy.mockRestore()
      vi.unstubAllEnvs()
    }

    return written.join("")
  }

  it("forks a Claude session with --fork-session", async () => {
    const output = await dryRun(() => openClaudeSession("sid", os.tmpdir(), { fork: true }))
    expect(output).toContain("claude --resume sid --fork-session")
  })

  it("resumes a Claude session in place without the flag", async () => {
    const output = await dryRun(() => openClaudeSession("sid", os.tmpdir()))
    expect(output).not.toContain("--fork-session")
  })

  it("forks an OpenCode session with --fork", async () => {
    const output = await dryRun(() => openSession("sid", os.tmpdir(), { fork: true }))
    expect(output).toContain("opencode --session sid --fork")
  })

  it("resumes an OpenCode session in place without the flag", async () => {
    const output = await dryRun(() => openSession("sid", os.tmpdir()))
    expect(output).not.toContain("--fork")
  })

  // Codex spells fork as a subcommand rather than a flag on resume.
  it("forks a Codex session with the fork subcommand", async () => {
    const output = await dryRun(() => openCodexSession("sid", os.tmpdir(), { fork: true }))
    expect(output).toContain("codex fork sid")
  })

  it("resumes a Codex session with the resume subcommand", async () => {
    const output = await dryRun(() => openCodexSession("sid", os.tmpdir()))
    expect(output).toContain("codex resume sid")
  })
})

describe("Codex accounts", () => {
  const dryRun = async (open: () => Promise<number>) => {
    const written: string[] = []
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(String(chunk))
        return true
      })

    vi.stubEnv("OCS_DRY_RUN", "1")
    try {
      await open()
    } finally {
      spy.mockRestore()
      vi.unstubAllEnvs()
    }

    return written.join("")
  }

  it("points a non-default account at its own CODEX_HOME", async () => {
    const output = await dryRun(() =>
      openCodexSession("sid", os.tmpdir(), {
        account: { tool: "codex", name: "cx2", home: "/tmp/.codex-cx2" },
      }),
    )

    expect(output).toContain("CODEX_HOME=/tmp/.codex-cx2 codex resume sid")
  })

  it("bypasses approvals and the sandbox when permissions are skipped", async () => {
    const output = await dryRun(() => openCodexFresh(os.tmpdir(), "seed", { skipPermissions: true }))
    expect(output).toContain("codex --dangerously-bypass-approvals-and-sandbox seed")
  })

  // The surrounding shell's CLAUDE_CONFIG_DIR is inherited, but it is not part
  // of the route and must not be printed as though ocs had chosen it.
  it("does not render environment ocs did not set", async () => {
    vi.stubEnv("CLAUDE_CONFIG_DIR", "/tmp/.claude-cc2")
    const output = await dryRun(() => openCodexSession("sid", os.tmpdir()))
    expect(output).not.toContain("CLAUDE_CONFIG_DIR")
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
