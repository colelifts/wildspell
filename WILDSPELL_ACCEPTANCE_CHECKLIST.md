# WILDSPELL_ACCEPTANCE_CHECKLIST.md

## Visuals

- [ ] Bright magical tournament atmosphere
- [ ] No giant dead/empty table composition
- [x] Cole and opponent are large and readable
- [x] Gabby renders correctly online
- [ ] UI uses consistent premium pixel frames
- [x] Cards remain readable on desktop and mobile
- [ ] Animated arena details do not distract from play
- [ ] Reduced-motion mode works

## LPC characters

- [ ] Asset audit generated exact frame metadata
- [ ] Idle
- [ ] Ready
- [ ] Card play
- [ ] Light cast
- [ ] Heavy cast
- [ ] Hurt
- [ ] Frozen
- [ ] Burning
- [ ] Wind reaction
- [ ] Emote
- [ ] Final Card celebration
- [ ] Challenge win/loss
- [ ] Round victory
- [ ] Match victory
- [ ] Defeat
- [ ] Entrance/exit
- [ ] No detached heads, missing bodies, or flashing layers

## Cards

- [ ] Full number deck
- [ ] Freeze
- [ ] Arcane +2
- [ ] Chaos +4
- [ ] Arsonist
- [ ] Whirlwind Swap
- [ ] Looping special-card faces
- [ ] Hover
- [ ] Playable glow
- [ ] Select
- [ ] Deal
- [ ] Draw
- [ ] Throw
- [ ] Impact
- [ ] Invalid shake
- [ ] Hand reflow

## Rules

- [ ] Legal-card clicking bug fixed
- [ ] Clear illegal-move reason
- [ ] Classic stacking
- [ ] Wild mixed stacking
- [ ] Deck recycling
- [ ] Burn 1
- [ ] Burn 2 maximum
- [ ] Red removes one Burn
- [ ] Burn draws correct amount
- [ ] Freeze skips next turn
- [ ] Whirlwind swaps cards
- [ ] Color picker works
- [ ] Drawn-card play/pass works
- [x] Round scoring
- [x] Match target score

## Final Card

- [ ] Call required before going from two to one
- [ ] Missed call draws two
- [ ] Rune Memory challenge
- [ ] Spell Timing challenge
- [ ] Arcane Clash challenge
- [ ] Challenge lasts 5–10 seconds
- [ ] Online score synchronization
- [ ] AI challenge behavior
- [ ] Tie
- [ ] Timeout
- [ ] Disconnect/reconnect

## Audio

- [ ] No browser speech synthesis
- [x] No generated chiptune placeholder
- [x] Menu music hook
- [x] Battle music hook
- [x] Challenge music hook
- [ ] Victory music hook
- [ ] SFX preloaded
- [ ] Voice lines preloaded
- [ ] Music ducking
- [ ] Missing file fallback
- [ ] Settings persist

## AI

- [ ] Easy
- [ ] Normal
- [ ] Hard
- [ ] Nightmare
- [ ] Never illegal
- [ ] Understands stacking
- [ ] Understands all statuses
- [ ] Chooses Wild colors
- [ ] Protects against opponent near-win
- [ ] Seeded tests

## Multiplayer

- [x] Create room
- [x] Join room
- [x] Invite URL
- [x] Quick Match
- [x] Presence
- [x] Reconnect
- [x] Hidden hands
- [ ] Host validation
- [x] Two-browser Playwright test
- [x] Color choice sync
- [x] Stack sync
- [x] Challenge sync
- [x] Round transition sync

## Shipping

- [x] Vite production build passes
- [x] TypeScript passes
- [x] Vitest passes
- [ ] Playwright passes
- [x] Desktop screenshots
- [x] Mobile screenshots
- [ ] README deployment guide
- [ ] Firebase rules documented
- [ ] Vercel deployment verified
- [ ] Original LPC credits preserved
- [ ] Known limitations documented
