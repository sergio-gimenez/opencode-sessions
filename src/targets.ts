import type { Account, SessionPreview, SessionSource } from "./types.js"

// OpenCode keeps one store, so it needs no configured account — but the picker
// cycles a single list of destinations, and this is OpenCode's place in it.
export const OPENCODE_ACCOUNT: Account = { tool: "opencode", name: "oc" }

const FALLBACK_LABEL: Record<SessionSource, string> = {
  opencode: "OC",
  claude: "CC",
  codex: "CX",
}

export function accountLabel(tool: SessionSource, account?: Account) {
  return (account?.name ?? FALLBACK_LABEL[tool]).toUpperCase()
}

export function toolName(tool: SessionSource) {
  if (tool === "claude") return "Claude Code"
  return tool === "codex" ? "Codex" : "OpenCode"
}

// Two accounts are the same place when they drive the same tool out of the same
// home. OpenCode has a single home, so the tool alone decides.
export function sameAccount(left?: Account, right?: Account) {
  if (left?.tool !== right?.tool) return false
  if (left?.tool === "opencode") return true
  return (left?.home ?? "") === (right?.home ?? "")
}

// True when the target is exactly where the session already lives, i.e. when
// the tool can resume it natively instead of being seeded with a transcript.
export function isNativeTarget(session: SessionPreview, target?: Account) {
  if (!target || target.tool !== session.source) return false
  return sameAccount(session.account ?? { tool: session.source, name: "" }, target)
}

export function nextTarget(targets: Account[], current: number, step: number) {
  if (targets.length === 0) return current
  return (current + step + targets.length) % targets.length
}

// Tab jumps to the next *tool*, skipping the other accounts of the current one:
// the useful move is "try this over in Codex", not "walk every account".
export function nextToolTarget(targets: Account[], from: SessionSource, preferred?: Account) {
  const order: SessionSource[] = ["opencode", "claude", "codex"]
  const start = order.indexOf(from)

  for (let step = 1; step <= order.length; step += 1) {
    const tool = order[(start + step) % order.length]
    if (tool === from) continue
    if (preferred?.tool === tool) return preferred
    const match = targets.find((target) => target.tool === tool)
    if (match) return match
  }

  return undefined
}
