const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameRoom = require('./gameRoom');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Serve client files in development
app.use(express.static(path.join(__dirname, '../client')));

const gameRoom = new GameRoom();

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join', ({ name }) => {
        if (!name || name.trim().length === 0) {
            socket.emit('error', { message: 'Name is required' });
            return;
        }
        const trimmed = name.trim();
        gameRoom.addPlayer(socket.id, trimmed, socket);

        // System chat message
        io.emit('chatMessage', {
            name: trimmed,
            message: 'joined the table',
            time: Date.now(),
            system: true
        });
    });

    socket.on('action', ({ type, amount }) => {
        gameRoom.handleAction(socket.id, type, amount);
    });

    socket.on('rebuy', () => {
        gameRoom.handleRebuy(socket.id);
    });

    socket.on('chat', (data) => {
        const message = data && data.message;
        if (!message || message.trim().length === 0) return;
        // Try multiple ways to find the player name
        let name = gameRoom.getPlayerName(socket.id);
        if (!name) {
            // Fallback: reverse lookup from playerNames map
            for (const [pName, pId] of gameRoom.playerNames) {
                if (pId === socket.id) { name = pName; break; }
            }
        }
        if (!name) {
            console.log(`Chat from unknown socket ${socket.id}`);
            return;
        }
        console.log(`Chat: ${name}: ${message.trim()}`);
        io.emit('chatMessage', {
            name,
            message: message.trim().substring(0, 200),
            time: Date.now()
        });
    });

    socket.on('disconnect', () => {
        const name = gameRoom.getPlayerName(socket.id);
        console.log(`Socket disconnected: ${socket.id}`);
        gameRoom.removePlayer(socket.id);
        if (name) {
            io.emit('chatMessage', {
                name,
                message: 'left the table',
                time: Date.now(),
                system: true
            });
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`♠♥♦♣ Texas Hold'em server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
