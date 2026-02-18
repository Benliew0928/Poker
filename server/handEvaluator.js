const RANK_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_NAMES = [
    'High Card', 'One Pair', 'Two Pair', 'Three of a Kind',
    'Straight', 'Flush', 'Full House', 'Four of a Kind',
    'Straight Flush', 'Royal Flush'
];

function evaluateFiveCards(cards) {
    const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
    const values = sorted.map(c => RANK_VALUES[c.rank]);

    const isFlush = sorted.every(c => c.suit === sorted[0].suit);

    let isStraight = false;
    let straightHigh = 0;
    if (values[0] - values[4] === 4 && new Set(values).size === 5) {
        isStraight = true;
        straightHigh = values[0];
    }
    if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
        isStraight = true;
        straightHigh = 5;
    }

    const counts = {};
    for (const v of values) counts[v] = (counts[v] || 0) + 1;
    const groups = Object.entries(counts)
        .map(([rank, count]) => ({ rank: parseInt(rank), count }))
        .sort((a, b) => b.count - a.count || b.rank - a.rank);

    if (isFlush && isStraight) {
        if (straightHigh === 14) return { rank: 9, tiebreaker: [14], name: 'Royal Flush' };
        return { rank: 8, tiebreaker: [straightHigh], name: 'Straight Flush' };
    }
    if (groups[0].count === 4) {
        return { rank: 7, tiebreaker: [groups[0].rank, groups[1].rank], name: 'Four of a Kind' };
    }
    if (groups[0].count === 3 && groups[1].count === 2) {
        return { rank: 6, tiebreaker: [groups[0].rank, groups[1].rank], name: 'Full House' };
    }
    if (isFlush) {
        return { rank: 5, tiebreaker: values, name: 'Flush' };
    }
    if (isStraight) {
        return { rank: 4, tiebreaker: [straightHigh], name: 'Straight' };
    }
    if (groups[0].count === 3) {
        return { rank: 3, tiebreaker: [groups[0].rank, ...groups.slice(1).map(g => g.rank)], name: 'Three of a Kind' };
    }
    if (groups[0].count === 2 && groups[1].count === 2) {
        const pairs = [groups[0].rank, groups[1].rank].sort((a, b) => b - a);
        return { rank: 2, tiebreaker: [...pairs, groups[2].rank], name: 'Two Pair' };
    }
    if (groups[0].count === 2) {
        return { rank: 1, tiebreaker: [groups[0].rank, ...groups.slice(1).map(g => g.rank)], name: 'One Pair' };
    }
    return { rank: 0, tiebreaker: values, name: 'High Card' };
}

function getCombinations(arr, k) {
    const result = [];
    function bt(start, combo) {
        if (combo.length === k) { result.push([...combo]); return; }
        for (let i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            bt(i + 1, combo);
            combo.pop();
        }
    }
    bt(0, []);
    return result;
}

function evaluateHand(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    const combos = getCombinations(allCards, 5);
    let best = null;
    for (const combo of combos) {
        const result = evaluateFiveCards(combo);
        if (!best || compareHands(result, best) > 0) best = result;
    }
    return best;
}

function compareHands(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    for (let i = 0; i < Math.min(a.tiebreaker.length, b.tiebreaker.length); i++) {
        if (a.tiebreaker[i] !== b.tiebreaker[i]) return a.tiebreaker[i] - b.tiebreaker[i];
    }
    return 0;
}

module.exports = { evaluateHand, compareHands, HAND_NAMES };
