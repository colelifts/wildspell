# CONNECT_CODEX.md — How to Open the WildSpell Repository in Codex

## Easiest: Codex web/cloud

1. Open Codex.
2. Sign in with the same ChatGPT account.
3. Connect GitHub when prompted.
4. Grant Codex access to the `colelifts/wildspell` repository.
5. Create a new task using that repository.
6. Paste the contents of `CODEX_START_HERE.md`.
7. Tell Codex to read `AGENTS.md` first.
8. Review the proposed plan and diffs before merging the pull request.

Use a rebuild branch, not `main`, until the game is tested.

## Best for local testing on Windows: Codex CLI

Open PowerShell:

```powershell
git clone https://github.com/colelifts/wildspell.git
cd wildspell
```

Install Codex using the official Codex instructions for your platform, sign in, then run:

```powershell
codex
```

Inside Codex, paste:

```text
Read AGENTS.md and CODEX_START_HERE.md completely. Start with the repository audit. Create branch codex/wildspell-rebuild before editing files.
```

Codex CLI works inside the selected repository directory, so it can inspect files, edit the project, run npm commands, run tests, and show diffs.

## Recommended safety workflow

Before Codex starts:

```powershell
git status
git add .
git commit -m "Checkpoint before Codex rebuild"
git checkout -b codex/wildspell-rebuild
```

After each milestone:

```powershell
git status
git diff
git add .
git commit -m "Milestone: <name>"
git push -u origin codex/wildspell-rebuild
```

Open a pull request into `main` only after tests and screenshots are reviewed.

## Files Codex must see

These handoff files should be copied into the repository root:

```text
AGENTS.md
CODEX_START_HERE.md
WILDSPELL_ACCEPTANCE_CHECKLIST.md
```

The existing LPC assets and credits must remain in the repository.
