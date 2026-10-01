# StickyTasks v1.1

Offline Windows sticky-note task app (Electron + React + built-in SQLite).

## Commands
- `npm install`   install everything (no compiler needed)
- `npm run dev`   run the app for development
- `npm run build` make the installer. Look in `release\` for `StickyTasks Setup 1.1.0.exe`
  (run the terminal as Administrator, or turn on Developer Mode, the first time)

## What is new in 1.1
- Installer wizard: license page ("I Agree"), choose install folder, shortcuts, finish page
- Themes: Yellow, Dark, Blue, Pink, Green, Follow Windows (palette button, tray menu, Settings)
- Settings window: theme, font size, opacity, auto-clean, startup, hotkey, export/import, updates, shortcuts, About
- Per-task delete (hover x) with Undo, Undo for Clear Done
- Drag to reorder (hover a task, use the dots handle)
- Reminders with Windows notifications (hover a task, clock button)
- Hotkey Ctrl+Shift+T shows or hides the note
- Open-task count badge on the bubble
- Export / import tasks as JSON, open data folder, error log file
- Welcome tasks on first run, press ? for shortcuts
- Auto-update from GitHub Releases (set owner/repo in package.json > build > publish)

## Where things are saved
- Database: `%APPDATA%\StickyTasks\tasks.db`
- Logs: `%APPDATA%\StickyTasks\logs\app.log`

## Files you may want to edit
- `build/license.txt`   the terms shown in the installer
- `build/installer.nsh` the message shown on uninstall
- `build/*.bmp`         installer sidebar images
- `package.json`        author, version, GitHub repo for updates
- `src/Settings.jsx`    the About text (name and GitHub link)

## Firebase (later)
- Login status placeholder: `src/useAuthStatus.js`
- Sync queue will read rows where `synced = 0` in `electron/db.js`
