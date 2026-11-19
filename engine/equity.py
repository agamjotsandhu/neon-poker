"""
Equity calculator + preflop equity table generator.

  python3 engine/equity.py table            # builds data/preflop_equity.csv (169 hands x 1..8 opponents)
  python3 engine/equity.py hand AhKh QsQd   # equity of hand(s) vs each other, optional --board
  python3 engine/equity.py hand AhKh --vs-random 3 --board 2h7hJc

Equity = share of the pot you'd win on average if all hands went to showdown
(ties split). It is NOT the same as expected value: see the research doc,
section "Equity vs EV".
"""
import csv
import os
import random
import sys
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(__file__))
from evaluator import RANKS, card, card_str, evaluate7  # noqa: E402

DECK = list(range(52))


def hand_classes():
    """The 169 strategically distinct starting hands, strongest-looking first."""
    out = []
    for i in range(12, -1, -1):
        for j in range(12, -1, -1):
            if i == j:
                out.append(RANKS[i] * 2)
            elif i > j:
                out.append(RANKS[i] + RANKS[j] + "s")
            else:
                out.append(RANKS[j] + RANKS[i] + "o")
    return list(dict.fromkeys(out))


def class_combos(hc):
    """All concrete 2-card combos for a class like 'AKs' (4), 'AKo' (12), 'TT' (6)."""
    r1, r2 = RANKS.index(hc[0]), RANKS.index(hc[1])
    combos = []
    for s1 in range(4):
        for s2 in range(4):
            a, b = r1 * 4 + s1, r2 * 4 + s2
            if len(hc) == 2:
                if s1 < s2:
                    combos.append((a, b))
            elif hc[2] == "s" and s1 == s2:
                combos.append((a, b))
            elif hc[2] == "o" and s1 != s2:
                combos.append((a, b))
    return combos


def equity_vs_random(hole, n_opp, trials, board=(), seed=None):
    """Monte Carlo equity of `hole` against n_opp uniformly random hands."""
    rng = random.Random(seed)
    dead = set(hole) | set(board)
    deck = [c for c in DECK if c not in dead]
    need_board = 5 - len(board)
    board = list(board)
    hole = list(hole)
    total = 0.0
    for _ in range(trials):
        draw = rng.sample(deck, need_board + 2 * n_opp)
        b = board + draw[:need_board]
        mine = evaluate7(hole + b)
        best_opp = -1
        ties = 0
        for k in range(n_opp):
            o = need_board + 2 * k
            v = evaluate7([draw[o], draw[o + 1]] + b)
            if v > best_opp:
                best_opp, ties = v, (1 if v == mine else 0)
            elif v == best_opp and v == mine:
                ties += 1
        if mine > best_opp:
            total += 1.0
        elif mine == best_opp:
            total += 1.0 / (ties + 1)
    return total / trials


def equity_hands(hands, board=(), trials=50000, seed=1):
    """Equity of specific hands vs each other (Monte Carlo, or exact if river)."""
    rng = random.Random(seed)
    dead = set(c for h in hands for c in h) | set(board)
    deck = [c for c in DECK if c not in dead]
    need = 5 - len(board)
    eq = [0.0] * len(hands)
    for _ in range(trials):
        b = list(board) + rng.sample(deck, need)
        vals = [evaluate7(list(h) + b) for h in hands]
        best = max(vals)
        winners = [i for i, v in enumerate(vals) if v == best]
        for i in winners:
            eq[i] += 1.0 / len(winners)
    return [e / trials for e in eq]


def _job(args):
    hc, n_opp, trials = args
    combos = class_combos(hc)
    # Use one representative combo per class (equity is suit-symmetric preflop),
    # but rotate representatives to wash out any RNG artifacts.
    per = max(1, trials // len(combos))
    tot = 0.0
    for i, c in enumerate(combos):
        tot += equity_vs_random(c, n_opp, per, seed=hash((hc, n_opp, i)) & 0xFFFFFFFF)
    return hc, n_opp, tot / len(combos)


def build_table(trials_hu=60000, trials_multi=24000, max_opp=8, out="data/preflop_equity.csv"):
    classes = hand_classes()
    jobs = []
    for n in range(1, max_opp + 1):
        t = trials_hu if n == 1 else trials_multi
        jobs += [(hc, n, t) for hc in classes]
    res = {}
    with Pool() as p:
        for i, (hc, n, e) in enumerate(p.imap_unordered(_job, jobs, chunksize=4)):
            res[(hc, n)] = e
            if i % 100 == 0:
                print(f"{i}/{len(jobs)}", flush=True)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    rows = []
    for hc in classes:
        rows.append([hc, len(class_combos(hc))] + [round(100 * res[(hc, n)], 2) for n in range(1, max_opp + 1)])
    rows.sort(key=lambda r: -r[2])
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["hand", "combos"] + [f"vs{n}" for n in range(1, max_opp + 1)] + ["rank_hu"])
        for i, r in enumerate(rows, 1):
            w.writerow(r + [i])
    print(f"wrote {out}")


def _parse_cards(s):
    return tuple(card(s[i:i + 2]) for i in range(0, len(s), 2))


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "table":
        build_table()
    elif len(sys.argv) >= 3 and sys.argv[1] == "hand":
        args = sys.argv[2:]
        board = ()
        vs_random = None
        if "--board" in args:
            i = args.index("--board")
            board = _parse_cards(args[i + 1])
            args = args[:i] + args[i + 2:]
        if "--vs-random" in args:
            i = args.index("--vs-random")
            vs_random = int(args[i + 1])
            args = args[:i] + args[i + 2:]
        hands = [_parse_cards(a) for a in args]
        if vs_random:
            e = equity_vs_random(hands[0], vs_random, 100000, board, seed=7)
            print(f"{args[0]} vs {vs_random} random: {100 * e:.2f}%")
        else:
            for a, e in zip(args, equity_hands(hands, board)):
                print(f"{a}: {100 * e:.2f}%")
    else:
        print(__doc__)
