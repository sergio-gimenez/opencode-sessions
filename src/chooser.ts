import readline from "node:readline"

import type { SessionPreview, SessionSource } from "./types.js"

function clearScreen() {
  process.stdout.write("\x1Bc")
}

function bold(value: string) {
  return `\x1b[1m${value}\x1b[0m`
}

function dim(value: string) {
  return `\x1b[2m${value}\x1b[0m`
}

function magenta(value: string) {
  return `\x1b[35m${value}\x1b[0m`
}

function blue(value: string) {
  return `\x1b[34m${value}\x1b[0m`
}

function option(key: string, label: string, native: boolean) {
  const tag = native ? dim("  (native)") : ""
  return `  ${bold(`[${key}]`)} ${label}${tag}`
}

export function chooseTool(session: SessionPreview): Promise<SessionSource> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  readline.emitKeypressEvents(process.stdin, rl)

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }

  const native = session.source

  const render = () => {
    clearScreen()
    process.stdout.write(`${bold("Open session with")}\n\n`)
    process.stdout.write(`  ${bold(session.title)}\n`)
    process.stdout.write(`  ${dim(session.directory)}\n`)
    process.stdout.write(
      `  ${session.source === "claude" ? blue("[CC] claude") : magenta("[OC] opencode")}\n\n`,
    )
    process.stdout.write(`${option("o", magenta("opencode"), native === "opencode")}\n`)
    process.stdout.write(`${option("c", blue("claude code"), native === "claude")}\n\n`)
    process.stdout.write(dim(`  Native tool resumes this session; the other opens a fresh\n`))
    process.stdout.write(dim(`  session seeded with its transcript (ids are not portable).\n`))
    process.stdout.write(dim(`  Enter opens with ${native}. Esc or Ctrl+C cancels.\n`))
  }

  return new Promise<SessionSource>((resolve, reject) => {
    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }

      process.stdin.removeListener("keypress", onKeypress)
      rl.close()
      clearScreen()
    }

    const onKeypress = (_: string, key: readline.Key) => {
      if ((key.ctrl && key.name === "c") || key.name === "escape") {
        cleanup()
        reject(new Error("Cancelled."))
        return
      }

      if (key.name === "o") {
        cleanup()
        resolve("opencode")
        return
      }

      if (key.name === "c" && !key.ctrl) {
        cleanup()
        resolve("claude")
        return
      }

      if (key.name === "return") {
        cleanup()
        resolve(native)
      }
    }

    process.stdin.on("keypress", onKeypress)
    render()
  })
}
