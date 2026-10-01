// Tiny file logger: %APPDATA%\StickyTasks\logs\app.log (rotates at 512 KB).
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let dir = null;
let file = null;

function init() {
  try {
    dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, 'app.log');
    try {
      if (fs.statSync(file).size > 512 * 1024) fs.renameSync(file, path.join(dir, 'app.old.log'));
    } catch {
      /* no log yet */
    }
  } catch {
    file = null;
  }
}

function fmt(a) {
  if (a instanceof Error) return a.stack || a.message;
  if (typeof a === 'string') return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function write(level, args) {
  const line = `${new Date().toISOString()} [${level}] ${args.map(fmt).join(' ')}\n`;
  try {
    if (file) fs.appendFileSync(file, line);
  } catch {
    /* ignore */
  }
  if (!app.isPackaged) console.log(line.trim());
}

module.exports = {
  init,
  info: (...a) => write('INFO', a),
  warn: (...a) => write('WARN', a),
  error: (...a) => write('ERROR', a),
  dir: () => dir
};
