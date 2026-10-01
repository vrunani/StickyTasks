import { useState } from 'react';
import { toLocalInput } from '../due.js';

// Small panel to set or clear a reminder time for one task.
export default function DueDialog({ task, onSet, onClose }) {
  const [val, setVal] = useState(task.dueAt ? toLocalInput(task.dueAt) : '');

  const at = (h, addDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + addDays);
    d.setHours(h, 0, 0, 0);
    return d.getTime();
  };
  const in1h = Date.now() + 60 * 60 * 1000;
  const tonight = at(20);
  const tomorrow = at(9, 1);

  const save = () => {
    const t = new Date(val).getTime();
    if (val && Number.isFinite(t)) onSet(task.id, t);
  };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-title">⏰ Reminder</div>
        <div className="dlg-task">{task.text}</div>
        <div className="presets">
          <button onClick={() => onSet(task.id, in1h)}>In 1 hour</button>
          <button disabled={tonight < Date.now()} onClick={() => onSet(task.id, tonight)}>Tonight 8 PM</button>
          <button onClick={() => onSet(task.id, tomorrow)}>Tomorrow 9 AM</button>
        </div>
        <input
          type="datetime-local"
          className="dt"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <div className="dlg-actions">
          <button className="btn" onClick={() => onSet(task.id, null)}>Clear</button>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!val}>Set</button>
        </div>
      </div>
    </div>
  );
}
