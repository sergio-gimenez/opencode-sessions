import type { SessionSearchScope } from "./types.js"

export type CliOptions = {
  print: boolean
  help: boolean
  query: string
  search: SessionSearchScope
  freshFrom: string
}

export function parseArgs(argv: string[]): CliOptions {
  let query = ""
  let search: SessionSearchScope = "user"
  let print = false
  let help = false
  let freshFrom = ""

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

    if (arg === "--query") {
      query = argv[index + 1] ?? ""
      index += 1
      continue
    }

    if (arg === "--fresh-from") {
      freshFrom = argv[index + 1] ?? ""
      index += 1
      continue
    }
  }

  return { print, help, query, search, freshFrom }
}
