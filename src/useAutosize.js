import { useLayoutEffect } from 'react';

// Makes a textarea grow to fit its text, so it looks like plain wrapped text.
export default function useAutosize(ref, value) {
  useLayoutEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    };
    fit();
    window.addEventListener('resize', fit); // text re-wraps when the note is resized
    return () => window.removeEventListener('resize', fit);
  }, [ref, value]);
}
