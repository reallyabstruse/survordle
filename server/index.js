const PORT = process.env.PORT || 3001;

const wordlist = require("../client/src/wordlist.js");

const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

var app = express();
var server = http.createServer(app);
var wss = new WebSocket.Server({ server: server });


const GREEN = "green";
const YELLOW = "yellow";
const RED = "red";
const BLACK = "black";
const WHITE = "white";

var games = new Map();
var gamesInLobby = new Map();
var clients = new Map();

var clientsInLobby = new Set();

function sendJson(ws, obj) {
	if (ws) {
		ws.send(JSON.stringify(obj));
	}
}

function error(str, gameover=undefined) {
	return {
		error: str,
		gameover: gameover
		};
}

function refreshLobbies() {
	for (let clientSocket of clientsInLobby) {
		refreshLobby(clientSocket);
	}
}

function refreshLobby(clientSocket) {
	let lobby = [];
	for (let [hostSocket, gameData] of gamesInLobby) {
		if (hostSocket != clientSocket) {
			lobby.push([gameData.wordRemove, gameData.amtGuesses, gameData.timeLimit, gameData.hardMode]);
		}
	}
	sendJson(clientSocket, {lobby: lobby});
}


class PlayerData {
	constructor(socket) {
		this.socket = socket;
		this.word = null;
		this.guesses = [];
		this.guessColors = [];
		
		this.timer = null;
		this.timerStartedAt = 0;
		this.timeLimit = 0;
	}
	
	startTimer(timeLimit, func) {
		this.timeLimit = timeLimit;
		clearInterval(this.timer);
		this.timerStartedAt = (new Date()).getTime();
		this.timer = setInterval(() => {
			func();
			sendJson(this.socket, {timePassed: 0, a: 1});
			this.timerStartedAt += this.timeLimit * 1000;
		}, timeLimit*1000);
		sendJson(this.socket, {timePassed: 0, a: 2});
	}
	
	timePassed() {
		if (!this.timer) {
			return 0;
		}
		return ((new Date()).getTime() - this.timerStartedAt) / 1000;
	}
}

class Game {
	constructor(wordRemove, amtGuesses, timeLimit, hardMode, ws) {
		this.wordRemove = wordRemove;
		this.hardMode = !!hardMode;
		this.players = new Map([[uuidv4(), new PlayerData(ws)]]);
		this.wordLength = 5;
		this.amtGuesses = amtGuesses;
		this.timeLimit = timeLimit;
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
		
		if (playerData.guesses.length >= this.amtGuesses) {
			return error("No guesses left");
		}
		
		if (!this.hardModeCheck(playerId, guess)) {
			return error("Hard mode failed");
		}
		
		if (!wordlist.isValidWord(guess)) {
			return error("Invalid word");
		}
		
		if (this.timeLimit) {
			playerData.startTimer(this.timeLimit, () => this.sendPenalty(playerId));
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
			
			this.sendToOpponents(playerId, { opponentGuessColors: playerData.guessColors } );
			
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
			
			this.sendToOpponents(playerId, { opponentColors: guessColors } );
			
			return {
				guessResult: {
					word: guess,
					colors: guessColors
					}
			};
		}
	}
	
	sendPenalty(playerId) {
		let playerData = this.players.get(playerId);
		if (playerData) {
			let guessColors = this.getColors(playerData.word, "");
			playerData.guesses.push("");
			playerData.guessColors.push(guessColors);
			
			this.sendToOpponents(playerId, { opponentColors: guessColors });
			
			this.checkHasLost(playerId);
			
			sendJson(playerData.socket, {
				guessResult: {
					word: "",
					colors: guessColors
				}
			});
		}
	}
	
	// Send penalty row to all players except the one specified
	sendPenalties(fromPlayerId) {
		for (const [id, playerData] of this.players) {
			if (id !== fromPlayerId) {
				this.sendPenalty(id);
			}
		}
	}
	
	// Send own guess colors to opponents
	sendToOpponents(fromPlayerId, obj) {
		for (const [id, playerData] of this.players) {
			if (id !== fromPlayerId) {
				sendJson(playerData.socket, obj);
			}
		}
	}
	
	checkHasLost(playerId) {
		let playerData = this.players.get(playerId);
		if (playerData.guesses.length === this.amtGuesses) {
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
			  colors[i] = BLACK;
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
		this.players.set(uuidv4(), new PlayerData(ws));
	}
	
	removePlayer(playerId) {
		let playerData = this.players.get(playerId);
		
		let client = clients.get(playerData.socket);
		if (client) {
			client.game = null;
			client.playerId = null;
			clientsInLobby.add(playerData.socket);
			refreshLobby(playerData.socket);
		}
		
		this.players.delete(playerId);
		clearInterval(playerData.timer);
		
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
			gamesInLobby.delete(playerData.socket);
			clientsInLobby.delete(playerData.socket);
			
			let client = clients.get(playerData.socket);
			playerData.word = wordlist.getSolutionWord();
			if (client) {
				client.game = this;
				client.playerId = id;
			}
			playerData.startTimer(this.timeLimit, () => this.sendPenalty(id));
			sendJson(playerData.socket, this.getPlayerGameData(id));
		}
		
		refreshLobbies();
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
		
		let opponentGuessColors;
		
		for (const [id, playerData] of this.players) {
			if (id !== playerId) {
				opponentGuessColors = this.players.get(id).guessColors;
				break;
			}
		}
		
		return {
			guessColors: playerData.guessColors,
			guesses: playerData.guesses,
			wordRemove: this.wordRemove,
			hardMode: this.hardMode,
			amtGuesses: this.amtGuesses,
			gameId: this.gameId,
			playerId: playerId,
			opponentGuessColors: opponentGuessColors,
			timeLimit: this.timeLimit - 1, // Run client timer 1 second faster in case of lag to reduce possibility of timer running out on server before client
			timePassed: playerData.timePassed()
		};
	}
}

wss.on('connection', (ws) => {
	let client = {
		game: null,
		playerId: null,
	};
	
	clients.set(ws, client);
	clientsInLobby.add(ws);
	
	refreshLobby(ws);
	
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
				
				clientsInLobby.delete(ws);
				gamesInLobby.delete(ws);
				
				return sendJson(ws, client.game.getPlayerGameData(client.playerId));
			}
				
			case "join":
			{
				if (client.game) {
					return sendJson(ws, error("Attempted to join game while already in game"));
				}
				
				if (!Number.isInteger(message.wordRemove) || 
					message.wordRemove < 1 || 
					message.wordRemove > 3 ||
					!Number.isInteger(message.amtGuesses) ||
					message.amtGuesses < 6 ||
					!Number.isInteger(message.timeLimit) ||
					message.timeLimit < 0 ) {
					return sendJson(ws, error("Settings not provided for join"));
				}
				
				for (let [cws, game] of gamesInLobby.entries()) {
					if (game.hardMode === message.hardMode && game.wordRemove === message.wordRemove && game.amtGuesses === message.amtGuesses && game.timeLimit === message.timeLimit) {
						let gameId = uuidv4();
						games.set(gameId, game);
						
						game.addPlayer(ws);
						game.startGame(gameId);
						return;
					}
				}
				
				gamesInLobby.set(ws, new Game(message.wordRemove, message.amtGuesses, message.timeLimit, message.hardMode, ws));
				refreshLobbies();
				return sendJson(ws, {wait: [message.wordRemove, message.amtGuesses, message.timeLimit, message.hardMode]});
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
		gamesInLobby.delete(ws);
		clients.delete(ws);
		clientsInLobby.delete(ws);
		
		refreshLobbies();
	});
});

app.use(express.static(path.resolve(__dirname, "../client/build/")));

server.listen(PORT);