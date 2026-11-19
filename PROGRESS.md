# PROGRESS

## Phases
- [x] Phase 0 — Environment (Node 24.21, npm 11.19, git init, .gitignore)
- [x] Phase 1 — Scaffold
- [x] Phase 2 — Engine (71 tests: evaluator, side pots, min-raise, short all-ins, splits)
- [ ] Phase 3 — Static table UI
- [ ] Phase 4 — Animations
- [ ] Phase 5 — Bots
- [ ] Phase 6 — Coach
- [ ] Phase 7 — Extras
- [ ] Phase 8 — Visual QA
- [ ] Phase 9 — Final

## Decisions log
- **Art direction follows `Art Style/`, not the prompt's green-felt/art-deco brief.** The user asked for the Art Style folder to be used. It shows a neon-noir pixel-art rainy city with a translucent, magenta-rimmed table. All art (city backdrop, avatars, cards, chips) is generated procedurally in code; the reference images are mood boards only and are not shipped.
- Fonts: Pixelify Sans (display/labels, matches the chunky pixel lettering) + Chakra Petch (body, techy but readable).
- TypeScript pinned to 5.9 (create-vite now defaults to TS 7, which typescript-eslint doesn't support yet). ESLint (flat config) replaces the template's oxlint, as the brief asks.
- The existing `data/preflop_ranges.json` (RFI ranges by position) and `data/preflop_equity.csv` (169-hand equity table) are reused by the coach. The Python prototype in `engine/` and `research/` is kept as reference material, untouched.
- Howler is installed per the brief, but sounds are synthesised with the Web Audio API (the brief says no external files). Howler is used only for its global mute/unlock helpers (`Howler.mute`), so a single mute switch controls everything.
