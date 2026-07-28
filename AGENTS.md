# AGENTS.md — WildSpell Development Rules

## Project goal

Rebuild WildSpell as a polished, colorful, pixel-art fantasy card game for:

- Solo play against smart AI
- Private online 1v1 matches
- Quick Match against another player
- Deployment from GitHub to Vercel
- Firebase Realtime Database for beta multiplayer

The current repository is a prototype. Treat it as a source of rules, Firebase configuration, existing assets, and lessons learned—not as the final architecture or visual standard.

## Non-negotiable art direction

- Entire game must read as high-quality pixel art.
- Mood: bright magical tournament, playful fantasy, competitive, lively.
- Do not use horror as the main atmosphere.
- Skeleton AI may look mischievous or dramatic, but the world itself must be colorful and fun.
- Do not make another flat oval-table interface with tiny characters.
- Characters must be large, visible, and meaningfully animated.
- Cards remain readable at all times.
- Effects may be dramatic but may not hide required controls or game state.

## Technical direction

Migrate the project to:

- Vite
- TypeScript
- Phaser 3 for the game scene, cards, particles, camera effects, and character animation
- DOM/CSS overlays only for menus, settings, forms, accessibility, and lobby UI
- Firebase Realtime Database for beta matchmaking and synchronization
- Anonymous Firebase Authentication if possible on the free tier
- Vitest for game-rule tests
- Playwright for end-to-end browser testing

Keep the Vercel deployment static. Never commit secrets. Read Firebase values from Vite environment variables, with a documented local `.env.example`.

## Required repository structure

```text
/
  AGENTS.md
  README.md
  package.json
  vite.config.ts
  tsconfig.json
  .env.example
  src/
    main.ts
    app/
      App.ts
      ScreenRouter.ts
    game/
      WildSpellGame.ts
      scenes/
        BootScene.ts
        PreloadScene.ts
        MenuScene.ts
        LobbyScene.ts
        MatchScene.ts
        ChallengeScene.ts
        ResultsScene.ts
      rules/
        cards.ts
        deck.ts
        legalMoves.ts
        reducer.ts
        scoring.ts
        statuses.ts
        challenges.ts
        ai.ts
      multiplayer/
        firebase.ts
        roomService.ts
        matchmaking.ts
        presence.ts
        protocol.ts
      animation/
        CharacterAnimator.ts
        CardAnimator.ts
        SpellCinematics.ts
        ParticleLibrary.ts
        CameraDirector.ts
      audio/
        AudioManager.ts
        audioManifest.ts
      ui/
        GuidanceDirector.ts
        Toasts.ts
        Settings.ts
    assets/
      characters/
      cards/
      effects/
      backgrounds/
      music/
      sfx/
      voices/
  tests/
    rules/
    e2e/
```

Equivalent modular structure is acceptable, but do not return to one giant HTML or one giant JavaScript file.

## Existing assets

The repository should preserve and use all supplied Universal LPC assets for:

- Cole / player 1
- Gabby / player 2
- Skeleton AI

Inspect the exact dimensions of every PNG. Do not guess rows, frame counts, or offsets.

Create a generated character manifest with:

- sheet path
- frame width
- frame height
- directions
- frame count
- animation name
- supported character
- missing clothing/body layers or known visual problems

Use actual sheets for idle, spellcast, slash, thrust, hurt, walk, and emote when valid.

Do not animate LPC sheets using incorrect CSS background assumptions. Use Phaser sprite sheets or atlases with verified frame metadata.

## Character animation requirements

Characters must have:

- Idle loop
- Turn-ready animation
- Card-play gesture
- Light spell cast
- Heavy spell cast
- Hurt reaction
- Frozen reaction
- Burning reaction
- Wind reaction
- Final Card celebration
- Challenge win
- Challenge loss
- Round victory
- Match victory
- Defeat
- Entrance and exit

When a supplied LPC animation does not fully support clothing or body layers:

1. Detect it during asset audit.
2. Choose a complete supported animation.
3. Add particles, camera movement, squash/stretch, or pose transitions around it.
4. Never show a detached head, missing body, or flashing broken layer.

## Card visual system

Number cards:

- Keep the current readable number-card concept.
- Four rich color families: red, blue, green, yellow.
- Shared reusable frame.
- Readable center and corner values.
- Hover tilt, playable glow, select lift, draw, deal, throw, impact, invalid shake, and hand-reflow animations.

Special cards must have:

1. A static card frame.
2. A looping animated face.
3. A full play cinematic.
4. A persistent status animation when relevant.
5. A unique sound and optional voice hook.

Do not generate an entire inconsistent card six times. Keep the base card fixed and animate separate layers such as flame, glow, particles, runes, frost, or orbiting cards.

## Core card set

Classic-compatible cards:

- Freeze: replaces Skip. Opponent loses the next turn. Full-screen frost; opponent character becomes blue/frozen temporarily.
- Rewind: replaces Reverse. In 1v1, the caster takes another turn.
- Arcane +2: adds 2 to the active draw stack.
- Prism Shift: choose the next color.
- Chaos +4: choose the next color and add 4 to the active draw stack.

Wild Mode custom cards:

### Arsonist — red
- Apply Burn 1 to the opponent.
- Mark one random card in their hand with a looping burn overlay.
- At the end of the burned player's turn:
  - If they played red, remove one Burn.
  - Otherwise draw cards equal to current Burn, then increase Burn by one, maximum Burn 2.
- Burn 2 marks two random cards.
- Full cinematic: caster spell animation, fire projectile, screen warmth, impact, opponent reaction, embers, persistent burned-card overlay.

### Whirlwind Swap — green
- Each player gives one random card to the other.
- Full cinematic: tornado between hands, cards orbit and swap positions, leaves and wind particles, character reactions.

### Stormcall — yellow
- Opponent must answer with yellow or Wild on their next completed turn.
- If not, draw 2.
- Lightning atmosphere and character shock reaction.

### Frostbite — blue
- Freeze one random opponent card for one turn.
- Frozen card is visibly locked and cannot be selected.
- Ice crystal overlay, frost crack animation, blue glow.

### Mirror Trick — wild
- Copy the most recent non-Mirror special spell.
- Visually mirror the previous cinematic with a reflective/glass effect.

### Cleanse — wild
- Remove all negative statuses from the caster.
- Choose the next color.
- Bright healing rune and particle burst.

## Draw stacking

Classic Mode:

- +2 stacks only on +2.
- +4 stacks only on +4.

Wild Mode:

- Mixed +2 and +4 stacking is allowed.
- Show the total stack prominently.
- Each stack play must visibly charge a shared magical orb or counter.
- A player who cannot or chooses not to stack draws the full total and loses the turn.
- Test +2, +4, mixed chains, deck exhaustion during a stack, and reconnect during a stack.

## Final Card system

- A player must call Final Card before playing from two cards to one.
- Failure immediately draws two.
- In Wild Mode, a successful call starts a multiplayer challenge.
- In 1v1, the Final Card player faces the opponent.
- If the Final Card player wins, they remain safe.
- If they lose, they draw two.

Challenges must be real 5–10 second minigames, not one-second gimmicks:

1. Rune Memory:
   - Show a sequence.
   - Hide it.
   - Players repeat it.
   - Score accuracy and speed.

2. Spell Timing:
   - Moving marker and target zones.
   - Several rounds, not one click.
   - Score cumulative precision.

3. Arcane Clash:
   - Players alternate or simultaneously respond to several directional/rune prompts.
   - Score speed and correctness.

Challenge results must synchronize online and handle disconnects/timeouts.

## Intelligent guidance

The player should never wonder what to do.

The GuidanceDirector must produce precise messages such as:

- Play a red card, match the number, use a Wild, or draw.
- No legal card. Draw from the highlighted pile.
- A +8 stack is active. Stack another draw card or take eight.
- The card you drew is playable. Play it or end your turn.
- Stormcall is active. Play yellow or Wild.
- Call Final Card before playing down to one.
- Waiting for Gabby.
- Gabby disconnected. Attempting to reconnect.
- Choose a new color.
- This card is frozen for one turn.
- That move is illegal because…

Illegal interactions must shake/highlight the relevant card and show the reason. Never silently ignore input.

## Animation quality

Implement a reusable animation library:

- Card deal
- Draw from deck
- Throw to discard
- Hand fan/reflow
- Hover tilt
- Select lift
- Playable pulse
- Invalid shake
- Status attachment
- Stack charge
- Color-change atmosphere
- Round intro
- Round result
- Match victory
- Reconnect indicator

Spell cinematics:

- Freeze: ice wave, border frost, blue tint, opponent freeze pose.
- Rewind: rotating time runes, reverse trail, brief rewind echo.
- Arcane +2: two glowing cards launch toward opponent.
- Chaos +4: four-card storm, strong camera shake, purple atmosphere.
- Arsonist: fire cast, projectile, impact, embers, persistent Burn.
- Whirlwind: tornado, card orbit, visible swap.
- Stormcall: lightning strike, screen flash, shock reaction.
- Frostbite: ice shard hits a specific card and locks it.
- Mirror: glass reflection and replayed effect.
- Cleanse: healing ring clears status overlays.

Use Phaser timelines/tweens, particles, camera shake, and color grading. Respect the reduced-motion setting.

## Audio

Do not synthesize chiptune music and do not use browser text-to-speech.

Build an AudioManager that:

- Loads from `src/assets/audio-manifest.json`.
- Preloads menu, battle, challenge, victory, and defeat music.
- Preloads SFX and voice clips before a match.
- Fails gracefully when a file is missing.
- Supports music, SFX, and voice toggles and independent volume controls.
- Avoids delayed first playback by decoding assets during preload.
- Supports ducking music beneath voices and major effects.

The user will supply final music and voices. Keep documented filenames and make replacement easy.

## AI requirements

Difficulties:

- Easy: legal but loose/random.
- Normal: considers color counts and obvious specials.
- Hard: plans draw stacks, statuses, color control, and Final Card timing.
- Nightmare: evaluates several candidate moves, protects against opponent near-win, uses Cleanse intelligently, and chooses challenge performance in a strong but beatable range.

AI must:

- Never make illegal moves.
- Understand Burn, Frostbite, Stormcall, stacking, Mirror, Cleanse, and Wild color choice.
- Use deterministic seeded randomness in tests.
- Explain decisions in debug mode.

## Multiplayer requirements

For the free beta:

- Firebase Realtime Database.
- Anonymous authentication where available.
- Private room code.
- Invite URL.
- Quick Match.
- Presence heartbeat.
- Reconnect.
- Host-authoritative validation for beta.
- Separate public room metadata from hidden hand data where practical.
- Document clearly that the beta is not cheat-proof ranked infrastructure.

Never expose private hands in normal rendered UI or logs.

## Testing

Before declaring a milestone complete:

- Run TypeScript checks.
- Run Vitest.
- Run Playwright in Chromium.
- Capture screenshots at desktop and mobile sizes.
- Test every card.
- Test every status.
- Test draw stack combinations.
- Test deck recycle.
- Test Final Card success, failure, challenge win, challenge loss, tie, timeout, and disconnect.
- Test solo at all four difficulties.
- Test two-browser online play.
- Test reconnect during:
  - normal turn
  - color choice
  - draw stack
  - Final Card challenge
  - round result

Do not say “complete” if tests are failing or major assets are placeholders.

## Workflow

- Start by auditing the current repository and writing `docs/AUDIT.md`.
- Create a new branch: `codex/wildspell-rebuild`.
- Commit after each milestone.
- Do not delete original assets or credits.
- Prefer small reviewable diffs.
- Take screenshots after visual milestones.
- Keep a `docs/PROGRESS.md` checklist.
- Ask for approval at visual gates, but continue technical work that does not depend on the approval.
- Never claim commercial-finished quality after a single pass.
