import { spawn } from "node:child_process"
import fs from "node:fs"

import { shortenHome } from "./format.js"
import type { Account } from "./types.js"

export type OpenOptions = { skipPermissions?: boolean; fork?: boolean }
export type AccountOpenOptions = OpenOptions & { account?: Account }

// Only the variables ocs itself sets. Everything else is inherited, but an
// inherited value is not part of the route and must not be rendered as if ocs
// had chosen it. `undefined` means "unset this for the child".
type EnvOverrides = Record<string, string | undefined>

const SEED_PROMPT_MIN_CHARS = 200

// A seeded prompt is a whole transcript; printing it verbatim would bury the
// command it belongs to.
function renderArg(arg: string) {
  if (arg.length > SEED_PROMPT_MIN_CHARS || arg.includes("\n")) {
    return `<transcript seed, ${arg.length} chars>`
  }
  return /\s/.test(arg) ? JSON.stringify(arg) : arg
}

export function renderCommand(
  command: string,
  args: string[],
  directory: string,
  env?: EnvOverrides,
) {
  const prefix = Object.entries(env ?? {})
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}=${shortenHome(value as string)} `)
    .join("")

  return `${prefix}${command} ${args.map(renderArg).join(" ")}\n  in ${shortenHome(directory)}`
}

// A session records the cwd it ran in. Projects get renamed and moved, so that
// path can be gone by the time we resume. Node reports a missing spawn cwd as
// "spawn <command> ENOENT", which reads as "the tool is not installed" and
// sends people hunting the wrong bug.
export function assertDirectory(directory: string) {
  if (fs.existsSync(directory)) return
  throw new Error(
    `Session directory no longer exists: ${shortenHome(directory)}\n` +
      "The project was probably moved or renamed since this session ran.",
  )
}

function childEnvironment(overrides?: EnvOverrides) {
  const env = { ...process.env }

  for (const [name, value] of Object.entries(overrides ?? {})) {
    if (value) env[name] = value
    else delete env[name]
  }

  return env
}

function run(command: string, args: string[], directory: string, env?: EnvOverrides) {
  assertDirectory(directory)

  if (process.env.OCS_DRY_RUN) {
    process.stdout.write(`\x1b[36mwould run\x1b[0m ${renderCommand(command, args, directory, env)}\n`)
    return Promise.resolve(0)
  }

  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: directory,
      stdio: "inherit",
      env: childEnvironment(env),
    })
    child.on("error", reject)
    child.on("exit", (code) => resolve(code ?? 0))
  })
}

// Each tool names its isolated home with its own variable. Always pass the key,
// so an account on the tool's default home explicitly clears whatever the
// surrounding shell had set.
function claudeEnvironment(account?: Account): EnvOverrides {
  return { CLAUDE_CONFIG_DIR: account?.home }
}

function codexEnvironment(account?: Account): EnvOverrides {
  return { CODEX_HOME: account?.home }
}

// Native resume: the session lives in this tool's own store.

export function openSession(sessionId: string, directory: string, opts?: OpenOptions) {
  const args = ["--session", sessionId]
  // Native fork: the tool copies the history into a new session id, so the
  // original stays untouched and the copy keeps the full context.
  if (opts?.fork) args.push("--fork")
  if (opts?.skipPermissions) args.push("--auto")
  return run("opencode", args, directory)
}

export function openClaudeSession(sessionId: string, directory: string, opts?: AccountOpenOptions) {
  const args = ["--resume", sessionId]
  if (opts?.fork) args.push("--fork-session")
  if (opts?.skipPermissions) args.push("--dangerously-skip-permissions")
  return run("claude", args, directory, claudeEnvironment(opts?.account))
}

// Codex spells fork as its own subcommand rather than a flag on resume.
export function openCodexSession(sessionId: string, directory: string, opts?: AccountOpenOptions) {
  const args = [opts?.fork ? "fork" : "resume", sessionId]
  if (opts?.skipPermissions) args.push("--dangerously-bypass-approvals-and-sandbox")
  return run("codex", args, directory, codexEnvironment(opts?.account))
}

// Cross-tool: session IDs are not portable between OpenCode, Claude Code and
// Codex, so open a fresh session in the target tool seeded with the transcript.

export function openOpencodeFresh(directory: string, prompt: string, opts?: OpenOptions) {
  const args = ["run"]
  if (opts?.skipPermissions) args.push("--auto")
  args.push("--dir", directory, prompt)
  return run("opencode", args, directory)
}

export function openClaudeFresh(directory: string, prompt: string, opts?: AccountOpenOptions) {
  const args: string[] = []
  if (opts?.skipPermissions) args.push("--dangerously-skip-permissions")
  args.push(prompt)
  return run("claude", args, directory, claudeEnvironment(opts?.account))
}

export function openCodexFresh(directory: string, prompt: string, opts?: AccountOpenOptions) {
  const args: string[] = []
  if (opts?.skipPermissions) args.push("--dangerously-bypass-approvals-and-sandbox")
  args.push(prompt)
  return run("codex", args, directory, codexEnvironment(opts?.account))
}
