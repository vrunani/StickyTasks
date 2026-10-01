// Validated app settings, stored in the SQLite settings table.
const db = require('./db');

const toBool = (v) => v === true || v === 'true';

const DEFS = {
  theme:          { type: 'string', def: 'yellow', ok: (v) => ['system', 'yellow', 'dark', 'blue', 'pink', 'green'].includes(v) },
  font_size:      { type: 'string', def: 'm',      ok: (v) => ['s', 'm', 'l'].includes(v) },
  opacity:        { type: 'number', def: 100,      ok: (v) => Number.isFinite(v) && v >= 50 && v <= 100 },
  autoclean_days: { type: 'number', def: 1,        ok: (v) => v === 1 || v === 7 },
  autostart:      { type: 'bool',   def: true,     ok: (v) => typeof v === 'boolean' },
  hotkey:         { type: 'bool',   def: true,     ok: (v) => typeof v === 'boolean' }
};

function coerce(def, v) {
  if (def.type === 'number') return Math.round(Number(v));
  if (def.type === 'bool') return toBool(v);
  return String(v);
}

function get(key) {
  const def = DEFS[key];
  if (!def) throw new Error('Unknown setting: ' + key);
  const raw = db.getSetting(key);
  if (raw === null) return def.def;
  const v = coerce(def, raw);
  return def.ok(v) ? v : def.def;
}

function set(key, value) {
  const def = DEFS[key];
  if (!def) throw new Error('Unknown setting: ' + key);
  const v = coerce(def, value);
  if (!def.ok(v)) throw new Error(`Bad value for ${key}: ${value}`);
  db.setSetting(key, String(v));
  return v;
}

function getAll() {
  const out = {};
  for (const k of Object.keys(DEFS)) out[k] = get(k);
  return out;
}

module.exports = { get, set, getAll, DEFS };
