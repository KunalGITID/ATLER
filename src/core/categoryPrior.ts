// A category prior: what a statement line usually is, learned from other
// people's statements (KunalGITID/atler-ml, synthetic Indian statements), so
// suggestions work before you've filed anything. Logistic regression over
// TF-IDF character n-grams; the featurizer below must stay identical to
// atler_ml/prior.py (the export checks it). The weights are JSON, loaded
// on demand (data/prior.ts).

export interface Prior {
  classes: string[];
  bias: number[];
  features: Record<string, number[]>; // token -> [idf, weight per class]
}

// Lowercase, letters only; per word "w:word" and the 3-5 character n-grams of " word ".
export function priorTokens(text: string): string[] {
  const out: string[] = [];
  for (const w of text.toLowerCase().replace(/[^a-z]+/g, ' ').split(' ')) {
    if (w.length < 2) continue;
    out.push(`w:${w}`);
    const padded = ` ${w} `;
    for (const n of [3, 4, 5]) for (let i = 0; i + n <= padded.length; i++) out.push(padded.slice(i, i + n));
  }
  return out;
}

// Probability per prior class, or null when none of the text's features are known.
export function priorProbabilities(prior: Prior, text: string): Map<string, number> | null {
  const counts = new Map<string, number>();
  for (const t of priorTokens(text)) if (prior.features[t]) counts.set(t, (counts.get(t) ?? 0) + 1);
  if (!counts.size) return null;
  const x = [...counts].map(([t, c]) => [t, (1 + Math.log(c)) * prior.features[t]![0]!] as const);
  const norm = Math.sqrt(x.reduce((a, [, v]) => a + v * v, 0));
  const logits = prior.bias.map((b, k) => x.reduce((a, [t, v]) => a + (v / norm) * prior.features[t]![k + 1]!, b));
  const max = Math.max(...logits);
  const exp = logits.map(l => Math.exp(l - max));
  const total = exp.reduce((a, b) => a + b, 0);
  return new Map(prior.classes.map((c, k) => [c, exp[k]! / total]));
}
