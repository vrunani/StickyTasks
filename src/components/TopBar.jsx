import { useState } from 'react';
import useAuthStatus from '../useAuthStatus.js';
import ThemePicker from './ThemePicker.jsx';

const Palette = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .3-2.1 1.4-2.1H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10.5" cy="7" r="1" fill="currentColor" />
    <circle cx="15" cy="7.5" r="1" fill="currentColor" />
  </svg>
);

const Gear = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export default function TopBar({ settings }) {
  const { user, online } = useAuthStatus();
  const [picker, setPicker] = useState(false);
  const label = user ? user.email : 'Not signed in';

  return (
    <>
      <div className="bar">
        <div className="status" title={user ? 'Signed in' : 'Working offline. Login comes with Firebase.'}>
          <span className={'dot ' + (user ? 'on' : 'off')} />
          <span className="label">{label}</span>
          {!online && <span className="offline">· Offline</span>}
        </div>
        <div className="btns">
          <button className="wbtn" data-theme-btn title="Theme" onClick={() => setPicker((p) => !p)}><Palette /></button>
          <button className="wbtn" title="Settings" onClick={() => window.api.openSettings()}><Gear /></button>
          <button className="wbtn" title="Minimize to bubble" onClick={() => window.api.minimize()}>–</button>
          <button className="wbtn close" title="Close to taskbar" onClick={() => window.api.close()}>×</button>
        </div>
      </div>
      {picker && (
        <ThemePicker
          current={settings?.theme}
          onPick={(v) => {
            window.api.setSetting('theme', v);
            setPicker(false);
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </>
  );
}
