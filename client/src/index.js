import './index.css';

import React from 'react';
import ReactDOM from 'react-dom';

import { Game } from './game.js';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Game />
  </React.StrictMode>
);
