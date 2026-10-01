// Auto-update from GitHub Releases (only in the installed app).
// Set owner/repo in package.json > build > publish.
const { app, Notification } = require('electron');
const log = require('./logger');

let wired = false;

function getUpdater() {
  const { autoUpdater } = require('electron-updater');
  if (!wired) {
    wired = true;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = {
      info: (m) => log.info('updater', m),
      warn: (m) => log.warn('updater', m),
      error: (m) => log.warn('updater', m),
      debug: () => {}
    };
    autoUpdater.on('error', (e) => log.warn('updater error', e && e.message));
    autoUpdater.on('update-downloaded', (info) => {
      log.info('update downloaded', info && info.version);
      if (Notification.isSupported()) {
        new Notification({
          title: 'StickyTasks update ready',
          body: `Version ${info.version} will be installed when you quit the app.`
        }).show();
      }
    });
  }
  return autoUpdater;
}

function checkSilently() {
  if (!app.isPackaged) return;
  try {
    getUpdater()
      .checkForUpdates()
      .catch((e) => log.warn('update check failed', e && e.message));
  } catch (e) {
    log.warn('update check failed', e && e.message);
  }
}

async function checkManual() {
  if (!app.isPackaged) return 'Updates only work in the installed app, not in dev mode.';
  try {
    const r = await getUpdater().checkForUpdates();
    const avail = r && (r.isUpdateAvailable ?? (r.updateInfo && r.updateInfo.version !== app.getVersion()));
    return avail
      ? `Version ${r.updateInfo.version} found. Downloading it now. It installs when you quit.`
      : 'You are up to date.';
  } catch (e) {
    log.warn('manual update check failed', e && e.message);
    return 'Could not check for updates. Check your internet connection.';
  }
}

module.exports = { checkSilently, checkManual };
