import { useEffect, useState } from 'react';

// Hash routes (#/, #/control, #/sim) so the static build works from any folder, no server rewrites needed.
export const ROUTES = [
  { path: '/', label: 'Live' },
  { path: '/control', label: 'Vs timer' },
  { path: '/sim', label: 'Outside' },
];
const read = () => {
  const p = (window.location.hash || '#/').slice(1) || '/';
  return ROUTES.some((r) => r.path === p) ? p : '/';
};

export function useHashRoute() {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => { setPath(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}
