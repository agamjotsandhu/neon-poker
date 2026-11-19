# No-Limit Hold'em Strategy Research: foundations for a poker "engine"

Scope: No-Limit Texas Hold'em cash games (6-max, 100bb deep), with notes on heads-up, full ring and tournaments.
Every equity number in this document was computed by the code in [`engine/`](../engine/) unless a source is cited.

---

## 0. Read this first: what is possible and what isn't

**Poker is not chess, and that changes how the engine has to work.**

| | Chess engine | Poker engine |
|---|---|---|
| Information | Perfect: you see the whole board | Imperfect: you don't see opponents' cards |
| Best move | One deterministic move | A **mixed strategy**, e.g. "bet 66% pot 40%, check 60%" |
| Evaluated unit | A position | Your whole **range** (every hand you could hold here) vs theirs |
| Solved? | No, but engines are superhuman | Heads-up **Limit** Hold'em is essentially solved (Cepheus, 2015). No-Limit isn't solved, but bots beat top pros heads-up (Libratus, 2017) and 6-max (Pluribus, 2019) |
| Precomputed table of every position? | No | No. Heads-up No-Limit has ~10^161 decision points. It's solved **on demand** for each spot |

The consequences:

1. **There is no lookup table of "every hand pre- and post-flop".** Preflop can be tabulated: there are 169 distinct starting hands, and the table is in `data/`. Postflop, the right play depends on both players' ranges, the board, stack depth, bet sizes and the action so far. An engine computes it per spot with a **CFR solver** (section 9), the same way a chess engine searches each position rather than storing every game.
2. **Your hand's strength alone is never the answer.** The same hand is a fold, a call or a raise depending on the opponent's range and the price. AA preflop is the only hand that's always played.
3. **"Probability of winning" (equity) ≠ "probability of making money" (EV).** 72o wins 34.5% of the time heads-up and still loses money in almost every spot. See section 3.
4. **The strategy that loses the least is GTO (Nash equilibrium).** It can't be beaten in the long run, but it doesn't maximise profit against weak players. The most money comes from **exploiting** opponents' mistakes. A complete engine does both: GTO as the baseline, plus measured deviations.
5. **Rake** (the house's cut) is a cost the math has to include. At low stakes it can exceed a good player's pre-rake edge.

> ⚠️ **Fair-play note.** Using a tool that advises you *during* a hand (Real-Time Assistance) is banned on essentially every online poker site, and accounts get closed and funds confiscated. Build this as a **post-session review / training tool**, the way chess players use engines after a game. Using it while you play also wouldn't make you better: the skill has to be in your head.

---

## 1. Combinatorics: the counting everything else is built on

- 52 cards → **1,326** two-card starting combos.
- These collapse to **169 strategically distinct hands**:
  - 13 pocket pairs × **6** combos each = 78
  - 78 suited hands × **4** combos each = 312
  - 78 offsuit hands × **12** combos each = 936
- So AKo (12 combos) is **3×** as common as AKs (4), and any specific pair is rarer than any unpaired hand.
- **Card removal / blockers.** If you hold A♠, opponents have fewer AA/AK combos. With one ace, AA drops from 6 combos to 3. With an ace on the board as well, AA has 1 combo left. All "how likely is it they have X" reasoning runs on combo counting.
- Flops: C(50,3) = **19,600** per hand, or 22,100 overall. Suit isomorphism reduces these to **1,755** strategically distinct flops. Solvers and training sites use these subsets.

Handy preflop odds:

| Event | Probability |
|---|---|
| Dealt a pocket pair | 5.9% (1 in 17) |
| Dealt AA (or any specific pair) | 0.45% (1 in 221) |
| Pocket pair flops a set or better | 11.8% (~1 in 8.5) |
| Suited hand flops a flush | 0.84% |
| Suited hand flops a flush draw | 10.9% |
| Two unpaired cards flop at least a pair | ~32.4% |

---

## 2. Preflop equity: all 169 hands

Full data: [`data/preflop_equity.csv`](../data/preflop_equity.csv). It gives the win share of every hand against 1 to 8 random opponents, Monte Carlo, 60k samples heads-up and 24k multiway. The error is about ±0.3% heads-up and about ±0.5% multiway.

### 2.1 Heads-up equity vs one random hand (%)
Suited hands are above the diagonal, offsuit below, pairs on the diagonal.

| | A | K | Q | J | T | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A** | 85 | 67 | 66 | 65 | 65 | 63 | 62 | 61 | 60 | 60 | 59 | 58 | 57 |
| **K** | 66 | 82 | 63 | 62 | 62 | 60 | 58 | 58 | 57 | 56 | 55 | 54 | 53 |
| **Q** | 64 | 61 | 80 | 60 | 59 | 58 | 56 | 54 | 53 | 53 | 52 | 51 | 50 |
| **J** | 64 | 61 | 58 | 77 | 58 | 56 | 54 | 52 | 51 | 50 | 49 | 48 | 47 |
| **T** | 62 | 60 | 57 | 55 | 75 | 54 | 52 | 50 | 49 | 47 | 46 | 46 | 45 |
| **9** | 61 | 58 | 55 | 54 | 51 | 72 | 51 | 49 | 47 | 46 | 44 | 44 | 42 |
| **8** | 60 | 56 | 53 | 52 | 50 | 48 | 69 | 48 | 46 | 44 | 43 | 41 | 40 |
| **7** | 59 | 55 | 51 | 50 | 48 | 46 | 45 | 66 | 45 | 44 | 42 | 40 | 38 |
| **6** | 57 | 54 | 51 | 48 | 46 | 45 | 43 | 42 | 63 | 43 | 41 | 40 | 38 |
| **5** | 58 | 53 | 50 | 48 | 44 | 43 | 41 | 41 | 40 | 60 | 42 | 40 | 38 |
| **4** | 57 | 52 | 49 | 46 | 44 | 41 | 39 | 39 | 38 | 38 | 57 | 38 | 37 |
| **3** | 56 | 51 | 48 | 46 | 42 | 40 | 38 | 36 | 36 | 36 | 35 | 54 | 36 |
| **2** | 55 | 51 | 47 | 44 | 42 | 39 | 37 | 34 | 34 | 34 | 33 | 32 | 50 |

Best: AA 85.3%. Worst: 32o 32.0%. 72o is 34.5%: it's the "worst hand" in folklore because it's the weakest hand that can't make a straight.

### 2.2 Ranking changes with the number of opponents

| Opponents | Top 12 hands by equity |
|---|---|
| 1 | AA KK QQ JJ TT 99 88 AKs AQs 77 AKo AJs |
| 2 | AA KK QQ JJ TT 99 AKs 88 AQs AKo AJs KQs |
| 5 | AA KK QQ JJ AKs TT AQs KQs AJs AKo ATs 99 |
| 8 | AA KK QQ AKs JJ AQs AJs KQs AKo KJs TT ATs |

**Lesson:** heads-up, **high cards and pairs** win because one pair often holds up. Multiway, **suited and connected** hands gain value because they make the flushes and straights that win big pots. Small pairs drop sharply in raw equity (22 goes from 50% heads-up to 12.5% against 8 opponents), but they keep **implied odds** for set-mining.

Equity vs 1 to 8 opponents for some reference hands:

| Hand | vs1 | vs2 | vs3 | vs5 | vs8 |
|---|---|---|---|---|---|
| AA | 85.3 | 73.4 | 63.9 | 49.2 | 34.6 |
| KK | 82.1 | 69.1 | 58.7 | 43.5 | 29.3 |
| AKs | 67.1 | 50.7 | 41.3 | 30.5 | 22.4 |
| AKo | 65.5 | 48.3 | 37.8 | 27.8 | 19.4 |
| KQo | 61.4 | 44.3 | 35.2 | 25.2 | 17.1 |
| A5s | 60.0 | 42.1 | 31.2 | 22.3 | 16.1 |
| JTs | 57.5 | 42.0 | 34.1 | 25.0 | 18.3 |
| 22 | 50.2 | 30.4 | 21.5 | 15.4 | 12.5 |
| 72o | 34.5 | 20.4 | 14.5 | 8.7 | 5.4 |

### 2.3 Classic head-to-head matchups (computed, specific suits)

| Matchup | Equity | Pattern |
|---|---|---|
| AA vs KK (no shared suits) | 81.3 / 18.7 | Bigger pair vs smaller pair ≈ 80/20 (exact over all 1.7M boards) |
| QQ vs JJ | 81.3 / 18.7 | Same |
| QQ vs AKo | 57.3 / 42.7 | Pair vs two overcards ≈ "coin flip", the pair slightly ahead |
| QQ vs AKs | 53.8 / 46.2 | Suitedness adds about 3.5% |
| 22 vs AKo | 53.1 / 46.9 | Even the smallest pair is a slight favourite |
| AKs vs 22 | 50.1 / 49.9 | A true coin flip |
| JJ vs ATo | 71.3 / 28.7 | Pair vs one overcard ≈ 70/30 |
| AKo vs AQo | 74.9 / 25.1 | **Domination** (shared card, worse kicker) ≈ 70–75/25 |
| AKo vs KQo | 74.5 / 25.5 | Domination |
| AKo vs 76s | 57.7 / 42.3 | Two overs vs suited connector ≈ 60/40 |
| AKo vs JTs | 58.5 / 41.5 | |
| AA vs 87s | 77.0 / 23.0 | Suited connectors are the best hands to hold against aces |
| AA vs KK vs QQ | 67.1 / 18.2 / 14.7 | |

Reproduce any of these: `python3 engine/equity.py hand AhKh QsQd [--board 2h7hJc]`

---

## 3. Equity vs expected value (EV): why "% to win" isn't "% to make money"

**EV** is the average amount won or lost by an action over all the ways the hand can play out:

```
EV(action) = Σ  P(outcome) × chips won/lost in that outcome
EV(fold)   = 0   (measured from now: chips already in the pot are sunk)
```

Equity only describes **showdown**. Real outcomes differ from it for these reasons:

1. **Equity realization (R).** You realize `equity × R`. In position R is often 1.0 to 1.1 (you see showdown cheaply and bluff well). Out of position, with weak or offsuit hands, R can be 0.6 to 0.8, because you get bet off your equity. That's why the button opens 44% of hands but UTG opens 18%.
2. **Fold equity.** Betting wins the pot outright when they fold. `EV(bet) = P(fold)·Pot + P(call)·(Equity_vs_calls·FinalPot − Bet)`.
3. **Implied odds.** Chips you win on *later* streets when you hit, such as set-mining 22.
4. **Reverse implied odds.** Chips you *lose* later when you make a second-best hand, such as A4o vs AK, or a low flush.
5. **Position.** Acting last means more information on every street. It's worth roughly the difference between UTG and BTN win-rates, which is the largest single structural edge in the game.

---

## 4. The core formulas (the engine's math kernel)

Notation: `P` = pot **before** the bet, `B` = bet size, `S` = effective stack.
All of these are implemented in [`engine/advisor.py`](../engine/advisor.py).

### 4.1 Pot odds: when to call
```
Required equity to call = B / (P + 2B)          (call / final pot)
```

| Bet size (fraction of pot) | Required equity | MDF (defend at least) | Bluff must work | Bluffs in a polarized range |
|---|---|---|---|---|
| 25% | 16.7% | 80.0% | 20.0% | 16.7% (5 value : 1 bluff) |
| 33% | 20.0% | 75.0% | 25.0% | 20.0% (4:1) |
| 50% | 25.0% | 66.7% | 33.3% | 25.0% (3:1) |
| 66% | 28.4% | 60.2% | 39.8% | 28.4% (≈2.5:1) |
| 75% | 30.0% | 57.1% | 42.9% | 30.0% (≈2.3:1) |
| 100% | 33.3% | 50.0% | 50.0% | 33.3% (2:1) |
| 150% | 37.5% | 40.0% | 60.0% | 37.5% (≈1.7:1) |
| 200% | 40.0% | 33.3% | 66.7% | 40.0% (1.5:1) |

### 4.2 Minimum Defense Frequency (MDF)
```
MDF = P / (P + B)
```
If you fold more than `1 − MDF` of your range to a bet, any two cards can bluff you profitably. MDF is a **benchmark for the defender's whole range**, not a rule for a single hand. Against opponents who rarely bluff (common at low stakes), folding more than MDF is correct.

### 4.3 Bluff break-even (alpha)
```
α = B / (P + B)      → a bluff must succeed this often to break even
```

### 4.4 Optimal value-to-bluff ratio (river, polarized range)
On the river a GTO bettor makes the caller **indifferent** to calling, which sets the bluff fraction:
```
Bluff fraction of betting range = B / (P + 2B)     (equal to the caller's required equity)
```
A pot-size bet means 1 bluff per 2 value hands. Bigger bets carry more bluffs, smaller bets fewer.
On the **flop and turn** you can bluff *more* than this, because "bluffs" there are draws with equity.

### 4.5 Geometric bet sizing (getting stacks in by the river)
The same pot-fraction `f` on each of `n` remaining streets gets exactly all-in by the last one:
```
f = ((1 + 2S/P)^(1/n) − 1) / 2
```
Example: pot 6.5bb, stacks 97.5bb, 3 streets → f ≈ 107% pot each street. With the nuts and a polarized range, geometric sizing maximises the money you get in. With merged or thin-value ranges, use smaller sizes.

### 4.6 Stack-to-Pot Ratio (SPR)
```
SPR = effective stack / pot   (measured on the flop)
```

| SPR | Implication |
|---|---|
| < 2 | Committed with top pair or better; play is mostly all-in or fold |
| 2–6 | Top pair / overpair is usually good enough to stack off |
| 6–13 | Need two pair+ to happily get it all in; draws and sets gain value |
| > 13 | Deep: nutted hands and implied-odds hands (sets, suited connectors) dominate |

### 4.7 Outs → equity (draws)

`P(hit by river from the flop) = 1 − C(47−n, 2)/C(47, 2)`;  `P(hit on the next card) = n / 46` (from the turn) or `n / 47` (from the flop).
Quick estimate: **outs × 4** on the flop (two cards to come), **outs × 2** on the turn.

| Draw | Outs | Flop → River | Turn → River |
|---|---|---|---|
| Gutshot | 4 | 16.5% | 8.7% |
| Two overcards | 6 | 24.1% | 13.0% |
| Open-ended straight draw | 8 | 31.5% | 17.4% |
| Flush draw | 9 | 35.0% | 19.6% |
| Flush draw + gutshot | 12 | 45.0% | 26.1% |
| Flush draw + open-ended | 15 | 54.1% | 32.6% |

Discount "dirty" outs: a flush card that also pairs the board, or a straight card that completes a bigger straight for them.

### 4.8 Implied odds
```
Extra chips needed later to justify a call = (Call / Equity_now) − (Pot + Call)
```
Set-mining rule of thumb: call a raise with a small pair only when effective stacks are at least **15–20× the call**. You flop a set 11.8% of the time and won't always get paid.

---

## 5. Preflop strategy

Full ranges: [`data/preflop_ranges.json`](../data/preflop_ranges.json). They're **approximations** shaped after published solver output for 6-max, 100bb and 2.5bb opens. Published guides differ by a few percent ([source comparison](https://online6maxcash.pages.dev/), [HJ/CO guide](https://www.deucescracked.com/blog/poker-hijack-cutoff-opening-ranges-6max-guide-2026)). Replace them with your own solver exports for production.

### 5.1 Raise First In (RFI): nobody has entered the pot yet
| Position | Range width | Combos | Range |
|---|---|---|---|
| UTG (LJ) | ~18% | 238 | 44+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, ATo+, KJo+ |
| HJ | ~23% | 310 | 22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, ATo+, KTo+, QTo+ |
| CO | ~29% | 386 | 22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, A8o+, A5o, KTo+, QTo+, JTo |
| BTN | ~44% | 586 | 22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o |
| SB (raise-only version) | ~37% | 494 | 22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A2o+, K9o+, QTo+, JTo |

**Why the ranges widen:** fewer players are left to act behind you, so you're less likely to run into a strong hand. Later positions will also be **in position** postflop, so they realize more equity. And the blinds you can steal are a larger share of what's at stake.

**Why suited hands and small pairs are in the ranges but weak offsuit hands aren't:** suited and connected hands have high **playability** (equity realization plus implied odds). Offsuit hands like K7o are mostly dominated (reverse implied odds).

### 5.2 Sizing
| Situation | Size | Why |
|---|---|---|
| Open (UTG–BTN) | 2.0–2.5bb (live: 3bb) | Small risk; still builds a pot with a range advantage |
| Open from SB | 3bb | Out of position for the whole hand, so charge the BB more |
| Isolating limpers | 3bb + 1bb per limper | Get heads-up, in position, against a weak range |
| 3-bet in position | ~3× the open | |
| 3-bet out of position | ~3.5–4× the open | Lowers the SPR and denies position |
| 4-bet | ~2.2–2.5× the 3-bet | |
| ≤ ~20bb effective | Shove or fold (push/fold Nash charts) | Small raises commit you anyway |

### 5.3 Facing an open
- **3-bet ranges.** Against early-position opens they're mostly **linear** (the strongest hands plus a few blocker bluffs): QQ+, AK, AQs, A5s–A4s, KQs. Against late-position opens they're **polarized**: strong value (TT+, AQ+) plus suited bluffs with blockers or playability (A5s–A2s, K9s, 76s, 65s).
- **Flatting (calling)** fits hands that play well postflop but don't want a bigger pot: medium pairs and suited broadways. It's used mostly from BTN and BB.
- **Big blind defense.** The BB has already paid 1bb and closes the action, so against a 2.5bb BTN open it calls 1.5 to win 4. That needs about 27% raw equity, and many hands have it. The BB defends **~60%+** of hands against a button open: ~50% calls plus ~10–13% 3-bets.
- **Small blind** in modern solver play mostly 3-bets or folds (little flatting), because a call can be squeezed by the BB.

### 5.4 Facing a 3-bet (as the opener)
4-bet for value with QQ+/AK (KK+/AK against tight players) and some bluffs that block AA/AK, such as A5s. Call with hands that play well in position (TT–77, AQs, KQs, suited broadways). Fold most offsuit hands and the bottom of the range. You should continue against a 3-bet with roughly **35–45%** of your opening range. If you fold more, everyone can 3-bet you light.

### 5.5 Tournaments
- **Short stacks (under ~15bb).** Shove/fold strategy is effectively solved through Nash push/fold charts (e.g. HoldemResources Calculator).
- **ICM.** Chips aren't linear money near the bubble or at final tables, so calling ranges tighten sharply. A tournament engine needs an ICM layer that converts stacks to $EV.

---

## 6. Postflop strategy

### 6.1 Think in ranges
Before choosing an action, answer three questions:
1. **Range advantage.** Whose range has more total equity on this board?
2. **Nut advantage.** Who has more of the *very strongest* hands (sets, two pair, nut straight)? Nut advantage justifies **big bets and overbets**. A range advantage without a nut advantage justifies **small, frequent bets**.
3. **Where your hand sits in your range.** It's one of **value / medium (bluff-catcher) / draw / air**.

### 6.2 Hand classes and default actions
| Class | Examples | Default |
|---|---|---|
| Nuts / strong value | Sets, two pair, overpairs on dry boards | Bet. Build the pot, often with geometric sizing. Slowplay only when you block their continuing range or the board is dry and you have most of the nuts |
| Thin value | Top pair with a weak kicker, second pair on dry boards | Small bets, or check-call |
| Bluff-catchers | Middle pair, weak top pair late in the hand | Check; call bets according to MDF, pot odds and blockers |
| Strong draws | Flush draw + overcards, combo draws | **Semi-bluff**: bet or raise. You win when they fold *and* when you hit |
| Weak draws / backdoors | Gutshots, backdoor flush draws | Mixed: these are the best pure bluffs on the flop and turn |
| Air | No pair, no draw | Bluff only with **good blockers** (you hold cards that make their calls less likely) **and unblockers** (you don't hold cards from their folding range). Otherwise give up |

### 6.3 Flop c-bet tendencies from solvers (single-raised pot, opener in position, 100bb)
These are general solver tendencies, not exact frequencies:

| Board type | Example | Who it favors | Typical solver plan |
|---|---|---|---|
| Dry, high card | A♠7♦2♣, K♥8♦3♠ | Preflop raiser (more Ax/Kx, overpairs) | **Bet very often (70–100%), small (25–33%)** |
| Broadway, two-tone | K♥Q♥6♠ | Raiser, but connected | Medium frequency, mixed sizes |
| Middling, connected | 9♠8♦6♣, 7♥6♥5♠ | **Caller** (more two pairs, straights, sets) | **Check much more**; when betting, use larger, polarized sizes |
| Low and dry | 7♦4♣2♠ | Raiser has overpairs | Frequent, small to medium bets |
| Monotone | J♠8♠3♠ | Neutral; nuts are spread out | Small sizes, high frequency; avoid bloating the pot |
| Paired | T♣T♦4♠ | Raiser | Very high frequency, very small |

**Turn:** ranges are narrower and more polarized, so sizes grow (66–125%, and overbets when the turn card hits your range's nut advantage). Keep betting ("barrel") with value, with draws that picked up equity, and with blockers. Slow down with medium hands.

**River:** no more cards are coming, so there's no equity left to deny. Bet **polarized**: strong value plus bluffs in the ratio from §4.4. Medium hands check and bluff-catch. Choose bluffs by blockers: missed draws that block nothing of the caller's range are the best bluffs. Holding a card that blocks their calls is a reason to bluff. Holding a card that blocks their folds is a reason not to.

### 6.4 Out of position (facing a c-bet)
- **Check-raise** with your nutted hands *and* with strong draws: you need bluffs or semi-bluffs so your raises aren't transparent. This is most effective on boards that favor the caller.
- **Donk-bet** (leading into the preflop raiser) only on turns or rivers that shift the nut advantage to you, e.g. a 4th card to a straight that the caller's range hits more often.
- Against small c-bets (25–33%), MDF is 75–80%, so defend wide, including gutshots and backdoor draws.

---

## 7. Bet sizing cheat sheet

| Goal | Size |
|---|---|
| Range-bet on a dry board where you have a range advantage | 25–33% |
| Charge draws / protect a vulnerable made hand | 50–75% |
| Polarized value + bluffs, nut advantage, turn/river | 75–150% |
| Get all-in by the river with the nuts | Geometric (§4.5) |
| Thin value on the river | 25–50%: a bigger bet gets called only by hands that beat you |
| Bluff | The **same size** you'd use for value in that spot, so you aren't readable |

Rule: **choose the size for your range, then pick which hands go in it.** Using one size for both value and bluffs is what makes you unexploitable.

---

## 8. Exploitative adjustments: where the money actually comes from

GTO is the baseline. Profit comes from deviating when opponents deviate. Commonly reported tendencies at low and mid stakes (verify against your own database):

| Population leak | Counter-exploit |
|---|---|
| Under-bluff the river, especially with big bets and raises | **Overfold** bluff-catchers against big river bets and raises (fold more than MDF) |
| Call too much (calling stations) | Stop bluffing, value-bet thinner and larger |
| Fold too much to 3-bets / c-bets | 3-bet and c-bet more often, including as bluffs |
| Limp preflop | Isolation raises with a wide, linear range |
| Passive postflop (check-call, rarely raise) | Their raises mean the nuts: fold. Barrel more when they just call |
| Tilt / short attention | Value-bet larger |

To exploit reliably, the engine needs **opponent modelling**. HUD stats (VPIP, PFR, 3-bet %, fold-to-c-bet, WTSD, AF) estimate their ranges. Feed those **narrowed ranges** into the solver ("node locking") to compute the maximally exploitative response. Exploiting someone also opens you to being exploited, so deviate in proportion to the confidence (sample size) in the read.

---

## 9. Building the engine (architecture)

```
 Hand history / live state ──► Game-state model (positions, stacks, pot, action sequence)
                                   │
                ┌──────────────────┼────────────────────────────┐
                ▼                  ▼                            ▼
        Range estimator     Hand evaluator              Opponent model (HUD stats,
        (preflop charts →    (7-card lookup:             priors → range adjustments)
         Bayesian updates     ~100M+ evals/s)                   │
         per action)               │                            │
                └──────────────────┼────────────────────────────┘
                                   ▼
                     Solver: CFR (DCFR / CFR+) on the subgame
                     ranges × board × stack × bet-size abstraction
                                   │
                                   ▼
               Strategy + EV of EVERY action for EVERY hand in the range
                                   │
                                   ▼
        Explanation layer: compare the player's action to the best action:
          EV loss (bb) → grade: Best / Good / Inaccuracy / Mistake / Blunder
          + reasons: pot odds, MDF, equity vs range, blockers, range/nut advantage, SPR
```

### 9.1 The algorithm: Counterfactual Regret Minimization (CFR)
- Repeatedly play the game against itself. At each decision, track **regret**: how much better each alternative action would have done. Then play actions in proportion to positive regret. The **average** strategy converges to a Nash equilibrium in two-player zero-sum games.
- Variants: **CFR+** (Tammelin, 2014; used by Cepheus to solve heads-up limit), **Discounted CFR** (Brown & Sandholm, 2019; the current default in many solvers), and **Monte Carlo CFR** (sampling, for huge games).
- Stopping criterion: **exploitability**, i.e. how much a perfect counter-strategy could win. Commercial solvers target about 0.3–0.5% of the pot.

### 9.2 Making it tractable
- **Action abstraction.** Allow only a few sizes, e.g. 33%, 75%, 125% and all-in, instead of every chip amount.
- **Card abstraction / isomorphism.** Merge suit-equivalent boards (1,755 flops). Some systems bucket similar hands.
- **Subgame / real-time solving.** Solve only the current spot, with ranges derived from earlier actions. Libratus, DeepStack and ReBeL all do this.
- **Preflop.** Precompute once (full preflop solves take hours to days) and store the result as charts. That's what `data/preflop_ranges.json` stands in for.
- **Multiway.** CFR has no equilibrium guarantee with 3 or more players, but Pluribus showed it still produces superhuman play. In practice most multiway spots are handled heuristically or with simplified solves.

### 9.3 Don't write a solver from scratch first
Open-source solvers you can embed or study:
- **TexasSolver** (C++, fast, CLI and GUI, with a GPU version). Free for personal use; commercial use needs a licence or is AGPL ([bupticybee/TexasSolver](https://github.com/bupticybee/TexasSolver), [yffbit/TexasSolver](https://github.com/yffbit/TexasSolver)).
- **postflop-solver** (Rust, Discounted CFR, no abstraction) and **Desktop Postflop** (GUI). Development was suspended in Oct 2023, but the code is a clean reference ([b-inary/postflop-solver](https://www.github.com/b-inary/postflop-solver)).
- Hand evaluators: the **"2+2" 7-card lookup table**, **OMPEval** (C++), **phevaluator** (C/Python).

### 9.4 The "chess-engine" grading model
A chess engine reports centipawn loss. The poker equivalent is **EV loss in big blinds (or % of pot)**:
```
EV_loss = EV(best action) − EV(action taken)          (from the solver)
Accuracy grade by EV_loss as % of pot:
   0–1%   Best / Excellent
   1–3%   Good (inaccuracy)
   3–10%  Mistake
   >10%   Blunder
```
Mixed strategies need special handling. If the solver bets a hand 40% and checks 60%, **both actions are correct** (EV loss ≈ 0). Grade by EV loss, not by "did you pick the most frequent action".

### 9.5 MVP roadmap
1. ✅ Hand evaluator + equity calculator (`engine/evaluator.py`, `engine/equity.py`)
2. ✅ Preflop equity table for all 169 hands vs 1–8 opponents (`data/preflop_equity.csv`)
3. ✅ Preflop RFI / 3-bet / defend ranges (approximate) (`data/preflop_ranges.json`)
4. ✅ Spot advisor with explanations: pot odds, MDF, equity vs range, best bet size by EV (`engine/advisor.py`)
5. ⬜ Hand-history parser (PokerStars / GGPoker text format) → game-state replay
6. ⬜ Range tracker: narrow ranges through each action, using preflop charts plus postflop solver frequencies
7. ⬜ Embed TexasSolver / postflop-solver for exact postflop strategies and per-action EVs
8. ⬜ Swap in a fast evaluator (the Python one does ~300k evals/s; a lookup-table evaluator does 100M+)
9. ⬜ UI: replay the hand street by street, showing "you did X (EV −2.3bb); the best play was Y because …"
10. ⬜ Opponent modelling + node locking for exploitative suggestions

---

## 10. Bankroll and variance (so the edge actually turns into money)

- 6-max No-Limit Hold'em has a high **standard deviation**, roughly **80–120 bb/100 hands**. A solid winner at a few bb/100 can run below expectation for **tens of thousands of hands**.
- Bankroll guidelines: **30–50 buy-ins** for cash games, **100+** for tournaments (higher variance). Move down when you drop below the minimum.
- The **Kelly criterion** formally maximises long-run growth: risk a fraction of the bankroll proportional to edge / variance. Poker win rates are small relative to variance, so Kelly-optimal stakes are low, which is consistent with the buy-in rules above.
- **Track rake.** Win rate after rake is the only one that pays.
- Judge decisions by **EV, not results**. That's exactly what the engine's grading is for.

---

## 11. Using what's in this repo

```bash
# Equity: hand vs hand, optional board
python3 engine/equity.py hand AhKh QsQd
python3 engine/equity.py hand AhKh QsQd --board 2h7hJc
python3 engine/equity.py hand AhKh --vs-random 3

# Regenerate the 169-hand table (~2 min on 8 cores)
python3 engine/equity.py table

# Facing a bet: fold / call / raise with reasons
python3 engine/advisor.py facing --hero AhQh --board Kh7h2c --pot 10 --bet 7 --stack 90 \
   --villain "TT+,AQs+,AKo,KQs,KJs,K7s,77,22,QhJh,JhTh"

# Choosing a bet size: compares EV of check vs 25%..150% + geometric
python3 engine/advisor.py bet --hero AsKd --board Ks8d3c --pot 6.5 --stack 97.5 \
   --villain "22-JJ,A2s-AQs,K2s+,Q6s+,J7s+,T7s+,97s+,86s+,75s+,64s+,54s,A2o-AJo,K9o+,QTo+,JTo" \
   --hero-range "22+,A2s+,K2s+,Q4s+,J6s+,T6s+,96s+,85s+,74s+,63s+,53s+,43s,A2o+,K8o+,Q9o+,J9o+,T9o,98o"
```

**Known limits of the advisor:** it's a one-street best-response model, not a solver. Villain's response is modelled as calling whenever their equity against your range beats their pot odds. Future streets are approximated with a realization factor. It explains the logic correctly, but its exact sizes can differ from a full CFR solve (for example, it tends to favour large bets with strong hands where solvers often mix small sizes across the whole range). Step 7 of the roadmap replaces the numbers with solver output and keeps the explanations.

---

## 12. References

**Game-theory / AI milestones**
- Zinkevich, Johanson, Bowling, Piccione (2007). *Regret Minimization in Games with Incomplete Information* (CFR). NeurIPS.
- Lanctot et al. (2009). *Monte Carlo Sampling for Regret Minimization in Extensive Games*. NeurIPS.
- Tammelin (2014). *Solving Large Imperfect Information Games Using CFR+*.
- Bowling, Burch, Johanson, Tammelin (2015). *Heads-up Limit Hold'em Poker is Solved*. Science.
- Moravčík et al. (2017). *DeepStack: Expert-Level AI in Heads-Up No-Limit Poker*. Science.
- Brown & Sandholm (2017). *Superhuman AI for heads-up no-limit poker: Libratus beats top professionals*. Science.
- Brown & Sandholm (2019). *Solving Imperfect-Information Games via Discounted Regret Minimization*. AAAI.
- Brown & Sandholm (2019). *Superhuman AI for multiplayer poker* (Pluribus). Science.
- Brown et al. (2020). *Combining Deep RL and Search for Imperfect-Information Games* (ReBeL). NeurIPS.

**Strategy books**
- Sklansky, *The Theory of Poker*: EV, pot odds, the Fundamental Theorem.
- Chen & Ankenman, *The Mathematics of Poker*: indifference, optimal bluffing ratios, toy games.
- Janda, *Applications of No-Limit Hold'em*: range-based play, MDF.
- Acevedo, *Modern Poker Theory*: solver-based GTO for NLHE.

**Tools / code**
- [b-inary/postflop-solver](https://www.github.com/b-inary/postflop-solver) · [bupticybee/TexasSolver](https://github.com/bupticybee/TexasSolver) · [yffbit/TexasSolver](https://github.com/yffbit/TexasSolver) · [JoakimMich/opensolver](https://github.com/JoakimMich/opensolver/blob/main/README.md)
- Range-width comparisons: [online6maxcash](https://online6maxcash.pages.dev/), [deucescracked HJ/CO guide](https://www.deucescracked.com/blog/poker-hijack-cutoff-opening-ranges-6max-guide-2026), [replaypoker forum thread](https://forums.replaypoker.com/t/memorizing-open-raising-ranges-excl-sb-bb/49137)
