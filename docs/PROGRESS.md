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
- [ ] 8 — Firebase rooms, matchmaking, presence, projections, and reconnect (private rooms, atomic quick matchmaking, guest perspectives, reducer-validated turns, presence, reconnect, mixed-stack/color/challenge/round synchronization tests are complete; hardened authenticated rules remain)
- [x] 9 — Preloaded replaceable audio pipeline with missing-file fallbacks
- [ ] 10 — Responsive polish, accessibility, evidence, and deployment (high-density desktop/mobile rendering, evidence, and live hosting are complete; reduced-motion and final accessibility audits remain)

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
- [x] Lock Gabby's supplied character identity, costume, proportions, and animation style.
- [x] Create Gabby's transparent turn-ready, card-play, light-cast, heavy-cast, hurt, frozen, Burn, Whirlwind, Final Card, victory, and defeat poses.
- [x] Add Gabby's reusable entrance, breathing, anticipation, impact, recovery, persistent-status, victory, and defeat animation director for the future second-player flow.
- [x] Replace the Skeleton/AI opponent with Gabby and connect her complete pose set to live AI turns, spells, reactions, Final Card, victory, and defeat.

## Premium gameplay and clarity pass

- [x] Draw through unusable cards until the first legal card appears.
- [x] Resolve unanswerable draw stacks and exhausted no-move turns automatically.
- [x] Remove the unnecessary manual End Turn control and reject voluntary draws when a legal play exists.
- [x] Enlarge the live hand, discard, deck, and opponent cards across desktop and mobile.
- [x] Add full-size animated inspection previews for premium special cards.
- [x] Separate guidance and player plates so they no longer cover the central play field.
- [x] Add full-card cinematic reveals and layered arena reactions for every current spell family.
- [x] Replace the remaining Rewind, Prism Shift, Stormcall, Frostbite, Mirror Trick, and Cleanse fallback faces with high-resolution unified card designs.
- [x] Rebuild Rune Memory as a staged five-rune reveal with responsive input, accuracy scoring, speed bonus, and safe timeout cleanup.
- [x] Rebuild Spell Timing as a three-round moving-target challenge with readable hit feedback and mobile-sized controls.
- [x] Rebuild Arcane Clash as a five-prompt reaction challenge with pointer and keyboard controls and leak-free listener cleanup.
- [x] Add deterministic desktop/mobile challenge previews and visual regression evidence under `artifacts/challenges/`.
- [x] Add real round scoring, a visible 200-point match target, automatic fresh-round dealing, match victory, and rematch flow.
- [x] Add responsive desktop/mobile result presentations and browser evidence under `artifacts/results/`.
- [x] Replace the Online Beta placeholder with live Firebase room creation/joining, synchronized turns, invite URLs, presence, and reconnect.
- [x] Add local-first guest projections so Gabby/Cole identities, hands, actors, effects, and hidden rival cards render correctly from either seat.
- [x] Add keyboard-accessible card controls and a real two-browser desktop/mobile synchronization test with reconnect evidence under `artifacts/online/`.
- [x] Replace browser-upscaled 1024×576 rendering with a device-density-aware backing canvas and high-resolution Phaser text.
- [x] Increase desktop camera scale, hand-card scale, nameplate type size, deck-count contrast, and disabled-control legibility.
- [x] Add a dedicated 2048-pixel clarity assertion and proof image under `artifacts/clarity/`.
- [x] Prove atomic Quick Match pairing plus synchronized color choice, mixed +4/+2 stacking, reconnect, Final Card scoring, and round transition in two desktop/mobile browsers.
- [ ] Continue the full non-audio polish, multiplayer, accessibility, and acceptance-checklist pass.
