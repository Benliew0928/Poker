// Socket.io client wrapper
const PokerSocket = {
    socket: null,
    serverUrl: '',
    playerName: '',
    onStateUpdate: null,
    onError: null,
    onConnect: null,
    onDisconnect: null,

    connect(name) {
        this.playerName = name;

        // Auto-detect: same origin for dev, or set POKER_SERVER_URL for production
        const url = window.POKER_SERVER_URL || 'https://poker-biax.onrender.com/';
        this.socket = io(url, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('join', { name: this.playerName });
            if (this.onConnect) this.onConnect();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            if (this.onDisconnect) this.onDisconnect();
        });

        this.socket.on('gameState', (state) => {
            if (this.onStateUpdate) this.onStateUpdate(state);
        });

        this.socket.on('error', (err) => {
            console.error('Server error:', err);
            if (this.onError) this.onError(err);
        });

        this.socket.on('connect_error', (err) => {
            console.error('Connection error:', err.message);
        });
    },

    sendAction(type, amount) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('action', { type, amount });
        }
    },

    sendRebuy() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('rebuy');
        }
    },

    isConnected() {
        return this.socket && this.socket.connected;
    }
};
