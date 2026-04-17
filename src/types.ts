export type SessionPreview = {
  id: string
  title: string
  directory: string
  projectId: string
  updatedAtMs: number
  updatedAtLabel: string
  prompts: string[]
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
