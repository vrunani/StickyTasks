import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Settings from './Settings.jsx';
import './styles.css';

// Log any script error to the app log file.
window.addEventListener('error', (e) => window.api?.logError(`${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => window.api?.logError('Unhandled: ' + e.reason));

// The settings window is the same page with #settings in the address.
const isSettings = window.location.hash.startsWith('#settings');

createRoot(document.getElementById('root')).render(isSettings ? <Settings /> : <App />);
