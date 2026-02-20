import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Note: StrictMode intentionally omitted — it double-fires effects in dev,
// which conflicts with the imperative ArcGIS MapView lifecycle.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
