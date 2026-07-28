# WildSpell repository audit

Audit date: 2026-07-28

Baseline commit: `b0d6be8` (`origin/main`)

Audit branch: `codex/wildspell-rebuild`

## Executive summary

The repository is a static browser prototype, not the requested Vite/TypeScript/Phaser application. It boots and a sampled solo legal-card interaction works, but the implementation is monolithic, multiplayer is openly writable and client-authoritative, the LPC animation timing is incorrect for most sheets, and the Final Card challenges do not meet the required duration or interaction depth. The prototype should remain available as a behavioral reference while its rules are extracted into deterministic modules and the renderer is rebuilt.

## Repository baseline

- No `package.json`, TypeScript, Vite, Phaser, Vitest, Playwright, CI, `.gitignore`, `.env.example`, or Vercel configuration existed at the audited commit.
- Runtime code is split across `index.html` (259 lines), `styles.css` (95 dense lines / 19 KB), and `game.js` (929 physical lines / 44 KB; 893 nonblank lines reported by PowerShell).
- `test.html` is a browser/manual rules harness, not an automated test suite.
- Git history consists mainly of GitHub file-upload commits. There is one production branch, `main`.
- The project is statically hostable, but deployment and environment setup are undocumented beyond “upload every file.”

## Baseline behavior reproduced

The prototype was served at `http://127.0.0.1:4173` and inspected in Chromium.

- Loading screen resolves to the menu after asset preload.
- Solo Wild Mode starts and renders a seven-card hand.
- In one sampled turn, guidance reported four legal cards and a playable green `7` successfully moved to the discard pile, reducing the local hand from seven to six.
- The current 1280×720 game view clips important HUD content at the right edge and most of the local hand below the viewport.
- Characters are positioned at the edges; the opponent is primarily represented by a tiny portrait while the arena/table dominates the composition.
- The current app exposes no stable test IDs and no debug animation viewer.

The sampled click does not disprove the reported intermittent legal-card bug. State-transition and hit-target coverage are absent, so the issue cannot yet be bounded to a specific card/state combination.

## Source and rules findings

- `game.js` combines deck creation, legality, reducers, rendering, animation, audio, AI, Firebase synchronization, matchmaking, presence, and DOM event binding in one global script.
- State is cloned with JSON serialization and mutated on clients. Random IDs, shuffles, AI choices, challenges, room codes, and starting players use unseeded `Math.random()`.
- The special cards and statuses exist in prototype form: Freeze, Rewind, +2, Wild/+4, Arsonist/Burn, Whirlwind, Stormcall, Frostbite, Mirror, and Cleanse.
- Guidance covers several common paths, but illegal reducer exits commonly return `false` without a structured reason. The UI cannot reliably explain every rejected action.
- Final Card penalty logic exists. Challenges are named `reaction`, `timing`, and `memory`; reaction and timing are single-click exercises, memory is only a three-rune sequence, and no robust 5–10 second round/tie/timeout/disconnect protocol exists.
- AI difficulty changes simple card weights and challenge score ranges. It does not search multiple future states, produce seeded explanations, or provide deterministic tests.
- No automated coverage exists for deck recycling, stack chains, statuses, Final Card outcomes, reconnect, or two-browser play.

## LPC asset audit

All supplied character sheets were measured directly. Every frame cell is 64×64 pixels. Directional sheets are 832×256 (13 columns × 4 rows); hurt sheets are 832×64 (13 columns × 1 row). Direction row order used by the prototype is down, left, right, up (`0`, `-64`, `-128`, `-192` CSS offsets), but this must be verified visually in the Phaser viewer.

| Animation | Canvas grid | Non-empty frames per row | Directions |
|---|---:|---:|---:|
| idle | 13×4 | 2 | 4 |
| emote | 13×4 | 3 | 4 |
| slash | 13×4 | 6 | 4 |
| spellcast | 13×4 | 7 | 4 |
| thrust | 13×4 | 8 | 4 |
| walk | 13×4 | 9 | 4 |
| hurt | 13×1 | 6 | 1 |

The same occupancy pattern was measured for Cole (`assets/characters/you`), Gabby, and Skeleton. The current CSS incorrectly animates every sheet with `steps(13)` to `-832px`; this displays transparent padded cells for idle, emote, slash, spellcast, thrust, walk, and hurt and explains flashing/disappearing characters.

The generator metadata also warns that some layers do not support each exported pose:

- Cole: Santa coat lacks idle/emote; fur-white facial layer lacks hurt.
- Gabby: staff/crystal layers are missing from several poses; bodice lacks emote; closing-eyes layer lacks hurt.
- Skeleton: scythe is unsupported outside walk/hurt; body support is absent for idle/emote according to metadata.

The migration must generate a manifest from the measured counts, visually validate every composite, and fall back to complete poses plus Phaser effects when a layer is incomplete.

## Other assets

- Arena assets: JPEG 1600×1000 and PNG 1600×900.
- `assets/cards/arsonist.png`: 440×660 static image.
- Five champion strips are 128×32.
- Eight WAV files are bundled, including a 1.41 MB `music_loop.wav`; separate music/SFX/voice folders contain replacement filename guidance.
- Existing LPC `character.json` and `credits.txt` files are present for all three characters and must be preserved.

## Firebase and security

- Firebase compat SDK 10.12.5 is loaded from a CDN.
- Firebase project configuration is hard-coded in `game.js` instead of Vite environment variables.
- No anonymous authentication is initialized.
- Database rules allow anyone to read and write all `rooms` and `matchmaking` data.
- Every client can transact on the complete state, including both hands. There is no host-only validation boundary and hidden hands are present in shared state.
- Presence is a five-second timestamp heartbeat with `onDisconnect().remove()`. There is no reconnect state machine or stale-session recovery.

These rules are acceptable only as a disposable prototype and must not be described as secure multiplayer.

## Migration risks and priorities

1. Extract and characterize rules before replacing the UI; otherwise prototype edge cases will be lost.
2. Introduce deterministic IDs/randomness and reducer results carrying explicit illegal-move reasons.
3. Build the verified LPC manifest/viewer before relying on character animation in matches.
4. Define a versioned multiplayer protocol with host validation and public/private projections before reconnect testing.
5. Treat all current cinematics and challenges as prototypes requiring replacement, not polish-ready components.
6. Preserve credits and original assets throughout migration.

## Audit exit criteria

- [x] Repository and Git history inventoried.
- [x] Existing app served and menu/solo baseline inspected.
- [x] Sample legal-card interaction verified.
- [x] PNG dimensions and LPC non-empty frame counts measured.
- [x] Character layer-support metadata reviewed.
- [x] Firebase rules/configuration and static deployment posture reviewed.
- [x] Baseline Playwright test added.
- [x] Baseline Playwright command executed successfully; screenshot retained at `artifacts/baseline/menu-desktop.png`.
