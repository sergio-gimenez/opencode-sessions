# opencode-sessions

Small CLI to search and reopen OpenCode sessions across all local projects.

## Features

- Lists sessions from the global OpenCode SQLite database
- Orders by most recent update first
- Searches by title, directory, and all user prompts in each session
- Shows recent prompt previews in the picker
- Reopens the selected session in OpenCode

## Usage

```bash
npm install
npm run dev
```

Print recent sessions without opening the picker:

```bash
npm run print
```

Build the CLI:

```bash
npm run build
```
