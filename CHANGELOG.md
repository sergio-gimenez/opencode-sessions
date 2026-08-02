# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `OCS_DRY_RUN=1` prints the command `ocs` would run — target tool, Claude
  account, working directory — instead of launching it.
- A synthetic demo fixture (`npm run demo`) that builds a complete fake home of
  OpenCode and Claude sessions, so the picker can be tried, developed against
  and recorded without touching real session history.
- Scripted asciinema recording of the demo (`npm run demo:record`,
  `npm run demo:gif`) behind the README's animation.
- CI running typecheck, tests and build on Node 20, 22 and 24.
- `CONTRIBUTING.md`, issue templates and a pull request template.

### Fixed

- `ocs --print | head` no longer dies with an unhandled `EPIPE` stack trace when
  the reader closes the pipe early.
- `--print` now abbreviates the home directory to `~` the way the picker
  already did, so listings are consistent and safer to paste into an issue.

## [1.0.0]

### Added

- Multiple Claude Code accounts: `ocs` scans each configured account's projects
  directory, preserves account ownership when resuming, and shows the target
  account route in the badge (`[CC1]`, `[CC1→CC2]`).
- `Ctrl+T` cycles the target Claude account; `Shift+Tab` opens into it.
- `Enter` follows the displayed route rather than always resuming natively.
- Cross-tool open (`Tab`): because session ids are not portable between
  OpenCode and Claude Code, this forks a new session in the target tool seeded
  with the full transcript of the picked one.
- Permission bypass with `--dangerous` / `--skip-permissions` / `--yolo`, a
  `--safe` override, and a `skipPermissions` default in
  `~/.config/ocs/config.json`.
- Search across titles, directories and all user prompts, with `--assistant` to
  include assistant text.
- Responsive two-column picker that adapts to the terminal size, with match
  highlighting and paging.
- `--print` to list recent sessions without opening the picker.
- `npm run install:local` to install `ocs` into `~/.local/bin` without root.

[Unreleased]: https://github.com/sergio-gimenez/opencode-sessions/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sergio-gimenez/opencode-sessions/releases/tag/v1.0.0
