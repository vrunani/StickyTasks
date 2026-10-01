import { useState } from 'react';

export default function DoneSection({ tasks, onUndo, onClear, onDelete }) {
  const [open, setOpen] = useState(true);
  if (tasks.length === 0) return null;

  return (
    <div className="done">
      <div className="done-head">
        <button className="link" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} Done ({tasks.length})
        </button>
        <button className="link" onClick={onClear} title="Remove all done tasks now">
          Clear
        </button>
      </div>
      {open &&
        tasks.map((t) => (
          <div className="row" key={t.id}>
            <input
              type="checkbox"
              className="tick"
              checked
              onChange={() => onUndo(t.id, false)}
              title="Move back to active"
            />
            <span className="doneText">{t.text}</span>
            <div className="actions">
              <button className="act del" title="Delete" onClick={() => onDelete(t.id)}>×</button>
            </div>
          </div>
        ))}
    </div>
  );
}
