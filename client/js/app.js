// App — entry point, manages login and game state
(function () {
    const loginScreen = document.getElementById('login-screen');
    const gameScreen = document.getElementById('game-screen');
    const loginForm = document.getElementById('login-form');
    const nameInput = document.getElementById('player-name');
    const statusEl = document.getElementById('connection-status');

    // Restore name from session
    const savedName = sessionStorage.getItem('pokerName');
    if (savedName) nameInput.value = savedName;

    // Login handler
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;

        sessionStorage.setItem('pokerName', name);
        loginScreen.classList.remove('active');
        gameScreen.classList.add('active');

        // Connect
        PokerSocket.onStateUpdate = (state) => GameUI.render(state);
        PokerSocket.onConnect = () => {
            statusEl.textContent = '● Connected';
            statusEl.className = 'connected';
        };
        PokerSocket.onDisconnect = () => {
            statusEl.textContent = '● Reconnecting...';
            statusEl.className = 'disconnected';
        };
        PokerSocket.connect(name);

        // Rebuy button
        document.getElementById('rebuy-btn').addEventListener('click', () => {
            PokerSocket.sendRebuy();
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (gameScreen.classList.contains('active')) {
            switch (e.key.toLowerCase()) {
                case 'f': PokerSocket.sendAction('fold'); break;
                case 'c':
                    // Check if check is available, else call
                    if (GameUI.lastState) {
                        const actions = GameUI.lastState.availableActions || [];
                        const hasCheck = actions.some(a => a.type === 'check');
                        PokerSocket.sendAction(hasCheck ? 'check' : 'call');
                    }
                    break;
            }
        }
    });
})();
