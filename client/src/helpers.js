import React from 'react';

const classNames = require('classnames');

const GREEN = "green";
const YELLOW = "yellow";
const RED = "red";
const BLACK = "black";
const WHITE = "white";


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
        <div className="guessrow" style={{"--cell-dimension": this.props.cellDimension}}>
          {boxes}
        </div>
    );
  }
}

GuessRow.defaultProps = { colors: {} };

class GameInfo extends React.Component {
  render() {
	let messageDiv = this.props.gameoverMessage ? <div className="gameover-message">{this.props.gameoverMessage}</div> : null;
	  
    return (
      <>
        <div className="overlay" onClick={this.props.hide}></div>
        <div className="popup">
			<h2>Basics</h2>
			<div>The goal of the game is to correctly guess as many five-letter words as possible with a limited amount of guesses. Every guess gives you colorcoded feedback on each letter you have guesses.</div>

<h2>Example</h2>
<GuessRow wordLength="5" cellDimension="5vmin" val="WORLD" colors={[GREEN, BLACK, YELLOW, BLACK, BLACK]}/>
<div>In this word the W is in the correct position, the R is in the word but not in the given position and the letters O, L and D are not in the word. A possible correct solution would be WRITE.</div>
<h2>Gameplay</h2>
<div>Once the correct word is guessed some of your previous guesses are removed and the colors are changed to give information about the next word. If you run out of guesses the game ends.</div>
<h2>Duel</h2>
<div>In a duel you play against another player. Every correct guess will add a penalty row to the opponent leaving them with one less possible guess. The last player to run out of guesses wins.</div>

<h2>The game can be customized with various settings:</h2>
<ul>
	<li>Words to remove: How many of your previous guesses to remove upon a correct guess</li>
	<li>Available guesses: How many times you can guess during the game</li>
	<li>Time limit: A guess must be made within this time limit to avoid receiving a penalty row</li>
	<li>Hard mode: Every guess must respect the yellow and green hints from previous guesses</li>
</ul>

<div>Game is inspired by <a href="https://www.nytimes.com/games/wordle/index.html">Wordle</a></div>

<div>Created by Sindre Dammann</div>
        </div>
      </>
    );
  }
}

export {GameInfo, GuessRow, GREEN, YELLOW, BLACK, WHITE, RED};