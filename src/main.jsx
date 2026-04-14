import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Error boundary for top-level catastrophic failures
const root = document.getElementById('root');
if (!root) {
  console.error('FATAL: main.jsx — #root element not found in DOM');
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
