import { GuessRow } from './GuessRow.js';

const classNames = require('classnames');

function GameBoard(props) {
	let rows = [];
	for (let i = 0; i < props.amtGuesses + props.wordsToRemove; i++) {
		rows.push(
			<GuessRow
				val={i === props.guesses.length ? props.curguess : props.guesses[i]}
				key={i}
				colors={props.guessColors[i]}
				wordLength={props.wordLength}
				opponentGuessColors={props.opponentGuessColors[i]}
			/>
		);
	}

	return (<div className={classNames("guessesinner", { removewords: props.wordsToRemove })}
						style={{
							"--words-to-remove": props.wordsToRemove,
							"--cell-dimension": props.cellDimension + "px",
							"--amt-guesses": props.amtGuesses
						}}
						onAnimationEnd={props.finishWordRemoval}
			>
				{rows}
			</div>);
		
}

export {GameBoard};