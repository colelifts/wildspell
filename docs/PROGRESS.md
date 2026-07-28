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
