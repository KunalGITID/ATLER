import { Component, type ReactNode } from 'react';
import { reportError } from '../data/errors.ts';

// If a screen crashes, say so plainly and offer a reload, instead of a blank page.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportError('error', error, { componentStack: info.componentStack?.slice(0, 2000) ?? null });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
        <p className="text-ink-2">Your data is safe on this phone. Reloading usually fixes it, and the problem has been reported.</p>
        <button type="button" onClick={() => location.reload()} className="h-14 rounded-[22px] bg-money font-display text-lg font-bold text-on-color">RELOAD</button>
      </main>
    );
  }
}
