const TEXT_LIMIT = 140

export function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export function truncate(value: string, max = TEXT_LIMIT) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}...`
}

export function formatUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp))
}

export function parseTextPart(value: string) {
  const parsed = JSON.parse(value) as { text?: string }
  return collapseWhitespace(parsed.text ?? "")
}
