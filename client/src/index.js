import './index.css';

import React from 'react';
import * as ReactDOMClient from 'react-dom/client';

import {SettingSelect, SettingSlider, Setting, Settings} from './settings.js';
import {KeyBoardButton, KeyBoard} from './keyboard.js';

const classNames = require('classnames');

const GREEN = "green";
const YELLOW = "yellow";
const RED = "red";
const BLACK = "black";
const WHITE = "white";

const wordlist = require("./wordlist.js");

class GuessCell extends React.Component {
  render() {
    return (
      <div className={classNames("cell", this.props.color)}>
        <div className="letter">{this.props.value}</div>
		{this.props.opponentGuessColor && <div className={classNames("opponent-color", this.props.opponentGuessColor)}></div>}
      </div>
    );
  }
}

GuessCell.defaultProps = { color: WHITE };

class GuessRow extends React.Component {
  render() {
    let boxes = [];

    for (let i = 0; i < this.props.wordLength; i++) {
      boxes.push(
        <GuessCell
          key={i}
          value={this.props.val && this.props.val.charAt(i)}
          color={this.props.colors[i]}
		  opponentGuessColor={this.props.opponentGuessColors && this.props.opponentGuessColors[i]}
        />
      );
    }

    return (
        <div className="guessrow">
          {boxes}
        </div>
    );
  }
}

GuessRow.defaultProps = { colors: {} };

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
      wordsRemoved: 0,
      wordsToRemove: 0,
      stats: Settings.loadStats(),
      settings: Settings.loadSettings(),
	  showSettings: true,
	  gameId: localStorage.getItem("gameId"),
	  playerId: localStorage.getItem("playerId"),
	  opponentGuessColors: [],
	  timePassed: 0,
	  timerStartedAt: 0
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
  }

  componentDidMount() {
    document.addEventListener("keydown", (event) => {
      if (event.which === 8) {
        // backspace
        this.removeLetter();
        return;
      }

      if (event.which === 13) {
        // enter
        this.submitGuess();
        event.preventDefault();
        return;
      }

      let key = event.key.toUpperCase();
      if (key.search(this.state.acceptedLetters) === 0) {
        this.addLetter(key);
      }
    });
	
	this.setCellDimension();
	window.addEventListener("resize", () => this.setCellDimension());
  }
  
  setCellDimension() {
	  this.setState({
		  cellDimension: Math.min(this.refGuessesContainer.current.offsetWidth / this.state.wordLength, this.refGuessesContainer.current.offsetHeight / this.state.amtGuesses)
	  });
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
			
			if (this.state.gameId && this.state.playerId) {
				this.sendJson(null);
			}
		});

	} else if (obj) {
		this.ws.send(JSON.stringify(obj));
	}
  }
  
  startGame(duel=false) {
	if (duel) {
		this.sendJson({
			  action: "join",
			  ...this.state.settings
			  });
	  } else {
		  this.setState({
			  showSettings: false,
			  solution: wordlist.getSolutionWord(),
			  guesses: [],
			  guessColors: [],
			  opponentGuessColors: [],
			  gameId: null,
			  playerId: null,
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
  
  sendPing() {
	  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
		  this.sendJson({
			  action: "ping"
		  });
	  }
  }
  
  handleServerResponse(data) {
	  if (data.error) {
		  this.showError(data.error);
	  } else if (data.success) {
		  this.showSuccess(data.success);
	  }
	  
	  let passOnParameters = ["hardMode", "wordRemove", "wordsToRemove", "amtGuesses", "timeLimit", "wait", "opponentGuessColors"];
	  
	  for (let p of passOnParameters) {
		  if (p in data) {
			  this.setState({[p]: data[p]});
		  }
	  }
	  
	  if (data.guessResult) {
		  this.setState({
			  curguess: "",
			  guesses: [...this.state.guesses, data.guessResult.word],
			  guessColors: [...this.state.guessColors, data.guessResult.colors]
		  });
		  
		  for (let i = 0; i < this.state.wordLength; i++) {
			  this.addKeyboardColor(data.guessResult.word[i], data.guessResult.colors[i]);
		  }
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
		  this.setState({timePassed: data.timePassed}, () => this.resetTimer());
	  }
	  
	  if (data.gameover) {
		  this.setGameAndPlayerId(null, null);
		  this.setState({
			  showSettings: true,
			  gameoverMessage: data.gameoverMessage
		  });
	  } else if (data.gameId && data.playerId) {
		  this.setState({
			  showSettings: false,
			  wait: false
			}, this.setCellDimension);
		  this.setGameAndPlayerId(data.gameId, data.playerId);
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

  addLetter(key) {
    if (!this.state.showSettings && this.state.curguess.length < this.state.wordLength) {
      this.setState({ curguess: this.state.curguess + key });
    }
  }

  removeLetter() {
    this.setState({ curguess: this.state.curguess.slice(0, -1) });
  }

  hardModeCheck(guess) {
    if (!this.state.hardMode) {
        return true;
    }
    for (let j in this.state.guessColors) {
      let row = this.state.guessColors[j];
      for (let i in row) {
        if (row[i] === GREEN) {
          if (guess[i] !== this.state.guesses[j][i]) {
            return false;
          }
        } else if (row[i] === YELLOW) {
          if (guess[i] === this.state.guesses[j][i] || !guess.includes(this.state.guesses[j][i])) {
            return false;
          }
        }
      }
    }
    return true;
  }f
  
  submitGuess() {
    // No submitting if game has ended or word removal animation is in progress
    if (this.state.showSettings || this.state.wordsToRemove) {
      return;
    }

    let guess = this.state.curguess;

    if (guess.length !== this.state.wordLength) {
      this.showError("Not enough letters");
      return;
    }

    if (!this.hardModeCheck(guess)) {
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
	  let newSolution = wordlist.getSolutionWord();

	  let guessColors =  [
              ...this.state.guessColors.slice(0, wordsToRemove),
              ...guesses.slice(wordsToRemove)
					.map((item, index) => {
						return this.getColors(item, newSolution);
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
    } else {
      this.addIncorrectGuess(guess);
    }
  }
  
  addIncorrectGuess(guess="") {
	  let newGuesses = [...this.state.guesses, guess];

	  if (guess) {
		this.setState({curguess: ""});
	  }

	  let newColors = this.getColors(guess, this.state.solution);

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
			showSettings: true,
			gameoverMessage: "Game Over. Solution was " + this.state.solution
		});
      }
  }

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

  getColors(guess, solution) {
	if (!guess) {
		return new Array(this.state.wordLength).fill(RED);
	}
	  
    let colors = new Array(this.state.wordLength).fill("");
	let arr_guess = [...guess];
	let arr_solution = [...solution];

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
  
  getKeyboardColors(guesses, guessColors) {
	  let keyboardColors = {}
	  for (let i in guesses) {
		  let guess = guesses[i];
		  let colorRow = guessColors[i];
		  for (let j in guess) {
			  let letter = guess[j];
			  let color = colorRow[j];
			  
			  if (!(letter in keyboardColors) || color === GREEN) {
				  keyboardColors[letter] = color;
			  }
		  }
	  }
	  
	  return keyboardColors;
  }
  
  addKeyboardColor(key, color) {
	  this.setState(prevState => { 
		  if (key in prevState.keyboardColors && color !== GREEN) {
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

  finishWordRemoval() {
    this.setState({
      guesses: this.state.guesses.slice(this.state.wordsToRemove),
      guessColors: this.state.guessColors.slice(this.state.wordsToRemove),
      wordsToRemove: 0
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
  
  showError(text, infinite = false) {
    this.showMessage(RED, text, infinite);
  }
  
  showSuccess(text, infinite = false) {
    this.showMessage(GREEN, text, infinite);
  }

  hideMessage() {
    this.setState({
      showmessage: false
    });

    this.messageHideId = 0;
  }

  resetTimer() {
	  this.refTimer.current.style.animation = "none";
	  this.refTimer.current.offsetHeight; /* eslint-disable-line */ // trigger reflow
	  this.refTimer.current.style.animation = null;
	  this.setState({timerStartedAt: new Date().getTime()});
  }
  
  timerEnded() {
	  if (!this.state.duel) {
		  this.addIncorrectGuess();
		  this.resetTimer();
	  }
  }

  render() {
	let rows = [];
    for (let i = 0; i < this.state.amtGuesses + this.state.wordsToRemove; i++) {
      rows.push(
        <GuessRow
          val={i === this.state.guesses.length ? this.state.curguess : this.state.guesses[i]}
          key={i}
          colors={this.state.guessColors[i]}
		  wordLength={this.state.wordLength}
		  opponentGuessColors={this.state.opponentGuessColors[i]}
        />
      );
    }

    return (
	  <React.StrictMode>
		<div className={classNames("game", { dark: this.state.settings.dark })}>
			<header>
				<div className="headerleft">
					Score: {this.state.score} - Highscore: {this.state.stats.high} -
					Average:{" "}
					{this.state.stats.average.toLocaleString("en-EN", {
					  maximumFractionDigits: 2
					})}
				</div>
				<div className="headertitle">
					Survordle
				</div>
				<div className="headerright"></div>
			</header>
			
			{this.state.showSettings ? (
			<Settings
			  startGame={this.startGame}
			  updateSetting={this.updateSetting}
			  settings={this.state.settings}
			  gameoverMessage={this.state.gameoverMessage}
			  wait={this.state.wait}
					  />
					) : null}

			<div
			  ref={this.refGuessesContainer}
			  className="guessescontainer"
			>
				<div className={classNames("message", { hidemessage: !this.state.showmessage, [this.state.messagecolor]: this.state.showmessage})}>
					{this.state.message}
				</div>
				<div
				  className={classNames("guessesinner", { removewords: this.state.wordsToRemove })}
				  style={{
					"--words-to-remove": this.state.wordsToRemove,
					"--cell-dimension": this.state.cellDimension + "px",
					"--amt-guesses": this.state.amtGuesses
				  }}
				  onAnimationEnd={this.finishWordRemoval}
				>
					{rows}
				</div>
			</div>
			<footer>
			<div 
				ref={this.refTimer}
				className={classNames("timer", {paused: this.state.showSettings})}
				style={{
					"--duration": this.state.timeLimit, 
					"--time-passed":  ((this.state.timerStartedAt - new Date().getTime()) / 1000 - this.state.timePassed)
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
	  </React.StrictMode>
    );
  }
}

// ========================================

ReactDOMClient.createRoot(document.getElementById("root")).render(<Game />);
