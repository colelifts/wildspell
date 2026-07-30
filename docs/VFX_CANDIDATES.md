# Third-party VFX approval gate

No asset listed here is integrated into WildSpell. This page exists so the visual direction can be approved before any external animation files enter the live game.

## Requested source: ProductionCrate Toon / Anime FX

- Fire category supplied by the project owner: https://footagecrate.com/vfx/visual-graphics/toon-anime-fx/toon-fire-sparks
- Direct candidate: https://vfx.productioncrate.com/video-effects/footagecrate-4k-anime-fire-spark
- Direct candidate format: transparent RGBA MOV, PNG sequence, or H.264 preview; 4K; 30 FPS; 1.2 seconds
- Source listing states no attribution is required and an extended-use license is available for commercial and non-commercial productions.
- Important: the raw effect may not be redistributed as a standalone asset. Before download, confirm that committing the licensed media inside a public GitHub game repository is permitted under the chosen account/license.

Suggested audition only (not integrated):

- Arsonist impact: Anime Fire Spark plus a separate directional flame strike.
- Burn status: a smaller edge flame loop, masked to the card silhouette.
- Freeze: use the matching Toon/Anime Energy collection only if an ice burst has the same line weight.
- Whirlwind: use a transparent circular anime wind stroke; avoid photoreal tornado footage.

## No-AI alternative candidates

- PIPOYA Time Magic: https://pipoya.itch.io/pipoya-free-vfx-time-magic — transparent time-stop/reverse sprite sheets, commercial and personal use allowed, editing allowed, redistribution prohibited, author states no generative AI.
- Kalponic Free Stylized Sprite VFX: https://kalponic-studio.itch.io/free-stylized-sprite-vfx — 15 stylized flipbooks, commercial use and modification allowed, CC BY 4.0, author states no generative AI.
- Thundersnow Magic VFX Pack 1: https://thundersnowpixel.itch.io/magic-vfx-pack-1 — hand-drawn spell sheets including whirlwind/lightning, commercial use and modification allowed, redistribution prohibited, author states no generative AI.

## Primary candidate: Vivid Motion — Elemental Arcana Vol. 1

- Preview and download: https://vivid-motion-assets.itch.io/vivid-motion-elemental-arcana-vol-1
- Price: free / name your own price
- Style: high-fidelity transparent 2D elemental effects
- Format: transparent PNG sprite sheets at 60 FPS
- Structure: separate Cast, Projectile, and Hit animations
- Elements: Fire, Ice, Lightning, Air, Arcane, Holy, Water, Earth, and Acid
- License on source page: commercial and personal use permitted; modification and recoloring permitted; raw-sheet redistribution prohibited

Suggested WildSpell audition mapping:

- Arsonist: Fire Cast + Fire Projectile + Fire Hit
- Freeze: Ice Cast + Ice Hit, combined with the approved persistent frost frame
- Whirlwind: Air Cast + Air Projectile + Air Hit, recolored emerald/cyan
- Arcane +2: Arcane Cast + Arcane Projectile
- Chaos +4: Arcane or Void-style impact recolored crimson/purple
- Future Stormcall only if restored: Lightning Cast + Lightning Hit

Why it is the current favorite: one author and one animation system can cover every live spell, which prevents the game from looking like a collage of unrelated effect packs.

## Optional premium supplement: Mochi Lab

- Catalog: https://mochilab-studio.itch.io/
- Relevant packs: Magic FX, Spell Cast Circle, Smoke & Fire, Weather FX, Status Effect, and Combat FX
- Formats: PNG sheets, GIF, individual PNG frames, and animated WebP
- License stated on catalog: royalty-free commercial use; attribution appreciated but not required; source-file resale prohibited

This is a backup option only if the Vivid Motion audition is not visually strong enough. Buying or integrating these packs requires a separate approval.

## Approval rule

Before integration, show a side-by-side audition for all five live spells using candidate previews. Do not download paid packs, copy files into `assets/`, or alter the live manifest until the user approves the specific effect set.
