// Card Renderer — pure HTML/CSS card components
const CardRenderer = {
    SUIT_SYMBOLS: {
        hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠'
    },

    SUIT_COLORS: {
        hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black'
    },

    createCard(card, faceUp = true, animate = false) {
        const el = document.createElement('div');
        el.className = 'card';

        if (!card || !faceUp) {
            el.classList.add('card-back');
            if (animate) el.classList.add('card-deal');
            return el;
        }

        el.classList.add('card-front', this.SUIT_COLORS[card.suit]);
        if (animate) el.classList.add('card-reveal');

        const symbol = this.SUIT_SYMBOLS[card.suit];
        const rank = card.rank === '10' ? '10' : card.rank;

        el.innerHTML = `
      <span class="card-rank">${rank}</span>
      <span class="card-suit">${symbol}</span>
      <span class="card-rank-bottom">${rank}</span>
    `;

        return el;
    },

    createCardBack(animate = false) {
        return this.createCard(null, false, animate);
    },

    formatChips(amount) {
        if (amount >= 1000) return (amount / 1000).toFixed(1) + 'k';
        return amount.toString();
    }
};
