import {render, fireEvent, screen, waitFor} from '@testing-library/react'
import {Game} from './game.js'

const domTestingLib = require('@testing-library/dom')
const {queryHelpers} = domTestingLib

function getAllLetters() {
	return screen.queryAllByRole((role, element) => role === "cell" && element.getAttribute("name") === "letter");
}

function testWord(word, colorsWord, lettersAfter) {
	// Type word
	for (let c of word) {
		let ct = getAllLetters().length;
		
		pressButton(c);
		
		if (getAllLetters().length != ct + 1) {
			throw queryHelpers.getElementError(`Letter not added: ${c} count ${ct}`)
		}
	}
	
	pressEnter();
  
	// Check expected colors
	let lettersList = getAllLetters();
  
	for (let i = 0; i < word.length; i++) {	
		let letterCell = lettersList[lettersAfter + i - word.length];		
		let color = letterCell.getAttribute("state");
		
		if (colorsWord[i]) {
			if (color !== colorsWord[i]) {
				throw queryHelpers.getElementError(`Wrong letter colour in word ${word} index ${i} expected ${colorsWord[i]} has ${color}`)
			}
		} else { 
			if (color) {
				throw queryHelpers.getElementError(`Should not have letter colour in word ${word} index ${i} has ${color}`)
			}
		}
	}
	
	// Check expected amount of letters on screen
	expect(getAllLetters()).toHaveLength(lettersAfter);
}

function testKeyboardColor(arr, colorName) {
	let buttons = screen.queryAllByRole((role, element) => role === "button" && element.name === "key" && arr.split('').find(value => value.match(element.textContent) !== null));
	buttons.forEach((button) => {
		let state = button.getAttribute("state");
		if (state !== colorName) {
			throw queryHelpers.getElementError(`Keyboard key ${button.textContent} should have color ${colorName} has ${state}`);
		}
	});
}

function testAllKeyboardColors(greens, yellows, blacks) {
	testKeyboardColor(greens, "green");
	testKeyboardColor(yellows, "yellow");
	testKeyboardColor(blacks, "black");
	
	// Test that remaining buttons have no color
	let arrKnownKeys = (greens + yellows + blacks).split('');
	let buttons = screen.queryAllByRole((role, element) => role === "button" && element.name === "key" && !arrKnownKeys.find(value => value.match(element.textContent) !== null));
	
	buttons.forEach((button) => {
		let state = button.getAttribute("state");
		if (state) {
			throw queryHelpers.getElementError(`Keyboard key ${button.textContent} should not have a color has '${state}'`);
		}
	});
}

let pressButton = function(c) {
	fireEvent.click(screen.getByText(c, {selector: ".button"}));
}

let pressBackspace = function() {
	fireEvent.click(screen.getByText("\u232B"));
}

let pressEnter = function() {
	fireEvent.click(screen.getByText("ENTER"));
}

test('Solo game test', () => { const { container } = render(<Game isTest="true"/>);
	window.container = container;

	expect(screen.queryByText("Lobby")).toBeInTheDocument();

	// Start game
	fireEvent.click(screen.getByText(/Solo/i));
	expect(screen.queryByText("Lobby")).toBeNull();
	expect(getAllLetters()).toHaveLength(0);
	expect(screen.queryByText(/Score: 0/i)).toBeInTheDocument();

	// Test info screen
	expect(screen.queryByText("Basics")).toBeNull();
	fireEvent.click(screen.getByText("?"));
	expect(screen.queryByText("Basics")).toBeInTheDocument();
	fireEvent.click(screen.getByText("?"));
	expect(screen.queryByText("Basics")).toBeNull();

	// Test too short word 
	testWord("ABC", ["", "", ""], 3);
	testAllKeyboardColors("", "", "");
	expect(screen.queryByText(/Not enough letters/i)).toBeInTheDocument();

	// Test invalid word 
	testWord("DE", ["", ""], 5);
	testAllKeyboardColors("", "", "");
	expect(screen.queryByText(/Invalid word/i)).toBeInTheDocument();

	// Test erase input
	for (let i = 0; i < 5; i++) {
	  pressBackspace();
	}

	expect(getAllLetters()).toHaveLength(0);


	// Test gameplay
	testWord("CREAM", ["green", "yellow", "black", "green", "black"], 5);
	testAllKeyboardColors("CA", "R", "EM");
	testWord("TACKY", ["black", "yellow", "yellow", "black", "black"], 10);
	testAllKeyboardColors("CA", "R", "EMTKY");

	// Test correct guess
	testWord("CIGAR", ["black", "black", "black", "black", "yellow"], 5);
	testAllKeyboardColors("", "R", "CIGA");

	testWord("REARS", ["green", "green", "black", "black", "black"], 10);
	testAllKeyboardColors("RE", "", "CIGAS");
	testWord("SHARE", ["black", "black", "black", "yellow", "yellow"], 15);
	testAllKeyboardColors("RE", "", "CIGASH");
	testWord("RAZOR", ["green", "black", "black", "black", "black"], 20);
	testAllKeyboardColors("RE", "", "CIGASHZO");
	testWord("EARLS", ["yellow", "black", "yellow", "black", "black"], 25);
	testAllKeyboardColors("RE", "", "CIGASHZOLS");

	// Test correct guess
	testWord("REBUT", ["black", "black", "black", "black", "black"], 20);
	testAllKeyboardColors("S", "", "HARERZOLBUT");

	testWord("PISSY", ["black", "green", "green", "green", "green"], 25);
	testAllKeyboardColors("SIY", "", "HARERZOLBUTP");

	// Test losing
	testWord("LOSER", ["black", "black", "green", "black", "black"], 30);
	testAllKeyboardColors("SIY", "", "HARERZOLBUTP");
	expect(screen.queryByText("Lobby")).toBeInTheDocument();
	expect(screen.queryByText(/Score: 2/i)).toBeInTheDocument();
});