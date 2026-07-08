import os from "node:os"
import readline from "node:readline"

import { searchSessions } from "./sessions.js"
import type { SessionPreview, SessionSource } from "./types.js"

export type PickResult = { session: SessionPreview; tool: SessionSource }

function otherTool(source: SessionSource): SessionSource {
  return source === "claude" ? "opencode" : "claude"
}

const HOME = os.homedir()

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

function magenta(value: string) {
  return `\x1b[35m${value}\x1b[0m`
}

function blue(value: string) {
  return `\x1b[34m${value}\x1b[0m`
}

function badge(session: SessionPreview) {
  return session.source === "claude" ? blue("[CC]") : magenta("[OC]")
}

function termSize() {
  return {
    cols: process.stdout.columns || 100,
    rows: process.stdout.rows || 30,
  }
}

function shortenPath(value: string) {
  return value.startsWith(HOME) ? `~${value.slice(HOME.length)}` : value
}

function truncatePlain(value: string, width: number) {
  if (width <= 1) return ""
  if (value.length <= width) return value
  return `${value.slice(0, width - 1)}…`
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
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

function renderColumns(left: string[], right: string[], leftWidth: number) {
  const total = Math.max(left.length, right.length)
  const lines: string[] = []

  for (let index = 0; index < total; index += 1) {
    const leftLine = padLine(left[index] ?? "", leftWidth)
    const rightLine = right[index] ?? ""
    lines.push(`${leftLine}  ${rightLine}`)
  }

  return lines.join("\n")
}

function renderPreview(session: SessionPreview, query: string, width: number) {
  // Every returned line's *plain* length must be <= width, prefixes included,
  // or the terminal wraps it back to column 0 and smears the layout.
  const put = (plain: string) => highlightTerms(truncatePlain(plain, width), query)

  const lines = [
    bold(put(session.title)),
    dim(put(shortenPath(session.directory))),
    dim(truncatePlain(`${session.updatedAtLabel}  ${session.id}`, width)),
    "",
  ]

  if (session.prompts.length > 0) {
    lines.push(cyan("Recent user prompts"))
    for (const prompt of session.prompts) {
      lines.push(put(`- ${prompt}`))
    }
    lines.push("")
  }

  if (session.assistantSnippets.length > 0) {
    lines.push(cyan("Recent assistant snippets"))
    for (const snippet of session.assistantSnippets) {
      lines.push(put(`- ${snippet}`))
    }
  }

  return lines
}

function renderList(
  items: SessionPreview[],
  activeIndex: number,
  pageStart: number,
  pageSize: number,
  query: string,
  width: number,
) {
  if (items.length === 0) return [dim("No matches")]

  const page = items.slice(pageStart, pageStart + pageSize)
  // marker(1) + space(1) + "[CC]"(4) + space(1) = 7 chars before the title.
  const titleWidth = Math.max(4, width - 8)
  const indentWidth = Math.max(4, width - 6)

  return page.flatMap((session, index) => {
    const realIndex = pageStart + index
    const active = realIndex === activeIndex
    const marker = active ? cyan(">") : " "
    const title = truncatePlain(session.title, titleWidth)
    const dir = truncatePlain(shortenPath(session.directory), indentWidth)
    const date = truncatePlain(session.updatedAtLabel, indentWidth)

    return [
      `${marker} ${badge(session)} ${highlightTerms(title, query)}`,
      dim(`     ${highlightTerms(dir, query)}`),
      dim(`     ${date}`),
      "",
    ]
  })
}

function clampIndex(index: number, length: number) {
  if (length === 0) return 0
  if (index < 0) return 0
  if (index >= length) return length - 1
  return index
}

export async function pickSession(
  sessions: SessionPreview[],
  initialQuery = "",
): Promise<PickResult> {
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

    const { cols, rows } = termSize()
    // Layout: [left padded to leftWidth][2-space gap][right]. Keep the whole
    // row <= cols-1 so no terminal wraps a line back to column 0.
    const leftWidth = clamp(Math.round(cols * 0.42), 30, 64)
    const rightWidth = Math.max(20, cols - leftWidth - 3)

    const headerRows = 5
    const linesPerItem = 4
    const availableRows = Math.max(linesPerItem, rows - headerRows - 1)
    const pageSize = Math.max(1, Math.floor(availableRows / linesPerItem))
    const pageIndex = Math.floor(activeIndex / pageSize)
    const pageStart = pageIndex * pageSize
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))

    clearScreen()
    process.stdout.write(`${bold("Sessions")}  ${magenta("[OC]")} ${dim("opencode")}  ${blue("[CC]")} ${dim("claude")}\n`)
    const selectedNow = filtered[activeIndex]
    const openHint = selectedNow
      ? `Enter opens in ${selectedNow.source}. Tab opens in ${otherTool(selectedNow.source)} (fresh seed).`
      : "Enter opens natively. Tab opens with the other tool."
    process.stdout.write(`${dim(`Type to filter. ↑↓ move. PgUp/PgDn jump. ${openHint} Esc cancels.`)}\n`)
    process.stdout.write(`Query: ${query}\n`)
    process.stdout.write(`${dim(`${filtered.length} matches  Page ${pageIndex + 1}/${pageCount}`)}\n\n`)

    const selected = filtered[activeIndex]
    const left = renderList(filtered, activeIndex, pageStart, pageSize, query, leftWidth)
    const right = selected
      ? renderPreview(selected, query, rightWidth)
      : [dim("No session selected")]

    process.stdout.write(`${renderColumns(left, right.slice(0, availableRows), leftWidth)}\n`)
  }

  return await new Promise<PickResult>((resolve, reject) => {
    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }

      process.stdin.removeListener("keypress", onKeypress)
      process.stdout.removeListener("resize", render)
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
        resolve({ session: selected, tool: selected.source })
        return
      }

      if (key.name === "tab") {
        const selected = filtered[activeIndex]
        if (!selected) return
        cleanup()
        resolve({ session: selected, tool: otherTool(selected.source) })
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
        activeIndex = clampIndex(activeIndex - 10, filtered.length)
        render()
        return
      }

      if (key.name === "pagedown") {
        activeIndex = clampIndex(activeIndex + 10, filtered.length)
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
    process.stdout.on("resize", render)
    render()
  })
}
