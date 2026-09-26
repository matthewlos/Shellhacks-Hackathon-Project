import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// One family: Public Sans for everything (italic only for the Phase 2 plate caption). Atkinson Mono for code.
import '@fontsource-variable/public-sans/wght.css';
import '@fontsource-variable/public-sans/wght-italic.css';
import '@fontsource-variable/atkinson-hyperlegible-mono/wght.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
