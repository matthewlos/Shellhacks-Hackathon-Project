import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyBrand } from './brand';
import { startBoard, useApp } from './data/store';
import './styles.css';

applyBrand();
startBoard();
// ?debug exposes the store for scripted testing (tools/shots.mjs)
if (new URLSearchParams(location.search).has('debug')) Object.assign(window as object, { soil: { app: useApp } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
