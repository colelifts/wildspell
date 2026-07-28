# WildSpell rebuild progress

Updated: 2026-07-28

## Audit and stabilization

- [x] Read `AGENTS.md` and `CODEX_START_HERE.md` completely.
- [x] Create and switch to `codex/wildspell-rebuild` before edits.
- [x] Connect local checkout to `https://github.com/colelifts/wildspell.git`.
- [x] Inventory tracked source, configuration, and assets.
- [x] Run the existing static prototype locally.
- [x] Inspect desktop menu and solo match in Chromium.
- [x] Verify one sampled legal-card interaction.
- [x] Measure all supplied PNG dimensions and LPC frame occupancy.
- [x] Review Firebase configuration, rules, matchmaking, and presence.
- [x] Add baseline Playwright configuration and smoke test.
- [x] Retain the original baseline screenshot in `artifacts/baseline/`.
- [x] Commit and push the audit milestone.

## Milestones

- [x] 1 — Vite/TypeScript/Phaser foundation
- [x] 2 — Verified LPC character pipeline and exact animation metadata
- [x] 3 — Card rendering, dealing, hover, legality, and play interaction
- [x] 4 — Deterministic Classic/Wild rules and custom spells with unit coverage
- [x] 5 — Spell-specific cinematics and persistent status effects
- [x] 6 — Three timed 5–10 second Final Card challenges
- [x] 7 — Four seeded AI difficulties
- [ ] 8 — Firebase rooms, matchmaking, presence, projections, and reconnect (rooms, queue, presence, protocol, and subscription adapters implemented; authoritative synchronized turns remain)
- [x] 9 — Preloaded replaceable audio pipeline with missing-file fallbacks
- [ ] 10 — Responsive polish, accessibility, evidence, and deployment (desktop/mobile evidence and reduced motion complete; hosting and final accessibility audit remain)

## Visual gate

The first visual gate is captured in `artifacts/rebuild/` for desktop and mobile. The next gate should exercise every spell cinematic, all three challenges, and a two-client Firebase match before production merge.

## Premium visual pass

- [x] Switch Phaser from pixel rendering to antialiased high-detail rendering.
- [x] Integrate the 48-frame Arsonist, Freeze, Whirlwind, Arcane +2, and Chaos +4 card loops into live hands and the discard pile.
- [x] Create and integrate the definitive WildSpell card back.
- [x] Replace the pixel arena plate with an original high-detail supernatural-anime arena.
- [x] Add continuous arena parallax, drifting mist, rune rotation, and magical motes.
- [x] Add map-scale Freeze, Arsonist, Whirlwind, Arcane +2, and Chaos +4 reactions.
- [x] Rebuild number cards as clean antialiased premium faces with readable corner values.
- [x] Verify the updated menu and a live solo match in Chromium with no browser errors.
- [ ] Replace the remaining LPC player and opponent sprites with approved high-detail character animation packs.
- [ ] Replace legacy special-card faces only if those spells remain in the final deck.

## Premium character pass

- [x] Lock the supplied player-character identity, costume, weapon, proportions, and animation style.
- [x] Create transparent turn-ready, card-play, light-cast, heavy-cast, hurt, frozen, Burn, Whirlwind, Final Card, victory, and defeat poses.
- [x] Add entrance, breathing, anticipation, impact, recovery, persistent Burn, reaction, victory, and defeat direction in Phaser.
- [x] Replace the LPC player sprite in the live match without changing the supplied legacy files.
- [x] Validate player scale, transparency, placement, and browser console in a live Chromium match.
- [ ] Receive and build the premium opponent character pack.
