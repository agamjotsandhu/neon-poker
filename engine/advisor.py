"""
Spot advisor: the "explain why" layer of the engine.

This is NOT a solver. It applies the exact pot-odds / MDF / geometric-sizing
math from the research doc, plus Monte Carlo equity against a villain RANGE,
and returns a recommendation with every number that drove it.

A real GTO answer comes from a CFR solver (see research doc section 9);
this module is what turns a solver's (or this heuristic's) output into
human-readable reasons.

Usage examples:
  python3 engine/advisor.py facing --hero AhQh --board Kh7h2c --pot 10 --bet 7 --stack 90 --villain "TT+,AQs+,AKo,KQs,KJs,K7s,77,22,QhJh,JhTh"
  python3 engine/advisor.py bet --hero AsKd --board Ks8d3c --pot 6.5 --stack 97.5 --streets 3 --villain "22-JJ,A2s-AQs,K9s+,QTs+,JTs,T9s,98s,ATo-AQo,KTo+,QJo"
"""
import argparse
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from evaluator import RANKS, card, card_str, category, evaluate7  # noqa: E402

# ---------------------------------------------------------------- ranges

def _combos_for(token):
    """'AKs' / 'AKo' / 'AK' / 'TT' / 'AhKh' -> list of (c1, c2)"""
    if len(token) == 4:  # exact combo
        return [(card(token[:2]), card(token[2:]))]
    r1, r2 = RANKS.index(token[0]), RANKS.index(token[1])
    kind = token[2] if len(token) == 3 else ""
    out = []
    for s1 in range(4):
        for s2 in range(4):
            a, b = r1 * 4 + s1, r2 * 4 + s2
            if r1 == r2:
                if s1 < s2:
                    out.append((a, b))
            elif kind == "s" and s1 == s2 or kind == "o" and s1 != s2 or kind == "" and True:
                out.append((a, b))
    return out


def parse_range(text):
    """Supports: 22+  TT  77-JJ  A2s+  K9s+  ATo+  KQ  A2s-A5s  AhKh (exact combos)."""
    combos = set()
    for tok in [t.strip() for t in text.split(",") if t.strip()]:
        if "-" in tok:
            lo, hi = tok.split("-")
            if lo[0] == lo[1]:  # pair range 77-JJ
                a, b = sorted([RANKS.index(lo[0]), RANKS.index(hi[0])])
                for r in range(a, b + 1):
                    combos.update(_combos_for(RANKS[r] * 2))
            else:  # A2s-A5s
                hi_r = lo[0]
                suf = lo[2:] if len(lo) > 2 else ""
                a, b = sorted([RANKS.index(lo[1]), RANKS.index(hi[1])])
                for r in range(a, b + 1):
                    combos.update(_combos_for(hi_r + RANKS[r] + suf))
        elif tok.endswith("+"):
            t = tok[:-1]
            if t[0] == t[1]:  # 22+
                for r in range(RANKS.index(t[0]), 13):
                    combos.update(_combos_for(RANKS[r] * 2))
            else:  # A2s+ : raise the lower card up to just below the top card
                top = RANKS.index(t[0])
                suf = t[2:]
                for r in range(RANKS.index(t[1]), top):
                    combos.update(_combos_for(t[0] + RANKS[r] + suf))
        else:
            combos.update(_combos_for(tok))
    return [tuple(sorted(c)) for c in combos]


# ---------------------------------------------------------------- equity

def equity_vs_range(hero, villain_combos, board, trials=20000, seed=11):
    rng = random.Random(seed)
    dead = set(hero) | set(board)
    live = [c for c in villain_combos if c[0] not in dead and c[1] not in dead]
    if not live:
        raise ValueError("villain range is empty after card removal")
    need = 5 - len(board)
    tot = 0.0
    for _ in range(trials):
        v = rng.choice(live)
        deck = [c for c in range(52) if c not in dead and c not in v]
        b = list(board) + rng.sample(deck, need)
        h, o = evaluate7(list(hero) + b), evaluate7(list(v) + b)
        tot += 1.0 if h > o else 0.5 if h == o else 0.0
    return tot / trials, len(live)


def strength_profile(combos, board):
    """What fraction of a range currently has each made-hand category (on a 5+ card board,
    otherwise uses the cards present). Used for 'nut advantage' explanations."""
    if len(board) < 3:
        return {}
    dead = set(board)
    prof = {}
    live = [c for c in combos if c[0] not in dead and c[1] not in dead]
    for c in live:
        cards = list(c) + list(board)
        # pad to 7 with impossible-to-help low cards is wrong; instead evaluate best 5 of available
        score = _eval_partial(cards)
        cat = category(score)
        prof[cat] = prof.get(cat, 0) + 1
    n = len(live) or 1
    return {k: v / n for k, v in sorted(prof.items(), key=lambda kv: -kv[1])}


def _eval_partial(cards):
    # evaluator expects 7 cards but works on 5-7: it only counts what's present
    return evaluate7(cards)


# ---------------------------------------------------------------- core poker math

def required_equity(pot_before_bet, bet, to_call=None):
    """Break-even equity to call: call / (final pot)."""
    to_call = bet if to_call is None else to_call
    return to_call / (pot_before_bet + bet + to_call)


def mdf(pot_before_bet, bet):
    """Minimum defense frequency: how often you must continue so a pure bluff can't auto-profit."""
    return pot_before_bet / (pot_before_bet + bet)


def bluff_breakeven(pot_before_bet, bet):
    """How often a bluff must work (alpha) to break even."""
    return bet / (pot_before_bet + bet)


def optimal_bluff_ratio(pot_before_bet, bet):
    """Fraction of a polarized river betting range that should be bluffs (GTO indifference)."""
    return bet / (pot_before_bet + 2 * bet)


def geometric_bet_fraction(pot, stack, streets):
    """Same pot-fraction each street so you're all-in on the last street."""
    return ((1 + 2 * stack / pot) ** (1 / streets) - 1) / 2


# ---------------------------------------------------------------- advisors

def advise_facing_bet(hero, villain, board, pot, bet, stack, realization=None):
    eq, n = equity_vs_range(hero, villain, board)
    need = required_equity(pot, bet)
    streets_left = {3: 2, 4: 1, 5: 0}.get(len(board), 3)
    # equity realization: OOP / weak hands realize less than raw equity on earlier streets
    if realization is None:
        realization = 1.0 if streets_left == 0 else 0.85 if streets_left == 1 else 0.75
    real_eq = eq * realization if eq < 0.5 else eq  # strong hands roughly realize >= equity
    final_pot = pot + 2 * bet
    ev_call = real_eq * final_pot - bet
    lines = [
        f"Your equity vs villain's range ({n} live combos): {eq:.1%}",
        f"Pot odds: call {bet:g} to win {pot + bet:g} -> need {need:.1%} equity  (call / final pot = {bet:g}/{final_pot:g})",
        f"MDF for defender: {mdf(pot, bet):.1%} of your range must continue so villain's bluffs don't auto-profit",
    ]
    if streets_left:
        lines.append(f"{streets_left} street(s) to come: assume you realize ~{realization:.0%} of raw equity "
                     f"when behind (can't always see showdown) -> effective {real_eq:.1%}")
    lines.append(f"EV(call) ~ {real_eq:.3f} x {final_pot:g} - {bet:g} = {ev_call:+.2f} chips  (EV(fold) = 0)")

    # raise check: strong equity vs range -> raise for value
    if eq > 0.70 and stack > bet * 2:
        raise_to = round(min(stack, bet * 3), 1)
        action = f"RAISE to ~{raise_to:g}"
        lines.append("Why raise: you are well ahead of the betting range; raising builds the pot "
                     "while worse hands can still pay, and denies equity to draws.")
    elif ev_call > 0:
        action = "CALL"
        lines.append("Why call: positive EV, but not far enough ahead to raise "
                     "(a raise would mostly fold out worse and get called by better).")
    else:
        action = "FOLD"
        lines.append(f"Why fold: equity {real_eq:.1%} < required {need:.1%}. "
                     "Calling loses money on average unless implied odds or a strong read change the picture.")
        if streets_left and eq > need * 0.75:
            lines.append("Close spot: with deep stacks and a concealed draw, implied odds may justify a call.")
    return action, lines


def _combo_strength(combo, opp_combos, board, rng, trials=200):
    """Equity of one combo vs a range on this board (captures made hands AND draws)."""
    dead = set(combo) | set(board)
    opp = [o for o in opp_combos if o[0] not in dead and o[1] not in dead]
    need = 5 - len(board)
    tot = 0.0
    for _ in range(trials):
        o = rng.choice(opp)
        deck = [c for c in range(52) if c not in dead and c not in o]
        b = list(board) + rng.sample(deck, need)
        a, v = evaluate7(list(combo) + b), evaluate7(list(o) + b)
        tot += 1.0 if a > v else 0.5 if a == v else 0.0
    return tot / trials


def advise_bet(hero, villain, board, pot, stack, streets, hero_range=None,
               sizes=(0.25, 0.33, 0.5, 0.75, 1.0, 1.5)):
    """Model (one-step best response): villain sees a bet of size B and continues with every
    combo whose equity vs YOUR RANGE beats their pot odds B/(pot+2B). We then compute EV of each
    size for your actual hand and compare to checking.
    EV(check) ~ equity x pot (ignores future betting - flagged in the output)."""
    rng = random.Random(5)
    dead = set(hero) | set(board)
    live = [c for c in villain if c[0] not in dead and c[1] not in dead]
    eq_all, n = equity_vs_range(hero, live, board, trials=8000)
    if hero_range is None:
        hero_range = [tuple(sorted(hero))]
        note = "No --hero-range given: villain is assumed to know your exact hand (worst case for bluffs)."
    else:
        note = f"Villain responds to your whole range ({len(hero_range)} combos), not your exact hand."
    vs = {c: _combo_strength(c, hero_range, board, rng) for c in live}
    geo = geometric_bet_fraction(pot, stack, streets)
    realize = 1.0 if streets <= 1 else 0.9
    ev_check = eq_all * pot * realize
    lines = [f"Equity vs villain's whole range ({n} live combos): {eq_all:.1%}", note,
             f"Geometric size to be all-in by the river over {streets} street(s): {geo:.0%} pot",
             f"EV(check) ~ {eq_all:.1%} x pot {pot:g}{' x 90% realization' if realize < 1 else ''} = {ev_check:.2f}"]
    best = ("CHECK", ev_check, None)
    for f in sorted(set(list(sizes) + [round(geo, 2)])):
        b = min(f * pot, stack)
        need = required_equity(pot, b) / (realize if streets > 1 else 1.0)
        callers = [c for c in live if vs[c] >= need]
        fold = 1 - len(callers) / len(live)
        if callers:
            eq_c, _ = equity_vs_range(hero, callers, board, trials=4000, seed=17)
        else:
            eq_c = 0.0
        ev = fold * pot + (1 - fold) * (eq_c * realize * (pot + 2 * b) - b)
        lines.append(f"  bet {f:>4.0%} ({b:5.1f}): villain folds {fold:4.0%}, your equity when called "
                     f"{eq_c:5.1%} -> EV {ev:+.2f}")
        if ev > best[1] + 0.01 * pot:
            best = (f"BET {f:.0%} pot ({b:.1f})", ev, (f, fold, eq_c))
    action = best[0]
    if best[2] is None:
        lines.append("Why check: no bet size beats checking. Betting folds out the hands you beat and gets "
                     "called by the hands that beat you (classic medium-strength or no-equity spot).")
    else:
        f, fold, eq_c = best[2]
        if eq_c >= 0.5:
            lines.append(f"Why bet {f:.0%}: this is a VALUE bet. Even after villain folds their worst {fold:.0%}, "
                         f"you still have {eq_c:.0%} against the hands that call.")
        else:
            lines.append(f"Why bet {f:.0%}: this is a BLUFF / SEMI-BLUFF. You're behind the calling range ({eq_c:.0%}) "
                         f"but villain folds {fold:.0%} (break-even needs {bluff_breakeven(pot, f * pot):.0%}).")
    lines.append("Caveat: villain best-responds to this street only, and future streets are approximated; "
                 "a CFR solver models the full tree. Use this for explanation, a solver for the final number.")
    return action, lines


def _cards(s):
    return tuple(card(s[i:i + 2]) for i in range(0, len(s), 2)) if s else ()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["facing", "bet"])
    ap.add_argument("--hero", required=True)
    ap.add_argument("--board", default="")
    ap.add_argument("--pot", type=float, required=True)
    ap.add_argument("--bet", type=float, default=0)
    ap.add_argument("--stack", type=float, required=True)
    ap.add_argument("--streets", type=int, default=None)
    ap.add_argument("--villain", required=True, help="range string, e.g. '22+,A2s+,KQo'")
    ap.add_argument("--hero-range", default=None, help="your range in this spot (bet mode)")
    a = ap.parse_args()
    hero, board = _cards(a.hero), _cards(a.board)
    vill = parse_range(a.villain)
    if a.mode == "facing":
        act, why = advise_facing_bet(hero, vill, board, a.pot, a.bet, a.stack)
    else:
        streets = a.streets or {0: 4, 3: 3, 4: 2, 5: 1}[len(board)]
        hr = parse_range(a.hero_range) if a.hero_range else None
        act, why = advise_bet(hero, vill, board, a.pot, a.stack, streets, hero_range=hr)
    print(f"\n>>> {act}\n")
    for w in why:
        print("  -", w)
    print()
