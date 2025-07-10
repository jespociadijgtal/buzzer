import expressPkg from 'express';
const express = expressPkg;
type Request = expressPkg.Request;
type Response = expressPkg.Response;

import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws'
import http, { IncomingMessage } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

type GameState = 'waiting' | 'countdown' | 'active' | 'finished';

let gameState: GameState = 'waiting';
const players = new Map<string, WebSocket>();
let gameTimer: NodeJS.Timeout | null = null;
let countdownTimer: NodeJS.Timeout | null = null;

// View & static config
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, '../public')));

// Home route to enter username
app.get('/', (req: Request, res: Response) => {
	res.render('form');
});

// Web route
app.get('/:username', (req: Request, res: Response) => {
	const username = req.params.username;
	res.render('game', { username });
});

// WebSocket handling
wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
	const url = new URL(req.url || '', `http://${req.headers.host}`);
	const username = url.searchParams.get('username');
	if (!username) return ws.close();

	if (players.has(username)) {
		ws.send(JSON.stringify({ type: 'error', message: 'Username taken' }));
		return ws.close();
	}

	players.set(username, ws);
	sendPlayerList();

	ws.send(JSON.stringify({ type: 'gameState', state: gameState }));

	ws.on('message', (msg: RawData) => {
		try {
			const data = JSON.parse(msg.toString());

			switch (data.type) {
				case 'startGame':
					if (gameState === 'waiting' || gameState === 'finished') startCountdown();
					break;
				case 'tap':
					if (data.username && data.timestamp) handleTap(data.username, data.timestamp);
					break;
			}
		} catch (err) {
			console.error('Invalid message format:', err);
		}
	});

	ws.on('close', () => {
		players.delete(username);
		sendPlayerList();
		if (players.size === 0) resetGame();
	});
});

// Broadcast helper
function broadcast(data: any) {
	const str = JSON.stringify(data);
	for (const ws of players.values()) {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(str);
		}
	}
}

function sendPlayerList() {
	broadcast({ type: 'players', players: Array.from(players.keys()) });
}

function startCountdown() {
	gameState = 'countdown';
	let count = 3;

	broadcast({ type: 'gameStart', countdown: count });
	countdownTimer = setInterval(() => {
		count--;
		if (count > 0) {
			broadcast({ type: 'countdown', count });
		} else {
			clearInterval(countdownTimer!);
			startGame();
		}
	}, 1000);
}

function startGame() {
	const delay = Math.random() * 4000 + 1000;
	gameTimer = setTimeout(() => {
		gameState = 'active';
		broadcast({ type: 'gameActive' });
	}, delay);
}

function handleTap(username: string, timestamp: number) {
	if (gameState !== 'active') return;
	gameState = 'finished';
	clearTimeout(gameTimer!);
	broadcast({ type: 'winner', winner: username, timestamp });
}

function resetGame() {
	gameState = 'waiting';
	clearTimeout(gameTimer!);
	clearInterval(countdownTimer!);
	broadcast({ type: 'gameReset' });
}

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));

