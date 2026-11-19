You are building a complete, polished Texas Hold'em teaching website from scratch in this folder. Work autonomously through every phase below without stopping to ask me questions — make sensible decisions and note them in PROGRESS.md. Only stop if something truly needs my password or a manual action (tell me exactly what to do, then continue once I confirm).

Use a task list to track the phases. After finishing each phase: run tests + build, fix any failures, update PROGRESS.md, and make a git commit.

## Phase 0 — Environment

1. Check `node -v` and `npm -v`. Need Node 20+. If missing or too old, install it (on macOS prefer Homebrew `brew install node`; if Homebrew is missing, tell me the one command to run, then wait).
2. `git init` if not already a repo. Add a sensible .gitignore.
3. Create PROGRESS.md (phase checklist + decisions log). If PROGRESS.md already exists, read it and resume from the first unfinished phase.

## Phase 1 — Scaffold

- Vite + React + TypeScript (strict mode) in the current folder.
- Install: tailwindcss + @tailwindcss/vite, motion (Framer Motion), zustand, howler + @types/howler, clsx.
- Dev: vitest, @testing-library/react, jsdom, @playwright/test (then `npx playwright install chromium`), eslint, prettier.
- npm scripts: dev, build, test, lint, screenshot.
- Create `.mcp.json` registering the Playwright MCP server (`npx @playwright/mcp@latest`) for future sessions.
- Write CLAUDE.md containing the architecture rules below.

## Architecture rules (put these in CLAUDE.md and obey them)

```
src/
  engine/   pure TS, NO React: cards, deck, seeded shuffle, dealing, betting state machine, side pots, hand evaluator
  coach/    pure TS, NO React: preflop ranges, Monte Carlo equity, pot odds, outs, advice + explanation text
  bots/     pure TS: rule-based opponents (tight/loose, passive/aggressive personalities)
  store/    Zustand store bridging engine → UI (one-way data flow)
  ui/       React components only: Table, Seat, Card, CardBack, ChipStack, Pot, ActionBar, CoachPanel, HandHistory
  ui/motion.ts   ALL animation durations/easings/variants live here — never inline
```

- Design tokens (colours, radii, shadows, fonts) defined once in the Tailwind theme; no hard-coded hex values in components.
- engine/ and coach/ must have thorough Vitest coverage.
- Equity simulation runs in a Web Worker so the UI never stutters.
- Cards are drawn as original SVG components in code (no external card images).

## Phase 2 — Engine (tests first)

- Types: Card, Rank, Suit, Player, Action, Street, GameState.
- Seeded RNG shuffle (reproducible hands for tests and replay).
- Full No-Limit Hold'em flow for 2–6 players: blinds, preflop/flop/turn/river/showdown, fold/check/call/bet/raise/all-in, min-raise rules, side pots, split pots.
- Hand evaluator: all 9 categories + kickers. Tests MUST cover wheel straight (A-2-3-4-5), steel wheel, board-plays split pots, kicker ties, flush vs straight, full house comparisons, multiple side pots.

## Phase 3 — Static table UI

- Oval poker table, dark green felt with subtle texture/vignette, wooden rail, 6 seats around it, user always bottom-centre.
- Each seat: avatar initial, name, stack, current bet, dealer/SB/BB buttons.
- Centre: community card slots + pot.
- Bottom ActionBar: Fold / Check-Call / Bet-Raise with a bet slider and quick buttons (½ pot, ¾ pot, pot, all-in).
- Aesthetic: premium casino, art-deco — deep green felt, cream cards, gold accents, elegant serif headings + clean sans body (load via Google Fonts). Must look distinctive, not generic.
- Fully responsive: works on a phone in portrait.

## Phase 4 — Animations (the "wow" layer)

- Shuffle animation on the deck before each hand.
- Cards fly from the dealer position to each seat one at a time, clockwise, staggered, with a slight rotation and spring settle.
- User's hole cards flip face-up with a 3D flip; bots' stay face-down until showdown.
- Flop deals 3 cards with stagger then flips; turn and river flip individually.
- Chips slide from seat to pot on bets; pot slides to the winner at showdown.
- Winning 5 cards lift and glow; losing hands dim.
- Folded hands slide toward the muck and fade.
- Subtle hover lift on the user's cards. Respect `prefers-reduced-motion`.
- Optional sounds (deal, chip, flip, win) with a mute toggle — generate simple sounds with the Web Audio API, no external files.

## Phase 5 — Bots

- 5 bots with distinct personalities; decisions based on hand strength, position, pot odds, and some randomness. Realistic "thinking" delay (0.6–1.5s) with an indicator.

## Phase 6 — Coach (the core teaching feature)

CoachPanel slides in on the user's turn and shows:

- Current hand in plain English ("You have a pair of Queens with an Ace kicker").
- Hand strength category + percentile.
- Preflop: recommendation from standard opening ranges by position; show a 13×13 range grid with the user's hand highlighted.
- Postflop: Monte Carlo equity vs. estimated opponent range (5–10k sims in a worker), pot odds, required equity, outs list with "rule of 2 and 4" explanation, draws identified (flush draw, OESD, gutshot).
- Recommended action (Fold / Call / Raise + sizing) with a 2–3 sentence explanation of WHY.
- After the user acts: instant feedback — "Good play" / "Consider X instead" with reasoning.
- Clearly label advice as heuristic, not solver-optimal.
- Toggle: "Coach mode" (advice shown before acting) vs "Quiz mode" (user acts first, then gets graded).
- End of hand: summary card — what happened, key decision points, score.
- Session stats: hands played, decisions graded, accuracy %, saved to localStorage (wrapped in try/catch).

## Phase 7 — Extras

- Landing screen with "Play", "How to Play" (rules + hand rankings visual chart), and settings (number of bots, starting stack, blinds, speed, sound).
- Hand history panel with replay of the last hand.
- Keyboard shortcuts (F fold, C check/call, R raise).

## Phase 8 — Visual QA (mandatory)

- Write `scripts/screenshot.ts` using Playwright: start the dev server, open the site at 1440×900 and 390×844, play through a hand by clicking actions, save screenshots to `screenshots/` at: landing, deal complete, flop, coach panel open, showdown.
- Look at every screenshot yourself. Fix any misalignment, overlap, clipping, poor contrast, ugly spacing or janky layout. Re-run until it looks genuinely polished on both sizes.
- Check the browser console for errors and fix all of them.

## Phase 9 — Final

- `npm run lint`, `npm test`, `npm run build` all pass with zero errors.
- README.md: what it is, screenshot, how to run, architecture overview.
- Final commit. Then tell me: how to run it locally, and the exact steps to deploy free on Vercel.

Quality bar: this should feel like a premium commercial game, not a tutorial project. Prefer fewer features done beautifully over many done roughly.
