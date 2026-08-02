import { spawn } from "node:child_process"

import { shortenHome } from "./format.js"
import type { ClaudeAccount } from "./types.js"

export type OpenOptions = { skipPermissions?: boolean }
export type ClaudeOpenOptions = OpenOptions & { account?: ClaudeAccount }

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
  env?: NodeJS.ProcessEnv,
) {
  const configDir = env?.CLAUDE_CONFIG_DIR
  const prefix = configDir ? `CLAUDE_CONFIG_DIR=${shortenHome(configDir)} ` : ""
  return `${prefix}${command} ${args.map(renderArg).join(" ")}\n  in ${shortenHome(directory)}`
}

function run(command: string, args: string[], directory: string, env?: NodeJS.ProcessEnv) {
  if (process.env.OCS_DRY_RUN) {
    process.stdout.write(`\x1b[36mwould run\x1b[0m ${renderCommand(command, args, directory, env)}\n`)
    return Promise.resolve(0)
  }

  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: directory,
      stdio: "inherit",
      env: env ?? process.env,
    })
    child.on("error", reject)
    child.on("exit", (code) => resolve(code ?? 0))
  })
}

function claudeEnvironment(account?: ClaudeAccount) {
  const env = { ...process.env }
  if (account?.configDir) env.CLAUDE_CONFIG_DIR = account.configDir
  else delete env.CLAUDE_CONFIG_DIR
  return env
}

// Native resume: the session lives in this tool's own store.

export function openSession(sessionId: string, directory: string, opts?: OpenOptions) {
  const args = ["--session", sessionId]
  if (opts?.skipPermissions) args.push("--auto")
  return run("opencode", args, directory)
}

export function openClaudeSession(sessionId: string, directory: string, opts?: ClaudeOpenOptions) {
  const args = ["--resume", sessionId]
  if (opts?.skipPermissions) args.push("--dangerously-skip-permissions")
  return run(
    "claude",
    args,
    directory,
    claudeEnvironment(opts?.account),
  )
}

// Cross-tool: session IDs are not portable between OpenCode and Claude Code,
// so open a fresh session in the target tool seeded with the transcript.

export function openOpencodeFresh(directory: string, prompt: string, opts?: OpenOptions) {
  const args = ["run"]
  if (opts?.skipPermissions) args.push("--auto")
  args.push("--dir", directory, prompt)
  return run("opencode", args, directory)
}

export function openClaudeFresh(directory: string, prompt: string, opts?: ClaudeOpenOptions) {
  const args: string[] = []
  if (opts?.skipPermissions) args.push("--dangerously-skip-permissions")
  args.push(prompt)
  return run(
    "claude",
    args,
    directory,
    claudeEnvironment(opts?.account),
  )
}
