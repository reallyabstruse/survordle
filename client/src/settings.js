import React from 'react';

const classNames = require('classnames');

class SettingSelect extends React.Component {
	render() {
		let options = [];

		for (let i in this.props.options) {
			let val = this.props.options[i];
		let valTitle = this.props.optionTitles ? this.props.optionTitles[i] : val;
			options.push(
				<option key={i} value={val}>
					{valTitle}
				</option>
			);
		}

		return (
			<select
				value={this.props.value}
				onChange={(e) =>
					this.props.updateHandler(this.props.name, e.target.value)
				}
			>
				{options}
			</select>
		);
	}
}

class SettingSlider extends React.Component {
	render() {
		return (
			<label className="switch">
				<input
					onChange={(e) =>
						this.props.updateHandler(this.props.name, e.target.checked)
					}
					defaultChecked={this.props.value}
					type="checkbox"
				/>
				<div className="slider"></div>
			</label>
		);
	}
}

class Setting extends React.Component {
	render() {
		let inputElement = this.props.options ? (
			<SettingSelect {...this.props} />
		) : (
			<SettingSlider {...this.props} />
		);

		return (
			<div className="setting">
				<div className="title">{this.props.title}</div>
				<div className="options">{inputElement}</div>
			</div>
		);
	}
}

class Settings extends React.Component {
	static loadSettings() {
		let settings = JSON.parse(localStorage.getItem("settings"));
		if (!settings) {
			settings = {};
		}

		if (!Number.isInteger(settings.wordRemove) || settings.wordRemove < 1) {
			settings.wordRemove = 2;
		}
	
	if (!Number.isInteger(settings.amtGuesses) || settings.amtGuesses < 6) {
			settings.amtGuesses = 6;
		}
	
	if (!Number.isInteger(settings.timeLimit) || settings.timeLimit < 0) {
			settings.amtGuesses = 60;
		}
	
		return settings;
	}
	
	static loadStats() {
		let stats = JSON.parse(localStorage.getItem("stats"));

		if (!stats) {
			stats = {};
		}

		if (!Number.isInteger(stats.games)) {
			stats.games = 0;
		}
		if (!Number.isInteger(stats.high)) {
			stats.high = 0;
		}
		if (!Number.isFinite(stats.average)) {
			stats.average = 0;
		}

		return stats;
	}

	valueToString(val) {
		if (Number.isInteger(val)) {
			return val || "∞";
		}
		
		return val ? "On" : "Off";
	}
	
	gameArrayToDOM(arr) {
		return arr.map((val, i) => <td key={i}>{this.valueToString(val)}</td>);
	}
	
	render() {
	let messageDiv = this.props.gameoverMessage ? <div className="gameover-message">{this.props.gameoverMessage}</div> : null;
		
		return (
			<>
				<div className="overlay"></div>
				<div className="popup">
			{messageDiv}
			<div>
				<Setting
				title="Words to remove on correct guess"
				name="wordRemove"
				options={[1, 2, 3]}
				value={this.props.settings["wordRemove"]}
				updateHandler={this.props.updateSetting}
				/>
				<Setting
				title="Available guesses"
				name="amtGuesses"
				options={[6, 8, 10]}
				value={this.props.settings["amtGuesses"]}
				updateHandler={this.props.updateSetting}
				/>
				<Setting
				title="Time limit to make guess"
				name="timeLimit"
				options={[0, 10, 30, 60, 120]}
				optionTitles={["No limit", "10 seconds", "30 seconds", "1 minute", "2 minutes"]}
				value={this.props.settings["timeLimit"]}
				updateHandler={this.props.updateSetting}
				/>
				<Setting
				title="Hard mode"
				name="hardMode"
				value={this.props.settings["hardMode"]}
				updateHandler={this.props.updateSetting}
				/>
				<Setting
				title="Dark mode"
				name="dark"
				value={this.props.settings["dark"]}
				updateHandler={this.props.updateSetting}
				/>
				
				<div className="start-buttons">
					<button onClick={() => this.props.startGame(false)}>Start Solo Game</button>
					<button onClick={() => this.props.startGame(true)}>Start Duel Game</button>
				</div>
			</div>
			<div className="lobby">
			<div className="lobby-title">
				Lobby
			</div>
			<table>
				<thead>
					<tr><th></th><th>Word remove</th><th>Guesses</th><th>Time</th><th>Hard mode</th></tr>
				</thead>
				<tbody>
					{this.props.wait && <tr className="own-game-lobby">
						<td><div className="spinner"></div></td>
						{this.gameArrayToDOM(this.props.wait)}
						</tr>}
					{this.props.lobby.map((arr, i) => 
						<tr className="lobby-game" key={i} onClick={() => this.props.joinGame(arr)}>
							<td></td>
							{this.gameArrayToDOM(arr)}
						</tr>
					)}
					{!this.props.lobby.length && !this.props.wait && <tr><td colspan="5">No games in lobby</td></tr>}
				</tbody>
			</table>
			</div>
				</div>
			</>
		);
	}
}

export {SettingSelect, SettingSlider, Setting, Settings};