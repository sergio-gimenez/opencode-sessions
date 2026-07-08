export type SessionSource = "opencode" | "claude"

export type SessionPreview = {
  id: string
  title: string
  directory: string
  projectId: string
  source: SessionSource
  updatedAtMs: number
  updatedAtLabel: string
  prompts: string[]
  assistantSnippets: string[]
  searchText: string
}

export type SessionRow = {
  id: string
  title: string
  directory: string
  project_id: string
  time_updated: number
}

export type PromptRow = {
  session_id: string
  text: string
}

export type SessionSearchScope = "user" | "all"
