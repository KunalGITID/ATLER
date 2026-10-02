import { useState, type FormEvent } from 'react';
import { ask, EXAMPLES, type Answer, type AskData } from '../core/ask.ts';
import { today as todayDay } from '../core/dates.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';

// Questions answered on this phone from your own data; nothing is sent anywhere.
export function Ask({ data }: { data: AskData }) {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<{ q: string; a: Answer } | null>(null);
  const run = (q: string) => { setQuestion(q); setAsked({ q, a: ask(q, data, todayDay()) }); };

  return (
    <div className="flex flex-col gap-2.5">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (question.trim()) run(question); }} className="flex flex-col gap-2">
        <label htmlFor="ask" className="sr-only">Your question</label>
        <input id="ask" value={question} onChange={e => setQuestion(e.target.value)} placeholder="How much did I spend on food last month?" autoComplete="off"
          className="h-[52px] rounded-2xl border-2 border-block-2 bg-ground px-4 text-base font-semibold text-ink outline-none placeholder:text-ink-2/60 focus:border-money" />
        <Button kind="primary" type="submit">ASK</Button>
      </form>

      {asked && (
        <Block className="!p-4" aria-live="polite">
          <Kicker className="text-ink-2">{asked.q}</Kicker>
          <p role="status" className="mt-1 text-[17px] leading-snug font-bold">{asked.a.text}</p>
          {asked.a.lines && asked.a.lines.length > 0 && (
            <ul className="mt-2">
              {asked.a.lines.map((l, i) => (
                <li key={i} className={`flex justify-between gap-3 py-2 text-sm ${i ? 'border-t-2 border-ground' : ''}`}>
                  {l.value ? <><span>{l.label}</span><span className="num shrink-0 font-bold">{l.value}</span></>
                    : <button type="button" className="text-left font-bold text-money" onClick={() => run(l.label)}>{l.label}</button>}
                </li>
              ))}
            </ul>
          )}
        </Block>
      )}

      <div className="flex flex-wrap gap-2" aria-label="Example questions">
        {EXAMPLES.map(e => (
          <button key={e} type="button" onClick={() => run(e)} className="rounded-full bg-block-2 px-3 py-2 text-xs font-bold">{e}</button>
        ))}
      </div>
      <p className="px-1 text-xs text-ink-2">Answered on this phone from your own data. Nothing you ask is sent anywhere.</p>
    </div>
  );
}
