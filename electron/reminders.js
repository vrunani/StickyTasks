// Windows notifications for tasks that reach their due time.
const { Notification } = require('electron');
const db = require('./db');
const log = require('./logger');

let timer = null;
const alive = []; // keep references so notifications are not garbage-collected

function check(onClick) {
  let due;
  try {
    due = db.dueReminders(Date.now());
  } catch (e) {
    log.error('reminder check failed', e);
    return;
  }
  if (!due.length) return;
  db.markReminded(due.map((d) => d.id));
  if (!Notification.isSupported()) return;

  const one = due.length === 1;
  const body = one
    ? due[0].text
    : due.slice(0, 4).map((d) => '• ' + d.text).join('\n') + (due.length > 4 ? `\n…and ${due.length - 4} more` : '');
  const n = new Notification({
    title: one ? 'Task due' : `${due.length} tasks due`,
    body: body.slice(0, 250)
  });
  n.on('click', onClick);
  n.on('close', () => {
    const i = alive.indexOf(n);
    if (i >= 0) alive.splice(i, 1);
  });
  alive.push(n);
  n.show();
}

function start(onClick) {
  check(onClick); // catches reminders that came due while the app was closed
  timer = setInterval(() => check(onClick), 30 * 1000);
}

function stop() {
  if (timer) clearInterval(timer);
}

module.exports = { start, stop };
