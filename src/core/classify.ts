// A small category classifier that learns from your own filing, on the phone.
// Naive Bayes over the words of a name (plus its cleaned merchant name), so
// "SWIGGY*BLR 8823" lands where you put your other Swiggy orders even though
// the name never matched exactly. Nothing leaves the phone.
import { knownMerchant } from './import/statement.ts';

export interface Example { name: string; categoryId: string }

const STOP = new Set(['the', 'and', 'for', 'to', 'of', 'at', 'in', 'on', 'from', 'by', 'upi', 'pos', 'payment', 'order', 'bill', 'paid']);

export function tokens(name: string): string[] {
  const words = name.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
  const merchant = knownMerchant(name);
  return [...new Set(merchant ? [...words, `m:${merchant.toLowerCase()}`] : words)];
}

export interface Model {
  classes: Map<string, { docs: number; words: Map<string, number>; total: number }>;
  vocabulary: Set<string>;
  docs: number;
}

export function train(examples: readonly Example[]): Model {
  const classes: Model['classes'] = new Map();
  const vocabulary = new Set<string>();
  for (const ex of examples) {
    const c = classes.get(ex.categoryId) ?? { docs: 0, words: new Map(), total: 0 };
    c.docs++;
    for (const t of tokens(ex.name)) {
      c.words.set(t, (c.words.get(t) ?? 0) + 1);
      c.total++;
      vocabulary.add(t);
    }
    classes.set(ex.categoryId, c);
  }
  return { classes, vocabulary, docs: examples.length };
}

export interface Prediction { categoryId: string; confidence: number }

// The likeliest category and how sure the model is (0..1). null when none of
// the name's words have been seen before: then it would only be guessing.
export function predict(model: Model, name: string): Prediction | null {
  const words = tokens(name).filter(t => model.vocabulary.has(t));
  if (!words.length || model.classes.size === 0) return null;
  const v = model.vocabulary.size;
  const scores = [...model.classes].map(([id, c]) => {
    let log = Math.log(c.docs / model.docs);
    for (const w of words) log += Math.log(((c.words.get(w) ?? 0) + 1) / (c.total + v));
    return { id, log };
  });
  const max = Math.max(...scores.map(s => s.log));
  const weights = scores.map(s => ({ id: s.id, w: Math.exp(s.log - max) }));
  const total = weights.reduce((a, b) => a + b.w, 0);
  const best = weights.reduce((a, b) => (b.w > a.w ? b : a));
  return { categoryId: best.id, confidence: best.w / total };
}
