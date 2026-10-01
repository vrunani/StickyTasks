import { useEffect, useRef } from 'react';
import { THEMES } from '../themes.js';

// Little palette that drops down from the top bar.
export default function ThemePicker({ current, onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const away = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('[data-theme-btn]')) onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  return (
    <div className="popover" ref={ref}>
      <div className="pop-title">Theme</div>
      <div className="swatches">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={'swatch' + (current === t.id ? ' on' : '')}
            style={{ background: t.swatch }}
            title={t.label}
            onClick={() => onPick(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
