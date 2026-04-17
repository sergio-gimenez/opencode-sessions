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
