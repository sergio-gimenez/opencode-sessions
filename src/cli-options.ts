import type { SessionSearchScope } from "./types.js"

export type CliOptions = {
  print: boolean
  help: boolean
  query: string
  search: SessionSearchScope
  // undefined = defer to config file; true/false = explicit CLI override.
  skipPermissions?: boolean
}

export function parseArgs(argv: string[]): CliOptions {
  let query = ""
  let search: SessionSearchScope = "user"
  let print = false
  let help = false
  let skipPermissions: boolean | undefined

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
  }

  return { print, help, query, search, skipPermissions }
}
