#!/usr/bin/env node
// Builds a self-contained fake home from demo/data.mjs so the picker can be
// demoed (and recorded) against synthetic sessions instead of a real machine's
// history.
//
// Everything lands under demo/.fixture/home (gitignored), laid out exactly
// where ocs looks by default. Running the demo is then just HOME=<that>, with
// no path overrides and nothing pointing back at the real machine:
//
//   .local/share/opencode/opencode.db   OpenCode's session store
//   .claude-cc1/projects/...            Claude account "cc1"
//   .claude-cc2/projects/...            Claude account "cc2"
//   .config/ocs/config.json             ocs config naming both accounts
//
// The home path is hardcoded rather than read from $HOME so this can never
// write into a real home directory.
//
// Run: npm run demo:build

import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { sessions } from "./data.mjs"

const DEMO_DIR = path.dirname(fileURLToPath(import.meta.url))
export const FIXTURE_HOME = path.join(DEMO_DIR, ".fixture", "home")

const ACCOUNTS = [
  { name: "cc1", configDir: path.join(FIXTURE_HOME, ".claude-cc1") },
  { name: "cc2", configDir: path.join(FIXTURE_HOME, ".claude-cc2") },
]

// Claude Code derives a project directory name from the cwd by replacing every
// path separator with a dash.
function encodeProjectDir(directory) {
  return directory.replace(/\//g, "-")
}

function expandHome(directory) {
  return directory.startsWith("~/") ? path.join(FIXTURE_HOME, directory.slice(2)) : directory
}

// Stable ids: the same session always gets the same id, so re-running the build
// produces a diff-free fixture apart from timestamps.
function sessionId(index) {
  return `ses_demo${String(index + 1).padStart(2, "0")}`
}

function claudeSessionId(index) {
  const seq = index + 1
  return `9f2c${seq.toString(16).padStart(4, "0")}-4d1a-4c7e-b8f3-${String(seq).padStart(12, "0")}`
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents)
}

function buildOpencodeDb(entries, dbPath) {
  fs.rmSync(dbPath, { force: true })
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)

  // Only the columns ocs actually reads; the real schema is much wider.
  db.exec(`
    create table session (
      id text primary key,
      project_id text not null,
      directory text not null,
      title text not null,
      time_created integer not null,
      time_updated integer not null,
      time_archived integer
    );
    create table message (
      id text primary key,
      session_id text not null,
      time_created integer not null,
      data text not null
    );
    create table part (
      id text primary key,
      message_id text not null,
      session_id text not null,
      time_created integer not null,
      data text not null
    );
  `)

  const insertSession = db.prepare(
    `insert into session (id, project_id, directory, title, time_created, time_updated, time_archived)
     values (?, ?, ?, ?, ?, ?, null)`,
  )
  const insertMessage = db.prepare(
    `insert into message (id, session_id, time_created, data) values (?, ?, ?, ?)`,
  )
  const insertPart = db.prepare(
    `insert into part (id, message_id, session_id, time_created, data) values (?, ?, ?, ?, ?)`,
  )

  const write = db.transaction(() => {
    for (const entry of entries) {
      const id = sessionId(entry.index)
      const started = entry.updatedAtMs - entry.turns.length * 60_000

      insertSession.run(
        id,
        `prj_${path.basename(entry.directory)}`,
        entry.directory,
        entry.title,
        started,
        entry.updatedAtMs,
      )

      for (const [turnIndex, [role, text]] of entry.turns.entries()) {
        const messageId = `msg_${id}_${turnIndex}`
        const createdAt = started + turnIndex * 60_000

        insertMessage.run(messageId, id, createdAt, JSON.stringify({ role }))
        insertPart.run(
          `prt_${messageId}`,
          messageId,
          id,
          createdAt,
          JSON.stringify({ type: "text", text }),
        )
      }
    }
  })

  write()
  db.close()
}

function buildClaudeAccount(entries, configDir) {
  fs.rmSync(configDir, { recursive: true, force: true })

  for (const entry of entries) {
    const lines = [JSON.stringify({ type: "ai-title", aiTitle: entry.title })]

    for (const [role, text] of entry.turns) {
      lines.push(
        JSON.stringify({
          type: role,
          cwd: entry.directory,
          message: { role, content: [{ type: "text", text }] },
        }),
      )
    }

    const filePath = path.join(
      configDir,
      "projects",
      encodeProjectDir(entry.directory),
      `${claudeSessionId(entry.index)}.jsonl`,
    )
    writeFile(filePath, `${lines.join("\n")}\n`)

    // The Claude reader takes updatedAt from the file's mtime.
    const seconds = entry.updatedAtMs / 1000
    fs.utimesSync(filePath, seconds, seconds)
  }
}

function main() {
  const now = Date.now()
  const entries = sessions.map((session, index) => ({
    ...session,
    index,
    directory: expandHome(session.dir),
    updatedAtMs: now - session.ago * 60_000,
  }))

  fs.rmSync(FIXTURE_HOME, { recursive: true, force: true })
  fs.mkdirSync(FIXTURE_HOME, { recursive: true })

  buildOpencodeDb(
    entries.filter((entry) => entry.tool === "opencode"),
    path.join(FIXTURE_HOME, ".local", "share", "opencode", "opencode.db"),
  )

  for (const account of ACCOUNTS) {
    buildClaudeAccount(
      entries.filter((entry) => entry.tool === account.name),
      account.configDir,
    )
  }

  writeFile(
    path.join(FIXTURE_HOME, ".config", "ocs", "config.json"),
    `${JSON.stringify(
      { skipPermissions: false, claudeAccounts: ACCOUNTS, defaultClaudeAccount: "cc1" },
      null,
      2,
    )}\n`,
  )

  const counts = ["opencode", ...ACCOUNTS.map((account) => account.name)]
    .map((tool) => `${tool}=${entries.filter((entry) => entry.tool === tool).length}`)
    .join(" ")

  process.stdout.write(
    `Fixture home built at ${path.relative(process.cwd(), FIXTURE_HOME)} (${counts})\n`,
  )
}

main()
