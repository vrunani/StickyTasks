import { useEffect, useRef, useState } from 'react';
import useAutosize from '../useAutosize.js';
import { burst } from '../confetti.js';
import { formatDue } from '../due.js';

// One active task. Looks like plain text. Click it and type to edit.
export default function TaskLine({
  task, now, dragging, isSource, isOver,
  onDone, onSave, onDelete, onDue,
  onDragStart, onDragEnd, onDragOver, onDrop
}) {
  const [draft, setDraft] = useState(task.text);
  const [ticking, setTicking] = useState(false);
  const ref = useRef(null);
  const tickRef = useRef(null);
  const focused = useRef(false);
  const cancelled = useRef(false);
  useAutosize(ref, draft);

  // Pick up changes from outside (e.g. refresh) only when not typing.
  useEffect(() => {
    if (!focused.current) setDraft(task.text);
  }, [task.text]);

  const commit = () => {
    const t = draft.trim();
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(task.text);
      return;
    }
    if (!t) {
      setDraft(task.text); // emptied line: go back to the old text
      return;
    }
    if (t !== task.text) onSave(task.id, t);
  };

  // Tick: play the animation + confetti first, then move the task to Done.
  const handleTick = () => {
    if (ticking) return;
    setTicking(true);
    const r = tickRef.current.getBoundingClientRect();
    burst({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    setTimeout(() => onDone(task.id, true), 550);
  };

  const due = task.dueAt ? formatDue(task.dueAt, now) : null;

  return (
    <div
      className={'row' + (ticking ? ' ticking' : '') + (isOver ? ' dropbefore' : '') + (isSource ? ' dragsrc' : '')}
      onDragOver={(e) => {
        if (dragging && !isSource) {
          e.preventDefault();
          onDragOver(task.id);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(task.id);
      }}
    >
      <input
        ref={tickRef}
        type="checkbox"
        className="tick"
        checked={ticking}
        onChange={handleTick}
        title="Mark as done"
      />
      <textarea
        ref={ref}
        rows={1}
        className="plain"
        spellCheck={false}
        value={draft}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
      />
      {due && (
        <div className="chipline">
          <button
            className={'chip' + (due.overdue ? ' late' : '')}
            title="Change reminder"
            onClick={() => onDue(task.id)}
          >
            ⏰ {due.label}
          </button>
        </div>
      )}
      {!ticking && (
        <div className="actions">
          <button className="act" title="Set a reminder" onClick={() => onDue(task.id)}>⏰</button>
          <button className="act del" title="Delete" onClick={() => onDelete(task.id)}>×</button>
          <span
            className="grip"
            draggable
            title="Drag to reorder"
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', task.id);
              const row = e.currentTarget.closest('.row');
              if (row) e.dataTransfer.setDragImage(row, 20, 14);
              setTimeout(() => onDragStart(task.id), 0); // after the browser has started the drag
            }}
            onDragEnd={onDragEnd}
          >
            ⋮⋮
          </span>
        </div>
      )}
    </div>
  );
}
