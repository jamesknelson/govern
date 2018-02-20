import * as Govern from "govern";
import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { AppStore } from './AppStore';

let appStore = Govern.instantiate(<AppStore />);

ReactDOM.render(<App store={appStore} />, document.getElementById('root'));
