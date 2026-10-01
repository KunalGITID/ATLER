interface Window {
  atlerLaunch?: { step: (fraction: number, text?: string) => void; done: () => void };
}

declare const __APP_VERSION__: string;
