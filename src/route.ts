import { useEffect, useState } from 'react';

// Hash routes so the phone's back button works without a server:
//   #/            the month
//   #/plans       every plan
//   #/you         account and data
//   #/plan/<id>   one plan
export type Route = { name: 'month' } | { name: 'plans' } | { name: 'you' } | { name: 'plan'; id: string };

function parse(hash: string): Route {
  const m = hash.match(/^#\/plan\/([\w-]+)$/);
  if (m) return { name: 'plan', id: m[1]! };
  if (hash === '#/plans') return { name: 'plans' };
  if (hash === '#/you') return { name: 'you' };
  return { name: 'month' };
}

export const planHref = (id: string) => `#/plan/${id}`;

// Set once the user has moved between screens, so Back can return them there.
let movedInApp = false;

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => { movedInApp = true; setRoute(parse(location.hash)); window.scrollTo(0, 0); };
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
