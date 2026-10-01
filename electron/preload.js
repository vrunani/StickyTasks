// The only bridge between React (renderer) and the main process.
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => {
  const handler = (_e, ...args) => cb(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('api', {
  // tasks
  listTasks: () => ipcRenderer.invoke('tasks:list'),
  addTask: (text) => ipcRenderer.invoke('tasks:add', text),
  updateTask: (id, text) => ipcRenderer.invoke('tasks:update', id, text),
  setDone: (id, done) => ipcRenderer.invoke('tasks:setDone', id, done),
  deleteTask: (id) => ipcRenderer.invoke('tasks:delete', id),
  clearDone: () => ipcRenderer.invoke('tasks:clearDone'),
  restoreTasks: (ids) => ipcRenderer.invoke('tasks:restore', ids),
  setDue: (id, due) => ipcRenderer.invoke('tasks:setDue', id, due),
  reorder: (ids) => ipcRenderer.invoke('tasks:reorder', ids),

  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  openSettings: (section) => ipcRenderer.send('settings:open', section),

  // data and app
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  openDataFolder: () => ipcRenderer.invoke('data:openFolder'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  checkUpdates: () => ipcRenderer.invoke('app:checkUpdates'),
  logError: (msg) => ipcRenderer.send('log:error', String(msg)),

  // windows
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  restoreNote: () => ipcRenderer.send('bubble:restore'),
  bubbleDragStart: () => ipcRenderer.send('bubble:dragStart'),
  bubbleDragMove: (dx, dy) => ipcRenderer.send('bubble:dragMove', dx, dy),

  // events from the main process
  onTasksChanged: on('tasks:changed'),
  onSettingsChanged: on('settings:changed'),
  onSettingsGoto: on('settings:goto'),
  onFocusNew: on('focus:new'),
  onBubbleCount: on('bubble:count')
});
