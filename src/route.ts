import { flushSync } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

// Hash routes so the phone's back button works without a server:
//   #/            the month
//   #/plans       every plan
//   #/you         account and data
//   #/plan/<id>   one plan
export type Route = { name: 'month' } | { name: 'plans' } | { name: 'you' } | { name: 'plan'; id: string }
  | { name: 'spent'; month: string | null } | { name: 'calendar'; month: string | null } | { name: 'year'; year: string | null }
  | { name: 'money' } | { name: 'ask' };

function parse(hash: string): Route {
  const m = hash.match(/^#\/plan\/([\w-]+)$/);
  if (m) return { name: 'plan', id: m[1]! };
  if (hash === '#/plans') return { name: 'plans' };
  const spent = hash.match(/^#\/spent(?:\/(\d{4}-\d{2}))?$/);
  if (spent) return { name: 'spent', month: spent[1] ?? null };
  const cal = hash.match(/^#\/calendar(?:\/(\d{4}-\d{2}))?$/);
  if (cal) return { name: 'calendar', month: cal[1] ?? null };
  const year = hash.match(/^#\/year(?:\/(\d{4}))?$/);
  if (year) return { name: 'year', year: year[1] ?? null };
  if (hash === '#/you') return { name: 'you' };
  if (hash === '#/money') return { name: 'money' };
  if (hash === '#/ask') return { name: 'ask' };
  return { name: 'month' };
}

// Where each page sits, left to right / shallow to deep. Panels (null) float
// over Month instead of replacing it.
const DEPTH: Record<Route['name'], number | null> = { month: 0, plans: 1, plan: 2, you: 3, spent: null, calendar: null, year: null, money: null, ask: null };

export const planHref = (id: string) => `#/plan/${id}`;

// Set once the user has moved between screens, so Back can return them there.
let movedInApp = false;

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  const current = useRef(route);
  useEffect(() => {
    const onChange = () => {
      movedInApp = true;
      const next = parse(location.hash);
      const from = DEPTH[current.current.name];
      const to = DEPTH[next.name];
      current.current = next;
      const apply = () => { flushSync(() => setRoute(next)); window.scrollTo(0, 0); };
      // Panels float in on their own; only whole pages slide.
      if (from === null || to === null || from === to || !document.startViewTransition) return apply();
      document.documentElement.dataset.nav = to > from ? 'forward' : 'back';
      document.startViewTransition(apply);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

// Back to the previous screen if we came from inside the app, else to the month.
export function goBack() {
  if (movedInApp) history.back();
  else location.hash = '#/';
}
