// All SQLite code lives here. The UI never touches the database directly.
// node:sqlite is built into Electron 39+ (Node 22). No native module, no compiler needed.
const { DatabaseSync } = require('node:sqlite');
const { app } = require('electron');
const path = require('path');
const crypto = require('crypto');

let db;

function init() {
  // userData = C:\Users\<name>\AppData\Roaming\StickyTasks  (safe, survives updates)
  const file = path.join(app.getPath('userData'), 'tasks.db');
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         TEXT PRIMARY KEY,
      text       TEXT NOT NULL,
      position   INTEGER NOT NULL,
      done       INTEGER NOT NULL DEFAULT 0,
      done_at    INTEGER,
      due_at     INTEGER,
      reminded   INTEGER NOT NULL DEFAULT 0,
      synced     INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      deleted    INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  // Migration for databases made by v1.0 (no due dates yet).
  const cols = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);
  if (!cols.includes('due_at')) db.exec('ALTER TABLE tasks ADD COLUMN due_at INTEGER');
  if (!cols.includes('reminded')) db.exec('ALTER TABLE tasks ADD COLUMN reminded INTEGER NOT NULL DEFAULT 0');
}

const now = () => Date.now();

function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function rowToTask(r) {
  return {
    id: r.id,
    text: r.text,
    position: r.position,
    done: r.done === 1,
    doneAt: r.done_at,
    dueAt: r.due_at,
    updatedAt: r.updated_at
  };
}

function listTasks() {
  return db
    .prepare(
      `SELECT id, text, position, done, done_at, due_at, updated_at
       FROM tasks WHERE deleted = 0 ORDER BY position ASC, rowid ASC`
    )
    .all()
    .map(rowToTask);
}

function addTask(text) {
  const t = String(text || '').trim().slice(0, 2000);
  if (!t) return null;
  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM tasks').get().p;
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, text, position, done, done_at, due_at, reminded, synced, updated_at, deleted)
     VALUES (?, ?, ?, 0, NULL, NULL, 0, 0, ?, 0)`
  ).run(id, t, pos, now());
  return id;
}

function updateText(id, text) {
  const t = String(text || '').trim().slice(0, 2000);
  if (!t) return;
  db.prepare('UPDATE tasks SET text = ?, synced = 0, updated_at = ? WHERE id = ? AND deleted = 0').run(
    t,
    now(),
    id
  );
}

function setDone(id, done) {
  const ts = now();
  db.prepare(
    'UPDATE tasks SET done = ?, done_at = ?, synced = 0, updated_at = ? WHERE id = ? AND deleted = 0'
  ).run(done ? 1 : 0, done ? ts : null, ts, id);
}

// Soft delete: rows stay (deleted = 1) so Undo and the future Firebase sync can use them.
function deleteTask(id) {
  return db
    .prepare('UPDATE tasks SET deleted = 1, synced = 0, updated_at = ? WHERE id = ? AND deleted = 0')
    .run(now(), id).changes;
}

function clearDone() {
  const ids = db
    .prepare('SELECT id FROM tasks WHERE done = 1 AND deleted = 0')
    .all()
    .map((r) => r.id);
  if (ids.length) {
    db.prepare(
      'UPDATE tasks SET deleted = 1, synced = 0, updated_at = ? WHERE done = 1 AND deleted = 0'
    ).run(now());
  }
  return ids;
}

function restoreTasks(ids) {
  const upd = db.prepare('UPDATE tasks SET deleted = 0, synced = 0, updated_at = ? WHERE id = ?');
  tx(() => {
    for (const id of ids) upd.run(now(), id);
  });
}

function setDue(id, dueAt) {
  db.prepare(
    'UPDATE tasks SET due_at = ?, reminded = 0, synced = 0, updated_at = ? WHERE id = ? AND deleted = 0'
  ).run(dueAt, now(), id);
}

// Re-assigns the existing position numbers of these tasks in the new order.
function reorder(ids) {
  if (!Array.isArray(ids) || ids.length < 2 || new Set(ids).size !== ids.length) return;
  tx(() => {
    const sel = db.prepare('SELECT position FROM tasks WHERE id = ? AND deleted = 0');
    const slots = [];
    for (const id of ids) {
      const r = sel.get(id);
      if (!r) return; // unknown id: do nothing
      slots.push(r.position);
    }
    slots.sort((a, b) => a - b);
    const upd = db.prepare('UPDATE tasks SET position = ?, synced = 0, updated_at = ? WHERE id = ?');
    ids.forEach((id, i) => upd.run(slots[i], now(), id));
  });
}

function cleanupDone(days) {
  const cutoff = now() - days * 24 * 60 * 60 * 1000;
  return db
    .prepare(
      `UPDATE tasks SET deleted = 1, synced = 0, updated_at = ?
       WHERE done = 1 AND deleted = 0 AND done_at IS NOT NULL AND done_at < ?`
    )
    .run(now(), cutoff).changes;
}

// ---------- reminders ----------
function dueReminders(ts) {
  return db
    .prepare(
      `SELECT id, text, due_at FROM tasks
       WHERE deleted = 0 AND done = 0 AND reminded = 0 AND due_at IS NOT NULL AND due_at <= ?
       ORDER BY due_at ASC`
    )
    .all(ts)
    .map((r) => ({ id: r.id, text: r.text, dueAt: r.due_at }));
}

function markReminded(ids) {
  const upd = db.prepare('UPDATE tasks SET reminded = 1 WHERE id = ?');
  tx(() => {
    for (const id of ids) upd.run(id);
  });
}

function activeCount() {
  return db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE deleted = 0 AND done = 0').get().c;
}

// ---------- first run ----------
function seedWelcome() {
  if (getSetting('welcomed')) return;
  const total = db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c;
  if (total === 0) {
    addTask('Click here to edit this task');
    addTask('Tick the circle to finish a task 🎉');
  }
  setSetting('welcomed', 'true');
}

// ---------- export / import ----------
function exportTasks() {
  return listTasks().map((t) => ({
    id: t.id,
    text: t.text,
    done: t.done,
    doneAt: t.doneAt,
    dueAt: t.dueAt,
    position: t.position
  }));
}

function importTasks(list) {
  let added = 0;
  let skipped = 0;
  tx(() => {
    const find = db.prepare('SELECT deleted FROM tasks WHERE id = ?');
    let pos = db.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM tasks').get().p;
    const ins = db.prepare(
      `INSERT INTO tasks (id, text, position, done, done_at, due_at, reminded, synced, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`
    );
    const revive = db.prepare(
      `UPDATE tasks SET text = ?, position = ?, done = ?, done_at = ?, due_at = ?, reminded = ?,
         synced = 0, updated_at = ?, deleted = 0 WHERE id = ?`
    );
    for (const t of list.slice(0, 5000)) {
      if (!t || typeof t.text !== 'string') {
        skipped++;
        continue;
      }
      const text = t.text.trim().slice(0, 2000);
      if (!text) {
        skipped++;
        continue;
      }
      const id = typeof t.id === 'string' && t.id.length > 0 && t.id.length <= 100 ? t.id : crypto.randomUUID();
      const done = t.done === true ? 1 : 0;
      const doneAt = done ? (Number.isFinite(t.doneAt) ? Math.round(t.doneAt) : now()) : null;
      const dueAt = Number.isFinite(t.dueAt) ? Math.round(t.dueAt) : null;
      const reminded = dueAt !== null && dueAt <= now() ? 1 : 0;
      const row = find.get(id);
      if (row && row.deleted === 0) {
        skipped++; // already on this PC
      } else if (row) {
        revive.run(text, ++pos, done, doneAt, dueAt, reminded, now(), id);
        added++;
      } else {
        ins.run(id, text, ++pos, done, doneAt, dueAt, reminded, now());
        added++;
      }
    }
  });
  return { added, skipped };
}

// ---------- settings table ----------
function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

function getJSON(key) {
  const v = getSetting(key);
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function close() {
  if (db) db.close();
}

module.exports = {
  init, close, listTasks, addTask, updateText, setDone, deleteTask, clearDone, restoreTasks,
  setDue, reorder, cleanupDone, dueReminders, markReminded, activeCount, seedWelcome,
  exportTasks, importTasks, getSetting, setSetting, getJSON
};
