import { GuessRow } from './GuessRow.js';

const shared = require("./shared.js");

function GameInfo(props) { 
	return (<>
		<div className="overlay" onClick={props.hide}></div>
		<div className="popup">
			<h2>Basics</h2>
			<div>The goal of the game is to correctly guess as many five-letter words as possible with a limited amount of guesses. Every guess gives you colorcoded feedback on each letter you have guessed. Once the correct word is guessed some of your previous guesses are removed and the colors are changed to give information about the next word. If you run out of guesses the game ends.</div>

			<h2>Example</h2>
			<GuessRow wordLength="5" cellDimension="5vmin" val="WORLD" colors={[shared.GREEN, shared.BLACK, shared.YELLOW, shared.BLACK, shared.BLACK]}/>
			<div>In this word the W is in the correct position, the R is in the word but not in the given position and the letters O, L and D are not in the word. A possible correct solution would be WRITE.</div>
			
			<h2>Duel</h2>
			<div>In a duel you play against another player. Every correct guess will give a penalty row to the opponent leaving them with one less possible guess. The last player to run out of guesses wins. Small colored circles show you your opponent's progress.</div>

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
	</>);
};

export {GameInfo};