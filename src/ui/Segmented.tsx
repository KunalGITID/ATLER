// Pick one of a few options. The chosen one is white: "where you are".
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map(o => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`h-11 flex-1 rounded-control text-sm ${on ? 'bg-here text-on-color font-extrabold' : 'bg-block-2 text-ink font-bold'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
