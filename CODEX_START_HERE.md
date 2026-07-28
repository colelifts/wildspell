# CODEX_START_HERE.md — Master WildSpell Rebuild Prompt

Copy the prompt below into Codex after opening the `colelifts/wildspell` repository.

---

You are taking ownership of a full rebuild of the WildSpell web game in this repository.

Read `AGENTS.md` completely before editing anything. Treat it as binding project instructions.

## First task: audit, plan, and stabilize

1. Inspect every file and asset in the repository.
2. Run the existing game locally.
3. Reproduce all known problems:
   - visual layout feels flat and cheap
   - characters are too small or flash/break
   - legal cards sometimes cannot be clicked
   - special-card animations are weak or fake
   - guidance is incomplete
   - music/voice placeholders are unacceptable
   - project structure is too monolithic
4. Inspect all LPC PNG dimensions and identify exact frame grids.
5. Inspect current Firebase and Vercel configuration.
6. Write:
   - `docs/AUDIT.md`
   - `docs/ARCHITECTURE.md`
   - `docs/PROGRESS.md`
7. Create and switch to branch `codex/wildspell-rebuild`.
8. Create a baseline Playwright test that opens the existing game and records a screenshot.
9. Commit the audit before beginning the migration.

## Rebuild architecture

Migrate to Vite + TypeScript + Phaser 3.

Use Phaser for:

- card rendering
- character sprites
- particles
- atmosphere
- camera shake
- spell cinematics
- minigames
- turn transitions

Use accessible DOM overlays for:

- main menu
- room creation/join
- settings
- rules
- credits
- text input
- connection/reconnect messages

Do not keep the project as one giant HTML file.

## Visual target

Bright, colorful fantasy tournament.

The current screenshot is not the target. Replace:

- giant empty oval table
- tiny corner characters
- flat panels
- dark muddy background

with:

- layered magical tournament arena
- large Cole and opponent characters positioned like duelists
- a clean central card-play area
- rich but readable color
- animated banners, crystals, particles, and crowd
- premium pixel UI frames
- responsive desktop and mobile layouts

Keep normal number cards readable. Build animated custom cards and spell cinematics exactly as described in `AGENTS.md`.

## Milestones

### Milestone 1 — Foundation

- Vite/TypeScript/Phaser project boots.
- Menus and routing work.
- Existing Firebase environment is moved to `.env`.
- Asset preloader and error reporting work.
- Existing solo and online modes remain functional.
- Unit tests cover basic legal moves.

### Milestone 2 — Character pipeline

- Generate accurate sprite manifests by inspecting supplied LPC sheets.
- Cole, Gabby, and Skeleton render correctly.
- No detached layers, flashing, missing bodies, or guessed offsets.
- Implement idle, cast, attack, hurt, emote, win, loss, and entrance states.
- Add a debug animation viewer accessible from a development-only route.

### Milestone 3 — Card system

- Full deck renders.
- Number cards are reusable templates.
- Legal cards are always clickable.
- Illegal cards explain why they are illegal.
- Implement card deal, draw, throw, hover, playable glow, select, invalid shake, and hand reflow.
- Add unit tests for every legal/illegal move category.

### Milestone 4 — Rules and custom spells

Implement and test:

- Freeze
- Rewind
- Arcane +2
- Prism Shift
- Chaos +4
- Arsonist/Burn
- Whirlwind Swap
- Stormcall
- Frostbite
- Mirror Trick
- Cleanse
- Classic stacking rules
- Wild mixed stacking rules

### Milestone 5 — Spell animation system

Create full cinematics and persistent status effects.

Every special card must have:

- looping card-face animation
- play animation
- character action
- camera/atmosphere effect
- opponent reaction
- persistent status visualization when applicable
- sound and voice hooks

### Milestone 6 — Final Card challenges

Implement three synchronized 5–10 second challenges:

- Rune Memory
- Spell Timing
- Arcane Clash

Handle online scoring, timeout, tie, disconnect, and AI results.

### Milestone 7 — AI

Implement Easy, Normal, Hard, and Nightmare using the rules engine.

Add deterministic AI tests.

### Milestone 8 — Multiplayer reliability

- Private rooms
- invite links
- Quick Match
- anonymous auth
- presence
- reconnect
- hidden-hand handling
- host-authoritative validation
- synchronization tests in two browser contexts

### Milestone 9 — Audio integration

- No generated chiptune.
- No browser text-to-speech.
- Preload user-supplied music, SFX, and voices.
- Add audio settings and music ducking.
- Missing files fail gracefully.

### Milestone 10 — Polish and deployment

- Desktop and mobile visual pass.
- Accessibility and reduced motion.
- Loading and error screens.
- Rules and credits.
- Vercel build.
- Firebase rules.
- README deployment steps.
- Full test run.
- Screenshots and video/GIF captures of:
  - a normal card play
  - Freeze
  - Arsonist
  - Whirlwind
  - a +2/+4 stack
  - a Final Card challenge
  - round victory

## Definition of done

Do not call this complete until:

- TypeScript has no errors.
- All automated tests pass.
- Every card has been manually tested.
- Legal cards are reliably clickable.
- Characters animate without visual corruption.
- Online two-browser play works.
- Reconnection works.
- Final Card challenges work.
- The visual target is clearly bright, colorful, polished pixel fantasy.
- The game has no placeholder browser speech or fake chiptune soundtrack.
- README documents how to add final music and voice files.
- A final pull request contains the rebuilt game, test evidence, screenshots, and known limitations.

Begin with the audit. Do not immediately rewrite everything without inspecting the repository.

---

## Suggested first Codex message after the master prompt

After Codex finishes its audit, send:

> Continue with Milestone 1. Make the Vite + TypeScript + Phaser migration on the rebuild branch while preserving the current production deployment. Run the baseline tests before and after. Show me the file tree, commands run, tests, screenshots, and the exact next milestone.

## Review prompts

### Visual review

> Show me desktop and mobile screenshots. Explain how the new composition addresses the oversized empty table, tiny characters, weak hierarchy, and dark atmosphere. Do not proceed to final polish until the visual hierarchy is clearly better.

### Animation review

> Open the animation debug viewer and show every Cole, Gabby, and Skeleton state. Flag any unsupported LPC animation instead of displaying broken layers.

### Rules review

> Run the full rules test suite and summarize cases for Burn, Frostbite, Stormcall, Mirror, Cleanse, mixed stacking, Final Card penalties, and challenge outcomes.

### Online review

> Run two Playwright browser contexts in one test. Create a private room, join it, complete several turns, stack draw cards, trigger a Final Card challenge, disconnect one client, reconnect, and finish the round.
