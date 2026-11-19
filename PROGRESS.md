# PROGRESS

## Phases
- [x] Phase 0 — Environment (Node 24.21, npm 11.19, git init, .gitignore)
- [x] Phase 1 — Scaffold
- [x] Phase 2 — Engine (71 tests: evaluator, side pots, min-raise, short all-ins, splits)
- [x] Phase 3 — Static table UI
- [x] Phase 4 — Animations
- [x] Phase 5 — Bots (5 personalities, 0.6–1.5s think time)
- [x] Phase 6 — Coach
- [x] Phase 7 — Extras (landing, how-to, settings, history + replay, F/C/R keys)
- [ ] Phase 8 — Visual QA
- [ ] Phase 9 — Final

## Decisions log
- **Art direction follows `Art Style/`, not the prompt's green-felt/art-deco brief.** The user asked for the Art Style folder to be used. It shows a neon-noir pixel-art rainy city with a translucent, magenta-rimmed table. All art (city backdrop, avatars, cards, chips) is generated procedurally in code; the reference images are mood boards only and are not shipped.
- Fonts: Pixelify Sans (display/labels, matches the chunky pixel lettering) + Chakra Petch (body, techy but readable).
- TypeScript pinned to 5.9 (create-vite now defaults to TS 7, which typescript-eslint doesn't support yet). ESLint (flat config) replaces the template's oxlint, as the brief asks.
- The existing `data/preflop_ranges.json` (RFI ranges by position) and `data/preflop_equity.csv` (169-hand equity table) are reused by the coach. The Python prototype in `engine/` and `research/` is kept as reference material, untouched.
- Howler is installed per the brief, but sounds are synthesised with the Web Audio API (the brief says no external files). Howler is used only for its global mute/unlock helpers (`Howler.mute`), so a single mute switch controls everything.
- Phases were built slightly out of order: the coach's pure-TS core (ranges, equity, outs) was written right after the engine because the bots reuse its range and equity maths.
- Pixelify Sans renders `5` like `S`, so all numerals use Chakra Petch (`.num` utility) and card ranks are drawn as original 5×7 pixel bitmaps.
- Table layout is computed in px from the stage size (`ui/geometry.ts`), so deal/chip/pot flights animate between exact seat coordinates. Portrait gets its own tall-oval layout.
- Cards are dealt from the deck at the dealer button's position (it moves each hand), per the brief's "fly from the dealer position".
- Bots that bust rebuy automatically so the table stays full; the human gets a Rebuy button.
- Hole cards of every player are revealed in Hand History / Replay after the hand (a deliberate teaching choice).
- `?seed=N` makes deals and bot decisions reproducible; `npm run screenshot` uses it.
- Equity: 8,000 Monte Carlo run-outs postflop (3,000 preflop) in a Web Worker. Opponent ranges are estimated from preflop role (open range by position / 3-bet / call / limp) and narrowed to pairs+draws after postflop aggression.
- Vendor code is split into react/motion chunks and the game/how-to screens are lazy-loaded.
