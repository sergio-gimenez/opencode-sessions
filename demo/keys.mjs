#!/usr/bin/env node
// Types the demo script into the picker.
//
// This writes raw terminal input on stdout with pauses between keystrokes. Pipe
// it into `asciinema rec`, which forwards its stdin to the recorded process's
// pty, so the picker sees a real interactive session and the pauses land in the
// recording as human-paced typing.

const KEY = {
  down: "\x1b[B",
  up: "\x1b[A",
  enter: "\r",
  tab: "\t",
  shiftTab: "\x1b[Z",
  ctrlT: "\x14",
  backspace: "\x7f",
  escape: "\x1b",
}

const TYPE_DELAY = 120

function type(value) {
  return [...value]
}

// Each step is [pause before the step in ms, ...keys to send].
const script = [
  // Let the merged list settle: OpenCode, two Claude accounts and two Codex
  // accounts in one list, newest first.
  [2000],

  // Move down a few entries so the preview pane visibly follows the selection.
  [900, KEY.down],
  [700, KEY.down],
  [900, KEY.down],

  // Search by project. Every nebula-api session surfaces at once, whichever
  // tool it happens to live in.
  [1300, ...type("nebula")],
  [1900],

  // Second row is the Codex session. Its badge stays [CX1] and the preview
  // fills with its prompts, because the target follows the selection.
  [900, KEY.down],
  [2200],

  // Back up to the Claude session at the top.
  [1100, KEY.up],
  [1200],

  // Cycle the target twice: CC1 -> CC2 -> CX1. The badge turns into a route,
  // [CC1->CX1], so Enter will carry this Claude session into Codex instead of
  // resuming it in Claude.
  [1000, KEY.ctrlT],
  [1300, KEY.ctrlT],
  [2600],

  // Follow the displayed route.
  [900, KEY.enter],
  [2200],
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  for (const [pause, ...keys] of script) {
    await sleep(pause)

    for (const [index, key] of keys.entries()) {
      if (index > 0) await sleep(TYPE_DELAY)
      process.stdout.write(key)
    }
  }
}

main()
