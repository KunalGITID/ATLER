// ═══════════════════════════════════════════
// SUPABASE CONFIG
// ═══════════════════════════════════════════
const SUPABASE_URL  = 'https://cnxurdingdhhdcjgujkz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNueHVyZGluZ2RoaGRjamd1amt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQ1OTIsImV4cCI6MjA5MDQ1MDU5Mn0.nX0-MR9C1fmKRA9lHw0FBp_r0LYYlntbz9B7BW7HKd8';
const sb = window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: localStorage
        }
    })
    : null;

// ═══════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════
let currentUser   = null;
let profile       = {
    name: 'Atler',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
    theme: localStorage.getItem('atler_theme') || 'default',
    lastNotified: null,
    currency: 'INR'
};
let subscriptions = [];
let categories    = [];
let expenses      = [];
let activeSubId   = null;
let activeExpenseId = null;
let analyticsView = 'subscriptions';
let analyticsRange = 'month';
let analyticsSubSearch = '';
let analyticsExpSearch = '';
let currentPageId = 'dashboard-page';
let pageHistory = [];
let isSubmittingSubscription = false;
let isSubmittingExpense = false;
let isSavingExpenseEdit = false;
let lastLoadError = '';
let reminderPreferences = JSON.parse(localStorage.getItem('atler_reminder_prefs') || '{}');

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

const confirmSheetOverlay = document.getElementById('confirm-sheet-overlay');
const confirmSheetKicker = document.getElementById('confirm-sheet-kicker');
const confirmSheetTitle = document.getElementById('confirm-sheet-title');
const confirmSheetMessage = document.getElementById('confirm-sheet-message');
const confirmSheetCancel = document.getElementById('confirm-sheet-cancel');
const confirmSheetConfirm = document.getElementById('confirm-sheet-confirm');
let pendingConfirmResolve = null;

function closeConfirmSheet(result) {
    if (!pendingConfirmResolve) return;
    const resolve = pendingConfirmResolve;
    pendingConfirmResolve = null;
    confirmSheetOverlay?.classList.remove('is-open');
    confirmSheetConfirm?.classList.remove('is-danger');
    resolve(result);
}

function confirmAction({
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmLabel = 'Continue',
    cancelLabel = 'Cancel',
    tone = 'default',
    kicker = 'Please confirm'
} = {}) {
    if (!confirmSheetOverlay || !confirmSheetTitle || !confirmSheetMessage || !confirmSheetCancel || !confirmSheetConfirm) {
        return Promise.resolve(window.confirm(message));
    }
    if (pendingConfirmResolve) {
        closeConfirmSheet(false);
    }
    confirmSheetKicker.textContent = kicker;
    confirmSheetTitle.textContent = title;
    confirmSheetMessage.textContent = message;
    confirmSheetCancel.textContent = cancelLabel;
    confirmSheetConfirm.textContent = confirmLabel;
    confirmSheetConfirm.classList.toggle('is-danger', tone === 'danger');
    confirmSheetOverlay.classList.add('is-open');
    return new Promise(resolve => {
        pendingConfirmResolve = resolve;
    });
}

confirmSheetCancel?.addEventListener('click', () => closeConfirmSheet(false));
confirmSheetConfirm?.addEventListener('click', () => closeConfirmSheet(true));
confirmSheetOverlay?.addEventListener('click', e => {
    if (e.target === confirmSheetOverlay) closeConfirmSheet(false);
});

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
let isRecoveryMode = false;

function getAppRedirectUrl() {
    const path = window.location.pathname.endsWith('.html')
        ? window.location.pathname.replace(/[^/]+$/, '')
        : window.location.pathname;
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    return `${window.location.origin}${normalizedPath}`;
}

async function startOAuthSignIn(provider) {
    const errEl = document.getElementById('auth-error');
    if (!sb) {
        if (errEl) errEl.textContent = 'Unable to load app services. Refresh and try again.';
        return;
    }
    if (errEl) errEl.textContent = '';
    const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: getAppRedirectUrl()
        }
    });
    if (error && errEl) errEl.textContent = error.message || `Unable to start ${provider} sign in.`;
}

function setRecoveryMode(on) {
    isRecoveryMode = on;

    const tabs = document.querySelector('.auth-tabs');
    const email = document.getElementById('auth-email');
    const password = document.getElementById('auth-password');
    const nameGroup = document.getElementById('auth-name-group');
    const inlineActions = document.getElementById('auth-inline-actions');
    const submitBtn = document.getElementById('auth-submit-btn');
    const socials = document.querySelector('.auth-socials');
    const divider = document.querySelector('.auth-divider');
    const resetGroup = document.getElementById('reset-password-group');
    const errEl = document.getElementById('auth-error');

    if (tabs) tabs.style.display = on ? 'none' : '';
    if (email) email.style.display = on ? 'none' : '';
    if (password) password.style.display = on ? 'none' : '';
    if (nameGroup) nameGroup.style.display = on ? 'none' : (authMode === 'signup' ? 'block' : 'none');
    if (inlineActions) inlineActions.style.display = on ? 'none' : (authMode === 'login' ? 'flex' : 'none');
    if (submitBtn) submitBtn.style.display = on ? 'none' : '';
    if (socials) socials.style.display = on ? 'none' : '';
    if (divider) divider.style.display = on ? 'none' : '';
    if (resetGroup) resetGroup.style.display = on ? 'block' : 'none';
    if (errEl) errEl.textContent = on ? 'Enter your new password.' : '';
}

document.getElementById('tab-login').addEventListener('click', () => {
    authMode = 'login';
    setRecoveryMode(false);
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-signup').classList.remove('active');
    document.getElementById('auth-name-group').style.display = 'none';
    document.getElementById('auth-inline-actions').style.display = 'flex';
    document.getElementById('auth-submit-btn').textContent = 'Sign In';
    document.getElementById('auth-error').textContent = '';
});

document.getElementById('tab-signup').addEventListener('click', () => {
    authMode = 'signup';
    setRecoveryMode(false);
    document.getElementById('tab-signup').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('auth-name-group').style.display = 'block';
    document.getElementById('auth-inline-actions').style.display = 'none';
    document.getElementById('auth-submit-btn').textContent = 'Create Account';
    document.getElementById('auth-error').textContent = '';
});

document.getElementById('auth-submit-btn').addEventListener('click', async () => {
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name     = document.getElementById('auth-name').value.trim();
    const btn      = document.getElementById('auth-submit-btn');
    const errEl    = document.getElementById('auth-error');

    if (!sb) { errEl.textContent = 'Unable to load app services. Refresh and try again.'; return; }
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

document.getElementById('auth-forgot-btn').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const errEl = document.getElementById('auth-error');
    if (!sb) {
        errEl.textContent = 'Unable to load app services. Refresh and try again.';
        return;
    }
    if (!email) {
        errEl.textContent = 'Enter your email first, then tap Forgot password.';
        return;
    }

    errEl.textContent = '';
    const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: getAppRedirectUrl()
    });

    if (error) {
        errEl.textContent = error.message || 'Unable to send password reset email.';
        return;
    }

    errEl.style.color = 'var(--secondary)';
    errEl.textContent = 'Password reset email sent. Check your inbox.';
    setTimeout(() => {
        errEl.style.color = '';
    }, 2500);
});

document.getElementById('auth-google-btn').addEventListener('click', async () => {
    await startOAuthSignIn('google');
});

document.getElementById('reset-password-btn').addEventListener('click', async () => {
    const password = document.getElementById('reset-password').value;
    const confirm = document.getElementById('reset-password-confirm').value;
    const errEl = document.getElementById('auth-error');

    if (!sb) {
        errEl.textContent = 'Unable to load app services. Refresh and try again.';
        return;
    }
    if (!password || password.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters.';
        return;
    }
    if (password !== confirm) {
        errEl.textContent = 'Passwords do not match.';
        return;
    }

    const { error } = await sb.auth.updateUser({ password });
    if (error) {
        errEl.textContent = error.message || 'Unable to update password.';
        return;
    }

    errEl.style.color = 'var(--secondary)';
    errEl.textContent = 'Password updated. You can sign in now.';
    document.getElementById('reset-password').value = '';
    document.getElementById('reset-password-confirm').value = '';
    setRecoveryMode(false);
    authMode = 'login';
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-signup').classList.remove('active');
    document.getElementById('auth-submit-btn').textContent = 'Sign In';
    document.getElementById('auth-inline-actions').style.display = 'flex';
    setTimeout(() => {
        errEl.style.color = '';
    }, 2500);
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
    lastLoadError = '';

    let profRes, subsRes, catsRes, expsRes;
    try {
        [profRes, subsRes, catsRes, expsRes] = await Promise.all([
            sb.from('profiles').select('*').eq('user_id', uid).single(),
            sb.from('subscriptions').select('*').eq('user_id', uid),
            sb.from('categories').select('*').eq('user_id', uid),
            sb.from('expenses').select('*').eq('user_id', uid),
        ]);
    } catch (error) {
        lastLoadError = navigator.onLine
            ? 'Could not sync your latest data right now.'
            : 'You are offline. Showing what we already have.';
        throw error;
    }

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

async function ensureUserProfile(user = currentUser) {
    if (!sb || !user) return;

    const fallbackTheme = localStorage.getItem('atler_theme') || profile.theme || 'default';
    const rawName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.user_name ||
        user.email?.split('@')[0] ||
        'Atler';

    const safeName = String(rawName).trim() || 'Atler';

    try {
        await sb.from('profiles').upsert({
            user_id: user.id,
            name: safeName,
            avatar: profile.avatar,
            theme: fallbackTheme,
            currency: profile.currency || 'INR',
            last_notified: profile.lastNotified || null,
        });
    } catch {
        // Non-blocking safeguard for OAuth and first-login users.
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
    const approved = await confirmAction({
        title: 'Delete this category?',
        message: 'Subscriptions inside it will be moved to Unlisted so nothing gets lost.',
        confirmLabel: 'Delete category',
        tone: 'danger',
        kicker: 'Category change'
    });
    if (!approved) return;
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

function createEmptyStateHTML({ icon = 'spark', title, body, actionLabel = '', action = '' }) {
    const actionAttr = action ? ` data-empty-action="${action}"` : '';
    const actionMarkup = actionLabel
        ? `<button type="button" class="empty-state-btn"${actionAttr}>${escapeHTML(actionLabel)}</button>`
        : '';
    return `
        <div class="empty-state-card">
            <div class="empty-state-icon">
                <span class="material-symbols-outlined">${escapeHTML(icon)}</span>
            </div>
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(body)}</p>
            ${actionMarkup}
        </div>
    `;
}

function wireEmptyStateActions(scope = document) {
    scope.querySelectorAll('[data-empty-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-empty-action');
            if (action === 'add-subscription') openAddSheet('subscription');
            if (action === 'add-expense') openAddSheet('expense');
            if (action === 'switch-expenses') {
                analyticsView = 'expenses';
                renderAnalyticsView();
                document.querySelectorAll('.seg-pill').forEach(p =>
                    p.classList.toggle('active', p.getAttribute('data-view') === 'expenses')
                );
            }
        });
    });
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

function makeClientId(prefix = 'item') {
    if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function downloadTextFile(content, filename, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function csvEscape(value) {
    const str = value == null ? '' : String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function toCsv(rows, headers) {
    const headerLine = headers.map(col => csvEscape(col.label)).join(',');
    const lines = rows.map(row => headers.map(col => csvEscape(row[col.key])).join(','));
    return [headerLine, ...lines].join('\n');
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];
        if (char === '"') {
            if (inQuotes && next === '"') {
                value += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(value);
            value = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') i++;
            row.push(value);
            if (row.some(cell => cell !== '')) rows.push(row);
            row = [];
            value = '';
        } else {
            value += char;
        }
    }

    if (value !== '' || row.length) {
        row.push(value);
        if (row.some(cell => cell !== '')) rows.push(row);
    }
    return rows;
}

function parseCsvRecords(text) {
    const rows = parseCsv(text.trim());
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => String(h).trim());
    return rows.slice(1)
        .filter(row => row.some(cell => String(cell).trim() !== ''))
        .map(row => {
            const record = {};
            headers.forEach((header, index) => {
                record[header] = row[index] != null ? String(row[index]).trim() : '';
            });
            return record;
        });
}

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
function isWithinRange(dateString, range) {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (range === 'month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (range === '30d') {
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - 29);
        return date >= cutoff && date <= now;
    }
    if (range === 'year') {
        return date.getFullYear() === now.getFullYear();
    }
    return true;
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

function saveReminderPreferences() {
    localStorage.setItem('atler_reminder_prefs', JSON.stringify(reminderPreferences));
}

function getReminderPreference(subId) {
    return reminderPreferences[subId] || '3,1';
}

function getReminderDays(subId) {
    const pref = getReminderPreference(subId);
    if (pref === 'off') return [];
    return pref.split(',').map(v => parseInt(v, 10)).filter(Boolean);
}

function renderReminderPreference(subId) {
    document.querySelectorAll('.reminder-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-reminder') === getReminderPreference(subId));
    });
}

function renderMonthlyReview() {
    const card = document.getElementById('monthly-review-content');
    if (!card) return;

    const now = new Date();
    const thisMonthExpenses = expenses.filter(e => isWithinRange(e.date, 'month'));
    const manualThisMonth = thisMonthExpenses.filter(e => e.type === 'manual');
    const monthlyExpenseTotal = thisMonthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const activeSubs = subscriptions.filter(s => !s.paused);

    const categoryTotals = {};
    activeSubs.forEach(sub => {
        const categoryId = sub.category || 'unlisted';
        const categoryName = categoryId === 'unlisted'
            ? 'Unlisted'
            : (categories.find(c => c.id === categoryId)?.name || 'Unlisted');
        if (!categoryTotals[categoryId]) categoryTotals[categoryId] = { name: categoryName, total: 0 };
        categoryTotals[categoryId].total += getMonthlyCost(sub);
    });

    const topCategory = Object.values(categoryTotals).sort((a, b) => b.total - a.total)[0];
    const biggestSub = [...activeSubs].sort((a, b) => getMonthlyCost(b) - getMonthlyCost(a))[0];
    const totalMonthly = activeSubs.reduce((sum, sub) => sum + getMonthlyCost(sub), 0);
    const combined = totalMonthly + monthlyExpenseTotal;

    if (!activeSubs.length && !manualThisMonth.length) {
        card.innerHTML = createEmptyStateHTML({
            icon: 'calendar_month',
            title: 'Your month starts here',
            body: 'Add a subscription or expense and Atler will turn it into a monthly snapshot you can scan in seconds.',
            actionLabel: 'Add first subscription',
            action: 'add-subscription'
        });
        wireEmptyStateActions(card);
        return;
    }

    const rows = [
        {
            title: 'You spent',
            value: `${getCurrencySymbol()}${formatAmount(combined)}`,
            note: `${getCurrencySymbol()}${formatAmount(totalMonthly)} subscriptions + ${getCurrencySymbol()}${formatAmount(monthlyExpenseTotal)} logged this month`
        },
        {
            title: 'Top category',
            value: topCategory ? topCategory.name : 'None yet',
            note: topCategory
                ? `${getCurrencySymbol()}${formatAmount(topCategory.total)}/mo is flowing through this category`
                : 'Add categories to see which bucket is pulling the most'
        },
        {
            title: 'Most expensive subscription',
            value: biggestSub ? biggestSub.name : 'None yet',
            note: biggestSub
                ? `${getCurrencySymbol()}${formatAmount(getMonthlyCost(biggestSub))}/mo effective cost`
                : 'Your largest recurring cost will show up here'
        }
    ];

    card.innerHTML = rows.map(row => `
        <div class="review-row">
            <div class="review-copy">
                <div class="review-title">${escapeHTML(row.title)}</div>
                <div class="review-note">${escapeHTML(row.note)}</div>
            </div>
            <div class="review-value">${escapeHTML(row.value)}</div>
        </div>
    `).join('');
}

function handleLaunchShortcut() {
    const hash = window.location.hash;
    if (hash === '#add-subscription') {
        openAddSheet('subscription');
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    if (hash === '#add-expense') {
        openAddSheet('expense');
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }
}

function getMonthStart(offset = 0) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

function getMonthEnd(offset = 0) {
    const start = getMonthStart(offset + 1);
    return new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);
}

function getMonthlySpendTotalForOffset(offset = 0) {
    const start = getMonthStart(offset);
    const end = getMonthEnd(offset);
    return expenses.reduce((sum, exp) => {
        const expDate = new Date(exp.date);
        return expDate >= start && expDate <= end ? sum + parseFloat(exp.amount) : sum;
    }, 0);
}

function renderTrendChart() {
    const section = document.getElementById('spending-trend-section');
    const chart = document.getElementById('trend-chart');
    const comparePill = document.getElementById('trend-compare-pill');
    const currentTotalEl = document.getElementById('trend-current-total');
    const previousTotalEl = document.getElementById('trend-previous-total');
    const currentNoteEl = document.getElementById('trend-current-note');
    const previousNoteEl = document.getElementById('trend-previous-note');
    if (!section || !chart) return;

    const series = [];
    for (let offset = -5; offset <= 0; offset++) {
        const date = getMonthStart(offset);
        series.push({
            label: date.toLocaleDateString('en-US', { month: 'short' }),
            value: getMonthlySpendTotalForOffset(offset),
            isCurrent: offset === 0
        });
    }

    const current = series[series.length - 1]?.value || 0;
    const previous = series[series.length - 2]?.value || 0;
    const highest = Math.max(...series.map(item => item.value), 1);
    const delta = current - previous;
    const deltaPct = previous > 0 ? Math.round((delta / previous) * 100) : null;

    section.style.display = series.some(item => item.value > 0) ? 'block' : 'none';
    if (section.style.display === 'none') return;

    currentTotalEl.textContent = `${getCurrencySymbol()}${formatAmount(current)}`;
    previousTotalEl.textContent = `${getCurrencySymbol()}${formatAmount(previous)}`;
    currentNoteEl.textContent = current > 0 ? 'Auto renewals and manual expenses logged this month' : 'Nothing logged this month yet';
    previousNoteEl.textContent = previous > 0 ? 'What last month actually cost you' : 'No spend was logged last month';

    comparePill.className = 'trend-compare-pill';
    if (current === 0 && previous === 0) {
        comparePill.textContent = 'Quiet month';
        comparePill.classList.add('is-steady');
    } else if (delta > 0) {
        comparePill.textContent = deltaPct != null ? `${deltaPct}% up` : 'More than last month';
        comparePill.classList.add('is-up');
    } else if (delta < 0) {
        comparePill.textContent = deltaPct != null ? `${Math.abs(deltaPct)}% down` : 'Lower than last month';
        comparePill.classList.add('is-down');
    } else {
        comparePill.textContent = 'Steady';
        comparePill.classList.add('is-steady');
    }

    chart.innerHTML = series.map(item => {
        const height = Math.max(14, Math.round((item.value / highest) * 120));
        return `
            <div class="trend-chart-bar-wrap">
                <div class="trend-chart-amount">${getCurrencySymbol()}${formatAmount(item.value)}</div>
                <div class="trend-chart-bar ${item.isCurrent ? 'is-current' : ''}" style="height:${height}px;"></div>
                <div class="trend-chart-label">${escapeHTML(item.label)}</div>
            </div>
        `;
    }).join('');
}

function renderBudgetProgress() {
    const section = document.getElementById('budget-progress-section');
    const grid = document.getElementById('budget-progress-grid');
    if (!section || !grid) return;

    const cards = categories
        .filter(cat => cat.budget)
        .map(cat => {
            const spent = subscriptions
                .filter(sub => !sub.paused && (sub.category || 'unlisted') === cat.id)
                .reduce((sum, sub) => sum + getMonthlyCost(sub), 0);
            const budget = parseFloat(cat.budget) || 0;
            const remaining = budget - spent;
            const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
            const over = remaining < 0;
            return {
                name: cat.name,
                spent,
                budget,
                remaining,
                pct: Math.min(pct, 100),
                over
            };
        })
        .sort((a, b) => (b.over === a.over ? b.spent - a.spent : Number(b.over) - Number(a.over)));

    if (!cards.length) {
        section.style.display = 'none';
        grid.innerHTML = '';
        return;
    }

    section.style.display = 'block';
    grid.innerHTML = cards.map(card => `
        <div class="budget-card">
            <div class="budget-card-head">
                <div class="budget-card-name">${escapeHTML(card.name)}</div>
                <div class="budget-card-state ${card.over ? 'is-over' : ''}">
                    ${card.over ? 'Over budget' : `${Math.round((card.spent / card.budget) * 100)}% used`}
                </div>
            </div>
            <div class="budget-card-progress">
                <div class="budget-card-progress-fill ${card.over ? 'is-over' : ''}" style="width:${Math.max(8, card.pct)}%;"></div>
            </div>
            <div class="budget-card-meta">
                <div>
                    <div class="budget-card-meta-label">Spent</div>
                    <div class="budget-card-meta-value">${getCurrencySymbol()}${formatAmount(card.spent)}</div>
                </div>
                <div>
                    <div class="budget-card-meta-label">Remaining</div>
                    <div class="budget-card-meta-value">${card.over ? `-${getCurrencySymbol()}${formatAmount(Math.abs(card.remaining))}` : `${getCurrencySymbol()}${formatAmount(card.remaining)}`}</div>
                </div>
                <div>
                    <div class="budget-card-meta-label">Budget</div>
                    <div class="budget-card-meta-value">${getCurrencySymbol()}${formatAmount(card.budget)}</div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderNotificationOverview() {
    const container = document.getElementById('notification-overview');
    if (!container) return;

    const activeSubs = subscriptions.filter(sub => !sub.paused);
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    const lastChecked = localStorage.getItem('atler_last_notification_check');
    const lastCheckedText = lastChecked
        ? new Date(lastChecked).toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })
        : 'Not checked yet';

    if (!activeSubs.length) {
        container.innerHTML = `
            <div class="notification-overview-card">
                <h4>No reminder queue yet</h4>
                <p>Add a subscription and choose its reminder timing to see upcoming alerts here.</p>
            </div>
        `;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = [];
    activeSubs.forEach(sub => {
        const nextRenewal = getNextRenewalDate(sub.startDate || sub.dateAdded, sub.cycle);
        getReminderDays(sub.id).forEach(daysBefore => {
            const reminderDate = new Date(nextRenewal);
            reminderDate.setDate(reminderDate.getDate() - daysBefore);
            if (reminderDate >= today) {
                upcoming.push({
                    name: sub.name,
                    reminderDate,
                    daysBefore
                });
            }
        });
    });
    upcoming.sort((a, b) => a.reminderDate - b.reminderDate);

    const systemCard = `
        <div class="notification-overview-card">
            <h4>${permission === 'granted' ? 'Notifications are ready' : permission === 'denied' ? 'Notifications are blocked' : permission === 'default' ? 'Notifications need permission' : 'Browser notifications unsupported'}</h4>
            <p>Last reminder check: ${escapeHTML(lastCheckedText)}. For the most reliable delivery, open Atler at least once a day on this device.</p>
        </div>
    `;

    const listCard = upcoming.length
        ? upcoming.slice(0, 3).map(item => `
            <div class="notification-overview-card">
                <h4>${escapeHTML(item.name)}</h4>
                <p>${item.daysBefore === 0 ? 'Renewal day alert' : `${item.daysBefore} day${item.daysBefore > 1 ? 's' : ''} before`} on ${escapeHTML(formatDate(getLocalDateKey(item.reminderDate)))}</p>
            </div>
        `).join('')
        : `
            <div class="notification-overview-card">
                <h4>No upcoming reminder windows</h4>
                <p>Your current subscriptions do not have any reminder slots coming up right away.</p>
            </div>
        `;

    container.innerHTML = systemCard + listCard;
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
    const anchor = sub.startDate || sub.dateAdded;
    const nextRenewal = getNextRenewalDate(anchor, sub.cycle);
    const category = categories.find(c => c.id === sub.category);
    const monthlyEquivalent = getMonthlyCost(sub);
    const yearsActive = Math.max(0, (Date.now() - new Date(anchor).getTime()) / (1000 * 60 * 60 * 24 * 365));
    const spentSoFar = sub.cycle === 'Yearly'
        ? parseFloat(sub.price) * Math.max(1, Math.ceil(yearsActive))
        : monthlyEquivalent * Math.max(1, Math.ceil(((Date.now() - new Date(anchor).getTime()) / (1000 * 60 * 60 * 24 * 30))));
    const budget = category?.budget ? parseFloat(category.budget) : null;
    const budgetPressure = budget
        ? `${Math.round((monthlyEquivalent / budget) * 100)}% of ${getCurrencySymbol()}${formatAmount(budget)}`
        : 'No budget set';

    document.getElementById('detail-name').textContent  = sub.name;
    document.getElementById('detail-cycle').textContent = formatCycle(sub.cycle) + ' Plan';
    document.getElementById('detail-price').textContent = parseFloat(sub.price).toFixed(2);
    document.getElementById('detail-next-renewal').textContent = formatDate(getLocalDateKey(nextRenewal));
    document.getElementById('detail-spent-so-far').textContent = `${getCurrencySymbol()}${formatAmount(spentSoFar)}`;
    document.getElementById('detail-yearly-impact').textContent = `${getCurrencySymbol()}${formatAmount(monthlyEquivalent * 12)}`;
    document.getElementById('detail-category-name').textContent = category?.name || 'Unlisted';
    document.getElementById('detail-budget-pressure').textContent = budgetPressure;
    renderReminderPreference(sub.id);

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
    document.getElementById('edit-expense-name').value = exp.name;
    document.getElementById('edit-expense-amount').value = exp.amount;
    document.getElementById('edit-expense-date').value = exp.date;
    document.getElementById('expense-edit-card').style.display = 'none';
    document.getElementById('edit-expense-btn').style.display = exp.type === 'manual' ? 'block' : 'none';
    document.getElementById('delete-expense-btn').style.display = exp.type === 'manual' ? 'block' : 'none';

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
    if (duplicate) {
        const approved = await confirmAction({
            title: 'Keep both subscriptions?',
            message: `Another subscription called ${editedName} already exists. You can still save this one if it is a separate plan.`,
            confirmLabel: 'Save anyway',
            kicker: 'Possible duplicate'
        });
        if (!approved) return;
    }
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

document.querySelectorAll('.reminder-pill').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!activeSubId) return;
        reminderPreferences[activeSubId] = btn.getAttribute('data-reminder') || '3,1';
        saveReminderPreferences();
        renderReminderPreference(activeSubId);
        renderNotificationOverview();
        showToast('Reminder preference updated');
    });
});

// Delete button
document.getElementById('delete-sub-btn').addEventListener('click', async () => {
    const approved = await confirmAction({
        title: 'Delete this subscription?',
        message: 'Its linked renewal expenses will be removed too, so this change is permanent.',
        confirmLabel: 'Delete subscription',
        tone: 'danger',
        kicker: 'Permanent delete'
    });
    if (!approved) return;
    await deleteSubscription(activeSubId);
    subscriptions = subscriptions.filter(s => s.id !== activeSubId);
    showToast('Subscription deleted');
    goBack();
    await renderApp();
});

document.getElementById('delete-expense-btn').addEventListener('click', async () => {
    if (!activeExpenseId) return;
    const approved = await confirmAction({
        title: 'Delete this expense?',
        message: 'This will remove the manual expense from your history.',
        confirmLabel: 'Delete expense',
        tone: 'danger',
        kicker: 'Permanent delete'
    });
    if (!approved) return;

    await sb.from('expenses').delete().eq('id', activeExpenseId).eq('user_id', currentUser.id);
    expenses = expenses.filter(exp => exp.id !== activeExpenseId);
    activeExpenseId = null;
    showToast('Expense deleted');
    goBack();
    await renderApp();
});

document.getElementById('edit-expense-btn').addEventListener('click', () => {
    const card = document.getElementById('expense-edit-card');
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('edit-expense-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (isSavingExpenseEdit || !activeExpenseId || !currentUser) return;
    const expense = expenses.find(exp => exp.id === activeExpenseId);
    if (!expense || expense.type !== 'manual') return;

    const name = document.getElementById('edit-expense-name').value.trim();
    const amount = document.getElementById('edit-expense-amount').value;
    const date = document.getElementById('edit-expense-date').value || todayISO();
    if (!name || !amount) return;

    isSavingExpenseEdit = true;
    const submitBtn = document.getElementById('save-expense-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    expense.name = name;
    expense.amount = parseFloat(amount);
    expense.date = date;

    try {
        await sb.from('expenses').upsert({
            id: expense.id,
            user_id: currentUser.id,
            name: expense.name,
            amount: expense.amount,
            date: expense.date,
            type: expense.type || 'manual',
        });
        viewExpenseDetails(expense.id);
        await renderApp();
        showToast('Expense updated');
    } finally {
        isSavingExpenseEdit = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Expense';
    }
});

// ═══════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════
async function scheduleRenewalNotifications() {
    if (!currentUser || !('Notification' in window)) return;
    localStorage.setItem('atler_last_notification_check', new Date().toISOString());
    if (Notification.permission !== 'granted') return;

    const todayStr = todayISO();
    if (profile.lastNotified === todayStr) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const activeSubs = subscriptions.filter(s => !s.paused);

    for (const sub of activeSubs) {
        const anchor   = sub.startDate || sub.dateAdded;
        const next     = getNextRenewalDate(anchor, sub.cycle);
        const diffDays = Math.ceil((next - today) / 86400000);
        const reminderDays = getReminderDays(sub.id);
        if (reminderDays.includes(diffDays)) {
            const price = formatAmount(sub.price);
            new Notification('Atler — Renewal Reminder', {
                body: `${sub.name} renews in ${diffDays} day${diffDays > 1 ? 's' : ''} — ${getCurrencySymbol()}${price}`,
                icon: './icon-192.png',
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
    renderNotificationOverview();
    if (perm === 'granted') await scheduleRenewalNotifications();
});

document.getElementById('notif-prompt-skip').addEventListener('click', () => {
    hideNotificationPrompt();
    renderNotificationOverview();
});

window.addEventListener('focus', () => {
    scheduleRenewalNotifications();
    renderNotificationOverview();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        scheduleRenewalNotifications();
        renderNotificationOverview();
    }
});

// ═══════════════════════════════════════════
// PROFILE PAGE
// ═══════════════════════════════════════════
function renderProfilePage() {
    const preview = document.getElementById('profile-avatar-preview');
    if (preview) preview.src = profile.avatar;
    const heroName = document.getElementById('profile-display-name-hero');
    if (heroName) heroName.textContent = profile.name;
    const accountEmail = document.getElementById('account-email-value');
    if (accountEmail) accountEmail.textContent = currentUser?.email || 'Unknown';
    const providerLabel = document.getElementById('account-provider-value');
    const provider = currentUser?.app_metadata?.provider || 'email';
    if (providerLabel) {
        providerLabel.textContent = provider === 'google'
            ? 'Google'
            : provider.charAt(0).toUpperCase() + provider.slice(1);
    }
    const passwordForm = document.getElementById('change-password-form');
    const providerNote = document.getElementById('password-provider-note');
    const externalProvider = provider !== 'email';
    if (passwordForm) passwordForm.style.display = externalProvider ? 'none' : 'block';
    if (providerNote) providerNote.style.display = externalProvider ? 'block' : 'none';
    const nameInput = document.getElementById('profile-name');
    if (nameInput) nameInput.value = profile.name;
    const statsLine = document.getElementById('profile-stats-line');
    if (statsLine) {
        const totalMonthly = subscriptions.filter(s => !s.paused).reduce((s, sub) => s + getMonthlyCost(sub), 0);
        statsLine.textContent = `${subscriptions.length} subscription${subscriptions.length !== 1 ? 's' : ''} · ${getCurrencySymbol()}${formatAmount(totalMonthly)}/mo`;
    }
    applyTheme(profile.theme || 'default');
    renderNotificationStatus();
    renderNotificationOverview();
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

document.getElementById('change-password-form').addEventListener('submit', async e => {
    e.preventDefault();
    const password = document.getElementById('change-password').value;
    const confirm = document.getElementById('change-password-confirm').value;
    const feedback = document.getElementById('change-password-feedback');

    if (!sb) {
        feedback.textContent = 'Unable to load account services right now.';
        return;
    }
    if (!password || password.length < 6) {
        feedback.textContent = 'Password must be at least 6 characters.';
        return;
    }
    if (password !== confirm) {
        feedback.textContent = 'Passwords do not match.';
        return;
    }

    const { error } = await sb.auth.updateUser({ password });
    if (error) {
        feedback.textContent = error.message || 'Unable to update password.';
        return;
    }

    document.getElementById('change-password').value = '';
    document.getElementById('change-password-confirm').value = '';
    feedback.style.color = 'var(--secondary)';
    feedback.textContent = 'Password updated for this account.';
    setTimeout(() => {
        feedback.style.color = '';
    }, 2500);
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
    downloadTextFile(JSON.stringify(data, null, 2), `atler-backup-${todayISO()}.json`, 'application/json');
    closeDataModal();
    showToast('Full backup exported');
});

document.getElementById('dm-export-subs-csv-btn').addEventListener('click', () => {
    const rows = subscriptions.map(sub => ({
        name: sub.name,
        price: sub.price,
        cycle: sub.cycle,
        startDate: sub.startDate || sub.dateAdded || '',
        category: categories.find(cat => cat.id === (sub.category || 'unlisted'))?.name || 'Unlisted',
        paused: sub.paused ? 'true' : 'false'
    }));
    const csv = toCsv(rows, [
        { key: 'name', label: 'name' },
        { key: 'price', label: 'price' },
        { key: 'cycle', label: 'cycle' },
        { key: 'startDate', label: 'startDate' },
        { key: 'category', label: 'category' },
        { key: 'paused', label: 'paused' }
    ]);
    downloadTextFile(csv, `atler-subscriptions-${todayISO()}.csv`, 'text/csv;charset=utf-8');
    closeDataModal();
    showToast('Subscriptions CSV exported');
});

document.getElementById('dm-export-exp-csv-btn').addEventListener('click', () => {
    const rows = expenses.map(exp => ({
        name: exp.name,
        amount: exp.amount,
        date: exp.date,
        type: exp.type || 'manual'
    }));
    const csv = toCsv(rows, [
        { key: 'name', label: 'name' },
        { key: 'amount', label: 'amount' },
        { key: 'date', label: 'date' },
        { key: 'type', label: 'type' }
    ]);
    downloadTextFile(csv, `atler-expenses-${todayISO()}.csv`, 'text/csv;charset=utf-8');
    closeDataModal();
    showToast('Expenses CSV exported');
});

document.getElementById('dm-import-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        const text = String(e.target.result || '');
        const isCsv = file.name.toLowerCase().endsWith('.csv');

        if (isCsv) {
            const records = parseCsvRecords(text);
            if (!records.length) {
                showToast('CSV file is empty or unreadable');
                return;
            }

            const headers = Object.keys(records[0]).map(key => key.toLowerCase());
            closeDataModal();

            if (headers.includes('price') && headers.includes('cycle')) {
                let importedCount = 0;
                for (const row of records) {
                    const name = row.name || row.Name;
                    const price = parseFloat(row.price || row.Price);
                    const cycle = row.cycle || row.Cycle || 'Monthly';
                    if (!name || Number.isNaN(price)) continue;
                    const categoryName = (row.category || row.Category || 'Unlisted').trim();
                    let categoryId = 'unlisted';
                    if (categoryName && categoryName.toLowerCase() !== 'unlisted') {
                        const existingCategory = categories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
                        if (existingCategory) {
                            categoryId = existingCategory.id;
                        } else {
                            const newCategory = { id: makeClientId('cat'), name: categoryName, budget: null };
                            categories.push(newCategory);
                            await upsertCategory(newCategory);
                            categoryId = newCategory.id;
                        }
                    }
                    const newSub = {
                        id: makeClientId('sub'),
                        name: name.trim(),
                        cycle: cycle.trim() || 'Monthly',
                        price: price.toFixed(2),
                        dateAdded: todayISO(),
                        startDate: row.startDate || row.StartDate || todayISO(),
                        category: categoryId,
                        lastLoggedRenewal: null,
                        paused: String(row.paused || row.Paused || '').toLowerCase() === 'true'
                    };
                    subscriptions.push(newSub);
                    await upsertSubscription(newSub);
                    importedCount++;
                }
                await renderApp();
                renderProfilePage();
                showToast(importedCount ? `${importedCount} subscriptions imported` : 'No valid subscription rows found');
                return;
            }

            if (headers.includes('amount') && headers.includes('date')) {
                let importedCount = 0;
                for (const row of records) {
                    const name = row.name || row.Name;
                    const amount = parseFloat(row.amount || row.Amount);
                    const date = row.date || row.Date || todayISO();
                    if (!name || Number.isNaN(amount)) continue;
                    const newExpense = {
                        id: makeClientId('exp'),
                        name: name.trim(),
                        amount,
                        date,
                        type: (row.type || row.Type || 'manual').trim() || 'manual'
                    };
                    expenses.push(newExpense);
                    await insertExpense(newExpense);
                    importedCount++;
                }
                await renderApp();
                renderProfilePage();
                showToast(importedCount ? `${importedCount} expenses imported` : 'No valid expense rows found');
                return;
            }

            showToast('CSV format not recognised');
            return;
        }

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            showToast('Invalid JSON file');
            return;
        }
        if (!Array.isArray(parsed.subscriptions)) {
            showToast('Backup is missing subscriptions');
            return;
        }
        const approved = await confirmAction({
            title: 'Replace current data?',
            message: 'JSON restore replaces your current subscriptions, expenses, and categories with the backup snapshot.',
            confirmLabel: 'Restore backup',
            tone: 'danger',
            kicker: 'Full restore'
        });
        if (!approved) return;
        closeDataModal();
        await clearAllData();
        for (const sub of (parsed.subscriptions || [])) await upsertSubscription(sub);
        for (const cat of (parsed.categories || [])) await upsertCategory(cat);
        for (const exp of (parsed.expenses || [])) await insertExpense(exp);
        if (parsed.profile) {
            profile.name = parsed.profile.name || profile.name;
            profile.avatar = parsed.profile.avatar || profile.avatar;
            profile.theme = parsed.profile.theme || profile.theme;
            profile.currency = parsed.profile.currency || profile.currency;
        }
        await saveProfile();
        await loadAllData();
        await renderApp();
        renderProfilePage();
        showToast('Backup restored');
    };
    reader.readAsText(file);
    this.value = '';
});

document.getElementById('dm-clear-btn').addEventListener('click', async () => {
    const approved = await confirmAction({
        title: 'Clear all tracked data?',
        message: 'Subscriptions, expenses, and categories will be deleted. Your account profile stays intact.',
        confirmLabel: 'Clear everything',
        tone: 'danger',
        kicker: 'Destructive action'
    });
    if (!approved) return;
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
        const approved = await confirmAction({
            title: 'Possible duplicate subscription',
            message: `You already have ${existing.name} at ${existingPrice}/${existingCycle}. Keep both if this is a separate plan or family seat.`,
            confirmLabel: 'Add anyway',
            kicker: 'Duplicate check'
        });
        if (!approved) return;
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

document.querySelectorAll('.range-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.range-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        analyticsRange = pill.getAttribute('data-range') || 'month';
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
    const rangedExpenses = expenses.filter(e => isWithinRange(e.date, analyticsRange));
    const total = rangedExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
    document.getElementById('expenses-month-total-val').textContent = formatAmount(total);

    // ── JS-injected search input (only when expenses.length > 7) ──
    const expSearchWrap = container.parentElement.querySelector('.analytics-search-input[data-scope="expenses"]');
    if (expSearchWrap) expSearchWrap.remove(); // remove stale before re-injecting
    if (rangedExpenses.length > 7) {
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

    if (rangedExpenses.length === 0) {
        container.innerHTML = createEmptyStateHTML({
            icon: 'receipt_long',
            title: 'No expenses yet',
            body: analyticsRange === 'month'
                ? 'Manual expenses you add this month will appear here so you can track one-off spending alongside subscriptions.'
                : 'No expenses landed inside this time range yet. Try another range or log a new expense.',
            actionLabel: 'Log your first expense',
            action: 'add-expense'
        });
        wireEmptyStateActions(container);
        return;
    }

    const q = analyticsExpSearch.trim().toLowerCase();
    const sorted = [...rangedExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
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
        container.innerHTML = createEmptyStateHTML({
            icon: 'search_off',
            title: 'No matching expenses',
            body: 'Try a different search term or clear the search to see every logged expense.'
        });
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

    const manualExpenses = expenses.filter(e => e.type === 'manual');
    if (subscriptions.length === 0 && manualExpenses.length === 0) {
        portfolioList.innerHTML = createEmptyStateHTML({
            icon: 'rocket_launch',
            title: 'Welcome to Atler',
            body: 'Start by adding a subscription or logging an expense. We will turn your first entries into insights, reminders, and monthly totals.',
            actionLabel: 'Add your first subscription',
            action: 'add-subscription'
        });
        wireEmptyStateActions(portfolioList);
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
        upcomingScroll.innerHTML = createEmptyStateHTML({
            icon: 'event_upcoming',
            title: 'No renewals yet',
            body: 'Once you add a subscription with a billing cycle, upcoming renewals will show up here automatically.',
            actionLabel: 'Add subscription',
            action: 'add-subscription'
        });
        wireEmptyStateActions(upcomingScroll);
    }

    const now = new Date();
    const thisMonthExpenses = expenses
        .filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
        .reduce((s,e) => s + parseFloat(e.amount), 0);
    document.getElementById('total-spend').textContent = formatAmount(totalMonthly + thisMonthExpenses);
    document.getElementById('ytd-spend').textContent   = formatAmount(totalMonthly);

    renderAnalyticsView();
    renderInsights();
    renderMonthlyReview();
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
    const pausedSubs    = subscriptions.filter(s => s.paused);
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
    if (thisMonthExpTotal > 0 && totalMonthly > 0 && thisMonthExpTotal > totalMonthly) {
        candidates.push({
            score: 520,
            title: 'One-time spend is winning',
            text: `This month your one-time expenses are ${sym}${fmt(thisMonthExpTotal)}, which is higher than your subscriptions at ${sym}${fmt(totalMonthly)}. The leaks may not be recurring right now.`
        });
    }
    if (pausedSubs.length > 0) {
        const pausedMonthly = pausedSubs.reduce((sum, sub) => sum + getMonthlyCost(sub), 0);
        candidates.push({
            score: 260 + pausedSubs.length * 40,
            title: 'Paused, not forgotten',
            text: `${pausedSubs.length} subscription${pausedSubs.length !== 1 ? 's are' : ' is'} paused. That's ${sym}${fmt(pausedMonthly)}/mo sitting on standby if you decide to bring them back.`
        });
    }

    categories.forEach(cat => {
        if (!cat.budget) return;
        const ct = catTotals[cat.id];
        if (!ct) {
            candidates.push({
                score: 180,
                title: `Unused budget — ${cat.name}`,
                text: `${cat.name} has a budget of ${sym}${fmt(cat.budget)} but no active subscriptions yet. You can keep it as a guardrail or trim the number down.`
            });
            return;
        }
        const pct = (ct.total / cat.budget) * 100;
        if (pct >= 90) {
            const over = ct.total - cat.budget;
            candidates.push(pct >= 100
                ? { score: 750, title: `Budget Blown — ${cat.name}`, text: `${cat.name} has exceeded its ${sym}${fmt(cat.budget)}/mo limit by ${sym}${fmt(over)}. Consider pausing something.` }
                : { score: 500 + pct, title: `Budget Alert — ${cat.name}`, text: `${cat.name} is at ${Math.round(pct)}% of your ${sym}${fmt(cat.budget)}/mo limit. You have ${sym}${fmt(cat.budget - ct.total)} left.` }
            );
        } else if (pct <= 40) {
            candidates.push({
                score: 210,
                title: `Budget breathing room — ${cat.name}`,
                text: `${cat.name} is only using ${Math.round(pct)}% of its ${sym}${fmt(cat.budget)}/mo budget. You still have ${sym}${fmt(cat.budget - ct.total)} of space there.`
            });
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
    const summaryLabel = document.getElementById('subscriptions-summary-label');
    const activeSubs = subscriptions.filter(s => !s.paused);
    const monthlyTotal = activeSubs.reduce((sum, sub) => sum + getMonthlyCost(sub), 0);
    const summaryValue = analyticsRange === 'year' ? monthlyTotal * 12 : monthlyTotal;
    if (summaryLabel) {
        summaryLabel.textContent = analyticsRange === 'year'
            ? 'Projected Yearly Subscriptions'
            : analyticsRange === '30d'
                ? 'Active Subscription Run Rate'
                : 'Monthly Subscriptions';
    }
    document.getElementById('ytd-spend').textContent = formatAmount(summaryValue);
    renderTrendChart();
    renderBudgetProgress();

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

    if (subscriptions.length === 0) {
        container.innerHTML = createEmptyStateHTML({
            icon: 'subscriptions',
            title: 'No subscriptions tracked yet',
            body: 'Add your first subscription to unlock renewal reminders, category grouping, and spending insights.',
            actionLabel: 'Add first subscription',
            action: 'add-subscription'
        });
        wireEmptyStateActions(container);
        renderCategoryManager();
        return;
    }

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
        container.innerHTML = createEmptyStateHTML({
            icon: 'search_off',
            title: 'No matching subscriptions',
            body: 'Try a different search term or clear the search to see all of your subscriptions again.'
        });
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
    document.querySelectorAll('.profile-collapse-body.is-open').forEach(openBody => {
        if (openBody.id !== bodyId) openBody.classList.remove('is-open');
    });
    document.querySelectorAll('.profile-collapse-header').forEach(trigger => {
        const icon = trigger.querySelector('.profile-collapse-chevron');
        const isTarget = icon?.id === chevronId;
        trigger.setAttribute('aria-expanded', isTarget ? trigger.getAttribute('aria-expanded') : 'false');
        if (!isTarget && icon) icon.textContent = 'chevron_right';
    });
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

async function runBootWithLoader(bootFn, minVisible = 250) {
    const loading = document.getElementById('app-loading');
    const statusEl = document.getElementById('boot-status');
    if (!loading) return bootFn();
    const startTime = Date.now();
    
    loading.classList.remove('hidden');
    const stopNoise = startBootNoise();
    let forcedHideTimer = null;

    try {
        forcedHideTimer = setTimeout(() => {
            loading.classList.add('hidden');
        }, 12000);

        if (statusEl) statusEl.textContent = "INITIALIZING ATŁER...";
        
        // Run the boot function with a 10s safety timeout to prevent getting "stuck"
        const bootPromise = bootFn();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 2500));
        
        const bootResult = await Promise.race([bootPromise, timeoutPromise]);

        if (bootResult === 'timeout') {
            const authScreen = document.getElementById('auth-screen');
            if (authScreen && !currentUser) authScreen.classList.remove('hidden');
            if (statusEl) statusEl.textContent = "STARTUP TIMEOUT.";
            return;
        }

        // Ensure loader is visible for the requested vibe duration
        const elapsed = Date.now() - startTime;
        if (elapsed < minVisible) await sleep(minVisible - elapsed);

    } catch (error) {
        console.error('Boot failed:', error);
        const authScreen = document.getElementById('auth-screen');
        if (authScreen && !currentUser) authScreen.classList.remove('hidden');
    } finally {
        clearTimeout(forcedHideTimer);
        stopNoise();
        loading.style.opacity = '0';
        loading.style.transition = 'opacity 0.3s ease';
        await sleep(300);
        loading.classList.add('hidden');
        loading.style.opacity = '';
    }
}

async function renderInitialSessionView() {
    let dataLoadedInTime = false;
    const loadPromise = loadAllData()
        .then(() => {
            dataLoadedInTime = true;
        })
        .catch(() => {});

    await Promise.race([
        loadPromise,
        sleep(1200)
    ]);

    renderApp();
    renderProfilePage();

    if (dataLoadedInTime) {
        scheduleRenewalNotifications();
        handleLaunchShortcut();
        if (lastLoadError) showToast(lastLoadError, 3200);
        return;
    }

    loadPromise.then(() => {
        renderApp();
        renderProfilePage();
        scheduleRenewalNotifications();
        handleLaunchShortcut();
        if (lastLoadError) showToast(lastLoadError, 3200);
    }).catch(() => {
        handleLaunchShortcut();
        if (lastLoadError) showToast(lastLoadError, 3200);
    });
}

// Global App Initialization
(async () => {
    await runBootWithLoader(async () => {
        const authScreen = document.getElementById('auth-screen');
        const authError = document.getElementById('auth-error');
        const hash = window.location.hash || '';

        if (!sb) {
            if (authScreen) authScreen.classList.remove('hidden');
            if (authError) authError.textContent = 'Unable to load app services. Refresh and try again.';
            return;
        }

        if (hash.includes('type=recovery')) {
            if (authScreen) authScreen.classList.remove('hidden');
            setRecoveryMode(true);
            return;
        }

        const { data: { session } } = await sb.auth.getSession();

        if (!session?.user) {
            authScreen.classList.remove('hidden');
            return;
        }

        currentUser = session.user;
        await ensureUserProfile(session.user);
        authScreen.classList.add('hidden');
        await renderInitialSessionView();
    });
})();

// AUTH STATE CHANGES
if (sb) sb.auth.onAuthStateChange(async (event, session) => {
    const authScreen = document.getElementById('auth-screen');

    if (event === 'PASSWORD_RECOVERY') {
        if (authScreen) authScreen.classList.remove('hidden');
        setRecoveryMode(true);
        return;
    }

    if (event === 'SIGNED_IN' && session?.user) {
        if (currentUser?.id === session.user.id) return;

        await runBootWithLoader(async () => {
            currentUser = session.user;
            await ensureUserProfile(session.user);
            authScreen.classList.add('hidden');

            await loadAllData();
            await renderApp();
            renderProfilePage();
            scheduleRenewalNotifications();
            showNotificationPrompt();
            handleLaunchShortcut();
            if (lastLoadError) showToast(lastLoadError, 3200);
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
