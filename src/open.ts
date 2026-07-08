import { spawn } from "node:child_process"

export type OpenOptions = { skipPermissions?: boolean }

function run(command: string, args: string[], directory: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { cwd: directory, stdio: "inherit" })
    child.on("error", reject)
    child.on("exit", (code) => resolve(code ?? 0))
  })
}

// Native resume: the session lives in this tool's own store.

export function openSession(sessionId: string, directory: string, opts?: OpenOptions) {
  const args = ["--session", sessionId]
  if (opts?.skipPermissions) args.push("--auto")
  return run("opencode", args, directory)
}

export function openClaudeSession(sessionId: string, directory: string, opts?: OpenOptions) {
  const args = ["--resume", sessionId]
  if (opts?.skipPermissions) args.push("--dangerously-skip-permissions")
  return run("claude", args, directory)
}

// Cross-tool: session IDs are not portable between OpenCode and Claude Code,
// so open a fresh session in the target tool seeded with the transcript.

export function openOpencodeFresh(directory: string, prompt: string, opts?: OpenOptions) {
  const args = ["run"]
  if (opts?.skipPermissions) args.push("--auto")
  args.push("--dir", directory, prompt)
  return run("opencode", args, directory)
}

export function openClaudeFresh(directory: string, prompt: string, opts?: OpenOptions) {
  const args: string[] = []
  if (opts?.skipPermissions) args.push("--dangerously-skip-permissions")
  args.push(prompt)
  return run("claude", args, directory)
}
