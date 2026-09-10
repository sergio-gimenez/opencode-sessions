import type { SessionSearchScope } from "./types.js"

export type CliOptions = {
  print: boolean
  help: boolean
  query: string
  search: SessionSearchScope
  // undefined = defer to config file; true/false = explicit CLI override.
  skipPermissions?: boolean
  // Name of the account (or "oc") the picker should start targeting.
  target?: string
}

// --claude-account and --codex-account read better at the call site, but a
// target is a target: all three flags name one entry of the same list.
const TARGET_FLAGS = new Set(["--target", "--claude-account", "--codex-account"])

export function parseArgs(argv: string[]): CliOptions {
  let query = ""
  let search: SessionSearchScope = "user"
  let print = false
  let help = false
  let skipPermissions: boolean | undefined
  let target: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--print") {
      print = true
      continue
    }

    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }

    if (arg === "--assistant") {
      search = "all"
      continue
    }

    if (arg === "--dangerous" || arg === "--skip-permissions" || arg === "--yolo") {
      skipPermissions = true
      continue
    }

    if (arg === "--safe" || arg === "--no-skip-permissions") {
      skipPermissions = false
      continue
    }

    if (arg === "--query") {
      query = argv[index + 1] ?? ""
      index += 1
      continue
    }

    if (TARGET_FLAGS.has(arg)) {
      target = argv[index + 1]?.trim().toLowerCase()
      index += 1
      continue
    }
  }

  return { print, help, query, search, skipPermissions, target }
}
