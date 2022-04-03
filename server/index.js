const PORT = process.env.PORT || 3001;

const wordlist = require("./wordlist.js");

const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

var app = express();
var server = http.createServer(app);
var wss = new WebSocket.Server({ server: server });


const GREEN = "green";
const YELLOW = "yellow";
const RED = "red";
const BLACK = "black";
const WHITE = "white";

var games = new Map();
var clientQueue = new Map();
var clients = new Map();

function sendJson(ws, obj) {
	ws.send(JSON.stringify(obj));
}

function error(str, gameover=undefined) {
	return {
		error: str,
		gameover: gameover
		};
}

function makeId() {
	let id;
	do {
		id = (1+Math.random()).toString(36).slice(2, 10).toUpperCase();
	} while (id.length != 8);
	
	return id;
}


class PlayerData {
	constructor(socket) {
		this.socket = socket;
		this.word = null;
		this.guesses = [];
		this.guessColors = [];
	}
}

class Game {
	constructor(wordRemove, hardMode, ws) {
		this.wordRemove = wordRemove;
		this.hardMode = !!hardMode;
		this.players = new Map([[makeId(), new PlayerData(ws)]]);
		this.wordLength = 5;
		this.guessLimit = 6;
		this.gameId = null;
	}
	
	handleGuess(playerId, guess) {
		let playerData = this.players.get(playerId);
		if (!playerData.word) {
			return error("Game not started");
		}
		
		if (!guess || guess.length !== this.wordLength) {
			return error("Invalid word length");
		}
		
		if (playerData.guesses.length >= this.guessLimit) {
			return error("No guesses left");
		}
		
		if (!this.hardModeCheck(playerId, guess)) {
			return error("Hard mode failed");
		}
		
		if (!wordlist.isValidWord(guess)) {
			return error("Invalid word");
		}
		
		if (playerData.word === guess) {
			let wordsToRemove = Math.min(this.wordRemove, playerData.guesses.length);
			
			this.sendPenalties(playerId);
			
			playerData.word = wordlist.getSolutionWord();
			playerData.guesses.splice(0, wordsToRemove);
			playerData.guesses.push(guess);
			playerData.guessColors = playerData.guesses.map((item, index) => {
					  return this.getColors(playerData.word, item);
					});
			
			return {
				success: "Correct!", 
				wordsToRemove: wordsToRemove,
				guesses: playerData.guesses,
				guessColors: playerData.guessColors
				};
		} else {
		
			playerData.guesses.push(guess);
			let guessColors = this.getColors(playerData.word, guess);
			playerData.guessColors.push(guessColors);

			this.checkHasLost(playerId);
			
			return {
				guessResult: {
					word: guess,
					colors: guessColors
					}
			};
		}
	}
	
	// Send penalty row to all players except the one specified
	sendPenalties(fromPlayerId) {
		for (const [id, playerData] of this.players) {
			if (id !== fromPlayerId) {
				let guessColors = this.getColors(playerData.word, "");
				playerData.guesses.push("");
				playerData.guessColors.push(guessColors);
				
				this.checkHasLost(id);
				
				sendJson(playerData.socket, {
					guessResult: {
						word: "",
						colors: guessColors
					}
				});
			}
		}
	}
	
	checkHasLost(playerId) {
		let playerData = this.players.get(playerId);
		if (playerData.guesses.length === this.guessLimit) {
			this.removePlayer(playerId);
			sendJson(playerData.socket, {
				gameover: true,
				gameoverMessage: "You lost, last word was " + playerData.word
			});
		}
	}
	
	getColors(solution, guess) {
		if (!guess) {
			return new Array(this.wordLength).fill(RED);
		}
		
		let colors = new Array(this.wordLength).fill("");

		let arr_solution = [...solution];
		let arr_guess = [...guess];

		for (let i = 0; i < arr_solution.length; i++) {
			if (arr_guess[i] === arr_solution[i]) {
				arr_solution[i] = arr_guess[i] = "";
				colors[i] = GREEN;
			}
		}

		for (let i = 0; i < arr_guess.length; i++) {
			if (!arr_guess[i]) {
				continue;
			}
			for (let j = 0; j < arr_solution.length; j++) {
				if (arr_guess[i] === arr_solution[j]) {
					arr_guess[i] = arr_solution[j] = "";
					colors[i] = YELLOW;
					break;
				}
			}
		}

		for (let i = 0; i < arr_guess.length; i++) {
			if (arr_guess[i]) {
			  colors[i] = WHITE;
			}
		}
		return colors;
	}
	
	hardModeCheck(playerId, guess) {
		if (!this.hardMode) {
			return true;
		}
		
		let playerData = this.players.get(playerId);
		
		let guessColors = playerData.guessColors;
		
		for (let j in guessColors) {
			let row = guessColors[j];
			for (let i in row) {
				if (row[i] === GREEN) {
					if (guess[i] !== playerData.guesses[j][i]) {
						return false;
					}
				} else if (row[i] === YELLOW) {
					if (guess[i] === playerData.guesses[j][i] || !guess.includes(playerData.guesses[j][i])) {
						return false;
					}
				}
			}
		}
		return true;
	}

	addPlayer(ws) {
		this.players.set(makeId(), new PlayerData(ws));
	}
	
	removePlayer(playerId) {
		let playerData = this.players.get(playerId);
		let client = clients.get(playerData.socket);
		client.game = null;
		client.playerId = null;
		
		this.players.delete(playerId);
		
		
		if (this.players.size == 1) {
			const [winnerPlayerId, winnerPlayerData] = this.players.entries().next().value;
			sendJson(winnerPlayerData.socket, { 
				gameover: true,
				gameoverMessage: "You won!"
			});
			
			this.removePlayer(winnerPlayerId);
			games.delete(this.gameId);
		}
	}
	
	startGame(gameId) {
		this.gameId = gameId;
		
		if (this.players.size < 2) {
			return false;
		}
		
		for (const [id, playerData] of this.players) {
			let client = clients.get(playerData.socket);
			playerData.word = wordlist.getSolutionWord();
			if (client) {
				client.game = this;
				client.playerId = id;
			}
			sendJson(playerData.socket, this.getPlayerGameData(id));
		}
	}
	
	updateClients() {
		for (const [id, playerData] of this.players) {
			let client = clients.get(playerData.socket);
			if (client === undefined) {
				continue;
			}
			client.playerId = id;
			client.game = this;
		}
	}
	
	getPlayerGameData(playerId) {
		let playerData = this.players.get(playerId);
		return {
			guessColors: playerData.guessColors,
			guesses: playerData.guesses,
			wordRemove: this.wordRemove,
			hardMode: this.hardMode,
			gameId: this.gameId,
			playerId: playerId
		};
	}
}

wss.on('connection', (ws) => {
	let client = {
		game: null,
		playerId: null,
	};
	
	clients.set(ws, client);
	
    ws.on('message', (messageAsString) => {
		const message = JSON.parse(messageAsString);
		switch(message.action) {
			case "rejoin":
			{
				if (client.game) {
					return sendJson(ws, error("Attempted to rejoin game while already in game"));
				}
				
				if (!message.gameId || !message.playerId) {
					return sendJson(ws, error("No ids provided for rejoin"));
				}
				
				if (!games.has(message.gameId)) {
					return sendJson(ws, error("Game not in progress", true));
				}
				
				let game = games.get(message.gameId);
				
				let playerData = game.players.get(message.playerId);
				if (playerData === undefined) {
					return sendJson(ws, error("No such player in game", true));
				}
				
				playerData.socket = ws;
				
				client.game = game
				client.playerId = message.playerId;
				
				return sendJson(ws, client.game.getPlayerGameData(client.playerId));
			}
				
			case "join":
			{
				if (client.game) {
					return sendJson(ws, error("Attempted to join game while already in game"));
				}
				
				if (message.hardMode === undefined || !Number.isInteger(message.wordRemove) || message.wordRemove < 1 || message.wordRemove > 3) {
					return sendJson(ws, error("Settings not provided for join"));
				}
				
				clientQueue.delete(ws);
				
				for (let [cws, game] of clientQueue.entries()) {
					if (game.hardMode === !!message.hardMode && game.wordRemove === message.wordRemove) {
						let gameId = makeId();
						clientQueue.delete(cws);
						games.set(gameId, game);
						
						game.addPlayer(ws);
						game.startGame(gameId);
						return;
					}
				}
				
				clientQueue.set(ws, new Game(message.wordRemove, message.hardMode, ws));
				return sendJson(ws, {wait: true});
			}
			
			case "guess":
			{
				if (!client.game || !client.playerId) {
					return sendJson(ws, error("Can't guess before game starts"));
				}
				
				return sendJson(ws, client.game.handleGuess(client.playerId, message.guess));
			}
			
			case "ping":
				return;
			
			default:
				return sendJson(ws, error("Invalid action"));
		}
	});
	
	ws.on("close", () => {
		if (client.game) {
			let playerData = client.game.players.get(client.playerId);
			if (playerData) {
				playerData.socket = null;
			}
		}
		clientQueue.delete(ws);
		clients.delete(ws);
	});
});

app.use(express.static(path.resolve(__dirname, "../client/build/")));

app.get("/duel", (req, res) => {
	res.sendFile(path.resolve(__dirname, "../client/build/index.html"));
});

server.listen(PORT);