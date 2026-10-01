import { useEffect, useRef, useState } from 'react';

const FONT = {
  s: { fs: '15px', lh: '26px' },
  m: { fs: '17px', lh: '28px' },
  l: { fs: '19px', lh: '32px' }
};

// Loads settings from the main process, keeps them live, and applies theme + font size.
export default function useSettings() {
  const [s, setS] = useState(null);
  const lastTheme = useRef(null);

  useEffect(() => {
    window.api.getSettings().then(setS);
    return window.api.onSettingsChanged(setS);
  }, []);

  useEffect(() => {
    if (!s) return;
    const root = document.documentElement;
    if (lastTheme.current && lastTheme.current !== s.themeResolved) {
      // smooth 0.3s colour fade when the theme changes
      root.classList.add('theme-anim');
      setTimeout(() => root.classList.remove('theme-anim'), 450);
    }
    lastTheme.current = s.themeResolved;
    root.dataset.theme = s.themeResolved;
    const f = FONT[s.font_size] || FONT.m;
    root.style.setProperty('--fs', f.fs);
    root.style.setProperty('--lh', f.lh);
  }, [s]);

  return s;
}
