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

function repeat(key, count) {
  return Array(count).fill(key)
}

// Each step is [pause before the step in ms, ...keys to send].
const script = [
  // Let the merged list settle: both tools, both Claude accounts, newest first.
  [2000],

  // Move down a few entries so the preview pane visibly follows the selection.
  [900, KEY.down],
  [700, KEY.down],
  [900, KEY.down],

  // Search by project: every nebula-api session, whichever tool it lives in.
  [1300, ...type("nebula")],
  [1800, KEY.down],
  [900, KEY.down],

  // Clear, then a project whose sessions span OpenCode, CC1 and CC2.
  [1500, ...repeat(KEY.backspace, 6)],
  [900, ...type("forge")],
  [1700, KEY.down],
  [800, KEY.down],

  // Retarget the Claude account. The badge turns into [CC1->CC2]: Enter will
  // now fork this CC1 session into CC2 instead of resuming it.
  [1600, KEY.ctrlT],
  [2400],

  // Follow the displayed route.
  [900, KEY.enter],
  [2000],
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
