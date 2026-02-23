// Game UI — renders the poker table based on game state
const GameUI = {
    lastState: null,
    timerInterval: null,
    myId: null,

    // Seat positions (percentages) for 2-10 players around an ellipse
    // Current player is always at bottom center
    // Positions are pushed further from table center to avoid overlap
    getSeatPositions(count) {
        const positions = {
            2: [
                { x: 50, y: 97 },   // bottom (me)
                { x: 50, y: 3 }     // top
            ],
            3: [
                { x: 50, y: 97 },
                { x: 88, y: 15 },
                { x: 12, y: 15 }
            ],
            4: [
                { x: 50, y: 97 },
                { x: 93, y: 50 },
                { x: 50, y: 3 },
                { x: 7, y: 50 }
            ],
            5: [
                { x: 50, y: 97 },
                { x: 93, y: 65 },
                { x: 82, y: 5 },
                { x: 18, y: 5 },
                { x: 7, y: 65 }
            ],
            6: [
                { x: 50, y: 97 },
                { x: 93, y: 62 },
                { x: 82, y: 5 },
                { x: 50, y: 3 },
                { x: 18, y: 5 },
                { x: 7, y: 62 }
            ],
            7: [
                { x: 50, y: 97 },
                { x: 95, y: 65 },
                { x: 88, y: 15 },
                { x: 64, y: 3 },
                { x: 36, y: 3 },
                { x: 12, y: 15 },
                { x: 5, y: 65 }
            ],
            8: [
                { x: 50, y: 97 },
                { x: 93, y: 72 },
                { x: 95, y: 32 },
                { x: 74, y: 3 },
                { x: 50, y: 1 },
                { x: 26, y: 3 },
                { x: 5, y: 32 },
                { x: 7, y: 72 }
            ],
            9: [
                { x: 50, y: 97 },
                { x: 90, y: 78 },
                { x: 95, y: 42 },
                { x: 84, y: 8 },
                { x: 62, y: 1 },
                { x: 38, y: 1 },
                { x: 16, y: 8 },
                { x: 5, y: 42 },
                { x: 10, y: 78 }
            ],
            10: [
                { x: 50, y: 97 },
                { x: 85, y: 82 },
                { x: 95, y: 52 },
                { x: 93, y: 22 },
                { x: 74, y: 3 },
                { x: 50, y: 1 },
                { x: 26, y: 3 },
                { x: 7, y: 22 },
                { x: 5, y: 52 },
                { x: 15, y: 82 }
            ]
        };
        return positions[count] || positions[10];
    },

    // Determine z-index zone for a seat position
    getSeatZone(pos) {
        if (pos.y > 75) return 'seat-bottom';
        if (pos.y < 25) return 'seat-top';
        return 'seat-side';
    },

    // Bet chip positions (offset from seat, towards center of table)
    getBetPosition(seatPos) {
        const cx = 50, cy = 50;
        const dx = (cx - seatPos.x) * 0.35;
        const dy = (cy - seatPos.y) * 0.35;
        return { x: seatPos.x + dx, y: seatPos.y + dy };
    },

    render(state) {
        this.myId = state.yourId;
        this.lastState = state;

        this.renderTopBar(state);
        this.renderCommunityCards(state);
        this.renderPot(state);
        this.renderSeats(state);
        this.renderActionPanel(state);
        this.renderWinner(state);
        this.renderSpectator(state);
        this.renderRebuy(state);
        this.updateTimer(state);
    },

    renderTopBar(state) {
        const playerCount = state.players.length;
        document.getElementById('hand-number').textContent = state.handNumber > 0
            ? `Hand #${state.handNumber}` : 'Waiting...';
        document.getElementById('player-count').textContent = `${playerCount} Player${playerCount !== 1 ? 's' : ''}`;
    },

    renderCommunityCards(state) {
        const container = document.getElementById('community-cards');
        const current = container.children.length;
        const target = state.communityCards.length;

        // Only re-render if card count changed
        if (current !== target) {
            container.innerHTML = '';
            state.communityCards.forEach((card, i) => {
                const el = CardRenderer.createCard(card, true, i >= current);
                container.appendChild(el);
            });
        }
    },

    renderPot(state) {
        const potEl = document.getElementById('pot-amount');
        const total = state.pot;
        potEl.textContent = total > 0 ? CardRenderer.formatChips(total) : '0';
    },

    renderSeats(state) {
        const container = document.getElementById('seats-container');
        container.innerHTML = '';

        const playerCount = state.players.length;
        if (playerCount === 0) return;

        // Reorder: put current player at index 0 (spectators see natural order)
        const myIdx = state.players.findIndex(p => p.id === state.yourId);
        let ordered;
        if (myIdx >= 0) {
            ordered = [];
            for (let i = 0; i < playerCount; i++) {
                ordered.push(state.players[(myIdx + i) % playerCount]);
            }
        } else {
            ordered = [...state.players];
        }

        const positions = this.getSeatPositions(playerCount);

        ordered.forEach((player, i) => {
            const pos = positions[i];
            const seat = this.createSeat(player, pos, state, myIdx >= 0 && i === 0);
            seat.classList.add(this.getSeatZone(pos));
            container.appendChild(seat);
        });
    },

    createSeat(player, pos, state, isMe) {
        const seat = document.createElement('div');
        seat.className = 'player-seat';
        seat.style.left = pos.x + '%';
        seat.style.top = pos.y + '%';

        const isActive = state.players[state.activePlayerIndex]?.id === player.id;
        const isWinner = state.winners && state.winners.some(w => w.id === player.id);
        const isDealer = player.isDealer;

        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'seat-avatar';
        if (isActive && state.phase !== 'SHOWDOWN' && state.phase !== 'WAITING') avatar.classList.add('active');
        if (player.folded) avatar.classList.add('folded');
        if (isWinner) avatar.classList.add('winner');
        avatar.textContent = player.name.charAt(0).toUpperCase();

        // Dealer button
        if (isDealer && state.phase !== 'WAITING') {
            const db = document.createElement('div');
            db.className = 'dealer-btn';
            db.textContent = 'D';
            avatar.appendChild(db);
        }

        // Blind badge
        const sbIdx = state.sbIndex;
        const bbIdx = state.bbIndex;
        const playerRealIdx = state.players.findIndex(p => p.id === player.id);
        if (playerRealIdx === sbIdx && state.phase !== 'WAITING') {
            const badge = document.createElement('div');
            badge.className = 'blind-badge sb';
            badge.textContent = 'SB';
            avatar.appendChild(badge);
        }
        if (playerRealIdx === bbIdx && state.phase !== 'WAITING') {
            const badge = document.createElement('div');
            badge.className = 'blind-badge bb';
            badge.textContent = 'BB';
            avatar.appendChild(badge);
        }

        // Hole cards
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'seat-cards' + (isMe ? ' my-cards' : '');
        if (player.holeCards && player.holeCards.length > 0) {
            player.holeCards.forEach(c => {
                cardsDiv.appendChild(CardRenderer.createCard(c, true));
            });
        } else if (!player.folded && state.phase !== 'WAITING' && state.phase !== 'SHOWDOWN') {
            cardsDiv.appendChild(CardRenderer.createCardBack());
            cardsDiv.appendChild(CardRenderer.createCardBack());
        }

        // Name & chips
        const nameDiv = document.createElement('div');
        nameDiv.className = 'seat-name';
        nameDiv.textContent = player.name;

        const chipsDiv = document.createElement('div');
        chipsDiv.className = 'seat-chips' + (player.chips === 0 ? ' zero' : '');
        chipsDiv.textContent = CardRenderer.formatChips(player.chips);

        // Action label
        if (player.lastAction && state.phase !== 'WAITING') {
            const actionDiv = document.createElement('div');
            actionDiv.className = 'seat-action ' + player.lastAction.replace(' ', '-');
            actionDiv.textContent = player.lastAction;
            seat.appendChild(actionDiv);
        }

        // Showdown hand info
        if (state.phase === 'SHOWDOWN' && state.showdownHands && state.showdownHands[player.id]) {
            const handDiv = document.createElement('div');
            handDiv.className = 'seat-action';
            handDiv.style.color = 'var(--accent-gold)';
            handDiv.style.bottom = '-28px';
            handDiv.style.fontSize = '9px';
            handDiv.textContent = state.showdownHands[player.id].name;
            seat.appendChild(handDiv);
        }

        // Bet chip display (inline, beside cards)
        const betDiv = document.createElement('div');
        betDiv.className = 'seat-bet-inline';
        if (player.bet > 0) {
            betDiv.textContent = '💰 ' + CardRenderer.formatChips(player.bet);
        }

        // Layout: row with cards + bet, then avatar, name, chips
        const topRow = document.createElement('div');
        topRow.className = 'seat-top-row';
        topRow.appendChild(cardsDiv);
        topRow.appendChild(betDiv);

        const inner = document.createElement('div');
        inner.className = 'seat-inner';
        inner.appendChild(topRow);
        inner.appendChild(avatar);
        inner.appendChild(nameDiv);
        inner.appendChild(chipsDiv);
        seat.appendChild(inner);

        return seat;
    },

    renderActionPanel(state) {
        const panel = document.getElementById('action-panel');
        const btnsContainer = document.getElementById('action-buttons');
        const raiseControls = document.getElementById('raise-controls');

        if (state.isSpectator || !state.availableActions || state.availableActions.length === 0) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');
        btnsContainer.innerHTML = '';
        raiseControls.classList.add('hidden');

        const actions = state.availableActions;
        let raiseAction = null;

        for (const action of actions) {
            if (action.type === 'raise') {
                raiseAction = action;
                const btn = document.createElement('button');
                btn.className = 'btn-raise';
                btn.textContent = 'Raise';
                btn.onclick = () => this.showRaiseControls(raiseAction, state);
                btnsContainer.appendChild(btn);
                continue;
            }

            const btn = document.createElement('button');
            btn.className = 'btn-' + action.type;

            switch (action.type) {
                case 'fold':
                    btn.textContent = 'Fold';
                    btn.onclick = () => PokerSocket.sendAction('fold');
                    break;
                case 'check':
                    btn.textContent = 'Check';
                    btn.onclick = () => PokerSocket.sendAction('check');
                    break;
                case 'call':
                    btn.textContent = `Call ${CardRenderer.formatChips(action.amount)}`;
                    btn.onclick = () => PokerSocket.sendAction('call');
                    break;
                case 'allin':
                    btn.textContent = `All-In ${CardRenderer.formatChips(action.amount)}`;
                    btn.onclick = () => PokerSocket.sendAction('allin');
                    break;
            }
            btnsContainer.appendChild(btn);
        }
    },

    showRaiseControls(action, state) {
        const controls = document.getElementById('raise-controls');
        const slider = document.getElementById('raise-slider');
        const amountInput = document.getElementById('raise-amount');
        const confirmBtn = document.getElementById('raise-confirm');
        const minusBtn = document.getElementById('raise-minus');
        const plusBtn = document.getElementById('raise-plus');
        const minLabel = document.getElementById('raise-min-label');
        const maxLabel = document.getElementById('raise-max-label');

        controls.classList.remove('hidden');

        const BB = 2; // Big blind
        slider.min = action.min;
        slider.max = action.max;
        slider.value = action.min;
        amountInput.min = action.min;
        amountInput.max = action.max;
        amountInput.value = action.min;

        // Show min/max labels with actual chip values
        minLabel.textContent = CardRenderer.formatChips(action.min);
        maxLabel.textContent = CardRenderer.formatChips(action.max);

        function syncAmount(val) {
            val = Math.min(Math.max(val, action.min), action.max);
            slider.value = val;
            amountInput.value = val;
        }

        slider.oninput = () => { amountInput.value = slider.value; };
        amountInput.oninput = () => {
            const v = Math.min(Math.max(parseInt(amountInput.value) || action.min, action.min), action.max);
            slider.value = v;
        };

        // +/- buttons increment by 1 BB (2 chips)
        minusBtn.onclick = () => {
            syncAmount((parseInt(amountInput.value) || action.min) - BB);
        };
        plusBtn.onclick = () => {
            syncAmount((parseInt(amountInput.value) || action.min) + BB);
        };

        confirmBtn.onclick = () => {
            PokerSocket.sendAction('raise', parseInt(amountInput.value));
            controls.classList.add('hidden');
        };

        // Pot fraction presets
        document.querySelectorAll('.preset-btn[data-mult]').forEach(btn => {
            btn.onclick = () => {
                const mult = parseFloat(btn.dataset.mult);
                const potSize = state.pot;
                const val = Math.min(Math.max(Math.round(potSize * mult + state.currentBet), action.min), action.max);
                syncAmount(val);
            };
        });

        // BB preset
        document.querySelectorAll('.preset-btn[data-bb]').forEach(btn => {
            btn.onclick = () => {
                const bbMult = parseInt(btn.dataset.bb);
                const val = Math.min(Math.max(bbMult * BB + state.currentBet, action.min), action.max);
                syncAmount(val);
            };
        });
    },

    updateTimer(state) {
        const fill = document.getElementById('timer-fill');
        if (!state.actionDeadline || state.isSpectator) {
            fill.style.width = '100%';
            fill.classList.remove('warning');
            return;
        }

        const activePlayer = state.players[state.activePlayerIndex];
        if (!activePlayer || activePlayer.id !== state.yourId) {
            fill.style.width = '100%';
            fill.classList.remove('warning');
            return;
        }

        if (this.timerInterval) clearInterval(this.timerInterval);

        const update = () => {
            const remaining = Math.max(0, state.actionDeadline - Date.now());
            const pct = (remaining / 30000) * 100;
            fill.style.width = pct + '%';
            fill.classList.toggle('warning', pct < 20);
            if (remaining <= 0 && this.timerInterval) clearInterval(this.timerInterval);
        };

        update();
        this.timerInterval = setInterval(update, 100);
    },

    renderWinner(state) {
        const overlay = document.getElementById('winner-overlay');
        const msg = document.getElementById('winner-message');

        if (!state.winners || state.winners.length === 0 || state.phase !== 'SHOWDOWN') {
            overlay.classList.add('hidden');
            return;
        }

        overlay.classList.remove('hidden');
        msg.innerHTML = state.winners.map(w =>
            `<div class="winner-name">${w.name} wins ${CardRenderer.formatChips(w.amount)}</div>
       <div class="winner-detail">${w.hand}</div>`
        ).join('');
    },

    renderSpectator(state) {
        const banner = document.getElementById('spectator-banner');
        if (state.isSpectator && !state.canRebuy) {
            banner.classList.remove('hidden');
            if (state.isPending) {
                banner.innerHTML = '<span>⏳ Joining next hand...</span>';
            } else {
                banner.innerHTML = '<span>👁 Spectating</span>';
            }
        } else {
            banner.classList.add('hidden');
        }
    },

    renderRebuy(state) {
        const panel = document.getElementById('rebuy-panel');
        if (state.canRebuy) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    }
};
