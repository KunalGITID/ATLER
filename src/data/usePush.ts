import { useCallback, useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, type PushState } from './push.ts';

export function usePush(userId: string) {
  const [state, setState] = useState<PushState>('off');
  useEffect(() => { void pushState().then(setState); }, []);
  const turnOn = useCallback(async () => { try { setState(await enablePush(userId)); } catch { setState('off'); } }, [userId]);
  const turnOff = useCallback(async () => setState(await disablePush()), []);
  return { state, turnOn, turnOff };
}
