import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export type OcsConfig = {
  // When true, launch the target tool with permission checks bypassed
  // (claude: --dangerously-skip-permissions, opencode: --auto).
  skipPermissions: boolean
}

const DEFAULTS: OcsConfig = {
  skipPermissions: false,
}

export function configPath() {
  return (
    process.env.OCS_CONFIG_PATH ??
    path.join(os.homedir(), ".config", "ocs", "config.json")
  )
}

export function parseConfig(raw: string): OcsConfig {
  const parsed = JSON.parse(raw) as Partial<OcsConfig>
  return {
    skipPermissions:
      typeof parsed.skipPermissions === "boolean"
        ? parsed.skipPermissions
        : DEFAULTS.skipPermissions,
  }
}

export function loadConfig(): OcsConfig {
  try {
    return parseConfig(fs.readFileSync(configPath(), "utf8"))
  } catch {
    return { ...DEFAULTS }
  }
}
