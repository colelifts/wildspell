# WildSpell: The Final Draw

WildSpell is a cinematic fantasy card duel rebuilt with Vite, TypeScript, and Phaser 3. The current build contains a playable solo arena, deterministic Wild and Classic rules, animated high-detail Cole and Gabby characters, spell cutscenes, four AI levels, three Final Card challenges, responsive desktop/mobile layouts, full round-to-match progression, and replaceable audio hooks.

## Run locally

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Gameplay in this milestone

- Full four-color number deck plus exactly five animated signature cards: Arsonist, Freeze, Whirlwind, Arcane +2, and Chaos +4
- Automatic +2/+4 draw-stack handling, Burn, Freeze turn skips, and Whirlwind hand swaps
- Easy, Normal, Hard, and Nightmare seeded AI policies
- Animated high-detail Cole and Gabby pose systems with spell and status reactions
- Card dealing, hover/play feedback, ambient particles, character actions, and spell-specific full-screen cinematics
- Three real timed Final Card challenges—Rune Memory, Spell Timing, and Arcane Clash—trigger automatically at one card
- One-card draw turns; a playable drawn card may be cast, otherwise the turn passes
- Automatic +2/+4 resolution with same-type counters and persistent locked Burn/freeze states
- Automatic round transitions, scoring to 200 points, match victory, and rematch
- Landscape and portrait arena compositions with reduced-motion and audio settings
- Device-density-aware Phaser rendering that keeps cards, character linework, and HUD text sharp on 2K/Retina displays
- Aspect-ratio-driven arena staging verified on laptop, QHD, ultrawide, and portrait phone layouts

## Audio

Cole's supplied menu, battle, and Final Card minigame music is installed and switches automatically with the game state. Twenty-five generated card, spell, status, challenge, and interface effects are preloaded; music and effects have independent volume controls. Voice and victory-music hooks remain replaceable and safely ignore missing optional files listed in `assets/voices/README.txt`.

## Firebase online beta

The deployed build uses the original WildSpell public Firebase project by default. Private-room creation, invite URLs, room-code joining, quick matchmaking, presence, reconnect, local-first guest perspective, hidden rival hands, and atomic reducer-validated turns are implemented.

To use a different Firebase project, copy `.env.example` to `.env.local` and provide its public browser configuration. The original project does not currently expose working Firebase Authentication, so its checked-in database rules intentionally support guest play and should be treated as casual/untrusted rather than ranked security.

## Evidence and architecture

- Rebuild progress: `docs/PROGRESS.md`
- Architecture: `docs/ARCHITECTURE.md`
- Asset audit: `docs/ASSET_MANIFEST.md`
- Desktop/mobile screenshots: `artifacts/rebuild/`
- 2K clarity proof: `artifacts/clarity/arena-2k.png`

Vite emits the deployable site to `dist/` with `npm run build`.
