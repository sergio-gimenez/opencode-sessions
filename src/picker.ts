import readline from "node:readline"

import { searchSessions } from "./sessions.js"
import type { SessionPreview } from "./types.js"

const PAGE_SIZE = 10

function clearScreen() {
  process.stdout.write("\x1Bc")
}

function dim(value: string) {
  return `\x1b[2m${value}\x1b[0m`
}

function bold(value: string) {
  return `\x1b[1m${value}\x1b[0m`
}

function cyan(value: string) {
  return `\x1b[36m${value}\x1b[0m`
}

function renderPreview(session: SessionPreview) {
  const lines = [
    bold(session.title),
    dim(session.directory),
    dim(`${session.updatedAtLabel}  ${session.id}`),
    "",
  ]

  if (session.prompts.length > 0) {
    lines.push(cyan("Recent user prompts"))

    for (const prompt of session.prompts) {
      lines.push(`- ${prompt}`)
    }

    lines.push("")
  }

  if (session.assistantSnippets.length > 0) {
    lines.push(cyan("Recent assistant snippets"))

    for (const snippet of session.assistantSnippets) {
      lines.push(`- ${snippet}`)
    }
  }

  return lines.join("\n")
}

function renderList(items: SessionPreview[], activeIndex: number) {
  if (items.length === 0) return "No matches"

  const pageStart = Math.max(0, activeIndex - Math.floor(PAGE_SIZE / 2))
  const page = items.slice(pageStart, pageStart + PAGE_SIZE)

  return page
    .map((session, index) => {
      const realIndex = pageStart + index
      const prefix = realIndex === activeIndex ? cyan(">") : " "

      return [
        `${prefix} ${session.title}`,
        dim(`  ${session.directory}`),
        dim(`  ${session.updatedAtLabel}`),
      ].join("\n")
    })
    .join("\n\n")
}

function clampIndex(index: number, length: number) {
  if (length === 0) return 0
  if (index < 0) return 0
  if (index >= length) return length - 1
  return index
}

export async function pickSession(sessions: SessionPreview[], initialQuery = "") {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  readline.emitKeypressEvents(process.stdin, rl)

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }

  let query = initialQuery
  let activeIndex = 0
  let filtered = searchSessions(sessions, query)

  const render = () => {
    filtered = searchSessions(sessions, query)
    activeIndex = clampIndex(activeIndex, filtered.length)

    clearScreen()
    process.stdout.write(`${bold("OpenCode Sessions")}\n`)
    process.stdout.write(`${dim("Type to filter. Enter opens. Esc or Ctrl+C cancels.")}\n\n`)
    process.stdout.write(`Query: ${query}\n`)
    process.stdout.write(`${dim(`${filtered.length} matches`)}\n\n`)

    const selected = filtered[activeIndex]
    const left = renderList(filtered, activeIndex)
    const right = selected ? renderPreview(selected) : dim("No session selected")

    process.stdout.write(`${left}\n\n${right}\n`)
  }

  return await new Promise<SessionPreview>((resolve, reject) => {
    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }

      process.stdin.removeListener("keypress", onKeypress)
      rl.close()
      clearScreen()
    }

    const onKeypress = (_: string, key: readline.Key) => {
      if (key.ctrl && key.name === "c") {
        cleanup()
        reject(new Error("Cancelled."))
        return
      }

      if (key.name === "escape") {
        cleanup()
        reject(new Error("Cancelled."))
        return
      }

      if (key.name === "return") {
        const selected = filtered[activeIndex]

        if (!selected) return

        cleanup()
        resolve(selected)
        return
      }

      if (key.name === "up") {
        activeIndex = clampIndex(activeIndex - 1, filtered.length)
        render()
        return
      }

      if (key.name === "down") {
        activeIndex = clampIndex(activeIndex + 1, filtered.length)
        render()
        return
      }

      if (key.name === "backspace") {
        query = query.slice(0, -1)
        activeIndex = 0
        render()
        return
      }

      if (!key.ctrl && !key.meta && key.sequence) {
        query += key.sequence
        activeIndex = 0
        render()
      }
    }

    process.stdin.on("keypress", onKeypress)
    render()
  })
}
