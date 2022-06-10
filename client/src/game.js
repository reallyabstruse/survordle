import React from 'react';
import * as ReactDOMClient from 'react-dom/client';

import { Menu } from './Menu.js';
import { KeyBoard } from './Keyboard.js';
import { GameInfo } from './GameInfo.js';
import { GameBoard } from './GameBoard.js';
import { GameHeader } from './GameHeader.js';

const classNames = require('classnames');

const wordlist = require("./wordlist.js");
const shared = require("./shared.js");

class Game extends React.Component {
	constructor(props) {
		super(props);

		this.refGuessesContainer = React.createRef();
		this.refTimer = React.createRef();
		this.queuedJsonMessages = [];

		this.state = {
			wordLength: 5,
			amtGuesses: 6,
			guesses: [],
			curguess: "",
			acceptedLetters: /^[A-Z]$/,
			keyboardColors: {},
			guessColors: [],
			score: 0,
			wordsToRemove: 0,
			stats: Menu.loadStats(),
			settings: Menu.loadSettings(),
			showMenu: true,
			gameId: localStorage.getItem("gameId"),
			playerId: localStorage.getItem("playerId"),
			opponentGuessColors: [],
			timePassed: 0,
			lobby: [],
			isTest: this.props.isTest
		};

		this.sendJson(null);

		this.hideMessage = this.hideMessage.bind(this);
		this.addLetter = this.addLetter.bind(this);
		this.removeLetter = this.removeLetter.bind(this);
		this.submitGuess = this.submitGuess.bind(this);
		this.startGame = this.startGame.bind(this);
		this.updateSetting = this.updateSetting.bind(this);
		this.finishWordRemoval = this.finishWordRemoval.bind(this);
		this.sendPing = this.sendPing.bind(this);
		this.joinGame = this.joinGame.bind(this);
		this.toggleGameInfo = this.toggleGameInfo.bind(this);
	}

	componentDidMount() {
		document.addEventListener("keydown", (event) => {
			if (event.which === 8) {
				// backspace
				this.removeLetter();
				event.stopImmediatePropagation();
				return;
			}

			if (event.which === 13) {
				// enter
				this.submitGuess();
				event.preventDefault();
				event.stopImmediatePropagation();
				return;
			}

			if (event.which === 27) {
				// esc
				this.toggleGameInfo(false);
				return;
			}


			let key = event.key.toUpperCase();
			if (key.search(this.state.acceptedLetters) === 0) {
				this.addLetter(key);
				event.stopImmediatePropagation();
			}
		});

		this.setCellDimension();
		window.addEventListener("resize", () => this.setCellDimension());
	}

	// Immediately start a solo game or send server request to start a duel game.
	startGame(duel = false) {
		if (duel) {
			this.sendJson({
				action: "join",
				...this.state.settings
			});
		} else {
			this.setState({
				showMenu: false,
				score: 0,
				solution: wordlist.getSolutionWord(this.state.isTest),
				guesses: [],
				guessColors: [],
				keyboardColors: {},
				opponentGuessColors: [],
				gameId: null,
				playerId: null,
				wait: null,
				...this.state.settings
			}, this.setCellDimension);

			this.resetTimer();

			if (this.ws) {
				this.ws.close();
				this.ws = null;
			}
		}

		this.setState({ duel: duel });
	}
	
	// Verify validity of guess and either add it to guesses or send it to server for processing.
	submitGuess() {
		// No submitting if game has ended or word removal animation is in progress
		if (this.state.showMenu || this.state.wordsToRemove) {
			return;
		}

		let guess = this.state.curguess;

		if (guess.length !== this.state.wordLength) {
			this.showError("Not enough letters");
			return;
		}

		if (this.state.hardMode && !shared.hardModeCheck(guess, this.state.guesses, this.state.guessColors)) {
			this.showError("Must abide by old hints in hard mode");
			return;
		}

		if (!wordlist.isValidWord(guess)) {
			this.showError("Invalid word");
			return;
		}

		if (this.state.duel) {
			return this.sendJson({
				action: "guess",
				guess: guess
			});
		}

		this.resetTimer();

		if (guess === this.state.solution) {
			this.showSuccess("Correct!");

			// Remove some guesses, but always leave the last guess
			let wordsToRemove = Math.min(
				this.state.wordRemove,
				this.state.guesses.length
			);

			let guesses = [...this.state.guesses, guess];
			let newSolution = wordlist.getSolutionWord(this.state.isTest);

			let guessColors = [
				...this.state.guessColors.slice(0, wordsToRemove),
				...guesses.slice(wordsToRemove)
					.map((item, index) => {
						return shared.getColors(item, newSolution);
					})
			];

			this.setState(
				{
					curguess: "",
					guesses: guesses,
					score: this.state.score + 1,
					solution: newSolution,
					wordsToRemove: wordsToRemove,
					guessColors: guessColors,
					keyboardColors: this.getKeyboardColors(guesses.slice(wordsToRemove), guessColors.slice(wordsToRemove))
				}
			);
			
			if (this.state.isTest) {
				this.finishWordRemoval();
			}
		} else {
			this.addIncorrectGuess(guess);
		}
	}
	
	handleServerResponse(data) {
		if (data.error) {
			this.showError(data.error);
		} else if (data.success) {
			this.showSuccess(data.success);
		}

		let passOnParameters = ["hardMode", "wordRemove", "wordsToRemove", "amtGuesses", "timeLimit", "wait", "opponentGuessColors", "lobby"];

		for (let p of passOnParameters) {
			if (p in data) {
				this.setState({ [p]: data[p] });
			}
		}

		// process result of incorrect guess
		if (data.guessResult) {
			this.setState({
				curguess: data.guessResult.word ? "" : this.state.curguess, // Remove current guess if not a penalty row
				guesses: [...this.state.guesses, data.guessResult.word],
				guessColors: [...this.state.guessColors, data.guessResult.colors]
			});

			for (let i = 0; i < this.state.wordLength; i++) {
				this.addKeyboardColor(data.guessResult.word[i], data.guessResult.colors[i]);
			}
		// process complete list of all guesses and colors
		} else if (data.guesses && data.guessColors) {
			this.setState({
				guessColors: [...this.state.guessColors.slice(0, data.wordsToRemove || 0), ...data.guessColors],
				keyboardColors: this.getKeyboardColors(data.guesses, data.guessColors),
				curguess: "",
				guesses: [...this.state.guesses.slice(0, data.wordsToRemove || 0), ...data.guesses]
			});
		}

		if (data.opponentColors) {
			this.setState({
				opponentGuessColors: [...this.state.opponentGuessColors, data.opponentColors]
			});
		}

		if ("timePassed" in data) {
			this.setState({ timePassed: data.timePassed }, () => this.resetTimer());
		}

		if (data.gameover) {
			this.setGameAndPlayerId(null, null);
			this.setState({
				showMenu: true,
				gameoverMessage: data.gameoverMessage
			});
		} else if (data.gameId && data.playerId) {
			this.setState({
				showMenu: false,
				wait: null
			}, this.setCellDimension);
			this.setGameAndPlayerId(data.gameId, data.playerId);
		}
	}
	
	// Call with null to ensure that connected and send rejoin if game in progress
	sendJson(obj) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			if (obj) {
				this.queuedJsonMessages.push(JSON.stringify(obj));
			}

			// If already connecting just wait for it to connect and queue the message
			if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
				return;
			}

			if (window.location.host.indexOf("localhost") >= 0) {
				this.ws = new WebSocket('ws://localhost:3001');
			} else {
				this.ws = new WebSocket('wss://' + window.location.host);
			}

			this.ws.addEventListener('open', e => {
				this.ws.addEventListener('message', e => {
					this.handleServerResponse(JSON.parse(e.data));
				});

				if (this.state.gameId && this.state.playerId) {
					this.ws.send(JSON.stringify({
						action: "rejoin",
						gameId: this.state.gameId,
						playerId: this.state.playerId
					}));
				}

				for (let msg of this.queuedJsonMessages) {
					this.ws.send(msg);
				}

				this.queuedJsonMessages = [];
				this.pingInterval = setInterval(this.sendPing, 10000);
			});

			this.ws.addEventListener('close', e => {
				this.ws = null;
				clearInterval(this.pingInterval);
			});
			
			this.ws.addEventListener('error', (e) => {				
				this.ws = null;
				clearInterval(this.pingInterval);
				
				if (this.showMenu || this.state.gameId) {
					this.showError("Error connecting to server, reattempting.");
					setTimeout(this.sendJson(null), 1000); // reconnect
				}
			});

		} else if (obj) {
			this.ws.send(JSON.stringify(obj));
		}
	}

	joinGame(settingsArr) {
		this.sendJson({
			action: "join",
			wordRemove: settingsArr[0],
			amtGuesses: settingsArr[1],
			timeLimit: settingsArr[2],
			hardMode: settingsArr[3],
		});
	}

	sendPing() {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.sendJson({
				action: "ping"
			});
		}
	}

	setGameAndPlayerId(gameId, playerId) {
		this.setState({
			gameId: gameId,
			playerId: playerId,
			duel: true
		});

		if (gameId && playerId) {
			localStorage.setItem("gameId", gameId);
			localStorage.setItem("playerId", playerId);
		} else {
			localStorage.removeItem("gameId");
			localStorage.removeItem("playerId");
		}
	}

	// Add a letter to the current guess
	addLetter(key) {
		if (!this.state.showMenu && this.state.curguess.length < this.state.wordLength) {
			this.setState({ curguess: this.state.curguess + key });
		}
	}

	// Remove last letter from current guess (backspace)
	removeLetter() {
		this.setState({ curguess: this.state.curguess.slice(0, -1) });
	}

	// Solo game only. Add an incorrect guess or by default a penalty row
	addIncorrectGuess(guess = "") {
		let newGuesses = [...this.state.guesses, guess];

		if (guess) {
			this.setState({ curguess: "" });
		}

		let newColors = shared.getColors(guess, this.state.solution);

		this.setState({
			guesses: newGuesses,
			guessColors: [...this.state.guessColors, newColors]
		});

		for (let i = 0; i < guess.length; i++) {
			this.addKeyboardColor(guess[i], newColors[i]);
		}

		if (newGuesses.length >= this.state.amtGuesses) {
			this.updateStats();
			this.setState({
				showMenu: true,
				gameoverMessage: "Game Over. Solution was " + this.state.solution
			});
			this.sendJson(null);
		}
	}

	// Change a setting
	updateSetting(name, val) {
		if (typeof val === "string") {
			val = parseInt(val);
		}

		this.setState({ settings: { ...this.state.settings, [name]: val } }, () => {
			localStorage.setItem("settings", JSON.stringify(this.state.settings));
		});
	}

	updateStats() {
		let sum = this.state.stats.games * this.state.stats.average;
		sum += this.state.score;

		let games = this.state.stats.games + 1;

		this.setState(
			{
				stats: {
					games: this.state.stats.games + 1,
					average: sum / games,
					high: Math.max(this.state.stats.high, this.state.score)
				}
			},
			() => {
				localStorage.setItem("stats", JSON.stringify(this.state.stats));
			}
		);
	}

	// Get all the colors for the keyboard keys based on the given guess colors.
	getKeyboardColors(guesses, guessColors) {
		let keyboardColors = {}
		for (let i in guesses) {
			let guess = guesses[i];
			let colorRow = guessColors[i];
			for (let j in guess) {
				let letter = guess[j];
				let color = colorRow[j];

				if (!(letter in keyboardColors) || color === shared.GREEN) {
					keyboardColors[letter] = color;
				}
			}
		}

		return keyboardColors;
	}

	// Add a single color to a keyboard key, unless the key already has a higher priority color.
	addKeyboardColor(key, color) {
		this.setState(prevState => {
			if (key in prevState.keyboardColors && color !== shared.GREEN) {
				return {};
			}

			return {
				keyboardColors: {
					...prevState.keyboardColors,
					[key]: color
				}
			}
		});
	}

	// Called on end of slide out animation for removing words
	finishWordRemoval() {
		this.setState(prevState => { 
			return {
				guesses: prevState.guesses.slice(prevState.wordsToRemove),
				guessColors: prevState.guessColors.slice(prevState.wordsToRemove),
				wordsToRemove: 0
			}
		});
		
	}

	showMessage(color, text, infinite = false) {
		this.setState({
			messagecolor: color,
			showmessage: true,
			message: text
		});

		clearTimeout(this.messageHideId);
		this.messageHideId = setTimeout(this.hideMessage, 1000);
	}

	hideMessage() {
		this.setState({
			showmessage: false
		});

		this.messageHideId = 0;
	}

	showError(text, infinite = false) {
		this.showMessage(shared.RED, text, infinite);
	}

	showSuccess(text, infinite = false) {
		this.showMessage(shared.GREEN, text, infinite);
	}
	
	// Display or hide game info menu. Default toggle.
	toggleGameInfo(show = undefined) {
		this.setState({ showGameInfo: show === undefined ? !this.state.showGameInfo : show });
	}
	
	// Set dimensions of each cell in guesses
	setCellDimension() {
		this.setState({
			cellDimension: Math.min(this.refGuessesContainer.current.offsetWidth / this.state.wordLength, 
				this.refGuessesContainer.current.offsetHeight / this.state.amtGuesses) - 1
		});
	}

	resetTimer() {
		this.refTimer.current.style.animation = "none";
		this.refTimer.current.offsetHeight; /* eslint-disable-line */ // trigger reflow
		this.refTimer.current.style.animation = null;
	}

	timerEnded() {
		if (!this.state.duel) {
			this.addIncorrectGuess();
			this.resetTimer();
		}
	}

	render() {
		return (
				<div className={classNames("game", { dark: this.state.settings.dark })}>
					<GameHeader
						score={this.state.score}
						duel={this.state.duel}
						stats={this.state.stats}
						toggleGameInfo={this.toggleGameInfo}/>

					<div
						ref={this.refGuessesContainer}
						className="guessescontainer"
					>
						<div className={classNames("message", { hidemessage: !this.state.showmessage, [this.state.messagecolor]: this.state.showmessage })}>
							{this.state.message}
						</div>
						<GameBoard 
							amtGuesses={this.state.amtGuesses}
							wordsToRemove={this.state.wordsToRemove}
							guesses={this.state.guesses}
							curguess={this.state.curguess}
							guessColors={this.state.guessColors}
							wordLength={this.state.wordLength}
							opponentGuessColors={this.state.opponentGuessColors}
							cellDimension={this.state.cellDimension}
							finishWordRemoval={this.finishWordRemoval}/>
					</div>
					
					{this.state.showMenu &&
						<Menu
							startGame={this.startGame}
							updateSetting={this.updateSetting}
							settings={this.state.settings}
							gameoverMessage={this.state.gameoverMessage}
							wait={this.state.wait}
							lobby={this.state.lobby}
							joinGame={this.joinGame}
						/>
					}

					{this.state.showGameInfo && <GameInfo hide={() => this.toggleGameInfo()} />}
					
					<footer>
						<div
							ref={this.refTimer}
							className={classNames({ timer: this.state.timeLimit, paused: this.state.showMenu })}
							style={{
								"--duration": this.state.timeLimit,
								"--time-passed": this.state.timePassed
							}}
							onAnimationEnd={() => this.timerEnded()}
						></div>
						<KeyBoard
							colors={this.state.keyboardColors}
							addLetter={this.addLetter}
							removeLetter={this.removeLetter}
							submitGuess={this.submitGuess}
						/>
					</footer>
				</div>
		);
	}
}

export {Game};

