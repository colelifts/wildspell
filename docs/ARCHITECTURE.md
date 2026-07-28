# WildSpell rebuild architecture

## Principles

- Keep game rules deterministic, serializable, and independent of Phaser, Firebase, and the DOM.
- Render match gameplay and challenges in Phaser; use DOM overlays for menus, forms, settings, accessibility, lobby, and reconnect messaging.
- Make every state transition return either an accepted event or a structured rejection reason.
- Treat multiplayer messages as versioned commands validated by the host, then publish sanitized views to each client.
- Load assets from generated manifests and fail visibly but safely when optional audio or animation is unavailable.

## Module boundaries

```text
DOM shell -> ScreenRouter -> Phaser scenes
                         -> pure rules reducer <- AI policy
                         -> animation/audio directors
                         -> multiplayer protocol -> Firebase services
```

The rules package owns cards, deck lifecycle, legal moves, statuses, stacking, scoring, challenges, and seeded randomness. Scenes may request commands but never mutate match state directly. Firebase adapters carry protocol types rather than renderer objects.

## State and command flow

1. UI or AI creates a typed command.
2. `legalMoves` and the reducer validate it against the authoritative state.
3. The reducer returns the next state plus semantic events, or a rejection with a human-readable reason key.
4. Animation, guidance, and audio consume semantic events.
5. Online hosts commit validated state and per-player projections; clients render their allowed projection.

## Migration sequence

1. Add Vite, TypeScript, Phaser, Vitest, and a minimal DOM shell without changing production deployment.
2. Port and test the pure Classic rules, then Wild rules/statuses.
3. Generate LPC metadata and create a development animation viewer.
4. Build match rendering and reusable animation directors.
5. Add synchronized Final Card challenges and deterministic AI.
6. Replace prototype Firebase access with authentication, protocol validation, projections, presence, and reconnect handling.
7. Integrate supplied audio, responsive polish, accessibility, deployment, and evidence capture.

## Deployment

Vite emits a static `dist/` directory for Vercel. Firebase values come from documented `VITE_FIREBASE_*` variables and `.env` remains ignored. Public configuration may be shipped to the browser, but credentials with server authority must never be added. Firebase database rules and indexes are versioned and reviewed with the client protocol.

