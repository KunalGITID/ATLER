// One dark design; a theme only picks the accent. The keys are the old theme
// names so saved preferences keep working. index.html has a copy of these
// values to set the accent before first paint; keep the two in sync.
export const ACCENTS = {
    default: { name: 'Lime', accent: '#C8F03C', on: '#0A0A0A' },
    midnight: { name: 'Blue', accent: '#0A84FF', on: '#FFFFFF' },
    forest: { name: 'Green', accent: '#30D158', on: '#0A0A0A' },
    inferno: { name: 'Orange', accent: '#FF9F0A', on: '#0A0A0A' },
    void: { name: 'Red', accent: '#FF453A', on: '#FFFFFF' },
    slate: { name: 'Indigo', accent: '#5E5CE6', on: '#FFFFFF' },
    paper: { name: 'Graphite', accent: '#E5E5EA', on: '#0A0A0A' },
};

export function accentFor(name) {
    return ACCENTS[name] || ACCENTS.default;
}

// 8-digit hex: the accent at a low alpha, for tinted fills (selected rows, badges).
export const tint = (hex, alpha = 0.16) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

export function applyAccent(name, root = document.documentElement) {
    const { accent, on } = accentFor(name);
    root.style.setProperty('--primary', accent);
    root.style.setProperty('--on-primary', on);
    root.style.setProperty('--primary-container', tint(accent));
    root.style.setProperty('--secondary', '#30D158');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#000000');
}
