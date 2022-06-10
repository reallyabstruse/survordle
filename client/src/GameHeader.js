const classNames = require('classnames');

function GameHeader(props) {
 return (
	<header>
		<div className="headerleft">
			{props.duel || <div>Score: {props.score}</div>}
			<div>Best: {props.stats.high}</div>
			<div>Average: {props.stats.average.toLocaleString("en-EN", {
					maximumFractionDigits: 2
				})}
			</div>
		</div>
		<div className="headertitle">
			Survordle
		</div>
		<div className="headerright">
			<button className="game-info-button" onClick={() => props.toggleGameInfo()}>?</button>
		</div>
	</header>
	);
}

export {GameHeader};