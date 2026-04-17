import readline from "node:readline"

import { searchSessions } from "./sessions.js"
import type { SessionPreview } from "./types.js"

const PAGE_SIZE = 10
const LEFT_WIDTH = 52

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

function yellow(value: string) {
  return `\x1b[33m${value}\x1b[0m`
}

function splitTerms(query: string) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function highlightTerms(value: string, query: string) {
  const terms = splitTerms(query)
  if (terms.length === 0) return value

  let result = value

  for (const term of terms) {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    result = result.replace(pattern, (match) => yellow(match))
  }

  return result
}

function padLine(value: string, width: number) {
  const plain = value.replace(/\x1b\[[0-9;]*m/g, "")
  if (plain.length >= width) return value
  return `${value}${" ".repeat(width - plain.length)}`
}

function wrapText(value: string, width: number) {
  if (width <= 0) return [value]

  const words = value.split(" ")
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word

    if (next.length > width && current) {
      lines.push(current)
      current = word
      continue
    }

    current = next
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : [""]
}

function renderColumns(left: string[], right: string[]) {
  const total = Math.max(left.length, right.length)
  const lines: string[] = []

  for (let index = 0; index < total; index += 1) {
    const leftLine = padLine(left[index] ?? "", LEFT_WIDTH)
    const rightLine = right[index] ?? ""
    lines.push(`${leftLine}  ${rightLine}`)
  }

  return lines.join("\n")
}

function renderPreview(session: SessionPreview, query: string) {
  const lines = [
    bold(highlightTerms(session.title, query)),
    dim(highlightTerms(session.directory, query)),
    dim(`${session.updatedAtLabel}  ${session.id}`),
    "",
  ]

  if (session.prompts.length > 0) {
    lines.push(cyan("Recent user prompts"))

    for (const prompt of session.prompts) {
      lines.push(`- ${highlightTerms(prompt, query)}`)
    }

    lines.push("")
  }

  if (session.assistantSnippets.length > 0) {
    lines.push(cyan("Recent assistant snippets"))

    for (const snippet of session.assistantSnippets) {
      lines.push(`- ${highlightTerms(snippet, query)}`)
    }
  }

  return lines.join("\n")
}

function renderList(items: SessionPreview[], activeIndex: number, pageIndex: number, query: string) {
  if (items.length === 0) return ["No matches"]

  const pageStart = pageIndex * PAGE_SIZE
  const page = items.slice(pageStart, pageStart + PAGE_SIZE)

  const lines = page.flatMap((session, index) => {
      const realIndex = pageStart + index
      const prefix = realIndex === activeIndex ? cyan(">") : " "

      return [
        `${prefix} ${highlightTerms(session.title, query)}`,
        dim(`  ${highlightTerms(session.directory, query)}`),
        dim(`  ${session.updatedAtLabel}`),
        "",
      ]
    })

  return lines
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
  let pageIndex = 0
  let filtered = searchSessions(sessions, query)

  const render = () => {
    filtered = searchSessions(sessions, query)
    activeIndex = clampIndex(activeIndex, filtered.length)
    pageIndex = Math.floor(activeIndex / PAGE_SIZE)

    clearScreen()
    process.stdout.write(`${bold("OpenCode Sessions")}\n`)
    process.stdout.write(`${dim("Type to filter. Up/Down move. PgUp/PgDn jump. Enter opens. Esc or Ctrl+C cancels.")}\n\n`)
    process.stdout.write(`Query: ${query}\n`)
    process.stdout.write(`${dim(`${filtered.length} matches  Page ${pageIndex + 1}/${Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}`)}\n\n`)

    const selected = filtered[activeIndex]
    const left = renderList(filtered, activeIndex, pageIndex, query)
    const right = selected ? renderPreview(selected, query).split("\n") : [dim("No session selected")]

    process.stdout.write(`${renderColumns(left, right)}\n`)
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

      if (key.name === "pageup") {
        activeIndex = clampIndex(activeIndex - PAGE_SIZE, filtered.length)
        render()
        return
      }

      if (key.name === "pagedown") {
        activeIndex = clampIndex(activeIndex + PAGE_SIZE, filtered.length)
        render()
        return
      }

      if (key.name === "home") {
        activeIndex = 0
        render()
        return
      }

      if (key.name === "end") {
        activeIndex = clampIndex(filtered.length - 1, filtered.length)
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
