import React from 'react';

const classNames = require('classnames');


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


export {GuessRow};