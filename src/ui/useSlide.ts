import { useRef } from 'react';

// Which way to slide new content in when a value that orders (a month, a year)
// changes: later comes from the right, earlier from the left.
export function useSlide(value: string): string {
  const last = useRef(value);
  const dir = useRef('');
  if (value !== last.current) {
    dir.current = value > last.current ? 'slide-forward' : 'slide-back';
    last.current = value;
  }
  return dir.current;
}
