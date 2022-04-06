var GREEN = "green";
var YELLOW = "yellow";
var RED = "red";
var BLACK = "black";
var WHITE = "white";

// Get colors for a single guess
exports. = function getColors(guess, solution) {
	if (!guess) {
		return new Array(solution.length).fill(RED);
	}

	let colors = new Array(solution.length).fill("");
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

exports.hardModeCheck = function(guess, guesses, guessColors) {	
	for (let j in guessColors) {
		let row = guessColors[j];
		for (let i in row) {
			if (row[i] === GREEN) {
				if (guess[i] !== guesses[j][i]) {
					return false;
				}
			} else if (row[i] === YELLOW) {
				if (guess[i] === guesses[j][i] || !guess.includes(guesses[j][i])) {
					return false;
				}
			}
		}
	}
	return true;
}

exports.RED = RED;
exports.YELLOW = YELLOW;
exports.GREEN = GREEN;
exports.BLACK = BLACK;
exports.WHITE = WHITE;