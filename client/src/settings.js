import React from 'react';

const classNames = require('classnames');

class SettingSelect extends React.Component {
  render() {
    let options = [];

    for (let i in this.props.options) {
      let val = this.props.options[i];
      options.push(
        <option key={i} value={val}>
          {val}
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
  render() {
	let messageDiv = this.props.gameoverMessage ? <div className="gameover-message">{this.props.gameoverMessage}</div> : null;
	  
    return (
      <>
        <div className="overlay"></div>
        <div className="popup">
		{messageDiv}
          <Setting
            title="Words to remove on correct guess"
            name="wordRemove"
            options={[1, 2, 3]}
            value={this.props.settings["wordRemove"]}
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
		  
		  <button onClick={() => this.props.startGame(false)}>Start Solo Game</button>
		  <button onClick={() => this.props.startGame(true)}>Start Duel Game</button>{this.props.wait ? "Please wait..." : null}
        </div>
      </>
    );
  }
}

export {SettingSelect, SettingSlider, Setting, Settings};