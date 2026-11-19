"""
7-card Texas Hold'em hand evaluator (pure Python, no dependencies).

Cards are ints 0..51:  rank = card // 4  (0 = deuce ... 12 = ace)
                       suit = card % 4   (0..3)

evaluate7(cards) -> int score. Higher score = better hand. Equal = split.
Score layout: category << 20 | kicker bits (5 x 4-bit ranks).

Categories: 8 straight flush, 7 quads, 6 full house, 5 flush, 4 straight,
            3 trips, 2 two pair, 1 one pair, 0 high card.

For a production engine replace this with a lookup-table evaluator
(e.g. the "2+2" 7-card table, OMPEval, or phevaluator), which is ~100x faster.
"""

RANKS = "23456789TJQKA"
SUITS = "cdhs"
CATEGORY_NAMES = ["High card", "One pair", "Two pair", "Three of a kind", "Straight",
                  "Flush", "Full house", "Four of a kind", "Straight flush"]


def card(s: str) -> int:
    """'As' -> int"""
    return RANKS.index(s[0].upper()) * 4 + SUITS.index(s[1].lower())


def card_str(c: int) -> str:
    return RANKS[c // 4] + SUITS[c % 4]


# Pre-compute: highest straight in a 13-bit rank mask (-1 if none). Wheel A-5 => rank 3 (five-high).
_STRAIGHT_HIGH = [-1] * (1 << 13)
for _m in range(1 << 13):
    for _hi in range(12, 3, -1):
        _need = 0b11111 << (_hi - 4)
        if _m & _need == _need:
            _STRAIGHT_HIGH[_m] = _hi
            break
    else:
        if _m & 0b1000000001111 == 0b1000000001111:  # A,2,3,4,5
            _STRAIGHT_HIGH[_m] = 3


def _kick(ranks):
    v = 0
    for r in ranks[:5]:
        v = (v << 4) | r
    # left-align so different-length kicker lists compare correctly
    return v << (4 * (5 - min(5, len(ranks))))


def evaluate7(cards) -> int:
    rank_counts = [0] * 13
    suit_counts = [0, 0, 0, 0]
    suit_masks = [0, 0, 0, 0]
    rank_mask = 0
    for c in cards:
        r = c >> 2
        s = c & 3
        rank_counts[r] += 1
        suit_counts[s] += 1
        suit_masks[s] |= 1 << r
        rank_mask |= 1 << r

    # Flush / straight flush
    for s in range(4):
        if suit_counts[s] >= 5:
            m = suit_masks[s]
            sh = _STRAIGHT_HIGH[m]
            if sh >= 0:
                return (8 << 20) | (sh << 16)
            fr = [r for r in range(12, -1, -1) if m >> r & 1]
            return (5 << 20) | _kick(fr)

    quads, trips, pairs, singles = [], [], [], []
    for r in range(12, -1, -1):
        n = rank_counts[r]
        if n == 4:
            quads.append(r)
        elif n == 3:
            trips.append(r)
        elif n == 2:
            pairs.append(r)
        elif n == 1:
            singles.append(r)

    if quads:
        q = quads[0]
        rest = max([r for r in range(13) if rank_counts[r] and r != q])
        return (7 << 20) | _kick([q, rest])
    if trips and (len(trips) > 1 or pairs):
        t = trips[0]
        p = max(trips[1:] + pairs)
        return (6 << 20) | _kick([t, p])
    sh = _STRAIGHT_HIGH[rank_mask]
    if sh >= 0:
        return (4 << 20) | (sh << 16)
    if trips:
        return (3 << 20) | _kick([trips[0]] + singles[:2])
    if len(pairs) >= 2:
        p1, p2 = pairs[0], pairs[1]
        k = max([r for r in singles + pairs[2:]])
        return (2 << 20) | _kick([p1, p2, k])
    if pairs:
        return (1 << 20) | _kick([pairs[0]] + singles[:3])
    return _kick(singles[:5])


def category(score: int) -> str:
    return CATEGORY_NAMES[score >> 20]


if __name__ == "__main__":
    # sanity tests
    def ev(s):
        return evaluate7([card(x) for x in s.split()])
    tests = [
        ("As Ks Qs Js Ts 2d 3c", "Straight flush"),
        ("As Ad Ah Ac Ks 2d 3c", "Four of a kind"),
        ("As Ad Ah Kc Ks 2d 3c", "Full house"),
        ("2s 7s 9s Js Ks Ad Ac", "Flush"),
        ("As 2d 3h 4c 5s 9d Kc", "Straight"),
        ("7s 7d 7h Kc 2s 9d 3c", "Three of a kind"),
        ("7s 7d Kh Kc 2s 9d 3c", "Two pair"),
        ("7s 7d Ah Kc 2s 9d 3c", "One pair"),
        ("As Jd 9h 7c 5s 3d 2c", "High card"),
    ]
    for hand, want in tests:
        got = category(ev(hand))
        assert got == want, (hand, got, want)
    assert ev("As Ks Qs Js Ts 2d 3c") > ev("Ks Qs Js Ts 9s 2d 3c")
    assert ev("As 2d 3h 4c 5s 9d Kc") < ev("2s 3d 4h 5c 6s 9d Kc")  # wheel < six-high
    assert ev("As Ad Kh Kc Qs Qd 2c") == ev("As Ad Kh Kc Qs 2d 3c")  # 3rd pair doesn't play
    assert ev("Ah Ad 9c 8c 7c 4s 2s") > ev("Ah Ad 9c 8c 6c 4s 2s")    # kicker
    print("evaluator: all tests passed")
