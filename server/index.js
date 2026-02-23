const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameRoom = require('./gameRoom');

const app = express();
const server = http.createServer(app);

// Socket.io with ping/pong tuned for Render's proxy
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    // Keep connections alive through Render's proxy
    pingInterval: 10000,   // Send ping every 10s (default 25s is too slow)
    pingTimeout: 5000,     // Wait 5s for pong before considering disconnected
    transports: ['websocket', 'polling'],
    allowUpgrades: true
});

// Serve client files in development
app.use(express.static(path.join(__dirname, '../client')));

// Health check endpoint (keeps Render happy)
app.get('/health', (req, res) => {
    const mem = process.memoryUsage();
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        memory: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
        players: gameRoom.engine.players.length,
        phase: gameRoom.engine.phase
    });
});

const gameRoom = new GameRoom();

// Log memory usage every 5 minutes
setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[MEM] Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB | RSS: ${Math.round(mem.rss / 1024 / 1024)}MB | Players: ${gameRoom.engine.players.length} | Hand: ${gameRoom.engine.handNumber}`);
}, 5 * 60 * 1000);

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
        try {
            gameRoom.handleAction(socket.id, type, amount);
        } catch (err) {
            console.error('Error handling action:', err);
        }
    });

    socket.on('rebuy', () => {
        try {
            gameRoom.handleRebuy(socket.id);
        } catch (err) {
            console.error('Error handling rebuy:', err);
        }
    });

    socket.on('chat', (data) => {
        const message = data && data.message;
        if (!message || message.trim().length === 0) return;
        let name = gameRoom.getPlayerName(socket.id);
        if (!name) {
            for (const [pName, pId] of gameRoom.playerNames) {
                if (pId === socket.id) { name = pName; break; }
            }
        }
        if (!name) return;
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

    socket.on('error', (err) => {
        console.error(`Socket error for ${socket.id}:`, err);
    });
});

// --- Global error handlers (prevent silent crashes) ---
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
    // Don't exit — keep the server alive
});

process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`♠♥♦♣ Texas Hold'em server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
