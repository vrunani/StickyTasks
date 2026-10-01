import { SHORTCUTS } from '../shortcuts.js';

export default function ShortcutsOverlay({ onClose }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-title">Keyboard shortcuts</div>
        <div className="keys">
          {SHORTCUTS.map(([k, d]) => (
            <div className="key-row" key={k}>
              <kbd>{k}</kbd>
              <span>{d}</span>
            </div>
          ))}
        </div>
        <div className="dlg-actions">
          <button className="btn primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
