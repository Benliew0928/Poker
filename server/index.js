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
        gameRoom.addPlayer(socket.id, name.trim(), socket);
    });

    socket.on('action', ({ type, amount }) => {
        gameRoom.handleAction(socket.id, type, amount);
    });

    socket.on('rebuy', () => {
        gameRoom.handleRebuy(socket.id);
    });

    socket.on('chat', ({ message }) => {
        if (!message || message.trim().length === 0) return;
        const name = gameRoom.getPlayerName(socket.id);
        if (!name) return;
        io.emit('chatMessage', {
            name,
            message: message.trim().substring(0, 200),
            time: Date.now()
        });
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
        gameRoom.removePlayer(socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`♠♥♦♣ Texas Hold'em server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
