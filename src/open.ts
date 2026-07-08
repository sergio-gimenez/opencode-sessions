import { spawn } from "node:child_process"

export function openSession(sessionId: string, directory: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn("opencode", ["--session", sessionId], {
      cwd: directory,
      stdio: "inherit",
    })

    child.on("error", reject)
    child.on("exit", (code) => resolve(code ?? 0))
  })
}
<<<<<<< Updated upstream
=======

export function openClaudeSession(sessionId: string, directory: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn("claude", ["--resume", sessionId], {
      cwd: directory,
      stdio: "inherit",
    })

    child.on("error", reject)
    child.on("exit", (code) => resolve(code ?? 0))
  })
}

export function openFreshSession(directory: string, prompt: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn("opencode", ["run", "--dir", directory, prompt], {
      cwd: directory,
      stdio: "inherit",
    })

    child.on("error", reject)
    child.on("exit", (code) => resolve(code ?? 0))
  })
}
>>>>>>> Stashed changes
