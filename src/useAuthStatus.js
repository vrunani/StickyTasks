import { useEffect, useState } from 'react';

// Shows login + internet status in the top bar.
// STAGE 9 (Firebase): replace `user = null` with onAuthStateChanged(auth, setUser).
export default function useAuthStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const user = null; // not signed in yet (Firebase comes later)
  return { user, online };
}
