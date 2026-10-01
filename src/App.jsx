import { useCallback, useEffect, useRef, useState } from 'react';
import TopBar from './components/TopBar.jsx';
import TaskLine from './components/TaskLine.jsx';
import NewTaskLine from './components/NewTaskLine.jsx';
import DoneSection from './components/DoneSection.jsx';
import Confetti from './components/Confetti.jsx';
import DueDialog from './components/DueDialog.jsx';
import ShortcutsOverlay from './components/ShortcutsOverlay.jsx';
import useSettings from './useSettings.js';
import { burst } from './confetti.js';

export default function App() {
  const settings = useSettings();
  const [tasks, setTasks] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [drag, setDrag] = useState({ id: null, over: undefined }); // over: task id, null = end
  const [dueFor, setDueFor] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const toastTimer = useRef(0);

  useEffect(() => {
    window.api.listTasks().then(setTasks);
    const offTasks = window.api.onTasksChanged(() => window.api.listTasks().then(setTasks));
    const offFocus = window.api.onFocusNew(() => document.getElementById('new-task')?.focus());
    const tick = setInterval(() => setNow(Date.now()), 30 * 1000); // keeps "overdue" chips fresh
    return () => {
      offTasks();
      offFocus();
      clearInterval(tick);
    };
  }, []);

  const active = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done).sort((a, b) => b.doneAt - a.doneAt);

  // ----- toast (with optional Undo button) -----
  const say = useCallback((text, opts = {}) => {
    clearTimeout(toastTimer.current);
    const ms = opts.ms || 2400;
    setToast({ text, action: opts.action, actionLabel: opts.actionLabel, ms, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const offerUndo = (text, ids) => {
    if (!ids.length) return;
    say(text, {
      ms: 6000,
      actionLabel: 'Undo',
      action: () => window.api.restoreTasks(ids).then(setTasks)
    });
  };

  // ----- task actions -----
  const add = (text) => window.api.addTask(text).then(setTasks);
  const save = (id, text) => window.api.updateTask(id, text).then(setTasks);

  const setDone = (id, d) => {
    // finishing the LAST active task = big celebration
    if (d && active.length === 1 && active[0].id === id) {
      burst({ x: window.innerWidth / 2, y: 70, count: 110, spread: 1.6 });
      say('All caught up! 🎉');
    }
    return window.api.setDone(id, d).then(setTasks);
  };

  const del = (id) =>
    window.api.deleteTask(id).then(({ tasks: t, ids }) => {
      setTasks(t);
      offerUndo('Task deleted', ids);
    });

  const clearDone = () =>
    window.api.clearDone().then(({ tasks: t, ids }) => {
      setTasks(t);
      offerUndo(ids.length === 1 ? 'Cleared 1 done task' : `Cleared ${ids.length} done tasks`, ids);
    });

  const setDue = (id, due) => {
    setDueFor(null);
    return window.api.setDue(id, due).then(setTasks);
  };

  // ----- drag to reorder -----
  const endDrag = () => setDrag({ id: null, over: undefined });
  const dropOn = (targetId) => {
    if (!drag.id) return;
    const ids = active.map((t) => t.id).filter((id) => id !== drag.id);
    const idx = targetId ? ids.indexOf(targetId) : ids.length;
    ids.splice(idx < 0 ? ids.length : idx, 0, drag.id);
    endDrag();
    window.api.reorder(ids).then(setTasks);
  };

  // ----- keyboard: ? opens help, Esc closes panels -----
  useEffect(() => {
    const onKey = (e) => {
      const typing = ['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName);
      if (e.key === '?' && !typing) {
        e.preventDefault();
        setShowKeys((v) => !v);
      } else if (e.key === 'Escape') {
        setShowKeys(false);
        setDueFor(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Clicking empty space in the note focuses the blank line.
  const focusNew = (e) => {
    if (e.target === e.currentTarget) document.getElementById('new-task')?.focus();
  };

  const dueTask = dueFor ? tasks.find((t) => t.id === dueFor) : null;

  return (
    <div className="note">
      <TopBar settings={settings} />
      <div className="body" onClick={focusNew}>
        {active.map((t) => (
          <TaskLine
            key={t.id}
            task={t}
            now={now}
            dragging={!!drag.id}
            isSource={drag.id === t.id}
            isOver={!!drag.id && drag.over === t.id}
            onDone={setDone}
            onSave={save}
            onDelete={del}
            onDue={setDueFor}
            onDragStart={(id) => setDrag({ id, over: undefined })}
            onDragEnd={endDrag}
            onDragOver={(id) => setDrag((d) => (d.over === id ? d : { ...d, over: id }))}
            onDrop={dropOn}
          />
        ))}
        <NewTaskLine
          onAdd={add}
          dragging={!!drag.id}
          isOver={!!drag.id && drag.over === null}
          onDragOver={(id) => setDrag((d) => (d.over === id ? d : { ...d, over: id }))}
          onDrop={dropOn}
        />
        <DoneSection tasks={done} onUndo={setDone} onClear={clearDone} onDelete={del} />
      </div>

      {toast && (
        <div className={'toast' + (toast.action ? ' has-action' : '')} key={toast.key} style={{ '--out-delay': toast.ms - 400 + 'ms' }}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              className="toast-btn"
              onClick={() => {
                toast.action();
                setToast(null);
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}

      {dueTask && <DueDialog task={dueTask} onSet={setDue} onClose={() => setDueFor(null)} />}
      {showKeys && <ShortcutsOverlay onClose={() => setShowKeys(false)} />}
      <Confetti />
    </div>
  );
}
