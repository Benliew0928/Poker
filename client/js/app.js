// App — entry point, manages login, chat, and game state
(function () {
    const loginScreen = document.getElementById('login-screen');
    const gameScreen = document.getElementById('game-screen');
    const loginForm = document.getElementById('login-form');
    const nameInput = document.getElementById('player-name');
    const statusEl = document.getElementById('connection-status');

    // Chat elements
    const chatPanel = document.getElementById('chat-panel');
    const chatHeader = document.getElementById('chat-header');
    const chatToggle = document.getElementById('chat-toggle');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatBadge = document.getElementById('chat-badge');
    let unreadCount = 0;
    let chatOpen = false;

    // ---- Session auto-reconnect ----
    const savedName = sessionStorage.getItem('pokerName');
    if (savedName) {
        nameInput.value = savedName;
        // Auto-join without showing login
        joinGame(savedName);
    }

    // Login handler
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;
        joinGame(name);
    });

    function joinGame(name) {
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
        PokerSocket.onChatMessage = (msg) => addChatMessage(msg);
        PokerSocket.connect(name);

        // Rebuy button
        document.getElementById('rebuy-btn').addEventListener('click', () => {
            PokerSocket.sendRebuy();
        });
    }

    // ---- Chat ----
    chatHeader.addEventListener('click', () => {
        chatOpen = !chatOpen;
        if (chatOpen) {
            chatPanel.classList.remove('chat-collapsed');
            unreadCount = 0;
            chatBadge.classList.add('hidden');
            chatMessages.scrollTop = chatMessages.scrollHeight;
            chatInput.focus();
        } else {
            chatPanel.classList.add('chat-collapsed');
        }
    });

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = chatInput.value.trim();
        if (!msg) return;
        PokerSocket.sendChat(msg);
        chatInput.value = '';
        chatInput.focus();
    });

    // Prevent game keyboard shortcuts when typing in chat
    chatInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
    });

    function addChatMessage(msg) {
        const div = document.createElement('div');
        div.className = 'chat-msg';

        if (msg.system) {
            div.classList.add('system');
            div.innerHTML = `<span class="chat-name">⚡</span><span class="chat-text">${escapeHtml(msg.message)}</span>`;
        } else {
            const time = new Date(msg.time);
            const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            div.innerHTML = `<span class="chat-name">${escapeHtml(msg.name)}</span><span class="chat-text">${escapeHtml(msg.message)}</span>`;
            div.title = timeStr;
        }

        chatMessages.appendChild(div);

        // Keep only last 100 messages
        while (chatMessages.children.length > 100) {
            chatMessages.removeChild(chatMessages.firstChild);
        }

        // Auto-scroll
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Unread badge
        if (!chatOpen) {
            unreadCount++;
            chatBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            chatBadge.classList.remove('hidden');
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in chat
        if (document.activeElement === chatInput) return;

        if (gameScreen.classList.contains('active')) {
            switch (e.key.toLowerCase()) {
                case 'f': PokerSocket.sendAction('fold'); break;
                case 'c':
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
