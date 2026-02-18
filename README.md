# ♠♥♦♣ Texas Hold'em Poker

Private multiplayer Texas Hold'em poker for you and your friends. **Entertainment only, no gambling.**

- 🎮 2–10 players per table, spectator mode for extras
- 🃏 1/2 blinds, 200BB (400 chips) buy-in
- 🎨 Modern dark theme, responsive UI
- ⚡ Real-time via WebSocket (Socket.io)
- 🔒 Server-side game logic — no cheating possible

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) 18+

### Run locally
```bash
cd server
npm install
npm start
```

Open **http://localhost:3001** in your browser. Open multiple tabs to simulate players.

---

## 🌐 Free Deployment Guide

### Architecture
| Component | Host | Cost |
|-----------|------|------|
| Frontend (static) | Cloudflare Pages | Free |
| Backend (game server) | Render.com | Free |

Both auto-deploy from the same GitHub repo.

---

### Step 1: Push to GitHub

```bash
# From the project root (texas-holdem/)
git init
git add .
git commit -m "Initial commit: Texas Hold'em poker"
```

Create a new repo on [github.com/new](https://github.com/new), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/texas-holdem.git
git branch -M main
git push -u origin main
```

---

### Step 2: Deploy Backend on Render.com

1. Go to [render.com](https://render.com) and sign up (free) with GitHub
2. Click **New → Web Service**
3. Connect your `texas-holdem` GitHub repo
4. Configure:
   - **Name**: `texas-holdem-server`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Instance Type**: Free
5. Click **Create Web Service**
6. Wait for deploy → note your URL, e.g. `https://texas-holdem-server.onrender.com`

---

### Step 3: Update Frontend Server URL

Edit `client/js/socket.js` and set the production server URL:

```javascript
// Change this line:
const url = window.POKER_SERVER_URL || '';

// To:
const url = window.POKER_SERVER_URL || 'https://texas-holdem-server.onrender.com';
```

Commit and push the change.

---

### Step 4: Deploy Frontend on Cloudflare Pages

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) and sign up (free)
2. Click **Create a project → Connect to Git**
3. Select your `texas-holdem` repo
4. Configure:
   - **Project name**: `texas-holdem` (this becomes your URL)
   - **Framework preset**: None
   - **Build command**: (leave empty)
   - **Build output directory**: `client`
5. Click **Save and Deploy**
6. Your site will be live at `https://texas-holdem.pages.dev`

---

### Step 5: Configure CORS (if needed)

If you get CORS errors, update `server/index.js`:

```javascript
const io = new Server(server, {
  cors: {
    origin: 'https://texas-holdem.pages.dev',  // your Cloudflare URL
    methods: ['GET', 'POST']
  }
});
```

---

## 🎮 How to Play

1. Open the website URL
2. Enter your name and click **Join Table**
3. Game auto-starts when 2+ players join (3-second countdown)
4. Use the action buttons: **Fold**, **Check**, **Call**, **Raise**, **All-In**
5. Keyboard shortcuts: `F` = Fold, `C` = Check/Call

## 📝 Game Rules

- **Blinds**: Small Blind = 1, Big Blind = 2
- **Buy-in**: 400 chips (200× Big Blind)
- **Betting rounds**: Pre-flop → Flop (3 cards) → Turn (1 card) → River (1 card)
- **Timer**: 30 seconds per action, auto-fold/check on timeout
- **Showdown**: Best 5-card hand from 7 cards wins
- **Disconnection**: 30-second grace period to reconnect; auto-fold if in hand

## 🧪 Testing

Open multiple browser tabs at `http://localhost:3001` and log in with different names.
Verify: blinds post correctly, cards deal, betting works, showdown evaluates hands, chips transfer.
