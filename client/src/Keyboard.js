import React from 'react';

class KeyBoard extends React.Component {
	symbolToKey(symbol) {
		if (symbol === "#") {
			return "\u2003⌫\u00A0";
		}
		if (symbol === "*") {
			return "ENTER";
		}
		return symbol;
	}

	symbolToHandler(symbol) {
		if (symbol === "#") {
			return this.props.removeLetter;
		}
		if (symbol === "*") {
			return this.props.submitGuess;
		}
		return this.props.addLetter;
	}

	render() {
		let keys = "QWERTYUIOP ASDFGHJKL #ZXCVBNM*";

		let keydata = [...keys].map((item, index) => {
			if (item === " ") {
				return <div className="break" key={index}></div>;
			}

			return (
				<KeyBoardButton
					value={this.symbolToKey(item)}
					key={index}
					color={this.props.colors[item] || ""}
					clickhandler={this.symbolToHandler(item)}
				/>
			);
		});
		return <div className="keyboard">{keydata}</div>;
	}
}

function KeyBoardButton(props) {
	return (
		<button onClick={() => props.clickhandler(props.value)} className={"button " + props.color}>
			{props.value}
		</button>
	);
}

export { KeyBoardButton, KeyBoard };