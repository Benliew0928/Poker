const Deck = require('./deck');
const { evaluateHand, compareHands } = require('./handEvaluator');

const PHASES = ['WAITING', 'PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
const SB = 1;
const BB = 2;
const STARTING_CHIPS = 400;

class GameEngine {
    constructor(onStateChange) {
        this.players = [];
        this.communityCards = [];
        this.deck = null;
        this.phase = 'WAITING';
        this.pot = 0;
        this.currentBet = 0;
        this.minRaise = BB;
        this.dealerIndex = -1;
        this.activePlayerIndex = -1;
        this.handNumber = 0;
        this.winners = null;
        this.showdownHands = {};
        this.onStateChange = onStateChange || (() => { });
        this.actionTimer = null;
        this.actionDeadline = null;
        this.startCountdown = null;
        this.roundBetsCollected = false;
        this.pendingPlayers = [];
        this.bustedPlayers = [];
        this.isDealing = false;
    }

    addPlayer(id, name) {
        const totalCount = this.players.length + this.pendingPlayers.length + this.bustedPlayers.length;
        if (totalCount >= 10) return 'full';
        if (this.players.find(p => p.id === id)) return 'exists';
        if (this.pendingPlayers.find(p => p.id === id)) return 'exists';

        // If hand is in progress, queue for next hand
        if (this.phase !== 'WAITING') {
            this.pendingPlayers.push({ id, name });
            return 'pending';
        }

        const seatIndex = this._nextSeat();
        this.players.push({
            id, name, chips: STARTING_CHIPS,
            holeCards: [], bet: 0, totalBet: 0,
            folded: false, allIn: false, hasActed: false,
            seatIndex, lastAction: null, isLeaving: false
        });
        return 'added';
    }

    rebuy(playerId) {
        const bustIdx = this.bustedPlayers.findIndex(p => p.id === playerId);
        if (bustIdx === -1) return false;

        const player = this.bustedPlayers[bustIdx];
        this.bustedPlayers.splice(bustIdx, 1);

        if (this.phase !== 'WAITING') {
            this.pendingPlayers.push({ id: player.id, name: player.name });
        } else {
            const seatIndex = this._nextSeat();
            this.players.push({
                id: player.id, name: player.name, chips: STARTING_CHIPS,
                holeCards: [], bet: 0, totalBet: 0,
                folded: false, allIn: false, hasActed: false,
                seatIndex, lastAction: null, isLeaving: false
            });
        }
        return true;
    }

    reconnectPlayer(oldId, newId) {
        const p = this.players.find(pl => pl.id === oldId);
        if (p) { p.id = newId; p.isLeaving = false; return true; }
        return false;
    }

    removePlayer(id) {
        // Check pending players first
        const pendIdx = this.pendingPlayers.findIndex(p => p.id === id);
        if (pendIdx !== -1) {
            this.pendingPlayers.splice(pendIdx, 1);
            return;
        }

        // Check busted players
        const bustIdx = this.bustedPlayers.findIndex(p => p.id === id);
        if (bustIdx !== -1) {
            this.bustedPlayers.splice(bustIdx, 1);
            return;
        }

        const idx = this.players.findIndex(p => p.id === id);
        if (idx === -1) return;

        if (this.phase === 'WAITING') {
            this.players.splice(idx, 1);
            return;
        }

        const player = this.players[idx];
        player.isLeaving = true;

        if (!player.folded && this.phase !== 'SHOWDOWN') {
            player.folded = true;
            player.lastAction = 'fold';
        }

        if (this.activePlayerIndex === idx) {
            this._advanceAction();
        }
        this._checkHandEnd();
    }

    startHand() {
        this.players = this.players.filter(p => !p.isLeaving);
        // Move broke players to busted
        const broke = this.players.filter(p => p.chips <= 0);
        for (const p of broke) {
            this.bustedPlayers.push({ id: p.id, name: p.name });
        }
        this.players = this.players.filter(p => p.chips > 0);

        // Promote pending players
        for (const pp of this.pendingPlayers) {
            if (this.players.length < 10) {
                const seatIndex = this._nextSeat();
                this.players.push({
                    id: pp.id, name: pp.name, chips: STARTING_CHIPS,
                    holeCards: [], bet: 0, totalBet: 0,
                    folded: false, allIn: false, hasActed: false,
                    seatIndex, lastAction: null, isLeaving: false
                });
            }
        }
        this.pendingPlayers = [];

        if (this.players.length < 2) { this.phase = 'WAITING'; return; }

        this.handNumber++;
        this.communityCards = [];
        this.pot = 0;
        this.winners = null;
        this.showdownHands = {};
        this.currentBet = 0;
        this.minRaise = BB;

        for (const p of this.players) {
            Object.assign(p, {
                holeCards: [], bet: 0, totalBet: 0,
                folded: false, allIn: false, hasActed: false, lastAction: null
            });
        }

        this.dealerIndex = this._nextNonFolded(this.dealerIndex);
        this.deck = new Deck();
        this._postBlinds();

        for (const p of this.players) {
            p.holeCards = this.deck.deal(2);
        }

        this.phase = 'PRE_FLOP';

        // Set first actor: heads-up = dealer, else UTG
        if (this.players.length === 2) {
            this.activePlayerIndex = this.dealerIndex;
        } else {
            const bbIdx = this._getBBIndex();
            this.activePlayerIndex = this._nextCanAct(bbIdx);
        }

        this._startTimer();
    }

    handleAction(playerId, type, amount = 0) {
        const idx = this.players.findIndex(p => p.id === playerId);
        if (idx === -1 || idx !== this.activePlayerIndex) return false;
        if (this.phase === 'WAITING' || this.phase === 'SHOWDOWN') return false;

        const player = this.players[idx];
        const actions = this.getAvailableActions(playerId);
        if (!actions.map(a => a.type).includes(type)) return false;

        this._clearTimer();

        switch (type) {
            case 'fold':
                player.folded = true;
                player.lastAction = 'fold';
                break;

            case 'check':
                player.lastAction = 'check';
                break;

            case 'call': {
                const callAmt = Math.min(this.currentBet - player.bet, player.chips);
                this._placeBet(idx, callAmt);
                player.lastAction = player.allIn ? 'all-in' : 'call';
                break;
            }

            case 'raise': {
                const raiseTotal = Math.max(amount, this.currentBet + this.minRaise);
                const needed = Math.min(raiseTotal - player.bet, player.chips);
                const actualTotal = player.bet + needed;
                const raiseSize = actualTotal - this.currentBet;
                if (raiseSize > 0 && raiseSize >= this.minRaise) {
                    this.minRaise = raiseSize;
                }
                this._placeBet(idx, needed);
                this.currentBet = player.bet;
                // Reset hasActed for everyone else
                for (let i = 0; i < this.players.length; i++) {
                    if (i !== idx && !this.players[i].folded && !this.players[i].allIn) {
                        this.players[i].hasActed = false;
                    }
                }
                player.lastAction = player.allIn ? 'all-in' : 'raise';
                break;
            }

            case 'allin': {
                const allInAmt = player.chips;
                this._placeBet(idx, allInAmt);
                if (player.bet > this.currentBet) {
                    const raiseSize = player.bet - this.currentBet;
                    if (raiseSize >= this.minRaise) this.minRaise = raiseSize;
                    this.currentBet = player.bet;
                    for (let i = 0; i < this.players.length; i++) {
                        if (i !== idx && !this.players[i].folded && !this.players[i].allIn) {
                            this.players[i].hasActed = false;
                        }
                    }
                }
                player.lastAction = 'all-in';
                break;
            }
        }

        player.hasActed = true;
        this._advanceAction();
        return true;
    }

    getAvailableActions(playerId) {
        const idx = this.players.findIndex(p => p.id === playerId);
        if (idx === -1 || idx !== this.activePlayerIndex) return [];
        const player = this.players[idx];
        if (player.folded || player.allIn) return [];

        const actions = [{ type: 'fold' }];
        const toCall = this.currentBet - player.bet;

        if (toCall <= 0) {
            actions.push({ type: 'check' });
        } else {
            if (toCall >= player.chips) {
                actions.push({ type: 'allin', amount: player.chips });
            } else {
                actions.push({ type: 'call', amount: toCall });
            }
        }

        // Raise
        const minRaiseTotal = this.currentBet + this.minRaise;
        const maxRaiseTotal = player.bet + player.chips;
        if (maxRaiseTotal > this.currentBet && player.chips > toCall) {
            if (maxRaiseTotal <= minRaiseTotal) {
                actions.push({ type: 'allin', amount: player.chips });
            } else {
                actions.push({ type: 'raise', min: minRaiseTotal, max: maxRaiseTotal });
                actions.push({ type: 'allin', amount: player.chips });
            }
        }

        return actions;
    }

    getStateForPlayer(playerId) {
        const isPlayer = this.players.some(p => p.id === playerId);
        const isPending = this.pendingPlayers.some(p => p.id === playerId);
        return {
            phase: this.phase,
            pot: this._totalPot(),
            communityCards: this.communityCards,
            currentBet: this.currentBet,
            dealerIndex: this.dealerIndex,
            sbIndex: this._getSBIndex(),
            bbIndex: this._getBBIndex(),
            activePlayerIndex: this.activePlayerIndex,
            handNumber: this.handNumber,
            yourId: playerId,
            isSpectator: !isPlayer,
            isPending: isPending,
            isDealing: this.isDealing,
            players: this.players.map((p, i) => ({
                id: p.id,
                name: p.name,
                chips: p.chips,
                bet: p.bet,
                totalBet: p.totalBet,
                folded: p.folded,
                allIn: p.allIn,
                seatIndex: p.seatIndex,
                lastAction: p.lastAction,
                isDealer: i === this.dealerIndex,
                holeCards: (p.id === playerId || (this.phase === 'SHOWDOWN' && !p.folded))
                    ? p.holeCards : null
            })),
            availableActions: this.isDealing ? [] : this.getAvailableActions(playerId),
            winners: this.winners,
            showdownHands: this.phase === 'SHOWDOWN' ? this.showdownHands : {},
            actionDeadline: this.actionDeadline,
            canRebuy: this.bustedPlayers.some(p => p.id === playerId)
        };
    }

    // --- Private methods ---

    _placeBet(idx, amount) {
        const p = this.players[idx];
        const actual = Math.min(amount, p.chips);
        p.chips -= actual;
        p.bet += actual;
        p.totalBet += actual;
        if (p.chips === 0) p.allIn = true;
    }

    _postBlinds() {
        const sbIdx = this._getSBIndex();
        const bbIdx = this._getBBIndex();
        this._placeBet(sbIdx, Math.min(SB, this.players[sbIdx].chips));
        this._placeBet(bbIdx, Math.min(BB, this.players[bbIdx].chips));
        this.currentBet = BB;
        this.minRaise = BB;
    }

    _getSBIndex() {
        if (this.players.length === 2) return this.dealerIndex;
        return this._nextNonFolded(this.dealerIndex);
    }

    _getBBIndex() {
        return this._nextNonFolded(this._getSBIndex());
    }

    _nextNonFolded(from) {
        let idx = (from + 1) % this.players.length;
        for (let i = 0; i < this.players.length; i++) {
            if (!this.players[idx].folded) return idx;
            idx = (idx + 1) % this.players.length;
        }
        return -1;
    }

    _nextCanAct(from) {
        let idx = (from + 1) % this.players.length;
        for (let i = 0; i < this.players.length; i++) {
            if (!this.players[idx].folded && !this.players[idx].allIn) return idx;
            idx = (idx + 1) % this.players.length;
        }
        return -1;
    }

    _advanceAction() {
        // Check if only 1 non-folded
        const active = this.players.filter(p => !p.folded);
        if (active.length <= 1) {
            this._awardPotToLastPlayer();
            return;
        }

        // Check if round is over
        const canAct = this.players.filter(p => !p.folded && !p.allIn);
        const allActed = canAct.every(p => p.hasActed);

        if (allActed || canAct.length === 0) {
            this._collectBets();
            this._advancePhase();
            return;
        }

        // Move to next player who can act
        this.activePlayerIndex = this._nextCanAct(this.activePlayerIndex);
        this._startTimer();
    }

    _collectBets() {
        for (const p of this.players) {
            this.pot += p.bet;
            p.bet = 0;
        }
    }

    _advancePhase() {
        if (this.phase === 'RIVER') {
            this._showdown();
            return;
        }

        const active = this.players.filter(p => !p.folded);
        const shouldAutoAdvance = active.every(p => p.allIn) || active.filter(p => !p.allIn).length <= 1;

        let newPhase, cardCount;
        switch (this.phase) {
            case 'PRE_FLOP': newPhase = 'FLOP'; cardCount = 3; break;
            case 'FLOP': newPhase = 'TURN'; cardCount = 1; break;
            case 'TURN': newPhase = 'RIVER'; cardCount = 1; break;
        }

        this.phase = newPhase;
        this.isDealing = true;

        // Deal cards one by one with 1s gaps
        this._dealSequential(cardCount, () => {
            this.isDealing = false;

            // Reset for new betting round
            for (const p of this.players) {
                p.hasActed = false;
                p.lastAction = null;
            }
            this.currentBet = 0;
            this.minRaise = BB;

            if (shouldAutoAdvance) {
                this._collectBets();
                // Pause briefly before next phase when running out board
                setTimeout(() => {
                    this._advancePhase();
                }, 800);
            } else {
                // Start betting round
                if (this.players.length === 2) {
                    this.activePlayerIndex = this._getBBIndex();
                } else {
                    this.activePlayerIndex = this._nextCanAct(this.dealerIndex);
                }
                this._startTimer();
                this.onStateChange();
            }
        });
    }

    _dealSequential(count, callback) {
        const cards = this.deck.deal(count);
        let i = 0;
        const dealNext = () => {
            this.communityCards.push(cards[i]);
            i++;
            this.onStateChange();
            if (i < cards.length) {
                setTimeout(dealNext, 1000);
            } else {
                setTimeout(callback, 1000);
            }
        };
        setTimeout(dealNext, 600);
    }

    _showdown() {
        this._collectBets();
        this.phase = 'SHOWDOWN';
        this._clearTimer();

        const active = this.players.filter(p => !p.folded);
        for (const p of active) {
            const hand = evaluateHand(p.holeCards, this.communityCards);
            this.showdownHands[p.id] = hand;
        }

        // Step 1: Reveal cards (no winners yet)
        this.winners = null;
        this.onStateChange();

        // Step 2: After delay, announce winners
        setTimeout(() => {
            this._distributePots();
            this.onStateChange();

            // Step 3: After showing results, start next hand
            setTimeout(() => {
                this.startHand();
                this.onStateChange();
            }, 5000);
        }, 2500);
    }

    _distributePots() {
        const pots = this._calculateSidePots();
        this.winners = [];

        for (const pot of pots) {
            const eligible = pot.eligible
                .map(id => ({ id, hand: this.showdownHands[id] }))
                .filter(e => e.hand);

            if (eligible.length === 0) continue;

            eligible.sort((a, b) => compareHands(b.hand, a.hand));
            const bestHand = eligible[0].hand;
            const winners = eligible.filter(e => compareHands(e.hand, bestHand) === 0);
            const share = Math.floor(pot.amount / winners.length);
            const remainder = pot.amount - share * winners.length;

            winners.forEach((w, i) => {
                const player = this.players.find(p => p.id === w.id);
                player.chips += share + (i === 0 ? remainder : 0);
                this.winners.push({
                    id: w.id, name: player.name,
                    amount: share + (i === 0 ? remainder : 0),
                    hand: w.hand.name
                });
            });
        }
    }

    _calculateSidePots() {
        const bettors = this.players
            .filter(p => p.totalBet > 0)
            .map(p => ({ id: p.id, totalBet: p.totalBet, folded: p.folded }));

        const allInAmounts = [...new Set(
            bettors.filter(b => this.players.find(p => p.id === b.id).allIn)
                .map(b => b.totalBet)
        )].sort((a, b) => a - b);

        if (allInAmounts.length === 0) {
            const amount = bettors.reduce((s, b) => s + b.totalBet, 0);
            const eligible = bettors.filter(b => !b.folded).map(b => b.id);
            return [{ amount, eligible }];
        }

        const pots = [];
        let processed = 0;

        for (const level of allInAmounts) {
            let potAmt = 0;
            const eligible = [];
            for (const b of bettors) {
                const contrib = Math.min(b.totalBet, level) - Math.min(b.totalBet, processed);
                potAmt += Math.max(0, contrib);
                if (!b.folded && b.totalBet >= level) eligible.push(b.id);
            }
            if (potAmt > 0) pots.push({ amount: potAmt, eligible });
            processed = level;
        }

        // Remaining
        let remaining = 0;
        const eligible = [];
        for (const b of bettors) {
            const r = b.totalBet - Math.min(b.totalBet, processed);
            remaining += Math.max(0, r);
            if (!b.folded && b.totalBet > processed) eligible.push(b.id);
        }
        if (remaining > 0) pots.push({ amount: remaining, eligible });

        return pots;
    }

    _awardPotToLastPlayer() {
        this._collectBets();
        this._clearTimer();
        const winner = this.players.find(p => !p.folded);
        if (winner) {
            winner.chips += this.pot;
            this.winners = [{ id: winner.id, name: winner.name, amount: this.pot, hand: 'Last standing' }];
        }
        this.phase = 'SHOWDOWN';
        this.onStateChange();

        setTimeout(() => {
            this.startHand();
            this.onStateChange();
        }, 3000);
    }

    _totalPot() {
        return this.pot + this.players.reduce((s, p) => s + p.bet, 0);
    }

    _startTimer() {
        this._clearTimer();
        this.actionDeadline = Date.now() + 30000;
        this.actionTimer = setTimeout(() => {
            const player = this.players[this.activePlayerIndex];
            if (!player) return;
            const actions = this.getAvailableActions(player.id);
            const canCheck = actions.some(a => a.type === 'check');
            this.handleAction(player.id, canCheck ? 'check' : 'fold');
            this.onStateChange();
        }, 30000);
    }

    _clearTimer() {
        if (this.actionTimer) { clearTimeout(this.actionTimer); this.actionTimer = null; }
        this.actionDeadline = null;
    }

    _checkHandEnd() {
        const active = this.players.filter(p => !p.folded);
        if (active.length <= 1 && this.phase !== 'WAITING' && this.phase !== 'SHOWDOWN') {
            this._awardPotToLastPlayer();
        }
    }

    _nextSeat() {
        const taken = new Set(this.players.map(p => p.seatIndex));
        for (let i = 0; i < 10; i++) { if (!taken.has(i)) return i; }
        return -1;
    }
}

module.exports = GameEngine;
