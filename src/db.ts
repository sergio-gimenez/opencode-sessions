import Database from "better-sqlite3"
import os from "node:os"
import path from "node:path"

const DEFAULT_DB_PATH = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db")

export function resolveDbPath(explicitPath?: string) {
  return explicitPath ?? process.env.OPENCODE_DB_PATH ?? DEFAULT_DB_PATH
}

export function openDatabase(explicitPath?: string) {
  const dbPath = resolveDbPath(explicitPath)
  return new Database(dbPath, { readonly: true, fileMustExist: true })
}
