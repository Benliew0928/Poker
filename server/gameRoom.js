const GameEngine = require('./gameEngine');

class GameRoom {
    constructor() {
        this.engine = new GameEngine(() => this.broadcastState());
        this.sockets = new Map();
        this.spectatorSockets = new Map();
        this.disconnectTimers = new Map();
        this.playerNames = new Map(); // name -> id (for reconnection)
    }

    addPlayer(socketId, name, socket) {
        this.sockets.set(socketId, socket);

        // Check for reconnection
        for (const [pName, pId] of this.playerNames) {
            if (pName === name && this.disconnectTimers.has(pId)) {
                clearTimeout(this.disconnectTimers.get(pId));
                this.disconnectTimers.delete(pId);
                this.engine.reconnectPlayer(pId, socketId);
                this.playerNames.set(name, socketId);
                console.log(`${name} reconnected`);
                this.broadcastState();
                return;
            }
        }

        // New player
        const totalPlayers = this.engine.players.length + this.engine.pendingPlayers.length;
        if (totalPlayers >= 10) {
            this.spectatorSockets.set(socketId, { name, socket });
            socket.emit('gameState', {
                ...this.engine.getStateForPlayer(socketId),
                isSpectator: true,
                message: 'Table is full. You are spectating.'
            });
            return;
        }

        const result = this.engine.addPlayer(socketId, name);
        this.playerNames.set(name, socketId);

        if (result === 'pending') {
            console.log(`${name} queued for next hand (game in progress)`);
        } else {
            console.log(`${name} joined (${this.engine.players.length} players)`);
        }

        this.broadcastState();

        // Auto-start
        if (this.engine.players.length >= 2 && this.engine.phase === 'WAITING') {
            setTimeout(() => {
                if (this.engine.phase === 'WAITING' && this.engine.players.length >= 2) {
                    this.engine.startHand();
                    this.broadcastState();
                }
            }, 3000);
        }
    }

    removePlayer(socketId) {
        const socket = this.sockets.get(socketId);
        this.sockets.delete(socketId);

        if (this.spectatorSockets.has(socketId)) {
            this.spectatorSockets.delete(socketId);
            return;
        }

        // Check if pending player
        const pending = this.engine.pendingPlayers.find(p => p.id === socketId);
        if (pending) {
            this.engine.removePlayer(socketId);
            this.playerNames.delete(pending.name);
            return;
        }

        const player = this.engine.players.find(p => p.id === socketId);
        if (!player) return;

        console.log(`${player.name} disconnected, 30s grace period`);

        // Grace period for reconnection
        const timer = setTimeout(() => {
            this.disconnectTimers.delete(socketId);
            this.playerNames.delete(player.name);
            this.engine.removePlayer(socketId);
            this.broadcastState();

            // Promote spectator if available
            if (this.spectatorSockets.size > 0) {
                const [specId, spec] = this.spectatorSockets.entries().next().value;
                this.spectatorSockets.delete(specId);
                this.engine.addPlayer(specId, spec.name);
                this.playerNames.set(spec.name, specId);
                this.broadcastState();
            }

            // Auto-start if enough players
            if (this.engine.players.length >= 2 && this.engine.phase === 'WAITING') {
                setTimeout(() => {
                    if (this.engine.phase === 'WAITING' && this.engine.players.length >= 2) {
                        this.engine.startHand();
                        this.broadcastState();
                    }
                }, 3000);
            }
        }, 30000);

        this.disconnectTimers.set(socketId, timer);
    }

    handleAction(socketId, type, amount) {
        const result = this.engine.handleAction(socketId, type, amount);
        this.broadcastState();
        return result;
    }

    handleRebuy(socketId) {
        const result = this.engine.rebuy(socketId);
        if (result) {
            console.log(`Player rebuyed`);
            this.broadcastState();

            // Auto-start if enough players and waiting
            if (this.engine.players.length >= 2 && this.engine.phase === 'WAITING') {
                setTimeout(() => {
                    if (this.engine.phase === 'WAITING' && this.engine.players.length >= 2) {
                        this.engine.startHand();
                        this.broadcastState();
                    }
                }, 3000);
            }
        }
        return result;
    }

    broadcastState() {
        for (const player of this.engine.players) {
            const socket = this.sockets.get(player.id);
            if (socket && socket.connected) {
                socket.emit('gameState', this.engine.getStateForPlayer(player.id));
            }
        }
        // Pending players get spectator-like state
        for (const pp of this.engine.pendingPlayers) {
            const socket = this.sockets.get(pp.id);
            if (socket && socket.connected) {
                socket.emit('gameState', {
                    ...this.engine.getStateForPlayer(pp.id),
                    isSpectator: true,
                    isPending: true,
                    message: 'You will join the next hand.'
                });
            }
        }
        // Busted players get state with canRebuy
        for (const bp of this.engine.bustedPlayers) {
            const socket = this.sockets.get(bp.id);
            if (socket && socket.connected) {
                socket.emit('gameState', {
                    ...this.engine.getStateForPlayer(bp.id),
                    isSpectator: true,
                    canRebuy: true
                });
            }
        }
        for (const [id, spec] of this.spectatorSockets) {
            if (spec.socket && spec.socket.connected) {
                spec.socket.emit('gameState', {
                    ...this.engine.getStateForPlayer(id),
                    isSpectator: true
                });
            }
        }
    }
}

module.exports = GameRoom;
