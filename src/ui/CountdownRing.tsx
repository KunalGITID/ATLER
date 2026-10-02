// One plan's billing cycle: the filled part is the days gone, the centre is
// the days left. Drawn black on whichever colour block holds it.
const SIZE = 112;
const R = 46;
const C = 2 * Math.PI * R;

export function CountdownRing({ done, left, total, trial = false }: { done: number; left: number; total: number; trial?: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} fill="none" role="img" aria-label={`${left} of ${total} days left until ${trial ? 'the trial ends' : 'the next charge'}`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgb(10 10 10 / 0.18)" strokeWidth={12} />
        {done > 0 && ( // nothing elapsed yet = nothing drawn (a round cap alone would be a meaningless dot)
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#0a0a0a" strokeWidth={12} strokeLinecap="round"
            strokeDasharray={`${C * done} ${C}`} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-on-color" aria-hidden="true">
        <div className="num text-[30px] leading-none font-bold">{left}</div>
        <div className="text-[10px] font-extrabold">{left === 1 ? 'DAY LEFT' : 'DAYS LEFT'}</div>
        <div className="text-[9px] font-bold">of {total}</div>
      </div>
    </div>
  );
}
