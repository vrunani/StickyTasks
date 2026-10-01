const {
  app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, nativeTheme, screen,
  powerMonitor, globalShortcut, dialog, shell
} = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const settings = require('./settings');
const log = require('./logger');
const reminders = require('./reminders');
const updater = require('./updater');

const isDev = !app.isPackaged;
const PRELOAD = path.join(__dirname, 'preload.js');
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');
const HOTKEY = 'CommandOrControl+Shift+T';
const THEME_BG = { yellow: '#ffef8a', dark: '#262830', blue: '#cfe8ff', pink: '#ffd9ea', green: '#d6f3c6' };

let noteWin = null;
let bubbleWin = null;
let settingsWin = null;
let tray = null;
let isQuitting = false;
let hotkeyOk = true;

process.on('uncaughtException', (e) => log.error('uncaughtException', e));
process.on('unhandledRejection', (e) => log.error('unhandledRejection', e));

// ---------- helpers ----------
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 100;

// If the saved position is off-screen (monitor removed), fall back to default.
function visibleBounds(saved, fallback) {
  if (!saved) return fallback;
  const ok = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    const overlapX = Math.min(saved.x + saved.width, a.x + a.width) - Math.max(saved.x, a.x);
    const overlapY = Math.min(saved.y + saved.height, a.y + a.height) - Math.max(saved.y, a.y);
    return overlapX > 60 && overlapY > 40;
  });
  return ok ? saved : fallback;
}

function setState(s) {
  db.setSetting('last_state', s); // 'note' | 'bubble' | 'closed'
}

function resolvedTheme() {
  const t = settings.get('theme');
  if (t === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'yellow';
  return t;
}

function snapshot() {
  return {
    ...settings.getAll(),
    themeResolved: resolvedTheme(),
    hotkeyOk,
    version: app.getVersion(),
    dataPath: app.getPath('userData'),
    isPackaged: app.isPackaged
  };
}

function broadcastSettings() {
  const s = snapshot();
  for (const w of [noteWin, settingsWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('settings:changed', s);
  }
}

function loadPage(win, hash = '') {
  if (isDev) win.loadURL('http://localhost:5173/' + hash);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: hash.replace('#', '') });
}

// Windows can only show our own pages. No random navigation, no pop-ups.
function lockdown(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    try {
      const u = new URL(url);
      if (u.protocol === 'file:' || u.origin === 'http://localhost:5173') return;
    } catch {
      /* fall through */
    }
    e.preventDefault();
  });
  win.webContents.on('render-process-gone', (_e, d) => {
    log.error('renderer gone', d);
    if (d.reason !== 'clean-exit' && !win.isDestroyed()) win.reload();
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => log.error('did-fail-load', code, desc));
}

// ---------- bubble badge ----------
function sendBubbleCount() {
  if (bubbleWin && !bubbleWin.isDestroyed()) {
    bubbleWin.webContents.send('bubble:count', db.activeCount());
  }
}

function tasksChanged() {
  sendBubbleCount();
  if (noteWin && !noteWin.isDestroyed()) noteWin.webContents.send('tasks:changed');
}

// ---------- windows ----------
function createNoteWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const def = { width: 300, height: 420, x: wa.x + wa.width - 340, y: wa.y + 60 };
  const b = visibleBounds(db.getJSON('note_bounds'), def);

  noteWin = new BrowserWindow({
    ...b,
    minWidth: 220,
    minHeight: 260,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: THEME_BG[resolvedTheme()] || '#ffef8a',
    icon: ICON,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false }
  });
  lockdown(noteWin);
  noteWin.setOpacity(settings.get('opacity') / 100);
  loadPage(noteWin);

  const saveBounds = debounce(() => {
    if (noteWin && !noteWin.isDestroyed() && noteWin.isVisible() && !noteWin.isMinimized()) {
      db.setSetting('note_bounds', JSON.stringify(noteWin.getBounds()));
    }
  }, 400);
  noteWin.on('move', saveBounds);
  noteWin.on('resize', saveBounds);

  // Clicking the taskbar button restores the note: hide the taskbar button again.
  noteWin.on('restore', () => {
    noteWin.setSkipTaskbar(true);
    setState('note');
  });

  // Close button = send to taskbar, do not quit.
  noteWin.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      closeToTaskbar();
    }
  });
}

function createBubbleWindow() {
  bubbleWin = new BrowserWindow({
    width: 64,
    height: 64,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false }
  });
  lockdown(bubbleWin);
  bubbleWin.loadFile(path.join(__dirname, 'bubble.html'));
  bubbleWin.webContents.on('did-finish-load', sendBubbleCount);

  const savePos = debounce(() => {
    if (bubbleWin && !bubbleWin.isDestroyed() && bubbleWin.isVisible()) {
      const [x, y] = bubbleWin.getPosition();
      db.setSetting('bubble_pos', JSON.stringify({ x, y }));
    }
  }, 400);
  bubbleWin.on('move', savePos);

  bubbleWin.on('close', (e) => {
    if (!isQuitting) e.preventDefault();
  });
}

function openSettings(section) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    if (section) settingsWin.webContents.send('settings:goto', section);
    return;
  }
  settingsWin = new BrowserWindow({
    width: 440,
    height: 640,
    minWidth: 380,
    minHeight: 420,
    title: 'StickyTasks Settings',
    icon: ICON,
    autoHideMenuBar: true,
    alwaysOnTop: true, // the note is always on top too, so settings must be above it
    show: false,
    backgroundColor: THEME_BG[resolvedTheme()] || '#ffef8a',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false }
  });
  lockdown(settingsWin);
  settingsWin.setMenuBarVisibility(false);
  loadPage(settingsWin, '#settings' + (section ? '/' + section : ''));
  settingsWin.once('ready-to-show', () => settingsWin.show());
  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

// ---------- state changes ----------
function showNote() {
  if (!noteWin) return;
  if (bubbleWin) bubbleWin.hide();
  noteWin.setSkipTaskbar(true); // note open = no taskbar button
  if (noteWin.isMinimized()) noteWin.restore();
  noteWin.show();
  noteWin.focus();
  setState('note');
}

function minimizeToBubble() {
  if (!noteWin || !bubbleWin) return;
  const nb = noteWin.getBounds();
  const saved = db.getJSON('bubble_pos');
  let pos = saved || { x: nb.x + nb.width - 64, y: nb.y };
  const fixed = visibleBounds({ x: pos.x, y: pos.y, width: 64, height: 64 }, null);
  if (!fixed) {
    const wa = screen.getPrimaryDisplay().workArea;
    pos = { x: wa.x + wa.width - 90, y: wa.y + 60 };
  }
  bubbleWin.setPosition(Math.round(pos.x), Math.round(pos.y));
  sendBubbleCount();
  noteWin.hide();
  bubbleWin.show();
  setState('bubble');
}

function closeToTaskbar() {
  if (!noteWin) return;
  if (bubbleWin) bubbleWin.hide();
  noteWin.setSkipTaskbar(false); // taskbar button appears now
  noteWin.minimize();            // note goes down to the taskbar. Click its button to reopen.
  setState('closed');
}

function toggleNote() {
  if (noteWin && noteWin.isVisible() && !noteWin.isMinimized()) {
    minimizeToBubble();
  } else {
    showNote();
    noteWin.webContents.send('focus:new');
  }
}

// ---------- settings side effects ----------
function applyAutostart() {
  // Only register when packaged. In dev it would register electron.exe itself.
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: settings.get('autostart') });
}

function applyHotkey() {
  globalShortcut.unregister(HOTKEY);
  hotkeyOk = true;
  if (settings.get('hotkey')) {
    hotkeyOk = globalShortcut.register(HOTKEY, toggleNote);
    if (!hotkeyOk) log.warn('Hotkey ' + HOTKEY + ' is used by another app');
  }
}

function applySetting(key) {
  switch (key) {
    case 'opacity':
      if (noteWin && !noteWin.isDestroyed()) noteWin.setOpacity(settings.get('opacity') / 100);
      break;
    case 'autostart':
      applyAutostart();
      break;
    case 'hotkey':
      applyHotkey();
      break;
    case 'autoclean_days':
      runCleanup();
      break;
    default:
      break;
  }
  refreshTray();
  broadcastSettings();
}

function setSetting(key, value) {
  try {
    settings.set(key, value);
    applySetting(key);
  } catch (e) {
    log.warn('bad setting', key, value, e.message);
  }
}

// ---------- tray ----------
function buildTrayMenu() {
  const s = settings.getAll();
  const themeItem = (label, value) => ({
    label, type: 'radio', checked: s.theme === value, click: () => setSetting('theme', value)
  });
  return Menu.buildFromTemplate([
    { label: 'Open note', click: showNote },
    { type: 'separator' },
    {
      label: 'Theme',
      submenu: [
        themeItem('Follow Windows', 'system'),
        themeItem('Yellow', 'yellow'),
        themeItem('Dark', 'dark'),
        themeItem('Blue', 'blue'),
        themeItem('Pink', 'pink'),
        themeItem('Green', 'green')
      ]
    },
    {
      label: 'Clear Done tasks after',
      submenu: [
        { label: '1 day', type: 'radio', checked: s.autoclean_days === 1, click: () => setSetting('autoclean_days', 1) },
        { label: '1 week', type: 'radio', checked: s.autoclean_days === 7, click: () => setSetting('autoclean_days', 7) }
      ]
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: s.autostart,
      click: (item) => setSetting('autostart', item.checked)
    },
    { type: 'separator' },
    { label: 'Settings…', click: () => openSettings() },
    { label: 'Open data folder', click: () => shell.openPath(app.getPath('userData')) },
    { label: 'About StickyTasks', click: () => openSettings('about') },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function refreshTray() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  const img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('StickyTasks');
  tray.on('click', showNote);
  refreshTray();
}

// ---------- auto-clean ----------
function runCleanup() {
  const n = db.cleanupDone(settings.get('autoclean_days'));
  if (n > 0) tasksChanged();
}

// ---------- IPC ----------
function registerIpc() {
  // tasks
  ipcMain.handle('tasks:list', () => db.listTasks());
  ipcMain.handle('tasks:add', (_e, text) => {
    if (typeof text === 'string') db.addTask(text);
    sendBubbleCount();
    return db.listTasks();
  });
  ipcMain.handle('tasks:update', (_e, id, text) => {
    if (isId(id) && typeof text === 'string') db.updateText(id, text);
    return db.listTasks();
  });
  ipcMain.handle('tasks:setDone', (_e, id, done) => {
    if (isId(id)) db.setDone(id, !!done);
    sendBubbleCount();
    return db.listTasks();
  });
  ipcMain.handle('tasks:delete', (_e, id) => {
    const ids = isId(id) && db.deleteTask(id) > 0 ? [id] : [];
    sendBubbleCount();
    return { tasks: db.listTasks(), ids };
  });
  ipcMain.handle('tasks:clearDone', () => {
    const ids = db.clearDone();
    sendBubbleCount();
    return { tasks: db.listTasks(), ids };
  });
  ipcMain.handle('tasks:restore', (_e, ids) => {
    if (Array.isArray(ids) && ids.every(isId)) db.restoreTasks(ids);
    sendBubbleCount();
    return db.listTasks();
  });
  ipcMain.handle('tasks:setDue', (_e, id, due) => {
    const ok = due === null || (typeof due === 'number' && Number.isFinite(due));
    if (isId(id) && ok) db.setDue(id, due === null ? null : Math.round(due));
    return db.listTasks();
  });
  ipcMain.handle('tasks:reorder', (_e, ids) => {
    if (Array.isArray(ids) && ids.length <= 5000 && ids.every(isId)) db.reorder(ids);
    return db.listTasks();
  });

  // settings
  ipcMain.handle('settings:get', () => snapshot());
  ipcMain.handle('settings:set', (_e, key, value) => {
    setSetting(key, value);
    return snapshot();
  });
  ipcMain.on('settings:open', (_e, section) => openSettings(typeof section === 'string' ? section : undefined));

  // data
  ipcMain.handle('data:export', async () => {
    try {
      const parent = BrowserWindow.getFocusedWindow() || noteWin;
      const date = new Date().toISOString().slice(0, 10);
      const r = await dialog.showSaveDialog(parent, {
        title: 'Export tasks',
        defaultPath: `StickyTasks-export-${date}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (r.canceled || !r.filePath) return { ok: false, canceled: true };
      const data = { app: 'StickyTasks', format: 1, exportedAt: new Date().toISOString(), tasks: db.exportTasks() };
      fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2), 'utf8');
      return { ok: true, path: r.filePath, count: data.tasks.length };
    } catch (e) {
      log.error('export failed', e);
      return { ok: false, error: 'Could not write the file.' };
    }
  });
  ipcMain.handle('data:import', async () => {
    try {
      const parent = BrowserWindow.getFocusedWindow() || noteWin;
      const r = await dialog.showOpenDialog(parent, {
        title: 'Import tasks',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
      const file = r.filePaths[0];
      if (fs.statSync(file).size > 5 * 1024 * 1024) return { ok: false, error: 'File is too big (over 5 MB).' };
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!data || !Array.isArray(data.tasks)) return { ok: false, error: 'This is not a StickyTasks export file.' };
      const res = db.importTasks(data.tasks);
      tasksChanged();
      return { ok: true, ...res };
    } catch (e) {
      log.error('import failed', e);
      return { ok: false, error: 'Could not read that file.' };
    }
  });
  ipcMain.handle('data:openFolder', () => shell.openPath(app.getPath('userData')));

  // app
  ipcMain.handle('app:openExternal', (_e, url) => {
    if (typeof url === 'string' && url.startsWith('https://github.com/')) shell.openExternal(url);
  });
  ipcMain.handle('app:checkUpdates', () => updater.checkManual());
  ipcMain.on('log:error', (_e, msg) => log.error('renderer', String(msg).slice(0, 2000)));

  // windows
  let dragOrigin = null;
  ipcMain.on('bubble:dragStart', () => {
    if (!bubbleWin) return;
    const [x, y] = bubbleWin.getPosition();
    dragOrigin = { x, y };
  });
  ipcMain.on('bubble:dragMove', (_e, dx, dy) => {
    if (!bubbleWin || !dragOrigin || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    bubbleWin.setBounds({
      x: Math.round(dragOrigin.x + dx),
      y: Math.round(dragOrigin.y + dy),
      width: 64,
      height: 64
    });
  });
  ipcMain.on('win:minimize', minimizeToBubble);
  ipcMain.on('win:close', closeToTaskbar);
  ipcMain.on('bubble:restore', showNote);
}

// ---------- app lifecycle ----------
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showNote); // opening the app again just shows the note

  app.whenReady().then(() => {
    app.setAppUserModelId('com.stickytasks.app');
    log.init();
    db.init();
    db.seedWelcome();
    Menu.setApplicationMenu(null);
    registerIpc();
    createNoteWindow();
    createBubbleWindow();
    createTray();
    applyAutostart();
    applyHotkey();
    log.info('started', app.getVersion(), app.isPackaged ? 'packaged' : 'dev');

    // Restore the last state (works for autostart at Windows login too).
    const state = db.getSetting('last_state', 'note');
    noteWin.once('ready-to-show', () => {
      if (state === 'note') showNote();
      else if (state === 'bubble') minimizeToBubble();
      else closeToTaskbar(); // 'closed' (or old 'tray' value): taskbar button only
    });

    nativeTheme.on('updated', () => {
      if (settings.get('theme') === 'system') broadcastSettings();
    });

    // Auto-clean: on start, every hour, and after the PC wakes from sleep.
    runCleanup();
    setInterval(runCleanup, 60 * 60 * 1000);
    powerMonitor.on('resume', runCleanup);

    reminders.start(showNote);
    setTimeout(() => updater.checkSilently(), 15 * 1000);
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    reminders.stop();
  });

  // Keep running in the background when all windows are hidden.
  app.on('window-all-closed', () => {});
}
