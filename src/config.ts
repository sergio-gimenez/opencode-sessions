import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import type { ClaudeAccount } from "./types.js"

export type OcsConfig = {
  // When true, launch the target tool with permission checks bypassed
  // (claude: --dangerously-skip-permissions, opencode: --auto).
  skipPermissions: boolean
  claudeAccounts: ClaudeAccount[]
  defaultClaudeAccount: string
}

const DEFAULTS: OcsConfig = {
  skipPermissions: false,
  claudeAccounts: [{ name: "cc" }],
  defaultClaudeAccount: "cc",
}

function expandHome(value: string) {
  if (value === "~") return os.homedir()
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2))
  return value
}

export function configPath() {
  return (
    process.env.OCS_CONFIG_PATH ??
    path.join(os.homedir(), ".config", "ocs", "config.json")
  )
}

export function parseConfig(raw: string): OcsConfig {
  const parsed = JSON.parse(raw) as Partial<OcsConfig>
  const seen = new Set<string>()
  const claudeAccounts = Array.isArray(parsed.claudeAccounts)
    ? parsed.claudeAccounts.flatMap((account) => {
        if (
          !account ||
          typeof account.name !== "string" ||
          (account.configDir !== undefined && typeof account.configDir !== "string")
        ) {
          return []
        }

        const name = account.name.trim().toLowerCase()
        if (!name || seen.has(name)) return []
        seen.add(name)
        return [{
          name,
          ...(account.configDir ? { configDir: expandHome(account.configDir) } : {}),
        }]
      })
    : []
  const accounts = claudeAccounts.length > 0 ? claudeAccounts : DEFAULTS.claudeAccounts
  const requestedDefault =
    typeof parsed.defaultClaudeAccount === "string"
      ? parsed.defaultClaudeAccount.trim().toLowerCase()
      : ""

  return {
    skipPermissions:
      typeof parsed.skipPermissions === "boolean"
        ? parsed.skipPermissions
        : DEFAULTS.skipPermissions,
    claudeAccounts: accounts.map((account) => ({ ...account })),
    defaultClaudeAccount: accounts.some((account) => account.name === requestedDefault)
      ? requestedDefault
      : accounts[0].name,
  }
}

export function loadConfig(): OcsConfig {
  try {
    return parseConfig(fs.readFileSync(configPath(), "utf8"))
  } catch {
    return {
      ...DEFAULTS,
      claudeAccounts: DEFAULTS.claudeAccounts.map((account) => ({ ...account })),
    }
  }
}
