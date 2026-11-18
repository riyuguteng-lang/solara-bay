// Solara Bay — save and load through localStorage (this browser only).

import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch { return null; }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}
