// ═══════════════════════════════════════════
// SUPABASE CONFIG
// ═══════════════════════════════════════════
const SUPABASE_URL  = 'https://cnxurdingdhhdcjgujkz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNueHVyZGluZ2RoaGRjamd1amt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQ1OTIsImV4cCI6MjA5MDQ1MDU5Mn0.nX0-MR9C1fmKRA9lHw0FBp_r0LYYlntbz9B7BW7HKd8';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: localStorage
    }
});

// ═══════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════
let currentUser   = null;
let profile       = { name: 'Atler', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150', theme: 'default', lastNotified: null, currency: 'INR' };
let subscriptions = [];
let categories    = [];
let expenses      = [];
let activeSubId   = null;
let activeExpenseId = null;
let analyticsView = 'subscriptions';
let analyticsSubSearch = '';
let analyticsExpSearch = '';
let currentPageId = 'dashboard-page';
let pageHistory = [];
let isSubmittingSubscription = false;
let isSubmittingExpense = false;

const presetCategories = ['Entertainment','Productivity','Utilities','Health','Food','Education'];
const navItems = document.querySelectorAll('.nav-item');

let _toastTimer = null;
function showToast(message, duration = 2200) {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(_toastTimer);
    el.textContent = message;
    el.style.opacity   = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    _toastTimer = setTimeout(() => {
        el.style.opacity   = '0';
        el.style.transform = 'translateX(-50%) translateY(-12px)';
    }, duration);
}

// ═══════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════
const DARK_SURFACES = {
    bg: '#0e0e0e', surfaceLow: '#1c1b1b', surface: '#201f1f', surfaceHigh: '#2a2a2a',
    onSurface: '#e5e2e1', onSurfaceVariant: '#c7c4d8',
    glassBg: 'rgba(19,19,19,0.6)', glassBorder: 'rgba(255,255,255,0.05)',
    error: '#ffb4ab', errorBg: 'rgba(255,180,171,0.1)',
    insightsText: 'rgba(255,255,255,0.8)', insightsDivider: 'rgba(255,255,255,0.1)',
    navBg: 'rgba(19,19,19,0.85)', navShadow: '0 -10px 40px rgba(0,0,0,0.5)',
};

const themes = {
    default:  { ...DARK_SURFACES, primary:'#c0c1ff', primaryContainer:'#4b4dd8', primaryGlow:'rgba(192,193,255,0.4)', secondary:'#4edea3', secondaryGlow:'rgba(78,222,163,0.2)' },
    midnight: { ...DARK_SURFACES, primary:'#4fc3f7', primaryContainer:'#0d47a1', primaryGlow:'rgba(79,195,247,0.4)',  secondary:'#80deea', secondaryGlow:'rgba(128,222,234,0.2)' },
    forest:   { ...DARK_SURFACES, primary:'#81c784', primaryContainer:'#1b5e20', primaryGlow:'rgba(129,199,132,0.4)', secondary:'#aed581', secondaryGlow:'rgba(174,213,129,0.2)' },
    paper: {
        primary: '#1A1A1A', primaryContainer: '#E0E0E0', primaryGlow: 'rgba(26,26,26,0.08)',
        secondary: '#555555', secondaryGlow: 'rgba(85,85,85,0.08)',
        bg: '#F5F5F5', surfaceLow: '#EBEBEB', surface: '#F0F0F0', surfaceHigh: '#E2E2E2',
        onSurface: '#1A1A1A', onSurfaceVariant: '#888888',
        glassBg: 'rgba(245,245,245,0.88)', glassBorder: 'rgba(0,0,0,0.08)',
        error: '#cc2222', errorBg: 'rgba(204,34,34,0.08)',
        insightsText: 'rgba(0,0,0,0.65)', insightsDivider: 'rgba(0,0,0,0.10)',
        navBg: 'rgba(245,245,245,0.92)', navShadow: '0 -10px 40px rgba(0,0,0,0.08)',
    },
    void: {
        primary: '#E05A4E', primaryContainer: '#2A1210', primaryGlow: 'rgba(224,90,78,0.35)',
        secondary: '#C04840', secondaryGlow: 'rgba(192,72,64,0.2)',
        bg: '#0D0D0D', surfaceLow: '#141414', surface: '#1C1C1C', surfaceHigh: '#252525',
        onSurface: '#E8E8E8', onSurfaceVariant: '#888888',
        glassBg: 'rgba(13,13,13,0.75)', glassBorder: 'rgba(255,255,255,0.06)',
        error: '#ff6b6b', errorBg: 'rgba(255,107,107,0.1)',
        insightsText: 'rgba(232,232,232,0.8)', insightsDivider: 'rgba(224,90,78,0.25)',
        navBg: 'rgba(13,13,13,0.9)', navShadow: '0 -10px 40px rgba(0,0,0,0.7)',
    },
    inferno: {
        primary: '#FF6A00', primaryContainer: '#1F1000', primaryGlow: 'rgba(255,106,0,0.4)',
        secondary: '#00FFB2', secondaryGlow: 'rgba(0,255,178,0.2)',
        bg: '#0A0A0A', surfaceLow: '#111111', surface: '#161616', surfaceHigh: '#1A1A1A',
        onSurface: '#EFEFEF', onSurfaceVariant: '#444444',
        glassBg: 'rgba(10,10,10,0.78)', glassBorder: 'rgba(255,106,0,0.12)',
        error: '#ff6b6b', errorBg: 'rgba(255,107,107,0.1)',
        insightsText: 'rgba(239,239,239,0.82)', insightsDivider: 'rgba(255,106,0,0.3)',
        navBg: 'rgba(10,10,10,0.92)', navShadow: '0 -10px 40px rgba(255,106,0,0.12)',
    },
    slate: {
        primary: '#94a3b8', primaryContainer: '#334155', primaryGlow: 'rgba(148,163,184,0.3)',
        secondary: '#7dd3fc', secondaryGlow: 'rgba(125,211,252,0.2)',
        bg: '#0f172a', surfaceLow: '#1e293b', surface: '#263348', surfaceHigh: '#334155',
        onSurface: '#e2e8f0', onSurfaceVariant: '#94a3b8',
        glassBg: 'rgba(15,23,42,0.75)', glassBorder: 'rgba(148,163,184,0.1)',
        error: '#fca5a5', errorBg: 'rgba(252,165,165,0.1)',
        insightsText: 'rgba(226,232,240,0.8)', insightsDivider: 'rgba(148,163,184,0.2)',
        navBg: 'rgba(15,23,42,0.92)', navShadow: '0 -10px 40px rgba(0,0,0,0.7)',
    },
};

function applyTheme(name) {
    const t = themes[name] || themes.default;
    const r = document.documentElement.style;

    r.setProperty('--primary',           t.primary);
    r.setProperty('--primary-container', t.primaryContainer);
    r.setProperty('--primary-glow',      t.primaryGlow);
    r.setProperty('--secondary',         t.secondary);
    r.setProperty('--secondary-glow',    t.secondaryGlow);

    r.setProperty('--bg-color',          t.bg);
    r.setProperty('--surface-low',       t.surfaceLow);
    r.setProperty('--surface',           t.surface);
    r.setProperty('--surface-high',      t.surfaceHigh);
    r.setProperty('--on-surface',        t.onSurface);
    r.setProperty('--on-surface-variant',t.onSurfaceVariant);
    r.setProperty('--glass-bg',          t.glassBg);
    r.setProperty('--glass-border',      t.glassBorder);
    r.setProperty('--error',             t.error);
    r.setProperty('--error-bg',          t.errorBg);
    r.setProperty('--insights-text',     t.insightsText);
    r.setProperty('--insights-divider',  t.insightsDivider);
    r.setProperty('--nav-bg',            t.navBg);
    r.setProperty('--nav-shadow',        t.navShadow);

    document.querySelectorAll('.theme-chip').forEach(chip => {
        const dot = chip.querySelector('div');
        if (dot) {
            dot.style.border =
                chip.dataset.theme === name
                    ? `2px solid ${t.primary}`
                    : '2px solid transparent';
        }
    });

    profile.theme = name;
    localStorage.setItem('atler_theme', name);
}

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════
let authMode = 'login';

document.getElementById('tab-login').addEventListener('click', () => {
    authMode = 'login';
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-signup').classList.remove('active');
    document.getElementById('auth-name-group').style.display = 'none';
    document.getElementById('auth-submit-btn').textContent = 'Sign In';
    document.getElementById('auth-error').textContent = '';
});

document.getElementById('tab-signup').addEventListener('click', () => {
    authMode = 'signup';
    document.getElementById('tab-signup').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('auth-name-group').style.display = 'block';
    document.getElementById('auth-submit-btn').textContent = 'Create Account';
    document.getElementById('auth-error').textContent = '';
});

document.getElementById('auth-submit-btn').addEventListener('click', async () => {
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name     = document.getElementById('auth-name').value.trim();
    const btn      = document.getElementById('auth-submit-btn');
    const errEl    = document.getElementById('auth-error');

    if (!email || !password) { errEl.textContent = 'Please enter email and password.'; return; }
    if (authMode === 'signup' && !name) { errEl.textContent = 'Please enter your name.'; return; }

    btn.disabled = true;
    btn.textContent = authMode === 'login' ? 'Signing in...' : 'Creating account...';
    errEl.textContent = '';

    try {
        if (authMode === 'signup') {
            const { data, error } = await sb.auth.signUp({ email, password });
            if (error) throw error;
            if (data.user) {
                await sb.from('profiles').upsert({ user_id: data.user.id, name: name || 'Atler', theme: 'default' });
            }
        } else {
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
        }
    } catch (err) {
        errEl.textContent = err.message || 'Something went wrong.';
        btn.disabled = false;
        btn.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
    }
});

['auth-email','auth-password','auth-name'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('auth-submit-btn').click();
    });
});

document.getElementById('signout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
});

// ═══════════════════════════════════════════
// DATA — SUPABASE CRUD
// ═══════════════════════════════════════════
async function loadAllData() {
    if (!currentUser) return;
    const uid = currentUser.id;

    const [profRes, subsRes, catsRes, expsRes] = await Promise.all([
        sb.from('profiles').select('*').eq('user_id', uid).single(),
        sb.from('subscriptions').select('*').eq('user_id', uid),
        sb.from('categories').select('*').eq('user_id', uid),
        sb.from('expenses').select('*').eq('user_id', uid),
    ]);

    if (profRes.data) {
        profile = {
            name:         profRes.data.name   || 'Atler',
            avatar:       profRes.data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
            theme:        profRes.data.theme  || 'default',
            lastNotified: profRes.data.last_notified || null,
            currency:     profRes.data.currency || 'INR',
        };
    }

    subscriptions = (subsRes.data || []).map(s => ({
        id:                s.id,
        name:              s.name,
        cycle:             s.cycle,
        price:             s.price,
        dateAdded:         s.date_added,
        startDate:         s.start_date,
        category:          s.category || 'unlisted',
        lastLoggedRenewal: s.last_logged_renewal,
        paused:            s.paused || false,
    }));

    categories = (catsRes.data || []).map(c => ({
        id:     c.id,
        name:   c.name,
        budget: c.budget,
    }));

    expenses = (expsRes.data || []).map(e => ({
        id:     e.id,
        name:   e.name,
        amount: e.amount,
        date:   e.date,
        type:   e.type || 'manual',
    }));

    applyTheme(profile.theme);
}

async function saveProfile() {
    if (!currentUser) return;
    try {
        await sb.from('profiles').upsert({
            user_id:       currentUser.id,
            name:          profile.name,
            avatar:        profile.avatar,
            theme:         profile.theme,
            last_notified: profile.lastNotified || null,
            currency:      profile.currency || 'INR',
        });
    } catch {
        if (!navigator.onLine) showToast('Saved locally — will sync when online');
    }
}

async function upsertSubscription(sub) {
    if (!currentUser) return;
    try {
        await sb.from('subscriptions').upsert({
            id:                  sub.id,
            user_id:             currentUser.id,
            name:                sub.name,
            cycle:               String(sub.cycle),
            price:               sub.price,
            date_added:          sub.dateAdded,
            start_date:          sub.startDate,
            category:            sub.category || 'unlisted',
            last_logged_renewal: sub.lastLoggedRenewal || null,
            paused:              sub.paused || false,
        });
    } catch {
        if (!navigator.onLine) showToast('Saved locally — will sync when online');
    }
}

async function deleteSubscription(id) {
    if (!currentUser) return;
    await sb.from('subscriptions').delete().eq('id', id).eq('user_id', currentUser.id);
    await sb.from('expenses').delete().eq('user_id', currentUser.id).like('id', `auto_${id}_%`);
    expenses = expenses.filter(exp => !String(exp.id).startsWith(`auto_${id}_`));
}

async function upsertCategory(cat) {
    if (!currentUser) return;
    try {
        await sb.from('categories').upsert({
            id:      cat.id,
            user_id: currentUser.id,
            name:    cat.name,
            budget:  cat.budget || null,
        });
    } catch {
        if (!navigator.onLine) showToast('Saved locally — will sync when online');
    }
}

async function deleteCategoryFromDB(id) {
    if (!currentUser) return;
    await sb.from('categories').delete().eq('id', id).eq('user_id', currentUser.id);
    const affected = subscriptions.filter(s => s.category === id);
    for (const sub of affected) {
        sub.category = 'unlisted';
        await upsertSubscription(sub);
    }
}

window.deleteCategory = async function(id) {
    if (!confirm('Delete category? Subscriptions will be moved to Unlisted.')) return;
    categories = categories.filter(c => c.id !== id);
    await deleteCategoryFromDB(id);
    renderAnalytics();
};

async function insertExpense(exp) {
    if (!currentUser) return;
    try {
        await sb.from('expenses').insert({
            id:      exp.id,
            user_id: currentUser.id,
            name:    exp.name,
            amount:  exp.amount,
            date:    exp.date,
            type:    exp.type || 'manual',
        });
    } catch {
        if (!navigator.onLine) showToast('Saved locally — will sync when online');
    }
}

async function clearAllData() {
    if (!currentUser) return;
    const uid = currentUser.id;
    await Promise.all([
        sb.from('subscriptions').delete().eq('user_id', uid),
        sb.from('categories').delete().eq('user_id', uid),
        sb.from('expenses').delete().eq('user_id', uid),
    ]);
    subscriptions = [];
    categories    = [];
    expenses      = [];
}

// ═══════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function pad2(value) {
    return String(value).padStart(2, '0');
}
function getLocalDateKey(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function getLocalDateTimeString(date = new Date()) {
    return `${getLocalDateKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
function formatDate(ds) {
    return new Date(ds).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function todayISO() { return getLocalDateKey(new Date()); }

// ═══════════════════════════════════════════
// CURRENCY HELPERS
// ═══════════════════════════════════════════
function getCurrencySymbol() {
    const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    return symbols[profile.currency] || '₹';
}
function formatAmount(amount) {
    const locales = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
    const locale  = locales[profile.currency] || 'en-IN';
    return parseFloat(amount).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthlyCost(sub) {
    const price = parseFloat(sub.price);
    if (sub.cycle === 'Yearly')  return price / 12;
    if (sub.cycle === 'Monthly') return price;
    const days = parseInt(sub.cycle);
    if (!days || days <= 0) return price;
    return (price / days) * 30;
}
function getNextRenewalDate(dateAdded, cycle) {
    const start = new Date(dateAdded);
    const today = new Date(); today.setHours(0,0,0,0);
    let next = new Date(start); next.setHours(0,0,0,0);
    if (cycle === 'Yearly') {
        while (next <= today) next.setFullYear(next.getFullYear() + 1);
    } else {
        const inc = cycle === 'Monthly' ? 30 : parseInt(cycle);
        while (next <= today) next.setDate(next.getDate() + inc);
    }
    return next;
}
function getLastRenewalDate(dateAdded, cycle) {
    const next = getNextRenewalDate(dateAdded, cycle);
    const last = new Date(next);
    if (cycle === 'Yearly') last.setFullYear(last.getFullYear() - 1);
    else { const inc = cycle === 'Monthly' ? 30 : parseInt(cycle); last.setDate(last.getDate() - inc); }
    return last;
}
function formatCycle(cycle) {
    if (cycle === 'Monthly' || cycle === 'Yearly') return cycle;
    return `Every ${cycle} days`;
}
function colorFromName(name) {
    const palette = ['#1db954','#e50914','#c0c1ff','#4edea3','#ffb4ab','#4b4dd8','#f59e0b','#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}

// ═══════════════════════════════════════════
// AUTO-LOG RENEWALS
// ═══════════════════════════════════════════
async function autoLogRenewals() {
    const today = new Date(); today.setHours(0,0,0,0);
    for (const sub of subscriptions) {
        if (sub.paused) continue;
        const anchor = sub.startDate || sub.dateAdded;
        const lastRenewal = getLastRenewalDate(anchor, sub.cycle);
        if (lastRenewal > today) continue;
        const lastRenewalISO = getLocalDateKey(lastRenewal);
        if (sub.lastLoggedRenewal === lastRenewalISO) continue;
        const subAddedDate = new Date(sub.dateAdded); subAddedDate.setHours(0,0,0,0);
        if (lastRenewal < subAddedDate) continue;
        const expId = 'auto_' + sub.id + '_' + lastRenewalISO;
        const exists = expenses.find(e => e.id === expId);
        if (!exists) {
            const newExp = { id: expId, name: sub.name, amount: parseFloat(sub.price), date: lastRenewalISO, type: 'auto' };
            expenses.push(newExp);
            await insertExpense(newExp);
        }
        sub.lastLoggedRenewal = lastRenewalISO;
        await upsertSubscription(sub);
    }
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
const ROOT_PAGES = new Set(['dashboard-page', 'analytics-page', 'profile-page']);

function switchPage(targetId, options = {}) {
    const { pushHistory: shouldPushHistory = false, preserveHistory = false } = options;
    if (shouldPushHistory && currentPageId && currentPageId !== targetId) {
        pageHistory.push(currentPageId);
    } else if (!preserveHistory && ROOT_PAGES.has(targetId)) {
        pageHistory = [];
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    navItems.forEach(item => item.classList.toggle('active', item.getAttribute('data-target') === targetId));
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.add('active');
        if (targetId === 'dashboard-page' || targetId === 'analytics-page') renderApp();
        if (targetId === 'profile-page') renderProfilePage();
        currentPageId = targetId;
    }
    window.scrollTo(0, 0);
}

function goBack() {
    const previous = pageHistory.pop() || 'dashboard-page';
    switchPage(previous, { preserveHistory: true });
}

navItems.forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        const t = item.getAttribute('data-target');
        if (t) switchPage(t, { preserveHistory: false });
    });
});

document.getElementById('user-avatar-img').addEventListener('click', () => switchPage('profile-page'));
document.querySelectorAll('[data-back-button]').forEach(button => {
    button.addEventListener('click', goBack);
});

// ═══════════════════════════════════════════
// DETAILS PAGE
// ═══════════════════════════════════════════
function viewDetails(id) {
    activeSubId = id;
    const sub = subscriptions.find(s => s.id === id);
    if (!sub) return;

    document.getElementById('detail-name').textContent  = sub.name;
    document.getElementById('detail-cycle').textContent = formatCycle(sub.cycle) + ' Plan';
    document.getElementById('detail-price').textContent = parseFloat(sub.price).toFixed(2);

    // Edit form pre-fill
    document.getElementById('edit-name').value       = sub.name;
    document.getElementById('edit-cycle').value      = (sub.cycle === 'Monthly' || sub.cycle === 'Yearly') ? sub.cycle : 'Custom';
    document.getElementById('edit-price').value      = sub.price;
    document.getElementById('edit-start-date').value = sub.startDate || sub.dateAdded?.split('T')[0] || todayISO();

    const isCustom = sub.cycle !== 'Monthly' && sub.cycle !== 'Yearly';
    document.getElementById('edit-custom-days-group').style.display = isCustom ? 'block' : 'none';
    if (isCustom) document.getElementById('edit-custom-days').value = sub.cycle;

    // Pause button state
    document.getElementById('pause-icon').textContent  = sub.paused ? 'play_arrow' : 'pause';
    document.getElementById('pause-label').textContent = sub.paused ? 'Resume Subscription' : 'Pause Subscription';

    switchPage('details-page', { pushHistory: true });
}

function viewExpenseDetails(id) {
    activeExpenseId = id;
    const exp = expenses.find(entry => entry.id === id);
    if (!exp) return;

    document.getElementById('expense-detail-name').textContent = exp.name;
    document.getElementById('expense-detail-date').textContent = formatDate(exp.date);
    document.getElementById('expense-detail-date-full').textContent = formatDate(exp.date);
    document.getElementById('expense-detail-amount').textContent = formatAmount(exp.amount);
    document.getElementById('expense-detail-type').textContent = exp.type === 'auto' ? 'Auto renewal' : 'Manual expense';

    switchPage('expense-details-page', { pushHistory: true });
}

// Edit form cycle toggle
document.getElementById('edit-cycle').addEventListener('change', e => {
    document.getElementById('edit-custom-days-group').style.display = e.target.value === 'Custom' ? 'block' : 'none';
});

// Edit form submit
document.getElementById('edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const sub = subscriptions.find(s => s.id === activeSubId);
    if (!sub) return;
    let cycle = document.getElementById('edit-cycle').value;
    if (cycle === 'Custom') {
        const days = parseInt(document.getElementById('edit-custom-days').value);
        if (!days || days <= 0) return;
        cycle = days;
    }
    const editedName = document.getElementById('edit-name').value.trim() || sub.name;
    const duplicate  = subscriptions.find(s => s.id !== activeSubId && s.name.toLowerCase().trim() === editedName.toLowerCase().trim());
    if (duplicate && !confirm(`Another subscription called ${editedName} already exists. Save anyway?`)) return;
    sub.name      = editedName;
    sub.cycle     = cycle;
    sub.price     = parseFloat(document.getElementById('edit-price').value).toFixed(2);
    sub.startDate = document.getElementById('edit-start-date').value || sub.startDate;
    await upsertSubscription(sub);

    // Refresh detail view
    document.getElementById('detail-name').textContent  = sub.name;
    document.getElementById('detail-cycle').textContent = formatCycle(sub.cycle) + ' Plan';
    document.getElementById('detail-price').textContent = parseFloat(sub.price).toFixed(2);

    showToast('Saved');
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = 'Save Changes'; }, 1500);
});

// Pause button
document.getElementById('pause-sub-btn').addEventListener('click', async () => {
    const sub = subscriptions.find(s => s.id === activeSubId);
    if (!sub) return;
    sub.paused = !sub.paused;
    await upsertSubscription(sub);
    document.getElementById('pause-icon').textContent  = sub.paused ? 'play_arrow' : 'pause';
    document.getElementById('pause-label').textContent = sub.paused ? 'Resume Subscription' : 'Pause Subscription';
    showToast(sub.paused ? 'Paused' : 'Resumed');
});

// Delete button
document.getElementById('delete-sub-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this subscription?')) return;
    await deleteSubscription(activeSubId);
    subscriptions = subscriptions.filter(s => s.id !== activeSubId);
    showToast('Subscription deleted');
    goBack();
    await renderApp();
});

document.getElementById('delete-expense-btn').addEventListener('click', async () => {
    if (!activeExpenseId) return;
    if (!confirm('Delete this expense?')) return;

    await sb.from('expenses').delete().eq('id', activeExpenseId).eq('user_id', currentUser.id);
    expenses = expenses.filter(exp => exp.id !== activeExpenseId);
    activeExpenseId = null;
    showToast('Expense deleted');
    goBack();
    await renderApp();
});

// ═══════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════
async function scheduleRenewalNotifications() {
    if (!currentUser || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const todayStr = new Date().toISOString().slice(0, 10);
    if (profile.lastNotified === todayStr) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const activeSubs = subscriptions.filter(s => !s.paused);

    for (const sub of activeSubs) {
        const anchor   = sub.startDate || sub.dateAdded;
        const next     = getNextRenewalDate(anchor, sub.cycle);
        const diffDays = Math.ceil((next - today) / 86400000);
        if (diffDays === 3 || diffDays === 1) {
            const price = formatAmount(sub.price);
            new Notification('Atler — Renewal Reminder', {
                body: `${sub.name} renews in ${diffDays} day${diffDays > 1 ? 's' : ''} — ${getCurrencySymbol()}${price}`,
                icon: '/icon-192.png',
            });
        }
    }

    profile.lastNotified = todayStr;
    await saveProfile();
}

function renderNotificationStatus() {
    const btn      = document.getElementById('notif-toggle-btn');
    const status   = document.getElementById('notif-status');
    const iconWrap = document.getElementById('notif-icon-wrap');
    if (!btn || !status) return;

    if (!('Notification' in window)) {
        status.textContent = 'Not supported in this browser';
        btn.style.display  = 'none';
        return;
    }

    const perm = Notification.permission;
    if (perm === 'granted') {
        status.textContent      = 'Enabled — reminders active';
        status.style.color      = 'var(--secondary)';
        btn.textContent         = 'On';
        btn.disabled            = true;
        btn.style.background    = 'var(--secondary)';
        btn.style.color         = '#0e0e0e';
        btn.style.opacity       = '1';
        btn.style.cursor        = 'default';
        if (iconWrap) iconWrap.style.background = 'rgba(78,222,163,0.15)';
    } else if (perm === 'denied') {
        status.textContent      = 'Blocked — allow in browser settings';
        status.style.color      = 'var(--error)';
        btn.textContent         = 'Blocked';
        btn.disabled            = true;
        btn.style.background    = 'var(--error-bg)';
        btn.style.color         = 'var(--error)';
        btn.style.opacity       = '1';
        btn.style.cursor        = 'default';
        if (iconWrap) iconWrap.style.background = 'var(--error-bg)';
    } else {
        status.textContent      = 'Not enabled';
        status.style.color      = 'var(--on-surface-variant)';
        btn.textContent         = 'Enable';
        btn.disabled            = false;
        btn.style.background    = 'var(--primary-container)';
        btn.style.color         = 'var(--primary)';
        btn.style.opacity       = '1';
        btn.style.cursor        = 'pointer';
        if (iconWrap) iconWrap.style.background = 'var(--primary-container)';
    }
}

function showNotificationPrompt() {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    const overlay = document.getElementById('notif-prompt-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
}

function hideNotificationPrompt() {
    const overlay = document.getElementById('notif-prompt-overlay');
    if (overlay) overlay.style.display = 'none';
}

document.getElementById('notif-prompt-allow').addEventListener('click', async () => {
    hideNotificationPrompt();
    const perm = await Notification.requestPermission();
    renderNotificationStatus();
    if (perm === 'granted') await scheduleRenewalNotifications();
});

document.getElementById('notif-prompt-skip').addEventListener('click', () => {
    hideNotificationPrompt();
});

// ═══════════════════════════════════════════
// PROFILE PAGE
// ═══════════════════════════════════════════
function renderProfilePage() {
    const preview = document.getElementById('profile-avatar-preview');
    if (preview) preview.src = profile.avatar;
    const heroName = document.getElementById('profile-display-name-hero');
    if (heroName) heroName.textContent = profile.name;
    const nameInput = document.getElementById('profile-name');
    if (nameInput) nameInput.value = profile.name;
    const statsLine = document.getElementById('profile-stats-line');
    if (statsLine) {
        const totalMonthly = subscriptions.filter(s => !s.paused).reduce((s, sub) => s + getMonthlyCost(sub), 0);
        statsLine.textContent = `${subscriptions.length} subscription${subscriptions.length !== 1 ? 's' : ''} · ${getCurrencySymbol()}${formatAmount(totalMonthly)}/mo`;
    }
    applyTheme(profile.theme || 'default');
    renderNotificationStatus();
    document.querySelectorAll('.currency-pill').forEach(pill => {
        pill.style.border = pill.dataset.currency === (profile.currency || 'INR')
            ? '2px solid var(--primary)'
            : '2px solid var(--glass-border)';
        pill.style.color = pill.dataset.currency === (profile.currency || 'INR')
            ? 'var(--primary)'
            : 'var(--on-surface-variant)';
    });
}

document.getElementById('notif-toggle-btn').addEventListener('click', async () => {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    showNotificationPrompt();
});

document.getElementById('profile-avatar-circle').addEventListener('click', () => {
    document.getElementById('avatar-file-input').click();
});

document.getElementById('avatar-file-input').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        profile.avatar = e.target.result;
        document.getElementById('profile-avatar-preview').src = e.target.result;
        document.getElementById('user-avatar-img').src = e.target.result;
        await saveProfile();
    };
    reader.readAsDataURL(file);
});

document.getElementById('profile-name-save').addEventListener('click', async () => {
    const val = document.getElementById('profile-name').value.trim();
    if (!val) return;
    profile.name = val;
    await saveProfile();
    document.getElementById('user-display-name').textContent = val;
    document.getElementById('profile-display-name-hero').textContent = val;
    const btn = document.getElementById('profile-name-save');
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = 'Save'; }, 1500);
});

document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
        applyTheme(chip.dataset.theme);
        await saveProfile();
    });
});

document.querySelectorAll('.currency-pill').forEach(pill => {
    pill.addEventListener('click', async () => {
        profile.currency = pill.dataset.currency;
        await saveProfile();
        renderProfilePage();
        renderApp();
    });
});

// ═══════════════════════════════════════════
// DATA MANAGEMENT MODAL
// ═══════════════════════════════════════════
const dataModalOverlay = document.getElementById('data-modal-overlay');

function openDataModal()  { dataModalOverlay.style.display = 'flex'; }
function closeDataModal() { dataModalOverlay.style.display = 'none'; }

document.getElementById('open-data-modal-btn').addEventListener('click', openDataModal);
document.getElementById('dm-cancel-btn').addEventListener('click', closeDataModal);
dataModalOverlay.addEventListener('click', e => { if (e.target === dataModalOverlay) closeDataModal(); });

document.getElementById('dm-export-btn').addEventListener('click', () => {
    const data = { profile, subscriptions, categories, expenses, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `atler-backup-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
    closeDataModal();
});

document.getElementById('dm-import-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        let parsed;
        try { parsed = JSON.parse(e.target.result); } catch {
            alert('Invalid JSON file.'); return;
        }
        if (!Array.isArray(parsed.subscriptions)) {
            alert('Invalid backup file — missing subscriptions array.'); return;
        }
        if (!confirm('This will replace all your current data. Continue?')) return;
        closeDataModal();
        await clearAllData();
        for (const sub of (parsed.subscriptions || [])) await upsertSubscription(sub);
        for (const cat of (parsed.categories   || [])) await upsertCategory(cat);
        for (const exp of (parsed.expenses      || [])) await insertExpense(exp);
        if (parsed.profile) {
            profile.name   = parsed.profile.name   || profile.name;
            profile.avatar = parsed.profile.avatar || profile.avatar;
        }
        await saveProfile();
        await loadAllData();
        await renderApp();
        renderProfilePage();
        showToast('Imported successfully');
    };
    reader.readAsText(file);
    this.value = '';
});

document.getElementById('dm-clear-btn').addEventListener('click', async () => {
    if (!confirm('This will delete all your subscriptions, expenses and categories. Your profile will be kept. Continue?')) return;
    closeDataModal();
    await clearAllData();
    await renderApp();
    renderProfilePage();
    showToast('All data cleared');
});

// ═══════════════════════════════════════════
// ADD SUBSCRIPTION FORM
// ═══════════════════════════════════════════
const addForm         = document.getElementById('add-form');
const cycleSelect     = document.getElementById('add-cycle');
const customDaysGroup = document.getElementById('custom-days-group');

document.getElementById('add-start-date').value = todayISO();

cycleSelect.addEventListener('change', e => {
    const show = e.target.value === 'Custom';
    customDaysGroup.style.display = show ? 'block' : 'none';
    if (!show) document.getElementById('add-custom-days').value = '';
});

addForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (isSubmittingSubscription) return;

    const submitBtn  = addForm.querySelector('button[type="submit"]');
    const name       = document.getElementById('add-name').value.trim();
    let cycle        = document.getElementById('add-cycle').value;
    const price      = document.getElementById('add-price').value;
    const startDate  = document.getElementById('add-start-date').value;
    const customDays = document.getElementById('add-custom-days').value;
    if (!name || !price) return;
    if (cycle === 'Custom') {
        if (!customDays || parseInt(customDays) <= 0) return;
        cycle = parseInt(customDays);
    }
    const existing = subscriptions.find(s => s.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (existing) {
        const existingPrice = getCurrencySymbol() + formatAmount(existing.price);
        const existingCycle = formatCycle(existing.cycle);
        if (!confirm(`You already have ${existing.name} at ${existingPrice}/${existingCycle}. Add another anyway?`)) return;
    }

    isSubmittingSubscription = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }

    try {
        const newSub = {
            id:        Date.now().toString(),
            name, cycle,
            price:     parseFloat(price).toFixed(2),
            dateAdded: getLocalDateTimeString(),
            startDate: startDate || todayISO(),
            category:  'unlisted',
            paused:    false,
        };
        subscriptions.push(newSub);
        await upsertSubscription(newSub);
        addForm.reset();
        document.getElementById('add-start-date').value = todayISO();
        customDaysGroup.style.display = 'none';
        closeAddSheet();
        await renderApp();
    } finally {
        isSubmittingSubscription = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Subscription';
        }
    }
});

// ═══════════════════════════════════════════
// ADD EXPENSE FORM
// ═══════════════════════════════════════════
const addExpenseForm = document.getElementById('add-expense-form');
document.getElementById('exp-date').value = todayISO();

addExpenseForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (isSubmittingExpense) return;

    const submitBtn = addExpenseForm.querySelector('button[type="submit"]');
    const name   = document.getElementById('exp-name').value.trim();
    const amount = document.getElementById('exp-amount').value;
    const date   = document.getElementById('exp-date').value || todayISO();
    if (!name || !amount) return;

    isSubmittingExpense = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }

    try {
        const newExp = { id: Date.now().toString(), name, amount: parseFloat(amount), date, type: 'manual' };
        expenses.push(newExp);
        await insertExpense(newExp);
        addExpenseForm.reset();
        document.getElementById('exp-date').value = todayISO();
        closeAddSheet();
        await renderApp();
    } finally {
        isSubmittingExpense = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Expense';
        }
    }
});

// ═══════════════════════════════════════════
// BOTTOM SHEET
// ═══════════════════════════════════════════
const sheetOverlay = document.getElementById('add-sheet-overlay');
const sheet        = document.getElementById('add-sheet');

function openAddSheet(mode) {
    const subForm = document.getElementById('sheet-sub-form');
    const expForm = document.getElementById('sheet-exp-form');
    if (mode === 'expense') {
        subForm.style.display = 'none'; expForm.style.display = 'block';
        document.getElementById('exp-date').value = todayISO();
    } else {
        subForm.style.display = 'block'; expForm.style.display = 'none';
        document.getElementById('add-start-date').value = todayISO();
    }
    sheetOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeAddSheet() {
    sheetOverlay.classList.remove('open');
    sheet.style.transform = '';
    document.body.style.overflow = '';
}

// FAB
const fabContainer = document.getElementById('fab-container');
const fabBtn       = document.getElementById('fab-btn');
const fabOverlay   = document.getElementById('fab-overlay');

function toggleFab() { const o = fabContainer.classList.toggle('open'); fabOverlay.classList.toggle('open', o); }
function closeFab()  { fabContainer.classList.remove('open'); fabOverlay.classList.remove('open'); }

fabBtn.addEventListener('click', e => { e.preventDefault(); toggleFab(); });
fabOverlay.addEventListener('click', closeFab);
document.getElementById('fab-option-sub').addEventListener('click', () => { closeFab(); openAddSheet('subscription'); });
document.getElementById('fab-option-expense').addEventListener('click', () => { closeFab(); openAddSheet('expense'); });
sheetOverlay.addEventListener('click', e => { if (e.target === sheetOverlay) closeAddSheet(); });

// Drag-to-dismiss
(function () {
    const handle = document.getElementById('sheet-handle');
    let dragStartY = 0, isDragging = false;
    handle.addEventListener('touchstart', e => { dragStartY = e.touches[0].clientY; isDragging = true; sheet.style.transition = 'none'; }, { passive: true });
    handle.addEventListener('touchmove', e => { if (!isDragging) return; const d = e.touches[0].clientY - dragStartY; if (d > 0) sheet.style.transform = `translateY(${d}px)`; }, { passive: true });
    handle.addEventListener('touchend', e => { if (!isDragging) return; isDragging = false; sheet.style.transition = ''; const d = e.changedTouches[0].clientY - dragStartY; if (d > 80) closeAddSheet(); else sheet.style.transform = 'translateY(0)'; }, { passive: true });
})();

// ═══════════════════════════════════════════
// ANALYTICS TOGGLE
// ═══════════════════════════════════════════
document.querySelectorAll('.seg-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.seg-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        analyticsView = pill.getAttribute('data-view');
        renderAnalyticsView();
    });
});

function renderAnalyticsView() {
    const subsView = document.getElementById('analytics-subs-view');
    const expView  = document.getElementById('analytics-expenses-view');
    if (analyticsView === 'expenses') {
        subsView.style.display = 'none'; expView.style.display = 'block';
        renderExpensesView();
    } else {
        subsView.style.display = 'block'; expView.style.display = 'none';
        renderAnalytics();
    }
}

// ═══════════════════════════════════════════
// EXPENSES VIEW
// ═══════════════════════════════════════════
function renderExpensesView() {
    const container = document.getElementById('expenses-list-container');
    container.innerHTML = '';
    const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
    document.getElementById('expenses-month-total-val').textContent = formatAmount(total);

    // ── JS-injected search input (only when expenses.length > 7) ──
    const expSearchWrap = container.parentElement.querySelector('.analytics-search-input[data-scope="expenses"]');
    if (expSearchWrap) expSearchWrap.remove(); // remove stale before re-injecting
    if (expenses.length > 7) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = 'Search expenses…';
        inp.autocomplete = 'off';
        inp.className = 'analytics-search-input';
        inp.dataset.scope = 'expenses';
        inp.value = analyticsExpSearch;
        inp.addEventListener('input', e => { analyticsExpSearch = e.target.value; renderExpensesView(); });
        container.parentElement.insertBefore(inp, container);
    }

    if (expenses.length === 0) { container.innerHTML = `<div class="expenses-empty">No expenses logged yet.<br>Tap (+) to add one.</div>`; return; }

    const q = analyticsExpSearch.trim().toLowerCase();
    const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    const todayStr = todayISO();
    const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return getLocalDateKey(d); })();
    const dateLabel = iso => iso === todayStr ? 'Today' : iso === yest ? 'Yesterday' : new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short' });

    // Build day groups
    const groups = []; const seen = new Map();
    sorted.forEach(exp => {
        const label = dateLabel(exp.date);
        if (!seen.has(exp.date)) { seen.set(exp.date, groups.length); groups.push({ label, date: exp.date, items: [] }); }
        groups[seen.get(exp.date)].items.push(exp);
    });

    let anyVisible = false;
    groups.forEach((group, gi) => {
        // Filter items in this group
        const visible = q ? group.items.filter(e => e.name.toLowerCase().includes(q)) : group.items;
        if (visible.length === 0) return; // hide whole day group when nothing matches
        anyVisible = true;

        const dayLabel = document.createElement('div');
        dayLabel.className = 'exp-day-label'; dayLabel.textContent = group.label;
        container.appendChild(dayLabel);

        visible.forEach(exp => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'exp-row exp-row-button';

            const left = document.createElement('div');
            left.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;';
            const nameSpan = document.createElement('span'); nameSpan.className = 'exp-name'; nameSpan.textContent = exp.name;
            const metaSpan = document.createElement('span'); metaSpan.className = 'list-subtitle'; metaSpan.textContent = exp.type === 'auto' ? 'Auto renewal' : 'Manual expense';
            left.appendChild(nameSpan);
            left.appendChild(metaSpan);

            const right = document.createElement('div');
            right.style.cssText = 'display:flex;align-items:center;gap:10px;';
            const amtSpan  = document.createElement('span'); amtSpan.className  = 'exp-amount'; amtSpan.textContent = getCurrencySymbol() + formatAmount(exp.amount);
            const chevron = document.createElement('span');
            chevron.className = 'material-symbols-outlined';
            chevron.style.cssText = 'font-size:18px;color:var(--on-surface-variant);';
            chevron.textContent = 'chevron_right';
            right.appendChild(amtSpan);
            right.appendChild(chevron);

            row.appendChild(left);
            row.appendChild(right);
            row.addEventListener('click', () => viewExpenseDetails(exp.id));
            container.appendChild(row);
        });

        if (gi < groups.length - 1) {
            const div = document.createElement('div'); div.className = 'exp-divider'; container.appendChild(div);
        }
    });

    if (!anyVisible && q) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:24px 0;color:var(--on-surface-variant);font-size:0.85rem;';
        empty.textContent = 'No results';
        container.appendChild(empty);
    }
}

// ═══════════════════════════════════════════
// RENDER APP
// ═══════════════════════════════════════════
async function renderApp() {
    await autoLogRenewals();

    document.getElementById('user-display-name').textContent = profile.name;
    document.getElementById('user-avatar-img').src           = profile.avatar;

    const activeSubs   = subscriptions.filter(s => !s.paused);
    const totalMonthly = activeSubs.reduce((s, sub) => s + getMonthlyCost(sub), 0);

    const portfolioList  = document.getElementById('portfolio-list');
    const upcomingScroll = document.getElementById('upcoming-scroll');
    portfolioList.innerHTML = ''; upcomingScroll.innerHTML = '';

    if (subscriptions.length === 0 && expenses.filter(e => e.type === 'manual').length === 0) {
        portfolioList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--on-surface-variant);font-size:0.9rem;background:var(--surface-low);border-radius:var(--radius-md);">No entries yet. Tap (+) to add.</div>';
    } else {
        document.getElementById('spend-trend').style.display = 'inline-flex';
    }

    const subItems = subscriptions.map(sub => ({ _type:'sub', _sortDate:new Date(sub.startDate || sub.dateAdded), data:sub }));
    const expItems = expenses.filter(e => e.type === 'manual').map(exp => ({ _type:'exp', _sortDate:new Date(exp.date), data:exp }));
    const mixed    = [...subItems, ...expItems].sort((a,b) => b._sortDate - a._sortDate);
    const visible  = mixed.slice(0, 5);

    visible.forEach(entry => {
        if (entry._type === 'sub') {
            const sub   = entry.data;
            const color = colorFromName(sub.name);
            const item  = document.createElement('div');
            item.className = 'list-item';
            item.style.cursor = 'default';
            if (sub.paused) item.style.opacity = '0.5';

            const left = document.createElement('div'); left.className = 'list-item-left';
            const icon = document.createElement('div'); icon.className = 'list-icon-wrapper';
            icon.style.cssText = `background:${color}20;color:${color};font-size:24px;`;
            icon.textContent = sub.name.charAt(0).toUpperCase();
            const info = document.createElement('div');
            const titleEl = document.createElement('div'); titleEl.className = 'list-title'; titleEl.textContent = sub.name;
            if (sub.paused) {
                const badge = document.createElement('span');
                badge.style.cssText = 'font-size:0.65rem;background:var(--surface-high);color:var(--on-surface-variant);padding:2px 8px;border-radius:99px;font-family:var(--font-body);margin-left:6px;';
                badge.textContent = 'Paused';
                titleEl.appendChild(badge);
            }
            const subtitleEl = document.createElement('div'); subtitleEl.className = 'list-subtitle'; subtitleEl.textContent = formatCycle(sub.cycle);
            info.appendChild(titleEl); info.appendChild(subtitleEl);
            left.appendChild(icon); left.appendChild(info);

            const right = document.createElement('div'); right.className = 'text-right';
            const priceEl = document.createElement('div'); priceEl.className = 'list-price'; priceEl.textContent = getCurrencySymbol() + formatAmount(sub.price);
            const dateEl  = document.createElement('div'); dateEl.className = 'list-date'; dateEl.textContent = formatDate(sub.dateAdded);
            right.appendChild(priceEl); right.appendChild(dateEl);

            item.appendChild(left); item.appendChild(right);
            portfolioList.appendChild(item);

            if (!sub.paused) {
                const today = new Date(); today.setHours(0,0,0,0);
                const anchor   = sub.startDate || sub.dateAdded;
                const renDate  = getNextRenewalDate(anchor, sub.cycle);
                const diffDays = Math.ceil((renDate - today) / 86400000);
                const renewalText = diffDays > 0 ? `Renews in ${diffDays} day${diffDays > 1 ? 's' : ''}` : 'Renews today';
                const textColor   = diffDays <= 3 ? 'var(--error)' : 'var(--primary)';
                const miniCard = document.createElement('div');
                miniCard.className = 'card-mini';
                miniCard.style.cursor = 'default';
                const cardIcon = document.createElement('div'); cardIcon.className = 'card-icon';
                cardIcon.style.cssText = `background:${color}20;color:${color};`;
                cardIcon.innerHTML = '<span class="material-symbols-outlined">payments</span>';
                const cardName = document.createElement('h3'); cardName.textContent = sub.name;
                const cardDate = document.createElement('p'); cardDate.style.cssText = `font-size:0.85rem;color:${textColor};font-weight:600;`; cardDate.textContent = renewalText;
                miniCard.appendChild(cardIcon); miniCard.appendChild(cardName); miniCard.appendChild(cardDate);
                upcomingScroll.appendChild(miniCard);
            }
        } else {
            const exp  = entry.data;
            const item = document.createElement('div');
            item.className = 'list-item'; item.style.cursor = 'default';

            const left = document.createElement('div'); left.className = 'list-item-left';
            const icon = document.createElement('div'); icon.className = 'list-icon-wrapper';
            icon.style.cssText = 'background:var(--surface-high);color:var(--on-surface-variant);';
            icon.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;">receipt_long</span>';
            const info = document.createElement('div');
            const titleEl    = document.createElement('div'); titleEl.className = 'list-title'; titleEl.textContent = exp.name;
            const subtitleEl = document.createElement('div'); subtitleEl.className = 'list-subtitle'; subtitleEl.textContent = formatDate(exp.date);
            info.appendChild(titleEl); info.appendChild(subtitleEl);
            left.appendChild(icon); left.appendChild(info);

            const right   = document.createElement('div'); right.className = 'text-right';
            const priceEl = document.createElement('div'); priceEl.className = 'list-price'; priceEl.textContent = getCurrencySymbol() + formatAmount(exp.amount);
            right.appendChild(priceEl);

            item.appendChild(left); item.appendChild(right);
            portfolioList.appendChild(item);
        }
    });

    if (mixed.length > 5) {
        const viewAll = document.createElement('div');
        viewAll.style.cssText = 'text-align:center;padding:12px 0 4px;';
        const link = document.createElement('a');
        link.href = '#'; link.style.cssText = 'color:var(--primary);font-size:0.85rem;font-weight:600;text-decoration:none;';
        link.textContent = 'View all';
        link.addEventListener('click', e => {
            e.preventDefault();
            analyticsView = 'expenses';
            switchPage('analytics-page');
            document.querySelectorAll('.seg-pill').forEach(p => p.classList.toggle('active', p.getAttribute('data-view') === 'expenses'));
        });
        viewAll.appendChild(link);
        portfolioList.appendChild(viewAll);
    }

    if (upcomingScroll.children.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding:10px 20px;color:var(--on-surface-variant);font-size:0.8rem;';
        empty.textContent = 'Add a subscription to see renewals.';
        upcomingScroll.appendChild(empty);
    }

    const now = new Date();
    const thisMonthExpenses = expenses
        .filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
        .reduce((s,e) => s + parseFloat(e.amount), 0);
    document.getElementById('total-spend').textContent = formatAmount(totalMonthly + thisMonthExpenses);
    document.getElementById('ytd-spend').textContent   = formatAmount(totalMonthly);

    renderAnalyticsView();
    renderInsights();
}

// ═══════════════════════════════════════════
// INSIGHTS ENGINE
// ═══════════════════════════════════════════
function renderInsights() {
    const card = document.getElementById('insights-content');
    if (!card) return;
    const now           = new Date();
    const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
    const activeSubs    = subscriptions.filter(s => !s.paused);
    const totalMonthly  = activeSubs.reduce((s, sub) => s + getMonthlyCost(sub), 0);
    const totalYearly   = totalMonthly * 12;
    const subCount      = activeSubs.length;
    const manualExp     = expenses.filter(e => e.type === 'manual');
    const msDay         = 86400000;
    const weekAgoMs     = now.getTime() - 7  * msDay;
    const twoWeeksAgoMs = now.getTime() - 14 * msDay;
    const thisWeekExps  = manualExp.filter(e => new Date(e.date).getTime() >= weekAgoMs);
    const lastWeekExps  = manualExp.filter(e => { const t = new Date(e.date).getTime(); return t >= twoWeeksAgoMs && t < weekAgoMs; });
    const thisWeekTotal = thisWeekExps.reduce((s,e) => s + parseFloat(e.amount), 0);
    const lastWeekTotal = lastWeekExps.reduce((s,e) => s + parseFloat(e.amount), 0);
    const thisMonthExp  = manualExp.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const thisMonthExpTotal = thisMonthExp.reduce((s,e) => s + parseFloat(e.amount), 0);
    const renewalsToday = [], renewalsSoon = [];
    activeSubs.forEach(sub => {
        const anchor = sub.startDate || sub.dateAdded;
        const next   = getNextRenewalDate(anchor, sub.cycle);
        const diff   = Math.ceil((next - todayMidnight) / msDay);
        if (diff === 0) renewalsToday.push(sub);
        else if (diff >= 1 && diff <= 3) renewalsSoon.push({ sub, diffDays: diff });
    });
    const catTotals = {};
    activeSubs.forEach(sub => {
        const cid   = sub.category || 'unlisted';
        const cname = cid === 'unlisted' ? 'Unlisted' : (categories.find(c => c.id === cid)?.name || 'Unlisted');
        if (!catTotals[cid]) catTotals[cid] = { name: cname, total: 0, count: 0 };
        catTotals[cid].total += getMonthlyCost(sub);
        catTotals[cid].count++;
    });
    let oldestSub = null, oldestDays = 0;
    activeSubs.forEach(sub => { const days = Math.floor((now - new Date(sub.dateAdded)) / msDay); if (days > oldestDays) { oldestDays = days; oldestSub = sub; } });
    let nextRenewalDays = Infinity;
    activeSubs.forEach(sub => { const anchor = sub.startDate || sub.dateAdded; const diff = Math.ceil((getNextRenewalDate(anchor, sub.cycle) - todayMidnight) / msDay); if (diff < nextRenewalDays) nextRenewalDays = diff; });
    const sym = getCurrencySymbol();
    const fmt = n => formatAmount(n);
    const candidates = [];

    if (subscriptions.length === 0 && manualExp.length === 0) candidates.push({ score:1000, solo:true, title:'Broke or Just Shy?', text:"No transactions yet. Either you live off the grid or you forgot to add everything. We don't judge. Much." });
    if (manualExp.length > 0 && subscriptions.length === 0) candidates.push({ score:900, solo:true, title:'Spending Without Tracking', text:"You're logging one-time expenses but haven't added recurring subscriptions yet. Add them to see the real damage." });
    if (renewalsToday.length > 0) { const total = renewalsToday.reduce((s,sub) => s + parseFloat(sub.price), 0); candidates.push({ score: 850 + (renewalsToday.length-1)*50, title:'Money Leaving Right Now', text: renewalsToday.length === 1 ? `${renewalsToday[0].name} renews today. ${sym}${fmt(renewalsToday[0].price)} is already gone or going. Moment of silence.` : `${renewalsToday[0].name} renews today plus ${renewalsToday.length-1} more totaling ${sym}${fmt(total)}.` }); }
    if (renewalsSoon.length > 0) { const s = renewalsSoon.sort((a,b) => a.diffDays - b.diffDays)[0]; candidates.push({ score: 700 + (3-s.diffDays)*50, title:'Renewal Incoming', text:`${s.sub.name} hits your wallet in ${s.diffDays} day${s.diffDays > 1 ? 's' : ''} — ${sym}${fmt(s.sub.price)}. Start mentally preparing.` }); }
    if (subCount > 1 && totalMonthly > 0) { let d = null, dp = 0; activeSubs.forEach(sub => { const p = getMonthlyCost(sub)/totalMonthly*100; if (p > dp) { dp = p; d = sub; } }); if (dp > 50) candidates.push({ score: dp*8, title:'One Sub to Rule Them All', text:`${d.name} is ${Math.round(dp)}% of your monthly spend. That's ${sym}${fmt(getMonthlyCost(d))} out of ${sym}${fmt(totalMonthly)}. At this point just marry it.` }); }
    Object.values(catTotals).forEach(cat => { if (cat.count > 2) candidates.push({ score: 400+cat.count*30, title:'Category Obsession', text:`You have ${cat.count} ${cat.name} subscriptions worth ${sym}${fmt(cat.total)}/month. We get it. You really love ${cat.name}.` }); });
    if (oldestSub && oldestDays >= 365) { const months = Math.floor(oldestDays/30); candidates.push({ score: 350+(oldestDays/365)*40, title:'Loyalty or Laziness?', text:`You've had ${oldestSub.name} for ${months} months. Either you love it or forgot it exists. Estimated cost so far: ${sym}${fmt(getMonthlyCost(oldestSub)*months)}.` }); }
    if (subCount > 4) candidates.push({ score: subCount*45, title:'Subscription Hoarder', text:`You have ${subCount} active subscriptions burning ${sym}${fmt(totalMonthly)}/mo. The average person uses about 3 actively. Think about that.` });
    if (totalMonthly > 3000) candidates.push({ score: (totalMonthly/1000)*60, title:'Big Spender Energy', text:`You're spending ${sym}${fmt(totalMonthly)}/mo. That's ${sym}${fmt(totalYearly)}/year. That's ${Math.round(totalYearly/250)} plates of biryani. Your call.` });
    if (totalYearly > 10000) candidates.push({ score: (totalYearly/5000)*40, title:'Annual Reality Check', text:`You're on track for ${sym}${fmt(totalYearly)} this year. Breaking it down: ${sym}${fmt(totalMonthly)}/mo, ${sym}${fmt(totalMonthly*12/52)}/week. Every. Single. Day.` });
    if (subCount === 1) candidates.push({ score:200, title:'Baby Steps', text:"One subscription tracked. Either you're a minimalist legend or this is just the beginning of a very expensive list." });
    if (subCount > 0) { const nr = nextRenewalDays === Infinity ? 'N/A' : `${nextRenewalDays} day${nextRenewalDays !== 1 ? 's' : ''}`; candidates.push({ score:100, title:'Looking Clean 👀', text:`Spending looks controlled. ${subCount} subscription${subCount !== 1 ? 's' : ''}, ${sym}${fmt(totalMonthly)}/mo, next renewal in ${nr}. Either you're disciplined or haven't added everything yet.` }); }
    if (lastWeekTotal > 0 && thisWeekTotal > lastWeekTotal*2) { const ratio = thisWeekTotal/lastWeekTotal; candidates.push({ score:ratio*200, title:'Spending Spike Detected', text:`Your one-time expenses this week are ${ratio.toFixed(1)}x higher than last week. ${sym}${fmt(thisWeekTotal)} vs ${sym}${fmt(lastWeekTotal)}. Something happened. We're not asking questions.` }); }
    if (totalMonthly > 0) { let lc = null, lp = 0; Object.values(catTotals).forEach(cat => { const p = cat.total/totalMonthly*100; if (p > lp) { lp = p; lc = cat; } }); if (lc && lp > 40) candidates.push({ score:450, title:`${lc.name} is Draining You`, text:`Your ${lc.name} subscriptions alone cost ${sym}${fmt(lc.total)}/mo — ${Math.round(lp)}% of your total. Consider if you need all ${lc.count} of them.` }); }
    if (thisWeekExps.length > 3) { const da = thisWeekTotal/7; candidates.push({ score:380, title:'Daily Spending Habit', text:`You've logged ${thisWeekExps.length} expenses this week averaging ${sym}${fmt(da)}/day. At this pace that's ${sym}${fmt(da*30)} extra this month.` }); }
    const cb = totalMonthly + thisMonthExpTotal;
    if (cb > 8000) candidates.push({ score:(cb/500)*60, title:'Total Burn Rate', text:`This month: ${sym}${fmt(thisMonthExpTotal)} one-time + ${sym}${fmt(totalMonthly)} subscriptions = ${sym}${fmt(cb)} combined. That's your real monthly spend.` });

    categories.forEach(cat => {
        if (!cat.budget) return;
        const ct = catTotals[cat.id];
        if (!ct) return;
        const pct = (ct.total / cat.budget) * 100;
        if (pct >= 90) {
            const over = ct.total - cat.budget;
            candidates.push(pct >= 100
                ? { score: 750, title: `Budget Blown — ${cat.name}`, text: `${cat.name} has exceeded its ${sym}${fmt(cat.budget)}/mo limit by ${sym}${fmt(over)}. Consider pausing something.` }
                : { score: 500 + pct, title: `Budget Alert — ${cat.name}`, text: `${cat.name} is at ${Math.round(pct)}% of your ${sym}${fmt(cat.budget)}/mo limit. You have ${sym}${fmt(cat.budget - ct.total)} left.` }
            );
        }
    });

    candidates.sort((a,b) => b.score - a.score);
    let shown = [];
    if (candidates.length === 0) { shown = []; }
    else if (candidates[0].solo) { shown = [candidates[0]]; }
    else { const m = candidates.filter(c => c.score > 300); shown = (m.length > 0 ? m : candidates).slice(0, 3); }

    if (shown.length === 0) { card.innerHTML = '<h3 style="margin:0 0 6px;">All Quiet</h3><p style="color:var(--insights-text);font-size:0.875rem;margin:0;">Nothing to flag yet. Add subscriptions and expenses to get personalised insights.</p>'; return; }
    card.innerHTML = shown.map((insight, i) => `<div style="${i > 0 ? 'border-top:1px solid var(--insights-divider);padding-top:14px;margin-top:14px;' : ''}"><h3 style="font-size:1.1rem;line-height:1.3;margin-bottom:6px;position:relative;z-index:2;">${escapeHTML(insight.title)}</h3><p style="color:var(--insights-text);font-size:0.875rem;line-height:1.5;margin:0;position:relative;z-index:2;">${escapeHTML(insight.text)}</p></div>`).join('');
}

// ═══════════════════════════════════════════
// CATEGORY MANAGEMENT
// ═══════════════════════════════════════════
document.getElementById('add-category-btn').addEventListener('click', () => addCategoryFn(document.getElementById('add-category-input').value));
document.getElementById('toggle-manage-categories-btn')?.addEventListener('click', () => {
    const c = document.getElementById('manage-categories-content');
    c.style.display = c.style.display === 'none' ? 'block' : 'none';
});

function renderAnalytics() {
    const container = document.getElementById('category-groups-container');
    container.innerHTML = '';

    // ── JS-injected search input (only when subscriptions.length > 7) ──
    const subsSearchWrap = container.parentElement.querySelector('.analytics-search-input[data-scope="subscriptions"]');
    if (subsSearchWrap) subsSearchWrap.remove();
    if (subscriptions.length > 7) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = 'Search subscriptions…';
        inp.autocomplete = 'off';
        inp.className = 'analytics-search-input';
        inp.dataset.scope = 'subscriptions';
        inp.value = analyticsSubSearch;
        inp.addEventListener('input', e => { analyticsSubSearch = e.target.value; renderAnalytics(); });
        container.parentElement.insertBefore(inp, container);
    }

    const q = analyticsSubSearch.trim().toLowerCase();
    const groups = { unlisted: { name: 'Unlisted', subs: [] } };
    categories.forEach(c => groups[c.id] = { name: c.name, subs: [] });
    subscriptions.forEach(sub => { const cat = sub.category || 'unlisted'; (groups[cat] || groups['unlisted']).subs.push(sub); });
    const hasCategories = categories.length > 0;

    const createGroup = (id, name, subs, showHeading) => {
        // Filter subs by search query
        const visibleSubs = q ? subs.filter(s => s.name.toLowerCase().includes(q)) : subs;
        // Hide entire group if nothing matches (only when searching)
        if (q && visibleSubs.length === 0) return;
        const groupEl = document.createElement('div'); groupEl.style.marginBottom = '20px';
        if (showHeading) {
            const header = document.createElement('h2');
            header.style.cssText = 'cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-top:1rem;margin-bottom:0.5rem;';
            const headerText = document.createTextNode(name);
            const headerIcon = document.createElement('span'); headerIcon.className = 'material-symbols-outlined'; headerIcon.style.fontSize = '20px'; headerIcon.textContent = 'chevron_right';
            header.appendChild(headerText); header.appendChild(headerIcon);
            header.addEventListener('click', () => {
                const list = groupEl.querySelector('.cat-list');
                const open = list.style.display === 'none';
                list.style.display = open ? 'block' : 'none';
                headerIcon.textContent = open ? 'expand_more' : 'chevron_right';
            });
            groupEl.appendChild(header);
        }
        const listEl = document.createElement('div');
        listEl.className = 'cat-list'; listEl.dataset.categoryId = id;
        if (showHeading) listEl.style.display = 'none';
        listEl.style.cssText += 'min-height:50px;padding:10px 0;border-radius:var(--radius-md);transition:background 0.2s;';
        listEl.addEventListener('dragover', e => { e.preventDefault(); listEl.style.background = 'var(--surface)'; listEl.style.border = '1px dashed var(--primary)'; });
        listEl.addEventListener('dragleave', () => { listEl.style.background = 'transparent'; listEl.style.border = 'none'; });
        listEl.addEventListener('drop', async e => {
            e.preventDefault(); listEl.style.background = 'transparent'; listEl.style.border = 'none';
            const draggedId = e.dataTransfer.getData('text/plain');
            const sub = subscriptions.find(s => s.id === draggedId);
            if (sub && sub.category !== id) { sub.category = id; await upsertSubscription(sub); renderAnalytics(); }
        });
        if (subs.length === 0 && showHeading && !q) {
            const empty = document.createElement('p');
            empty.style.cssText = 'color:var(--on-surface-variant);font-size:0.8rem;text-align:center;padding:10px;';
            empty.textContent = 'Drag subscriptions here';
            listEl.appendChild(empty);
        }
        visibleSubs.forEach(sub => {
            const color    = colorFromName(sub.name);
            const today    = new Date(); today.setHours(0,0,0,0);
            const anchor   = sub.startDate || sub.dateAdded;
            const renDate  = getNextRenewalDate(anchor, sub.cycle);
            const diffDays = Math.ceil((renDate - today) / 86400000);
            const renewalText = diffDays > 0 ? `Renews in ${diffDays} day${diffDays > 1 ? 's' : ''}` : 'Renews today';
            const textColor   = diffDays <= 3 ? 'var(--error)' : 'var(--primary)';
            const item = document.createElement('div');
            item.className = 'list-item'; item.draggable = true;
            item.style.cssText = 'cursor:grab;margin-bottom:8px;background:var(--surface-high);';
            if (sub.paused) item.style.opacity = '0.5';

            const left = document.createElement('div'); left.className = 'list-item-left';
            const icon = document.createElement('div'); icon.className = 'list-icon-wrapper';
            icon.style.cssText = `background:${color}20;color:${color};font-size:20px;width:40px;height:40px;`;
            icon.textContent = sub.name.charAt(0).toUpperCase();
            const info = document.createElement('div');
            const titleEl    = document.createElement('div'); titleEl.className = 'list-title'; titleEl.style.fontSize = '0.95rem'; titleEl.textContent = sub.name;
            const subtitleEl = document.createElement('div'); subtitleEl.className = 'list-subtitle'; subtitleEl.style.cssText = `color:${textColor};font-weight:600;`; subtitleEl.textContent = renewalText;
            info.appendChild(titleEl); info.appendChild(subtitleEl);
            left.appendChild(icon); left.appendChild(info);

            const right   = document.createElement('div'); right.className = 'text-right';
            const priceEl = document.createElement('div'); priceEl.className = 'list-price'; priceEl.style.fontSize = '1.1rem'; priceEl.textContent = getCurrencySymbol() + formatAmount(sub.price);
            right.appendChild(priceEl);

            item.appendChild(left); item.appendChild(right);
            item.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', sub.id));
            item.addEventListener('click', () => viewDetails(sub.id));
            listEl.appendChild(item);
        });
        groupEl.appendChild(listEl);
        container.appendChild(groupEl);
    };

    if (!hasCategories) { createGroup('unlisted', 'Unlisted', groups['unlisted'].subs, false); }
    else { for (const [id, grp] of Object.entries(groups)) { if (id !== 'unlisted') createGroup(id, grp.name, grp.subs, true); } createGroup('unlisted', 'Unlisted', groups['unlisted'].subs, true); }

    if (q && container.children.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:24px 0;color:var(--on-surface-variant);font-size:0.85rem;';
        empty.textContent = 'No results';
        container.appendChild(empty);
    }

    renderCategoryManager();
}

function renderCategoryManager() {
    const activeChips = document.getElementById('active-category-chips');
    const presetChips = document.getElementById('preset-category-chips');
    activeChips.innerHTML = ''; presetChips.innerHTML = '';
    categories.forEach(cat => {
        const chip = document.createElement('div');
        chip.style.cssText = 'background:var(--surface-high);padding:4px 12px;border-radius:100px;font-size:0.8rem;display:flex;align-items:center;gap:8px;border:1px solid var(--surface-low);';
        const nameSpan = document.createElement('span'); nameSpan.textContent = cat.name;
        const closeBtn = document.createElement('span'); closeBtn.className = 'material-symbols-outlined';
        closeBtn.style.cssText = 'font-size:14px;cursor:pointer;color:var(--on-surface-variant);';
        closeBtn.textContent = 'close';
        closeBtn.onclick = () => window.deleteCategory(cat.id);
        chip.appendChild(nameSpan); chip.appendChild(closeBtn);
        activeChips.appendChild(chip);
    });
    presetCategories.forEach(preset => {
        if (categories.find(c => c.name.toLowerCase() === preset.toLowerCase())) return;
        const chip = document.createElement('div');
        chip.style.cssText = 'background:transparent;padding:4px 12px;border-radius:100px;font-size:0.8rem;display:flex;align-items:center;gap:4px;border:1px dashed var(--primary);color:var(--primary);cursor:pointer;';
        const addIcon = document.createElement('span'); addIcon.className = 'material-symbols-outlined'; addIcon.style.fontSize = '14px'; addIcon.textContent = 'add';
        const labelSpan = document.createElement('span'); labelSpan.textContent = preset;
        chip.appendChild(addIcon); chip.appendChild(labelSpan);
        chip.onclick = () => addCategoryFn(preset);
        presetChips.appendChild(chip);
    });
    if (categories.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:var(--on-surface-variant);font-size:0.8rem;';
        empty.textContent = 'No categories yet';
        activeChips.appendChild(empty);
    }
}

async function addCategoryFn(name) {
    name = name.trim();
    if (!name || categories.find(c => c.name.toLowerCase() === name.toLowerCase())) return;
    const cat = { id: 'cat_' + Date.now(), name };
    categories.push(cat);
    await upsertCategory(cat);
    document.getElementById('add-category-input').value = '';
    renderAnalytics();
    showToast('Category added');
}
// ═══════════════════════════════════════════
// NETWORK STATUS
// ═══════════════════════════════════════════
(function () {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    const update = () => { banner.style.display = navigator.onLine ? 'none' : 'block'; };
    window.addEventListener('online',  update);
    window.addEventListener('offline', update);
    update(); // initialise on load
})();

// ═══════════════════════════════════════════
// PROFILE COLLAPSIBLE SECTIONS
// ═══════════════════════════════════════════
window.toggleProfileSection = function(bodyId, chevronId) {
    const body    = document.getElementById(bodyId);
    const chevron = document.getElementById(chevronId);
    if (!body) return;
    const open = !body.classList.contains('is-open');
    body.classList.toggle('is-open', open);
    const trigger = chevron?.closest('.profile-collapse-header');
    if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (chevron) chevron.textContent = open ? 'expand_more' : 'chevron_right';
};

// ═══════════════════════════════════════════
// BOOT LOADER & INITIALIZATION
// ═══════════════════════════════════════════

const sleep = ms => new Promise(r => setTimeout(r, ms));

function randomChars(len) {
    const chars = "^%*&()_+-=[]{}|;:,.<>?/\\#@!$";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

/**
 * Animated decoding effect: random noise -> target text with highlighter reveal
 */
async function decodeStatus(el, target, duration = 800) {
    if (!el) return;
    
    // Clear any previous animation interval on this element
    if (el._decodeInterval) clearInterval(el._decodeInterval);
    
    const start = Date.now();
    
    return new Promise(resolve => {
        el._decodeInterval = setInterval(() => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            
            // Number of characters to "reveal" in order
            const revealedCount = Math.floor(progress * target.length);
            
            let finalHTML = "";
            for (let i = 0; i < target.length; i++) {
                if (i < revealedCount) {
                    // Revealed character with solid background
                    finalHTML += `<span class="char-decoded">${target[i]}</span>`;
                } else {
                    // Noise character (dimmed)
                    finalHTML += `<span class="char-noise">${randomChars(1)}</span>`;
                }
            }
            
            el.innerHTML = finalHTML;
            
            if (progress >= 1) {
                clearInterval(el._decodeInterval);
                el._decodeInterval = null;
                el.textContent = target; // Fallback to plain text on final
                resolve();
            }
        }, 50);
    });
}

function startBootNoise() {
    const noiseEl = document.getElementById("boot-noise");
    if (!noiseEl) return () => {};

    const timer = setInterval(() => {
        noiseEl.textContent = `${randomChars(42)}\n${randomChars(34)}\n${randomChars(28)}`;
    }, 80);

    return () => clearInterval(timer);
}

async function runBootWithLoader(bootFn, minVisible = 800) {
    const loading = document.getElementById('app-loading');
    const statusEl = document.getElementById('boot-status');
    const startTime = Date.now();
    
    loading.classList.remove('hidden');
    const stopNoise = startBootNoise();

    try {
        await decodeStatus(statusEl, "INITIALIZING ATŁER...", 300);
        
        // Run the boot function with a 10s safety timeout to prevent getting "stuck"
        const bootPromise = bootFn();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 10000));
        
        await Promise.race([bootPromise, timeoutPromise]);
        
        await decodeStatus(statusEl, "SYSTEM READY.", 200);

        // Ensure loader is visible for the requested vibe duration
        const elapsed = Date.now() - startTime;
        if (elapsed < minVisible) await sleep(minVisible - elapsed);

    } finally {
        stopNoise();
        loading.style.opacity = '0';
        loading.style.transition = 'opacity 0.3s ease';
        await sleep(300);
        loading.classList.add('hidden');
        loading.style.opacity = '';
    }
}

// Global App Initialization
(async () => {
    await runBootWithLoader(async () => {
        const authScreen = document.getElementById('auth-screen');
        const { data: { session } } = await sb.auth.getSession();

        if (!session?.user) {
            authScreen.classList.remove('hidden');
            return;
        }

        currentUser = session.user;
        authScreen.classList.add('hidden');

        // Immediate shell render
        renderApp();
        renderProfilePage();

        // Background data load and re-render
        // This is the "UI first, then data" approach for speed
        loadAllData().then(() => {
            renderApp();
            renderProfilePage();
            scheduleRenewalNotifications();
        });
    });
})();

// AUTH STATE CHANGES
sb.auth.onAuthStateChange(async (event, session) => {
    const authScreen = document.getElementById('auth-screen');

    if (event === 'SIGNED_IN' && session?.user) {
        if (currentUser?.id === session.user.id) return;

        await runBootWithLoader(async () => {
            currentUser = session.user;
            authScreen.classList.add('hidden');

            await loadAllData();
            await renderApp();
            renderProfilePage();
            scheduleRenewalNotifications();
            showNotificationPrompt();
        }, 1000);
    }

    if (event === 'SIGNED_OUT') {
        currentUser = null;
        subscriptions = [];
        categories = [];
        expenses = [];
        profile = {
            name: 'Atler',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
            theme: 'default'
        };
        localStorage.removeItem('atler_theme');
        applyTheme('default');
        authScreen.classList.remove('hidden');
    }
});
