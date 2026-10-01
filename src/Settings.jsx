import { useEffect, useRef, useState } from 'react';
import useSettings from './useSettings.js';
import { THEMES } from './themes.js';
import { SHORTCUTS } from './shortcuts.js';

export default function Settings() {
  const s = useSettings();
  const [msg, setMsg] = useState({ data: '', update: '' });
  const [opacity, setOpacity] = useState(100);
  const opTimer = useRef(0);
  const refs = useRef({});

  useEffect(() => {
    document.title = 'StickyTasks Settings';
    const go = (section) => refs.current[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const fromHash = window.location.hash.split('/')[1];
    if (fromHash) setTimeout(() => go(fromHash), 150);
    return window.api.onSettingsGoto(go);
  }, []);

  useEffect(() => {
    if (s) setOpacity(s.opacity);
  }, [s?.opacity]);

  if (!s) return <div className="sp" />;

  const set = (k, v) => window.api.setSetting(k, v);
  const say = (k, text) => setMsg((m) => ({ ...m, [k]: text }));

  const onOpacity = (v) => {
    setOpacity(v);
    clearTimeout(opTimer.current);
    opTimer.current = setTimeout(() => set('opacity', v), 120);
  };

  const doExport = async () => {
    const r = await window.api.exportData();
    if (r.ok) say('data', `Saved ${r.count} task${r.count === 1 ? '' : 's'} to ${r.path}`);
    else if (!r.canceled) say('data', r.error || 'Export failed.');
  };

  const doImport = async () => {
    const r = await window.api.importData();
    if (r.ok) say('data', `Imported ${r.added} task${r.added === 1 ? '' : 's'}. Skipped ${r.skipped}.`);
    else if (!r.canceled) say('data', r.error || 'Import failed.');
  };

  const doUpdate = async () => {
    say('update', 'Checking…');
    say('update', await window.api.checkUpdates());
  };

  const Section = ({ id, title, children }) => (
    <section ref={(el) => (refs.current[id] = el)}>
      <h2>{title}</h2>
      <div className="sp-card">{children}</div>
    </section>
  );

  return (
    <div className="sp">
      <h1>Settings</h1>
      <div className="sp-sub">Changes apply right away.</div>

      <Section id="appearance" title="Appearance">
        <div className="sp-row col">
          <span>Theme</span>
          <div className="swatches big">
            {THEMES.map((t) => (
              <div className="sw-wrap" key={t.id}>
                <button
                  className={'swatch' + (s.theme === t.id ? ' on' : '')}
                  style={{ background: t.swatch }}
                  title={t.label}
                  onClick={() => set('theme', t.id)}
                />
                <span className="sw-label">{t.id === 'system' ? 'Auto' : t.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="sp-row">
          <span>Font size</span>
          <div className="seg">
            {[['s', 'Small'], ['m', 'Medium'], ['l', 'Large']].map(([k, label]) => (
              <button key={k} className={s.font_size === k ? 'on' : ''} onClick={() => set('font_size', k)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="sp-row">
          <span>Note opacity <b>{opacity}%</b></span>
          <input type="range" min="50" max="100" step="5" value={opacity} onChange={(e) => onOpacity(Number(e.target.value))} />
        </div>
      </Section>

      <Section id="behavior" title="Behavior">
        <div className="sp-row">
          <span>Clear Done tasks after</span>
          <div className="seg">
            <button className={s.autoclean_days === 1 ? 'on' : ''} onClick={() => set('autoclean_days', 1)}>1 day</button>
            <button className={s.autoclean_days === 7 ? 'on' : ''} onClick={() => set('autoclean_days', 7)}>1 week</button>
          </div>
        </div>
        <div className="sp-row">
          <span>Start with Windows{!s.isPackaged && <i className="hint"> (installed app only)</i>}</span>
          <input type="checkbox" className="switch" checked={s.autostart} onChange={(e) => set('autostart', e.target.checked)} />
        </div>
        <div className="sp-row">
          <span>
            Hotkey <kbd>Ctrl + Shift + T</kbd> shows or hides the note
            {s.hotkey && !s.hotkeyOk && <i className="hint warn"> Already used by another app.</i>}
          </span>
          <input type="checkbox" className="switch" checked={s.hotkey} onChange={(e) => set('hotkey', e.target.checked)} />
        </div>
      </Section>

      <Section id="data" title="Your data">
        <div className="sp-note">Your tasks stay on this PC. Nothing is sent anywhere.</div>
        <div className="btn-row">
          <button className="btn" onClick={doExport}>Export tasks…</button>
          <button className="btn" onClick={doImport}>Import tasks…</button>
          <button className="btn" onClick={() => window.api.openDataFolder()}>Open data folder</button>
        </div>
        {msg.data && <div className="sp-msg">{msg.data}</div>}
        <div className="sp-path">{s.dataPath}</div>
      </Section>

      <Section id="updates" title="Updates">
        <div className="btn-row">
          <button className="btn" onClick={doUpdate}>Check for updates</button>
        </div>
        {msg.update && <div className="sp-msg">{msg.update}</div>}
      </Section>

      <Section id="shortcuts" title="Keyboard shortcuts">
        <div className="keys">
          {SHORTCUTS.map(([k, d]) => (
            <div className="key-row" key={k}>
              <kbd>{k}</kbd>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="about" title="About">
        <div className="about-title">StickyTasks <span>v{s.version}</span></div>
        <div className="sp-note">A sticky note that cleans up after you. Offline-first, made for Windows.</div>
        <div className="sp-note">Made by Vrunani Muley. Built with Electron, React and SQLite.</div>
        <div className="btn-row">
          <button className="btn" onClick={() => window.api.openExternal('https://github.com/vrunani')}>GitHub: vrunani</button>
        </div>
        <div className="sp-note small">Privacy: your tasks, settings and logs live in the folder shown above. This version does not upload anything.</div>
      </Section>
    </div>
  );
}
