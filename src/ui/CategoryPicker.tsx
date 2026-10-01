import { useId } from 'react';
import type { Category } from '../core/model.ts';

export const NEW_CATEGORY = '__new__';

// Pick a category, or "New category…" which reveals a name field. The caller
// creates the category on save (see resolveCategory).
export function CategoryPicker({ categories, value, onChange, newName, onNewName }: {
  categories: Category[];
  value: string;                 // a category id, '' for none, or NEW_CATEGORY
  onChange: (value: string) => void;
  newName: string;
  onNewName: (name: string) => void;
}) {
  const id = useId();
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold tracking-[0.06em] uppercase text-ink-2">Category</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}
        className="h-[52px] rounded-2xl border-2 border-block-2 bg-ground px-4 text-base font-semibold text-ink outline-none focus:border-money">
        <option value="">No category</option>
        {sorted.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        <option value={NEW_CATEGORY}>New category…</option>
      </select>
      {value === NEW_CATEGORY && (
        <input
          aria-label="New category name"
          placeholder="e.g. Entertainment"
          value={newName}
          onChange={e => onNewName(e.target.value)}
          className="h-[52px] rounded-2xl border-2 border-money bg-ground px-4 text-base font-semibold text-ink outline-none"
        />
      )}
    </div>
  );
}
