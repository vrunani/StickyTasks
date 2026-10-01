import { useRef, useState } from 'react';
import useAutosize from '../useAutosize.js';

// The blank last line. Click it, type, press Enter: task saved, line clears and stays ready.
// It is also the "move to the end" drop target when reordering.
export default function NewTaskLine({ onAdd, dragging, isOver, onDragOver, onDrop }) {
  const [value, setValue] = useState('');
  const valueRef = useRef('');
  const ref = useRef(null);
  useAutosize(ref, value);

  const update = (v) => {
    valueRef.current = v;
    setValue(v);
  };

  const save = () => {
    const t = valueRef.current.trim();
    update('');
    if (t) onAdd(t); // empty lines are never saved
  };

  return (
    <div
      className={'row' + (isOver ? ' dropbefore' : '')}
      onDragOver={(e) => {
        if (dragging) {
          e.preventDefault();
          onDragOver(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(null);
      }}
    >
      <span className="plus">+</span>
      <textarea
        id="new-task"
        ref={ref}
        rows={1}
        className="plain"
        spellCheck={false}
        placeholder="Click here to add a task…"
        value={value}
        onChange={(e) => update(e.target.value.replace(/\n/g, ' '))}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
      />
    </div>
  );
}
