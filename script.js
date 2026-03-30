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
}; {
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
let currentUser  = null;
let profile      = { name: 'Atler', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150', theme: 'default' };
let subscriptions = [];
let categories    = [];
let expenses      = [];
let activeSubId   = null;
let analyticsView = 'subscriptions';

const presetCategories = ['Entertainment','Productivity','Utilities','Health','Food','Education'];
const navItems = document.querySelectorAll('.nav-item');

// ═══════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════
const themes = {
    default:  { primary:'#c0c1ff', primaryContainer:'#4b4dd8', primaryGlow:'rgba(192,193,255,0.4)', secondary:'#4edea3', secondaryGlow:'rgba(78,222,163,0.2)' },
    midnight: { primary:'#4fc3f7', primaryContainer:'#0d47a1', primaryGlow:'rgba(79,195,247,0.4)',  secondary:'#80deea', secondaryGlow:'rgba(128,222,234,0.2)' },
    rose:     { primary:'#f48fb1', primaryContainer:'#880e4f', primaryGlow:'rgba(244,143,177,0.4)', secondary:'#f06292', secondaryGlow:'rgba(240,98,146,0.2)' },
    forest:   { primary:'#81c784', primaryContainer:'#1b5e20', primaryGlow:'rgba(129,199,132,0.4)', secondary:'#aed581', secondaryGlow:'rgba(174,213,129,0.2)' },
    amber:    { primary:'#ffcc02', primaryContainer:'#e65100', primaryGlow:'rgba(255,204,2,0.4)',   secondary:'#ffb300', secondaryGlow:'rgba(255,179,0,0.2)' },
};

function applyTheme(name) {
    const t = themes[name] || themes.default;
    const r = document.documentElement.style;
    r.setProperty('--primary',           t.primary);
    r.setProperty('--primary-container', t.primaryContainer);
    r.setProperty('--primary-glow',      t.primaryGlow);
    r.setProperty('--secondary',         t.secondary);
    r.setProperty('--secondary-glow',    t.secondaryGlow);
    document.querySelectorAll('.theme-chip').forEach(chip => {
        const dot = chip.querySelector('div');
        if (dot) dot.style.border = chip.dataset.theme === name ? '2px solid ' + t.primary : '2px solid transparent';
    });
    profile.theme = name;
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
            // Create profile row
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

// Allow Enter key on auth inputs
['auth-email','auth-password','auth-name'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('auth-submit-btn').click();
    });
});

// Sign out
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

    // Profile
    if (profRes.data) {
        profile = {
            name:   profRes.data.name   || 'Atler',
            avatar: profRes.data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
            theme:  profRes.data.theme  || 'default',
        };
    }

    // Map DB columns to camelCase used throughout the app
    subscriptions = (subsRes.data || []).map(s => ({
        id:               s.id,
        name:             s.name,
        cycle:            s.cycle,
        price:            s.price,
        dateAdded:        s.date_added,
        startDate:        s.start_date,
        category:         s.category || 'unlisted',
        lastLoggedRenewal:s.last_logged_renewal,
        paused:           s.paused || false,
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
    await sb.from('profiles').upsert({
        user_id: currentUser.id,
        name:    profile.name,
        avatar:  profile.avatar,
        theme:   profile.theme,
    });
}

async function upsertSubscription(sub) {
    if (!currentUser) return;
    await sb.from('subscriptions').upsert({
        id:                 sub.id,
        user_id:            currentUser.id,
        name:               sub.name,
        cycle:              String(sub.cycle),
        price:              sub.price,
        date_added:         sub.dateAdded,
        start_date:         sub.startDate,
        category:           sub.category || 'unlisted',
        last_logged_renewal:sub.lastLoggedRenewal || null,
        paused:             sub.paused || false,
    });
}

async function deleteSubscription(id) {
    if (!currentUser) return;
    await sb.from('subscriptions').delete().eq('id', id).eq('user_id', currentUser.id);
}

async function upsertCategory(cat) {
    if (!currentUser) return;
    await sb.from('categories').upsert({
        id:      cat.id,
        user_id: currentUser.id,
        name:    cat.name,
        budget:  cat.budget || null,
    });
}

async function deleteCategory(id) {
    if (!currentUser) return;
    await sb.from('categories').delete().eq('id', id).eq('user_id', currentUser.id);
    // Move subs to unlisted
    const affected = subscriptions.filter(s => s.category === id);
    for (const sub of affected) {
        sub.category = 'unlisted';
        await upsertSubscription(sub);
    }
}
window.deleteCategory = async function(id) {
    if (!confirm('Delete category? Subscriptions will be moved to Unlisted.')) return;
    categories = categories.filter(c => c.id !== id);
    await deleteCategory(id);
    renderAnalytics();
};

async function insertExpense(exp) {
    if (!currentUser) return;
    await sb.from('expenses').insert({
        id:      exp.id,
        user_id: currentUser.id,
        name:    exp.name,
        amount:  exp.amount,
        date:    exp.date,
        type:    exp.type || 'manual',
    });
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
function formatDate(ds) {
    return new Date(ds).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function todayISO() { return new Date().toISOString().split('T')[0]; }
function getMonthlyCost(sub) {
    if (sub.cycle === 'Yearly')  return parseFloat(sub.price) / 12;
    if (sub.cycle === 'Monthly') return parseFloat(sub.price);
    return (parseFloat(sub.price) / parseInt(sub.cycle)) * 30;
}
function getNextRenewalDate(dateAdded, cycle) {
    const start = new Date(dateAdded);
    const today = new Date(); today.setHours(0,0,0,0);
    let next = new Date(start); next.setHours(0,0,0,0);
    if (cycle === 'Yearly') { while (next <= today) next.setFullYear(next.getFullYear() + 1); }
    else { const inc = cycle === 'Monthly' ? 30 : parseInt(cycle); while (next <= today) next.setDate(next.getDate() + inc); }
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
        const lastRenewalISO = lastRenewal.toISOString().split('T')[0];
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
function switchPage(targetId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    navItems.forEach(item => item.classList.toggle('active', item.getAttribute('data-target') === targetId));
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.add('active');
        if (targetId === 'dashboard-page' || targetId === 'analytics-page') renderApp();
        if (targetId === 'calendar-page') renderCalendar();
        if (targetId === 'profile-page') renderProfilePage();
    }
    window.scrollTo(0, 0);
}

navItems.forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        const t = item.getAttribute('data-target');
        if (t) switchPage(t);
    });
});

// ═══════════════════════════════════════════
// DETAILS PAGE
// ═══════════════════════════════════════════
function viewDetails(id) {
    activeSubId = id;
    const sub = subscriptions.find(s => s.id === id);
    if (!sub) return;
    document.getElementById('detail-name').textContent        = sub.name;
    document.getElementById('detail-cycle').textContent       = formatCycle(sub.cycle) + ' Plan';
    document.getElementById('detail-price').textContent       = parseFloat(sub.price).toFixed(2);
    document.getElementById('detail-date').textContent        = formatDate(sub.dateAdded);
    const anchor = sub.startDate || sub.dateAdded;
    document.getElementById('detail-renewal-date').textContent = formatDate(getNextRenewalDate(anchor, sub.cycle));
    switchPage('details-page');
}

document.getElementById('delete-sub-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this subscription?')) return;
    await deleteSubscription(activeSubId);
    subscriptions = subscriptions.filter(s => s.id !== activeSubId);
    switchPage('dashboard-page');
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
        statsLine.textContent = `${subscriptions.length} subscription${subscriptions.length !== 1 ? 's' : ''} · ₹${totalMonthly.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}/mo`;
    }
    applyTheme(profile.theme || 'default');
}

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

document.getElementById('export-data-btn').addEventListener('click', () => {
    const data = { profile, subscriptions, categories, expenses, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `atler-backup-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('clear-data-btn').addEventListener('click', async () => {
    if (!confirm('This will delete all your subscriptions, expenses and categories. Your profile will be kept. Continue?')) return;
    await clearAllData();
    renderApp();
    renderProfilePage();
    alert('All data cleared. Profile kept.');
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
    const name      = document.getElementById('add-name').value.trim();
    let cycle       = document.getElementById('add-cycle').value;
    const price     = document.getElementById('add-price').value;
    const startDate = document.getElementById('add-start-date').value;
    const customDays= document.getElementById('add-custom-days').value;
    if (!name || !price) return;
    if (cycle === 'Custom') {
        if (!customDays || parseInt(customDays) <= 0) return;
        cycle = parseInt(customDays);
    }
    const newSub = {
        id:        Date.now().toString(),
        name, cycle,
        price:     parseFloat(price).toFixed(2),
        dateAdded: new Date().toISOString(),
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
    renderApp();
});

// ═══════════════════════════════════════════
// ADD EXPENSE FORM
// ═══════════════════════════════════════════
const addExpenseForm = document.getElementById('add-expense-form');
document.getElementById('exp-date').value = todayISO();

addExpenseForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name   = document.getElementById('exp-name').value.trim();
    const amount = document.getElementById('exp-amount').value;
    const date   = document.getElementById('exp-date').value || todayISO();
    if (!name || !amount) return;
    const newExp = { id: Date.now().toString(), name, amount: parseFloat(amount), date, type: 'manual' };
    expenses.push(newExp);
    await insertExpense(newExp);
    addExpenseForm.reset();
    document.getElementById('exp-date').value = todayISO();
    closeAddSheet();
    renderApp();
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
    document.getElementById('expenses-month-total-val').textContent = total.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
    if (expenses.length === 0) { container.innerHTML = `<div class="expenses-empty">No expenses logged yet.<br>Tap (+) to add one.</div>`; return; }
    const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    const todayStr = todayISO();
    const yest = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; })();
    const dateLabel = iso => iso === todayStr ? 'Today' : iso === yest ? 'Yesterday' : new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
    const groups = []; const seen = new Map();
    sorted.forEach(exp => {
        const label = dateLabel(exp.date);
        if (!seen.has(exp.date)) { seen.set(exp.date, groups.length); groups.push({ label, date: exp.date, items: [] }); }
        groups[seen.get(exp.date)].items.push(exp);
    });
    groups.forEach((group, gi) => {
        const dayLabel = document.createElement('div');
        dayLabel.className = 'exp-day-label'; dayLabel.textContent = group.label;
        container.appendChild(dayLabel);
        group.items.forEach(exp => {
            const row = document.createElement('div'); row.className = 'exp-row';
            row.innerHTML = `<span class="exp-name">${exp.name}</span><span class="exp-amount">₹${parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}</span>`;
            container.appendChild(row);
        });
        if (gi < groups.length - 1) { const div = document.createElement('div'); div.className = 'exp-divider'; container.appendChild(div); }
    });
}

// ═══════════════════════════════════════════
// RENDER APP
// ═══════════════════════════════════════════
async function renderApp() {
    await autoLogRenewals();

    document.getElementById('user-display-name').textContent = profile.name;
    document.getElementById('user-avatar-img').src           = profile.avatar;

    const activeSubs = subscriptions.filter(s => !s.paused);
    let totalMonthly = activeSubs.reduce((s, sub) => s + getMonthlyCost(sub), 0);

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
            const sub = entry.data;
            const color = colorFromName(sub.name);
            const item  = document.createElement('div');
            item.className = 'list-item';
            if (sub.paused) item.style.opacity = '0.5';
            item.innerHTML = `
                <div class="list-item-left">
                    <div class="list-icon-wrapper" style="background:${color}20;color:${color};font-size:24px;">${sub.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="list-title">${sub.name}${sub.paused ? ' <span style="font-size:0.65rem;background:var(--surface-high);color:var(--on-surface-variant);padding:2px 8px;border-radius:99px;font-family:var(--font-body);">Paused</span>' : ''}</div>
                        <div class="list-subtitle">${formatCycle(sub.cycle)}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="list-price">₹${parseFloat(sub.price).toLocaleString('en-IN', { minimumFractionDigits:2 })}</div>
                    <div class="list-date">${formatDate(sub.dateAdded)}</div>
                </div>`;
            item.addEventListener('click', () => viewDetails(sub.id));
            portfolioList.appendChild(item);

            if (!sub.paused) {
                const today = new Date(); today.setHours(0,0,0,0);
                const anchor = sub.startDate || sub.dateAdded;
                const renDate  = getNextRenewalDate(anchor, sub.cycle);
                const diffDays = Math.ceil((renDate - today) / 86400000);
                const renewalText = diffDays > 0 ? `Renews in ${diffDays} day${diffDays > 1 ? 's' : ''}` : 'Renews today';
                const textColor   = diffDays <= 3 ? 'var(--error)' : 'var(--primary)';
                const miniCard = document.createElement('div');
                miniCard.className = 'card-mini';
                miniCard.innerHTML = `<div class="card-icon" style="background:${color}20;color:${color};"><span class="material-symbols-outlined">payments</span></div><h3>${sub.name}</h3><p style="font-size:0.85rem;color:${textColor};font-weight:600;">${renewalText}</p>`;
                miniCard.addEventListener('click', () => viewDetails(sub.id));
                upcomingScroll.appendChild(miniCard);
            }
        } else {
            const exp  = entry.data;
            const item = document.createElement('div');
            item.className = 'list-item'; item.style.cursor = 'default';
            item.innerHTML = `<div class="list-item-left"><div class="list-icon-wrapper" style="background:var(--surface-high);color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:20px;">receipt_long</span></div><div><div class="list-title">${exp.name}</div><div class="list-subtitle">${formatDate(exp.date)}</div></div></div><div class="text-right"><div class="list-price">₹${parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits:2 })}</div></div>`;
            portfolioList.appendChild(item);
        }
    });

    if (mixed.length > 5) {
        const viewAll = document.createElement('div');
        viewAll.style.cssText = 'text-align:center;padding:12px 0 4px;';
        viewAll.innerHTML = `<a href="#" style="color:var(--primary);font-size:0.85rem;font-weight:600;text-decoration:none;">View all</a>`;
        viewAll.querySelector('a').addEventListener('click', e => {
            e.preventDefault();
            analyticsView = 'expenses';
            switchPage('analytics-page');
            document.querySelectorAll('.seg-pill').forEach(p => p.classList.toggle('active', p.getAttribute('data-view') === 'expenses'));
        });
        portfolioList.appendChild(viewAll);
    }

    const now = new Date();
    const thisMonthExpenses = expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s,e) => s + parseFloat(e.amount), 0);
    document.getElementById('total-spend').textContent = (totalMonthly + thisMonthExpenses).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
    document.getElementById('ytd-spend').textContent   = totalMonthly.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });

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
    const fmt = n => parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
    const candidates = [];

    if (subscriptions.length === 0 && manualExp.length === 0) candidates.push({ score:1000, solo:true, title:'Broke or Just Shy?', text:"No transactions yet. Either you live off the grid or you forgot to add everything. We don't judge. Much." });
    if (manualExp.length > 0 && subscriptions.length === 0) candidates.push({ score:900, solo:true, title:'Spending Without Tracking', text:"You're logging one-time expenses but haven't added recurring subscriptions yet. Add them to see the real damage." });
    if (renewalsToday.length > 0) { const total = renewalsToday.reduce((s,sub) => s + parseFloat(sub.price), 0); candidates.push({ score: 850 + (renewalsToday.length-1)*50, title:'Money Leaving Right Now', text: renewalsToday.length === 1 ? `${renewalsToday[0].name} renews today. ₹${fmt(renewalsToday[0].price)} is already gone or going. Moment of silence.` : `${renewalsToday[0].name} renews today plus ${renewalsToday.length-1} more totaling ₹${fmt(total)}.` }); }
    if (renewalsSoon.length > 0) { const s = renewalsSoon.sort((a,b) => a.diffDays - b.diffDays)[0]; candidates.push({ score: 700 + (3-s.diffDays)*50, title:'Renewal Incoming', text:`${s.sub.name} hits your wallet in ${s.diffDays} day${s.diffDays > 1 ? 's' : ''} — ₹${fmt(s.sub.price)}. Start mentally preparing.` }); }
    if (subCount > 1 && totalMonthly > 0) { let d = null, dp = 0; activeSubs.forEach(sub => { const p = getMonthlyCost(sub)/totalMonthly*100; if (p > dp) { dp = p; d = sub; } }); if (dp > 50) candidates.push({ score: dp*8, title:'One Sub to Rule Them All', text:`${d.name} is ${Math.round(dp)}% of your monthly spend. That's ₹${fmt(getMonthlyCost(d))} out of ₹${fmt(totalMonthly)}. At this point just marry it.` }); }
    Object.values(catTotals).forEach(cat => { if (cat.count > 2) candidates.push({ score: 400+cat.count*30, title:'Category Obsession', text:`You have ${cat.count} ${cat.name} subscriptions worth ₹${fmt(cat.total)}/month. We get it. You really love ${cat.name}.` }); });
    if (oldestSub && oldestDays >= 365) { const months = Math.floor(oldestDays/30); candidates.push({ score: 350+(oldestDays/365)*40, title:'Loyalty or Laziness?', text:`You've had ${oldestSub.name} for ${months} months. Either you love it or forgot it exists. Estimated cost so far: ₹${fmt(getMonthlyCost(oldestSub)*months)}.` }); }
    if (subCount > 4) candidates.push({ score: subCount*45, title:'Subscription Hoarder', text:`You have ${subCount} active subscriptions burning ₹${fmt(totalMonthly)}/mo. The average person uses about 3 actively. Think about that.` });
    if (totalMonthly > 3000) candidates.push({ score: (totalMonthly/1000)*60, title:'Big Spender Energy', text:`You're spending ₹${fmt(totalMonthly)}/mo. That's ₹${fmt(totalYearly)}/year. That's ${Math.round(totalYearly/250)} plates of biryani. Your call.` });
    if (totalYearly > 10000) candidates.push({ score: (totalYearly/5000)*40, title:'Annual Reality Check', text:`You're on track for ₹${fmt(totalYearly)} this year. Breaking it down: ₹${fmt(totalMonthly)}/mo, ₹${fmt(totalMonthly*12/52)}/week. Every. Single. Day.` });
    if (subCount === 1) candidates.push({ score:200, title:'Baby Steps', text:"One subscription tracked. Either you're a minimalist legend or this is just the beginning of a very expensive list." });
    if (subCount > 0) { const nr = nextRenewalDays === Infinity ? 'N/A' : `${nextRenewalDays} day${nextRenewalDays !== 1 ? 's' : ''}`; candidates.push({ score:100, title:'Looking Clean 👀', text:`Spending looks controlled. ${subCount} subscription${subCount !== 1 ? 's' : ''}, ₹${fmt(totalMonthly)}/mo, next renewal in ${nr}. Either you're disciplined or haven't added everything yet.` }); }
    if (lastWeekTotal > 0 && thisWeekTotal > lastWeekTotal*2) { const ratio = thisWeekTotal/lastWeekTotal; candidates.push({ score:ratio*200, title:'Spending Spike Detected', text:`Your one-time expenses this week are ${ratio.toFixed(1)}x higher than last week. ₹${fmt(thisWeekTotal)} vs ₹${fmt(lastWeekTotal)}. Something happened. We're not asking questions.` }); }
    if (totalMonthly > 0) { let lc = null, lp = 0; Object.values(catTotals).forEach(cat => { const p = cat.total/totalMonthly*100; if (p > lp) { lp = p; lc = cat; } }); if (lc && lp > 40) candidates.push({ score:450, title:`${lc.name} is Draining You`, text:`Your ${lc.name} subscriptions alone cost ₹${fmt(lc.total)}/mo — ${Math.round(lp)}% of your total. Consider if you need all ${lc.count} of them.` }); }
    if (thisWeekExps.length > 3) { const da = thisWeekTotal/7; candidates.push({ score:380, title:'Daily Spending Habit', text:`You've logged ${thisWeekExps.length} expenses this week averaging ₹${fmt(da)}/day. At this pace that's ₹${fmt(da*30)} extra this month.` }); }
    const cb = totalMonthly + thisMonthExpTotal;
    if (cb > 8000) candidates.push({ score:(cb/500)*60, title:'Total Burn Rate', text:`This month: ₹${fmt(thisMonthExpTotal)} one-time + ₹${fmt(totalMonthly)} subscriptions = ₹${fmt(cb)} combined. That's your real monthly spend.` });

    // Budget limit alerts
    categories.forEach(cat => {
        if (!cat.budget) return;
        const ct = catTotals[cat.id];
        if (!ct) return;
        const pct = (ct.total / cat.budget) * 100;
        if (pct >= 90) {
            const over = ct.total - cat.budget;
            candidates.push(pct >= 100
                ? { score: 750, title: `Budget Blown — ${cat.name}`, text: `${cat.name} has exceeded its ₹${fmt(cat.budget)}/mo limit by ₹${fmt(over)}. Consider pausing something.` }
                : { score: 500 + pct, title: `Budget Alert — ${cat.name}`, text: `${cat.name} is at ${Math.round(pct)}% of your ₹${fmt(cat.budget)}/mo limit. You have ₹${fmt(cat.budget - ct.total)} left.` }
            );
        }
    });

    candidates.sort((a,b) => b.score - a.score);
    let shown = [];
    if (candidates.length === 0) { shown = []; }
    else if (candidates[0].solo) { shown = [candidates[0]]; }
    else { const m = candidates.filter(c => c.score > 300); shown = (m.length > 0 ? m : candidates).slice(0, 3); }

    if (shown.length === 0) { card.innerHTML = '<h3 style="margin:0 0 6px;">All Quiet</h3><p style="color:rgba(255,255,255,0.8);font-size:0.875rem;margin:0;">Nothing to flag yet. Add subscriptions and expenses to get personalised insights.</p>'; return; }
    card.innerHTML = shown.map((insight, i) => `<div style="${i > 0 ? 'border-top:1px solid rgba(255,255,255,0.1);padding-top:14px;margin-top:14px;' : ''}"><h3 style="font-size:1.1rem;line-height:1.3;margin-bottom:6px;position:relative;z-index:2;">${insight.title}</h3><p style="color:rgba(255,255,255,0.8);font-size:0.875rem;line-height:1.5;margin:0;position:relative;z-index:2;">${insight.text}</p></div>`).join('');
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
    const groups = { unlisted: { name: 'Unlisted', subs: [] } };
    categories.forEach(c => groups[c.id] = { name: c.name, subs: [] });
    subscriptions.forEach(sub => { const cat = sub.category || 'unlisted'; (groups[cat] || groups['unlisted']).subs.push(sub); });
    const hasCategories = categories.length > 0;

    const createGroup = (id, name, subs, showHeading) => {
        const groupEl = document.createElement('div'); groupEl.style.marginBottom = '20px';
        if (showHeading) {
            const header = document.createElement('h2');
            header.style.cssText = 'cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-top:1rem;margin-bottom:0.5rem;';
            header.innerHTML = `${name} <span class="material-symbols-outlined" style="font-size:20px;">chevron_right</span>`;
            header.addEventListener('click', () => {
                const list = groupEl.querySelector('.cat-list');
                const icon = header.querySelector('.material-symbols-outlined');
                const open = list.style.display === 'none';
                list.style.display = open ? 'block' : 'none';
                icon.textContent   = open ? 'expand_more' : 'chevron_right';
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
        if (subs.length === 0 && showHeading) listEl.innerHTML = '<p style="color:var(--on-surface-variant);font-size:0.8rem;text-align:center;padding:10px;">Drag subscriptions here</p>';
        subs.forEach(sub => {
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
            item.innerHTML = `<div class="list-item-left"><div class="list-icon-wrapper" style="background:${color}20;color:${color};font-size:20px;width:40px;height:40px;">${sub.name.charAt(0).toUpperCase()}</div><div><div class="list-title" style="font-size:0.95rem;">${sub.name}</div><div class="list-subtitle" style="color:${textColor};font-weight:600;">${renewalText}</div></div></div><div class="text-right"><div class="list-price" style="font-size:1.1rem;">₹${parseFloat(sub.price).toLocaleString('en-IN', { minimumFractionDigits:2 })}</div></div>`;
            item.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', sub.id));
            listEl.appendChild(item);
        });
        groupEl.appendChild(listEl);
        container.appendChild(groupEl);
    };

    if (!hasCategories) { createGroup('unlisted', 'Unlisted', groups['unlisted'].subs, false); }
    else { for (const [id, grp] of Object.entries(groups)) { if (id !== 'unlisted') createGroup(id, grp.name, grp.subs, true); } createGroup('unlisted', 'Unlisted', groups['unlisted'].subs, true); }
    renderCategoryManager();
}

function renderCategoryManager() {
    const activeChips = document.getElementById('active-category-chips');
    const presetChips = document.getElementById('preset-category-chips');
    activeChips.innerHTML = ''; presetChips.innerHTML = '';
    categories.forEach(cat => {
        const chip = document.createElement('div');
        chip.style.cssText = 'background:var(--surface-high);padding:4px 12px;border-radius:100px;font-size:0.8rem;display:flex;align-items:center;gap:8px;border:1px solid var(--surface-low);';
        chip.innerHTML = `<span>${cat.name}</span><span class="material-symbols-outlined" style="font-size:14px;cursor:pointer;color:var(--on-surface-variant);" onclick="deleteCategory('${cat.id}')">close</span>`;
        activeChips.appendChild(chip);
    });
    presetCategories.forEach(preset => {
        if (categories.find(c => c.name.toLowerCase() === preset.toLowerCase())) return;
        const chip = document.createElement('div');
        chip.style.cssText = 'background:transparent;padding:4px 12px;border-radius:100px;font-size:0.8rem;display:flex;align-items:center;gap:4px;border:1px dashed var(--primary);color:var(--primary);cursor:pointer;';
        chip.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;">add</span><span>${preset}</span>`;
        chip.onclick = () => addCategoryFn(preset);
        presetChips.appendChild(chip);
    });
    if (categories.length === 0) activeChips.innerHTML = '<div style="color:var(--on-surface-variant);font-size:0.8rem;">No categories yet</div>';
}

async function addCategoryFn(name) {
    name = name.trim();
    if (!name || categories.find(c => c.name.toLowerCase() === name.toLowerCase())) return;
    const cat = { id: 'cat_' + Date.now(), name };
    categories.push(cat);
    await upsertCategory(cat);
    document.getElementById('add-category-input').value = '';
    renderAnalytics();
}

// ═══════════════════════════════════════════
// SWIPE NAVIGATION
// ═══════════════════════════════════════════
(function () {
    const swipePageOrder = ['dashboard-page','analytics-page','profile-page'];
    const container = document.querySelector('.container');
    let touchStartX = 0, touchStartY = 0, touchStartedInScroll = false;
    container.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; touchStartedInScroll = !!e.target.closest('.horizontal-scroll'); }, { passive: true });
    container.addEventListener('touchend', e => {
        if (touchStartedInScroll) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);
        if (Math.abs(deltaX) < 50 || deltaY > 75) return;
        const currentId = document.querySelector('.page.active')?.id;
        if (currentId === 'details-page' || currentId === 'calendar-page') return;
        const idx = swipePageOrder.indexOf(currentId);
        if (idx === -1) return;
        const nextIdx = deltaX < 0 ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= swipePageOrder.length) return;
        switchPage(swipePageOrder[nextIdx]);
    }, { passive: true });
})();

// ═══════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelectedDate = null;

function buildRenewalMap(year, month) {
    const map = {}; const monthStart = new Date(year, month, 1); const monthEnd = new Date(year, month+1, 0);
    subscriptions.filter(s => !s.paused).forEach(sub => {
        const anchor = sub.startDate || sub.dateAdded; const start = new Date(anchor); start.setHours(0,0,0,0);
        let cursor = new Date(start);
        if (sub.cycle === 'Yearly') { while (cursor < monthStart) cursor.setFullYear(cursor.getFullYear()+1); }
        else { const inc = sub.cycle === 'Monthly' ? 30 : parseInt(sub.cycle); while (cursor < monthStart) cursor.setDate(cursor.getDate()+inc); }
        while (cursor <= monthEnd) {
            const key = cursor.toISOString().split('T')[0];
            if (!map[key]) map[key] = []; map[key].push(sub);
            cursor = new Date(cursor);
            if (sub.cycle === 'Yearly') cursor.setFullYear(cursor.getFullYear()+1);
            else { const inc = sub.cycle === 'Monthly' ? 30 : parseInt(sub.cycle); cursor.setDate(cursor.getDate()+inc); }
        }
    });
    return map;
}

function renderCalendar() {
    const monthLabel = document.getElementById('cal-month-label'); const grid = document.getElementById('cal-grid'); const detail = document.getElementById('cal-detail');
    if (!monthLabel || !grid || !detail) return;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthLabel.textContent = `${monthNames[calMonth]} ${calYear}`;
    grid.innerHTML = ''; detail.style.display = 'none'; calSelectedDate = null;
    const renewalMap = buildRenewalMap(calYear, calMonth);
    const firstDay = new Date(calYear, calMonth, 1).getDay(); const daysInMonth = new Date(calYear, calMonth+1, 0).getDate(); const prevDays = new Date(calYear, calMonth, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    const expenseMap = {};
    expenses.forEach(exp => { const d = new Date(exp.date); if (d.getMonth() === calMonth && d.getFullYear() === calYear) { const key = exp.date.split('T')[0]; expenseMap[key] = (expenseMap[key] || 0) + parseFloat(exp.amount); } });
    const heatBg = spend => { if (spend <= 0) return null; const t = Math.min(spend/1000, 1); return `rgba(105,106,219,${(0.08+t*0.67).toFixed(2)})`; };
    for (let i = 0; i < firstDay; i++) { const cell = document.createElement('div'); cell.className = 'cal-cell other-month'; cell.innerHTML = `<div class="cal-date">${prevDays - firstDay + 1 + i}</div>`; grid.appendChild(cell); }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(calYear, calMonth, d); const key = dateObj.toISOString().split('T')[0];
        const subs = renewalMap[key] || []; const dayExpAmt = expenseMap[key] || 0;
        const totalSpend = subs.reduce((s,sub) => s + parseFloat(sub.price), 0) + dayExpAmt;
        const isToday = dateObj.getTime() === today.getTime(); const hasAny = subs.length > 0 || dayExpAmt > 0;
        const cell = document.createElement('div');
        cell.className = 'cal-cell' + (hasAny ? ' has-events' : '') + (isToday ? ' today' : '');
        const heat = heatBg(totalSpend); if (heat) cell.style.background = heat;
        const dateEl = document.createElement('div'); dateEl.className = 'cal-date'; dateEl.textContent = d; cell.appendChild(dateEl);
        if (subs.length) { const dotsEl = document.createElement('div'); dotsEl.className = 'cal-dots'; subs.slice(0,3).forEach(sub => { const dot = document.createElement('div'); dot.className = 'cal-dot'; dot.style.background = colorFromName(sub.name); dotsEl.appendChild(dot); }); cell.appendChild(dotsEl); }
        if (hasAny) { cell.addEventListener('click', () => { if (calSelectedDate === key) { calSelectedDate = null; grid.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected')); detail.style.display = 'none'; return; } calSelectedDate = key; grid.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected')); cell.classList.add('selected'); renderCalendarDetail(key, subs); }); }
        grid.appendChild(cell);
    }
    const trailing = (firstDay + daysInMonth) % 7;
    if (trailing > 0) { for (let i = 1; i <= 7 - trailing; i++) { const cell = document.createElement('div'); cell.className = 'cal-cell other-month'; cell.innerHTML = `<div class="cal-date">${i}</div>`; grid.appendChild(cell); } }
}

function renderCalendarDetail(dateKey, subs) {
    const detail = document.getElementById('cal-detail');
    const d = new Date(dateKey); const label = d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });
    const fmt = n => parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
    const dayExps = expenses.filter(e => e.date.split('T')[0] === dateKey);
    let html = `<div class="cal-detail-date">${label}</div>`;
    subs.forEach(sub => { const color = colorFromName(sub.name); html += `<div class="cal-detail-item"><div class="cal-detail-left"><div class="cal-detail-icon" style="background:${color}20;color:${color};">${sub.name.charAt(0).toUpperCase()}</div><div><div class="cal-detail-name">${sub.name}</div><div class="cal-detail-cycle">${formatCycle(sub.cycle)} renewal</div></div></div><div class="cal-detail-price">₹${fmt(sub.price)}</div></div>`; });
    if (dayExps.length) {
        if (subs.length) html += `<div style="border-top:1px solid var(--surface);margin:8px 0 6px;"></div><div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--on-surface-variant);margin-bottom:6px;">One-time expenses</div>`;
        dayExps.forEach(exp => { html += `<div class="cal-detail-item"><div class="cal-detail-left"><div class="cal-detail-icon" style="background:var(--surface-high);color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:16px;">receipt_long</span></div><div><div class="cal-detail-name">${exp.name}</div><div class="cal-detail-cycle">One-time expense</div></div></div><div class="cal-detail-price">₹${fmt(exp.amount)}</div></div>`; });
    }
    if (subs.length && dayExps.length) { const st = subs.reduce((s,sub) => s+parseFloat(sub.price),0); const et = dayExps.reduce((s,e) => s+parseFloat(e.amount),0); html += `<div style="border-top:1px solid var(--surface);margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;align-items:center;"><div style="font-size:0.75rem;color:var(--on-surface-variant);font-weight:600;">Total today</div><div style="font-size:1rem;font-weight:800;color:var(--primary);">₹${fmt(st+et)}</div></div>`; }
    detail.innerHTML = html; detail.style.display = 'block';
    detail.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

document.getElementById('cal-prev').addEventListener('click', () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); });
document.getElementById('cal-next').addEventListener('click', () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); });
document.getElementById('cal-back-btn').addEventListener('click', e => { e.preventDefault(); switchPage('dashboard-page'); });
document.getElementById('calendar-link').addEventListener('click', e => { e.preventDefault(); switchPage('calendar-page'); });

// ═══════════════════════════════════════════
// APP INIT — AUTH STATE LISTENER
// ═══════════════════════════════════════════
// Fallback loader timeout
setTimeout(() => {
    const loading = document.getElementById('app-loading');
    const authScreen = document.getElementById('auth-screen');
    if (!loading.classList.contains('hidden')) {
        loading.classList.add('hidden');
        authScreen.classList.remove('hidden');
    }
}, 3000);

sb.auth.onAuthStateChange(async (event, session) => {
    const loading  = document.getElementById('app-loading');
    const authScreen = document.getElementById('auth-screen');

    if (session?.user) {
        currentUser = session.user;
        authScreen.classList.add('hidden');
        loading.classList.remove('hidden');

        await loadAllData();

        loading.classList.add('hidden');
        await renderApp();
        renderProfilePage();
    } else {
        currentUser = null;
        subscriptions = []; categories = []; expenses = [];
        profile = { name:'Atler', avatar:'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150', theme:'default' };
        loading.classList.add('hidden');
        authScreen.classList.remove('hidden');
    }
});
