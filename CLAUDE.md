# PlayPoker — Neon Hold'em teaching game

Vite + React 19 + TypeScript (strict) + Tailwind v4 + motion + zustand.

## Architecture rules (obey these)

```
src/
  engine/   pure TS, NO React: cards, deck, seeded shuffle, dealing, betting state machine, side pots, hand evaluator
  coach/    pure TS, NO React: preflop ranges, Monte Carlo equity, pot odds, outs, advice + explanation text
  bots/     pure TS: rule-based opponents (tight/loose, passive/aggressive personalities)
  store/    Zustand store bridging engine → UI (one-way data flow)
  ui/       React components only: Table, Seat, Card, CardBack, ChipStack, Pot, ActionBar, CoachPanel, HandHistory
  ui/motion.ts   ALL animation durations/easings/variants live here — never inline
```

- engine/, coach/ and bots/ must never import React or anything from ui/ or store/.
- The UI never mutates game state; it dispatches store actions, which call pure engine functions.
- Design tokens (colours, radii, shadows, fonts) are defined once in the Tailwind `@theme` block in `src/index.css`. No hard-coded hex values in components. Canvas/SVG art reads colours from `src/ui/palette.ts`, which reads the same CSS variables.
- engine/ and coach/ must have thorough Vitest coverage (`*.test.ts` next to the source).
- Equity simulation runs in a Web Worker (`src/coach/equity.worker.ts`) so the UI never stutters.
- Cards, chips, avatars and the city backdrop are drawn as original SVG/canvas code. No external images.
- Respect `prefers-reduced-motion` (motion's `useReducedMotion` + `MotionConfig reducedMotion="user"`).
- localStorage access is always wrapped in try/catch.

## Visual direction

Neon-noir pixel art (see `Art Style/`): rainy night city, deep violet sky, magenta + cyan neon,
glassy translucent table with a magenta neon rim, pixel-art avatars, chunky pixel display font
(Pixelify Sans) with a clean sans body (Chakra Petch).

## Commands

- `npm run dev` — dev server
- `npm test` — vitest
- `npm run lint` — eslint
- `npm run build` — typecheck + build
- `npm run screenshot` — Playwright visual QA → `screenshots/`
