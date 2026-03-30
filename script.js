const navItems = document.querySelectorAll('.nav-item');

// --- Global State ---
let profile = JSON.parse(localStorage.getItem('atelier_profile')) || {
    name: 'Atler',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
    theme: 'default'
};

let subscriptions = JSON.parse(localStorage.getItem('atelier_subscriptions')) || [];
let categories    = JSON.parse(localStorage.getItem('atelier_categories'))    || [];
let expenses      = JSON.parse(localStorage.getItem('atelier_expenses'))      || [];

let activeSubId = null;
let analyticsView = 'subscriptions';

const presetCategories = ['Entertainment', 'Productivity', 'Utilities', 'Health', 'Food', 'Education'];

// Backwards-compatibility migration
subscriptions.forEach(sub => {
    if (!sub.category) sub.category = 'unlisted';
});

// --- Theme Definitions ---
const themes = {
    default:  { primary: '#c0c1ff', primaryContainer: '#4b4dd8', primaryGlow: 'rgba(192,193,255,0.4)', secondary: '#4edea3', secondaryGlow: 'rgba(78,222,163,0.2)' },
    midnight: { primary: '#4fc3f7', primaryContainer: '#0d47a1', primaryGlow: 'rgba(79,195,247,0.4)',  secondary: '#80deea', secondaryGlow: 'rgba(128,222,234,0.2)' },
    rose:     { primary: '#f48fb1', primaryContainer: '#880e4f', primaryGlow: 'rgba(244,143,177,0.4)', secondary: '#f06292', secondaryGlow: 'rgba(240,98,146,0.2)' },
    forest:   { primary: '#81c784', primaryContainer: '#1b5e20', primaryGlow: 'rgba(129,199,132,0.4)', secondary: '#aed581', secondaryGlow: 'rgba(174,213,129,0.2)' },
    amber:    { primary: '#ffcc02', primaryContainer: '#e65100', primaryGlow: 'rgba(255,204,2,0.4)',   secondary: '#ffb300', secondaryGlow: 'rgba(255,179,0,0.2)' },
};

function applyTheme(themeName) {
    const t = themes[themeName] || themes.default;
    const r = document.documentElement.style;
    r.setProperty('--primary',           t.primary);
    r.setProperty('--primary-container', t.primaryContainer);
    r.setProperty('--primary-glow',      t.primaryGlow);
    r.setProperty('--secondary',         t.secondary);
    r.setProperty('--secondary-glow',    t.secondaryGlow);

    // Update theme chip borders
    document.querySelectorAll('.theme-chip').forEach(chip => {
        const dot = chip.querySelector('div');
        if (dot) dot.style.border = chip.dataset.theme === themeName
            ? '2px solid ' + t.primary
            : '2px solid transparent';
    });

    profile.theme = themeName;
}

// Apply saved theme on load
applyTheme(profile.theme || 'default');

// --- Utilities ---
function saveState() {
    localStorage.setItem('atelier_profile',       JSON.stringify(profile));
    localStorage.setItem('atelier_subscriptions', JSON.stringify(subscriptions));
    localStorage.setItem('atelier_categories',    JSON.stringify(categories));
    localStorage.setItem('atelier_expenses',      JSON.stringify(expenses));
}

function formatDate(dateString) {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
    return new Date().toISOString().split('T')[0];
}

function getMonthlyCost(sub) {
    if (sub.cycle === 'Yearly')  return parseFloat(sub.price) / 12;
    if (sub.cycle === 'Monthly') return parseFloat(sub.price);
    return (parseFloat(sub.price) / parseInt(sub.cycle)) * 30;
}

function getNextRenewalDate(dateAdded, cycle) {
    const start = new Date(dateAdded);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let next = new Date(start);
    next.setHours(0, 0, 0, 0);
    if (cycle === 'Yearly') {
        while (next <= today) next.setFullYear(next.getFullYear() + 1);
    } else {
        const incDays = cycle === 'Monthly' ? 30 : parseInt(cycle);
        while (next <= today) next.setDate(next.getDate() + incDays);
    }
    return next;
}

function getLastRenewalDate(dateAdded, cycle) {
    const next = getNextRenewalDate(dateAdded, cycle);
    const last = new Date(next);
    if (cycle === 'Yearly') {
        last.setFullYear(last.getFullYear() - 1);
    } else {
        const incDays = cycle === 'Monthly' ? 30 : parseInt(cycle);
        last.setDate(last.getDate() - incDays);
    }
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

// --- Auto-log subscription renewals as expenses ---
function autoLogRenewals() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let changed = false;
    subscriptions.forEach(sub => {
        const anchor = sub.startDate || sub.dateAdded;
        const lastRenewal = getLastRenewalDate(anchor, sub.cycle);
        if (lastRenewal > today) return;
        const lastRenewalISO = lastRenewal.toISOString().split('T')[0];
        if (sub.lastLoggedRenewal === lastRenewalISO) return;
        const subAddedDate = new Date(sub.dateAdded);
        subAddedDate.setHours(0, 0, 0, 0);
        if (lastRenewal < subAddedDate) return;
        expenses.push({
            id:     'auto_' + sub.id + '_' + lastRenewalISO,
            name:   sub.name,
            amount: parseFloat(sub.price),
            date:   lastRenewalISO,
            type:   'auto'
        });
        sub.lastLoggedRenewal = lastRenewalISO;
        changed = true;
    });
    if (changed) saveState();
}

// --- Navigation ---
function switchPage(targetId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-target') === targetId);
    });
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

// --- Details Page ---
function viewDetails(id) {
    activeSubId = id;
    const sub = subscriptions.find(s => s.id === id);
    if (!sub) return;
    document.getElementById('detail-name').textContent        = sub.name;
    document.getElementById('detail-cycle').textContent       = formatCycle(sub.cycle) + ' Plan';
    document.getElementById('detail-price').textContent       = parseFloat(sub.price).toFixed(2);
    document.getElementById('detail-date').textContent        = formatDate(sub.dateAdded);
    const anchor      = sub.startDate || sub.dateAdded;
    const nextRenewal = getNextRenewalDate(anchor, sub.cycle);
    document.getElementById('detail-renewal-date').textContent = formatDate(nextRenewal);
    switchPage('details-page');
}

document.getElementById('delete-sub-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to delete this subscription?')) {
        subscriptions = subscriptions.filter(s => s.id !== activeSubId);
        saveState();
        switchPage('dashboard-page');
    }
});

// --- Profile Page ---
function renderProfilePage() {
    // Avatar
    const preview = document.getElementById('profile-avatar-preview');
    if (preview) preview.src = profile.avatar;

    // Hero name
    const heroName = document.getElementById('profile-display-name-hero');
    if (heroName) heroName.textContent = profile.name;

    // Name input
    const nameInput = document.getElementById('profile-name');
    if (nameInput) nameInput.value = profile.name;

    // Stats line
    const statsLine = document.getElementById('profile-stats-line');
    if (statsLine) {
        const totalMonthly = subscriptions.reduce((s, sub) => s + getMonthlyCost(sub), 0);
        statsLine.textContent = `${subscriptions.length} subscription${subscriptions.length !== 1 ? 's' : ''} · ₹${totalMonthly.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo`;
    }

    // Theme chips — highlight active
    applyTheme(profile.theme || 'default');
}

// Avatar file upload
document.getElementById('profile-avatar-circle').addEventListener('click', () => {
    document.getElementById('avatar-file-input').click();
});

document.getElementById('avatar-file-input').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const base64 = e.target.result;
        profile.avatar = base64;
        saveState();
        // Update all avatar references instantly
        document.getElementById('profile-avatar-preview').src = base64;
        document.getElementById('user-avatar-img').src = base64;
    };
    reader.readAsDataURL(file);
});

// Name save button
document.getElementById('profile-name-save').addEventListener('click', () => {
    const val = document.getElementById('profile-name').value.trim();
    if (!val) return;
    profile.name = val;
    saveState();
    document.getElementById('user-display-name').textContent = val;
    document.getElementById('profile-display-name-hero').textContent = val;
    // Flash button feedback
    const btn = document.getElementById('profile-name-save');
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = 'Save'; }, 1500);
});

// Theme chips
document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        applyTheme(chip.dataset.theme);
        saveState();
    });
});

// Export data
document.getElementById('export-data-btn').addEventListener('click', () => {
    const data = {
        profile,
        subscriptions,
        categories,
        expenses,
        exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `atler-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

// Clear data
document.getElementById('clear-data-btn').addEventListener('click', () => {
    if (confirm('This will delete all your subscriptions, expenses and categories. Your profile will be kept. Continue?')) {
        subscriptions = [];
        categories    = [];
        expenses      = [];
        saveState();
        renderApp();
        renderProfilePage();
        alert('All data cleared. Profile kept.');
    }
});

// Legacy profile form (hidden, kept for compatibility)
const profileForm = document.getElementById('profile-form');
if (profileForm) {
    profileForm.addEventListener('submit', e => {
        e.preventDefault();
    });
}

// Keep avatarInput reference for renderApp compatibility
const avatarInput  = { value: '' };
const nameInput    = document.getElementById('profile-name') || { value: '' };

// --- Add Subscription Form ---
const addForm         = document.getElementById('add-form');
const cycleSelect     = document.getElementById('add-cycle');
const customDaysGroup = document.getElementById('custom-days-group');

document.getElementById('add-start-date').value = todayISO();

cycleSelect.addEventListener('change', e => {
    const show = e.target.value === 'Custom';
    customDaysGroup.style.display = show ? 'block' : 'none';
    if (!show) document.getElementById('add-custom-days').value = '';
});

addForm.addEventListener('submit', e => {
    e.preventDefault();
    const name  = document.getElementById('add-name').value.trim();
    let cycle   = document.getElementById('add-cycle').value;
    const price = document.getElementById('add-price').value;
    const startDate  = document.getElementById('add-start-date').value;
    const customDays = document.getElementById('add-custom-days').value;
    if (!name || !price) return;
    if (cycle === 'Custom') {
        if (!customDays || parseInt(customDays) <= 0) return;
        cycle = parseInt(customDays);
    }
    subscriptions.push({
        id:        Date.now().toString(),
        name,
        cycle,
        price:     parseFloat(price).toFixed(2),
        dateAdded: new Date().toISOString(),
        startDate: startDate || todayISO(),
        category:  'unlisted'
    });
    saveState();
    addForm.reset();
    document.getElementById('add-start-date').value = todayISO();
    customDaysGroup.style.display = 'none';
    closeAddSheet();
    renderApp();
});

// --- Add Expense Form ---
const addExpenseForm = document.getElementById('add-expense-form');
document.getElementById('exp-date').value = todayISO();

addExpenseForm.addEventListener('submit', e => {
    e.preventDefault();
    const name   = document.getElementById('exp-name').value.trim();
    const amount = document.getElementById('exp-amount').value;
    const date   = document.getElementById('exp-date').value || todayISO();
    if (!name || !amount) return;
    expenses.push({
        id:     Date.now().toString(),
        name,
        amount: parseFloat(amount),
        date,
        type:   'manual'
    });
    saveState();
    addExpenseForm.reset();
    document.getElementById('exp-date').value = todayISO();
    closeAddSheet();
    renderApp();
});

// --- Bottom Sheet Logic ---
const sheetOverlay = document.getElementById('add-sheet-overlay');
const sheet        = document.getElementById('add-sheet');

function openAddSheet(mode) {
    const subForm = document.getElementById('sheet-sub-form');
    const expForm = document.getElementById('sheet-exp-form');
    if (mode === 'expense') {
        subForm.style.display = 'none';
        expForm.style.display = 'block';
        document.getElementById('exp-date').value = todayISO();
    } else {
        subForm.style.display = 'block';
        expForm.style.display = 'none';
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

// --- FAB Logic ---
const fabContainer = document.getElementById('fab-container');
const fabBtn       = document.getElementById('fab-btn');
const fabOverlay   = document.getElementById('fab-overlay');

function toggleFab() {
    const isOpen = fabContainer.classList.toggle('open');
    fabOverlay.classList.toggle('open', isOpen);
}

function closeFab() {
    fabContainer.classList.remove('open');
    fabOverlay.classList.remove('open');
}

fabBtn.addEventListener('click', e => { e.preventDefault(); toggleFab(); });
fabOverlay.addEventListener('click', closeFab);

document.getElementById('fab-option-sub').addEventListener('click', () => {
    closeFab();
    openAddSheet('subscription');
});

document.getElementById('fab-option-expense').addEventListener('click', () => {
    closeFab();
    openAddSheet('expense');
});

sheetOverlay.addEventListener('click', e => {
    if (e.target === sheetOverlay) closeAddSheet();
});

// Drag-to-dismiss
(function () {
    const handle = document.getElementById('sheet-handle');
    let dragStartY = 0, isDragging = false;
    handle.addEventListener('touchstart', e => {
        dragStartY = e.touches[0].clientY;
        isDragging = true;
        sheet.style.transition = 'none';
    }, { passive: true });
    handle.addEventListener('touchmove', e => {
        if (!isDragging) return;
        const delta = e.touches[0].clientY - dragStartY;
        if (delta > 0) sheet.style.transform = `translateY(${delta}px)`;
    }, { passive: true });
    handle.addEventListener('touchend', e => {
        if (!isDragging) return;
        isDragging = false;
        sheet.style.transition = '';
        const delta = e.changedTouches[0].clientY - dragStartY;
        if (delta > 80) closeAddSheet();
        else sheet.style.transform = 'translateY(0)';
    }, { passive: true });
})();

// --- Analytics Toggle ---
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
        subsView.style.display = 'none';
        expView.style.display  = 'block';
        renderExpensesView();
    } else {
        subsView.style.display = 'block';
        expView.style.display  = 'none';
        renderAnalytics();
    }
}

// --- Render Expenses View ---
function renderExpensesView() {
    const container = document.getElementById('expenses-list-container');
    container.innerHTML = '';
    const allExpensesTotal = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    document.getElementById('expenses-month-total-val').textContent = allExpensesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (expenses.length === 0) {
        container.innerHTML = `<div class="expenses-empty">No expenses logged yet.<br>Tap (+) to add one.</div>`;
        return;
    }
    const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    const todayStr     = todayISO();
    const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })();
    function dateLabel(iso) {
        if (iso === todayStr)     return 'Today';
        if (iso === yesterdayStr) return 'Yesterday';
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
    const groups = [];
    const seen   = new Map();
    sorted.forEach(exp => {
        const label = dateLabel(exp.date);
        if (!seen.has(exp.date)) {
            seen.set(exp.date, groups.length);
            groups.push({ label, date: exp.date, items: [] });
        }
        groups[seen.get(exp.date)].items.push(exp);
    });
    groups.forEach((group, gi) => {
        const dayLabel = document.createElement('div');
        dayLabel.className = 'exp-day-label';
        dayLabel.textContent = group.label;
        container.appendChild(dayLabel);
        group.items.forEach(exp => {
            const row = document.createElement('div');
            row.className = 'exp-row';
            row.innerHTML = `
                <span class="exp-name">${exp.name}</span>
                <span class="exp-amount">₹${parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            `;
            container.appendChild(row);
        });
        if (gi < groups.length - 1) {
            const div = document.createElement('div');
            div.className = 'exp-divider';
            container.appendChild(div);
        }
    });
}

// --- Render Core App ---
function renderApp() {
    autoLogRenewals();

    // Profile topbar
    document.getElementById('user-display-name').textContent = profile.name;
    document.getElementById('user-avatar-img').src           = profile.avatar;

    let totalMonthly = 0;
    subscriptions.forEach(sub => { totalMonthly += getMonthlyCost(sub); });

    const portfolioList  = document.getElementById('portfolio-list');
    const upcomingScroll = document.getElementById('upcoming-scroll');
    portfolioList.innerHTML  = '';
    upcomingScroll.innerHTML = '';

    if (subscriptions.length === 0 && expenses.filter(e => e.type === 'manual').length === 0) {
        portfolioList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--on-surface-variant);font-size:0.9rem;background:var(--surface-low);border-radius:var(--radius-md);">No entries yet. Tap (+) to add.</div>';
    } else {
        document.getElementById('spend-trend').style.display = 'inline-flex';
    }

    // Build mixed list
    const subItems = subscriptions.map(sub => ({
        _type: 'sub', _sortDate: new Date(sub.startDate || sub.dateAdded), data: sub
    }));
    const expItems = expenses.filter(e => e.type === 'manual').map(exp => ({
        _type: 'exp', _sortDate: new Date(exp.date), data: exp
    }));
    const mixedItems  = [...subItems, ...expItems].sort((a, b) => b._sortDate - a._sortDate);
    const visibleItems = mixedItems.slice(0, 5);

    visibleItems.forEach(entry => {
        if (entry._type === 'sub') {
            const sub   = entry.data;
            const color = colorFromName(sub.name);
            const item  = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="list-item-left">
                    <div class="list-icon-wrapper" style="background:${color}20;color:${color};font-size:24px;">
                        ${sub.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="list-title">${sub.name}</div>
                        <div class="list-subtitle">${formatCycle(sub.cycle)}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="list-price">₹${parseFloat(sub.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div class="list-date">${formatDate(sub.dateAdded)}</div>
                </div>
            `;
            item.addEventListener('click', () => viewDetails(sub.id));
            portfolioList.appendChild(item);

            // Mini card
            const today = new Date(); today.setHours(0,0,0,0);
            const anchor   = sub.startDate || sub.dateAdded;
            const renDate  = getNextRenewalDate(anchor, sub.cycle);
            const diffDays = Math.ceil((renDate - today) / (1000 * 60 * 60 * 24));
            let renewalText = diffDays > 0 ? `Renews in ${diffDays} day${diffDays > 1 ? 's' : ''}` : 'Renews today';
            const textColor = diffDays <= 3 ? 'var(--error)' : 'var(--primary)';
            const miniCard  = document.createElement('div');
            miniCard.className = 'card-mini';
            miniCard.innerHTML = `
                <div class="card-icon" style="background:${color}20;color:${color};">
                    <span class="material-symbols-outlined">payments</span>
                </div>
                <h3>${sub.name}</h3>
                <p style="font-size:0.85rem;color:${textColor};font-weight:600;white-space:nowrap;">${renewalText}</p>
            `;
            miniCard.addEventListener('click', () => viewDetails(sub.id));
            upcomingScroll.appendChild(miniCard);

        } else {
            const exp  = entry.data;
            const item = document.createElement('div');
            item.className = 'list-item';
            item.style.cursor = 'default';
            item.innerHTML = `
                <div class="list-item-left">
                    <div class="list-icon-wrapper" style="background:var(--surface-high);color:var(--on-surface-variant);">
                        <span class="material-symbols-outlined" style="font-size:20px;">receipt_long</span>
                    </div>
                    <div>
                        <div class="list-title">${exp.name}</div>
                        <div class="list-subtitle">${formatDate(exp.date)}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="list-price">₹${parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
            `;
            portfolioList.appendChild(item);
        }
    });

    if (mixedItems.length > 5) {
        const viewAll = document.createElement('div');
        viewAll.style.cssText = 'text-align:center;padding:12px 0 4px;';
        viewAll.innerHTML = `<a href="#" style="color:var(--primary);font-size:0.85rem;font-weight:600;text-decoration:none;">View all</a>`;
        viewAll.querySelector('a').addEventListener('click', e => {
            e.preventDefault();
            analyticsView = 'expenses';
            switchPage('analytics-page');
            document.querySelectorAll('.seg-pill').forEach(p => {
                p.classList.toggle('active', p.getAttribute('data-view') === 'expenses');
            });
        });
        portfolioList.appendChild(viewAll);
    }

    // Dashboard hero total
    const now = new Date();
    const thisMonthExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((sum, e) => sum + parseFloat(e.amount), 0);
    document.getElementById('total-spend').textContent = (totalMonthly + thisMonthExpenses).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Analytics monthly subs
    document.getElementById('ytd-spend').textContent = totalMonthly.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    renderAnalyticsView();
    renderInsights();
}

// --- Insights Engine ---
function renderInsights() {
    const card = document.getElementById('insights-content');
    if (!card) return;
    const now           = new Date();
    const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
    const totalMonthly  = subscriptions.reduce((s, sub) => s + getMonthlyCost(sub), 0);
    const totalYearly   = totalMonthly * 12;
    const subCount      = subscriptions.length;
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
    subscriptions.forEach(sub => {
        const anchor = sub.startDate || sub.dateAdded;
        const next   = getNextRenewalDate(anchor, sub.cycle);
        const diff   = Math.ceil((next - todayMidnight) / msDay);
        if (diff === 0) renewalsToday.push(sub);
        else if (diff >= 1 && diff <= 3) renewalsSoon.push({ sub, diffDays: diff });
    });
    const catTotals = {};
    subscriptions.forEach(sub => {
        const cid   = sub.category || 'unlisted';
        const cname = cid === 'unlisted' ? 'Unlisted' : (categories.find(c => c.id === cid)?.name || 'Unlisted');
        if (!catTotals[cid]) catTotals[cid] = { name: cname, total: 0, count: 0 };
        catTotals[cid].total += getMonthlyCost(sub);
        catTotals[cid].count++;
    });
    let oldestSub = null, oldestDays = 0;
    subscriptions.forEach(sub => {
        const days = Math.floor((now - new Date(sub.dateAdded)) / msDay);
        if (days > oldestDays) { oldestDays = days; oldestSub = sub; }
    });
    let nextRenewalDays = Infinity;
    subscriptions.forEach(sub => {
        const anchor = sub.startDate || sub.dateAdded;
        const diff   = Math.ceil((getNextRenewalDate(anchor, sub.cycle) - todayMidnight) / msDay);
        if (diff < nextRenewalDays) nextRenewalDays = diff;
    });
    const fmt = n => parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const candidates = [];

    if (subCount === 0 && manualExp.length === 0) {
        candidates.push({ score: 1000, solo: true, title: 'Broke or Just Shy?', text: "No transactions yet. Either you live off the grid or you forgot to add everything. We don't judge. Much." });
    }
    if (manualExp.length > 0 && subCount === 0) {
        candidates.push({ score: 900, solo: true, title: 'Spending Without Tracking', text: "You're logging one-time expenses but haven't added recurring subscriptions yet. Add them to see the real damage." });
    }
    if (renewalsToday.length > 0) {
        const total = renewalsToday.reduce((s, sub) => s + parseFloat(sub.price), 0);
        const score = 850 + (renewalsToday.length - 1) * 50;
        const text  = renewalsToday.length === 1
            ? `${renewalsToday[0].name} renews today. ₹${fmt(renewalsToday[0].price)} is already gone or going. Moment of silence.`
            : `${renewalsToday[0].name} renews today plus ${renewalsToday.length - 1} more renewal${renewalsToday.length > 2 ? 's' : ''} totaling ₹${fmt(total)}.`;
        candidates.push({ score, title: 'Money Leaving Right Now', text });
    }
    if (renewalsSoon.length > 0) {
        const soonest = renewalsSoon.sort((a,b) => a.diffDays - b.diffDays)[0];
        const score   = 700 + (3 - soonest.diffDays) * 50;
        candidates.push({ score, title: 'Renewal Incoming', text: `${soonest.sub.name} hits your wallet in ${soonest.diffDays} day${soonest.diffDays > 1 ? 's' : ''} — ₹${fmt(soonest.sub.price)}. Start mentally preparing.` });
    }
    if (subCount > 1 && totalMonthly > 0) {
        let domSub = null, domPct = 0;
        subscriptions.forEach(sub => { const pct = getMonthlyCost(sub) / totalMonthly * 100; if (pct > domPct) { domPct = pct; domSub = sub; } });
        if (domPct > 50) candidates.push({ score: domPct * 8, title: 'One Sub to Rule Them All', text: `${domSub.name} is ${Math.round(domPct)}% of your monthly spend. That's ₹${fmt(getMonthlyCost(domSub))} out of ₹${fmt(totalMonthly)}. At this point just marry it.` });
    }
    Object.values(catTotals).forEach(cat => {
        if (cat.count > 2) candidates.push({ score: 400 + cat.count * 30, title: 'Category Obsession', text: `You have ${cat.count} ${cat.name} subscriptions worth ₹${fmt(cat.total)} per month. We get it. You really love ${cat.name}.` });
    });
    if (oldestSub && oldestDays >= 365) {
        const months = Math.floor(oldestDays / 30);
        const totalPaid = getMonthlyCost(oldestSub) * months;
        candidates.push({ score: 350 + (oldestDays / 365) * 40, title: 'Loyalty or Laziness?', text: `You've had ${oldestSub.name} for ${months} months. Either you love it or forgot it exists. Estimated cost so far: ₹${fmt(totalPaid)}.` });
    }
    if (subCount > 4) candidates.push({ score: subCount * 45, title: 'Subscription Hoarder', text: `You have ${subCount} active subscriptions burning ₹${fmt(totalMonthly)}/mo. The average person uses about 3 actively. Think about that.` });
    if (totalMonthly > 3000) candidates.push({ score: (totalMonthly / 1000) * 60, title: 'Big Spender Energy', text: `You're spending ₹${fmt(totalMonthly)}/mo. That's ₹${fmt(totalYearly)}/year. That's ${(totalYearly / 6000).toFixed(1)} months of rent. Or ${Math.round(totalYearly / 250)} plates of biryani. Your call.` });
    if (totalYearly > 10000) candidates.push({ score: (totalYearly / 5000) * 40, title: 'Annual Reality Check', text: `You're on track for ₹${fmt(totalYearly)} this year. Breaking it down: ₹${fmt(totalMonthly)}/mo, ₹${fmt(totalMonthly*12/52)}/week, ₹${fmt(totalMonthly*12/365)}/day. Every. Single. Day.` });
    if (subCount === 1) candidates.push({ score: 200, title: 'Baby Steps', text: "One subscription tracked. Either you're a minimalist legend or this is just the beginning of a very expensive list." });
    if (subCount > 0) {
        const nrDays = nextRenewalDays === Infinity ? 'N/A' : `${nextRenewalDays} day${nextRenewalDays !== 1 ? 's' : ''}`;
        candidates.push({ score: 100, title: 'Looking Clean 👀', text: `Spending looks controlled. ${subCount} subscription${subCount !== 1 ? 's' : ''}, ₹${fmt(totalMonthly)}/mo, next renewal in ${nrDays}. Either you're disciplined or haven't added everything yet.` });
    }
    if (lastWeekTotal > 0 && thisWeekTotal > lastWeekTotal * 2) {
        const ratio = thisWeekTotal / lastWeekTotal;
        candidates.push({ score: ratio * 200, title: 'Spending Spike Detected', text: `Your one-time expenses this week are ${ratio.toFixed(1)}x higher than last week. ₹${fmt(thisWeekTotal)} vs ₹${fmt(lastWeekTotal)}. Something happened. We're not asking questions.` });
    }
    if (totalMonthly > 0) {
        let leakCat = null, leakPct = 0;
        Object.values(catTotals).forEach(cat => { const pct = cat.total / totalMonthly * 100; if (pct > leakPct) { leakPct = pct; leakCat = cat; } });
        if (leakCat && leakPct > 40) candidates.push({ score: 450, title: `${leakCat.name} is Draining You`, text: `Your ${leakCat.name} subscriptions alone cost ₹${fmt(leakCat.total)}/mo — ${Math.round(leakPct)}% of your total. Consider if you need all ${leakCat.count} of them.` });
    }
    if (thisWeekExps.length > 3) {
        const dailyAvg = thisWeekTotal / 7;
        candidates.push({ score: 380, title: 'Daily Spending Habit', text: `You've logged ${thisWeekExps.length} expenses this week averaging ₹${fmt(dailyAvg)}/day. At this pace that's ₹${fmt(dailyAvg * 30)} extra this month.` });
    }
    const combinedBurn = totalMonthly + thisMonthExpTotal;
    if (combinedBurn > 8000) candidates.push({ score: (combinedBurn / 500) * 60, title: 'Total Burn Rate', text: `This month: ₹${fmt(thisMonthExpTotal)} one-time + ₹${fmt(totalMonthly)} subscriptions = ₹${fmt(combinedBurn)} combined. That's your real monthly spend.` });

    candidates.sort((a, b) => b.score - a.score);
    let shown = [];
    if (candidates.length === 0) { shown = []; }
    else if (candidates[0].solo) { shown = [candidates[0]]; }
    else {
        const meaningful = candidates.filter(c => c.score > 300);
        shown = (meaningful.length > 0 ? meaningful : candidates).slice(0, 3);
    }

    if (shown.length === 0) {
        card.innerHTML = '<h3 style="margin:0 0 6px;">All Quiet</h3><p style="color:rgba(255,255,255,0.8);font-size:0.875rem;margin:0;">Nothing to flag yet. Add subscriptions and expenses to get personalised insights.</p>';
        return;
    }

    card.innerHTML = shown.map((insight, i) => `
        <div style="${i > 0 ? 'border-top:1px solid rgba(255,255,255,0.1);padding-top:14px;margin-top:14px;' : ''}">
            <h3 style="font-size:1.1rem;line-height:1.3;margin-bottom:6px;position:relative;z-index:2;">${insight.title}</h3>
            <p style="color:rgba(255,255,255,0.8);font-size:0.875rem;line-height:1.5;margin:0;position:relative;z-index:2;">${insight.text}</p>
        </div>
    `).join('');
}

// --- Category Management ---
document.getElementById('add-category-btn').addEventListener('click', () => {
    addCategory(document.getElementById('add-category-input').value);
});

document.getElementById('toggle-manage-categories-btn')?.addEventListener('click', () => {
    const content = document.getElementById('manage-categories-content');
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
});

function renderAnalytics() {
    const container = document.getElementById('category-groups-container');
    container.innerHTML = '';
    const groups = { unlisted: { name: 'Unlisted', subs: [] } };
    categories.forEach(c => groups[c.id] = { name: c.name, subs: [] });
    subscriptions.forEach(sub => {
        const cat = sub.category || 'unlisted';
        (groups[cat] || groups['unlisted']).subs.push(sub);
    });
    const hasCategories = categories.length > 0;
    const createGroup = (id, name, subs, showHeading) => {
        const groupEl = document.createElement('div');
        groupEl.style.marginBottom = '20px';
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
        listEl.className = 'cat-list';
        listEl.dataset.categoryId = id;
        if (showHeading) listEl.style.display = 'none';
        listEl.style.cssText += 'min-height:50px;padding:10px 0;border-radius:var(--radius-md);transition:background 0.2s;';
        listEl.addEventListener('dragover', e => {
            e.preventDefault();
            listEl.style.background = 'var(--surface)';
            listEl.style.border = '1px dashed var(--primary)';
        });
        listEl.addEventListener('dragleave', () => {
            listEl.style.background = 'transparent';
            listEl.style.border = 'none';
        });
        listEl.addEventListener('drop', e => {
            e.preventDefault();
            listEl.style.background = 'transparent';
            listEl.style.border = 'none';
            const draggedId = e.dataTransfer.getData('text/plain');
            const sub = subscriptions.find(s => s.id === draggedId);
            if (sub && sub.category !== id) {
                sub.category = id;
                saveState();
                renderAnalytics();
            }
        });
        if (subs.length === 0 && showHeading) {
            listEl.innerHTML = '<p style="color:var(--on-surface-variant);font-size:0.8rem;text-align:center;padding:10px;">Drag subscriptions here</p>';
        }
        subs.forEach(sub => {
            const color    = colorFromName(sub.name);
            const today    = new Date(); today.setHours(0,0,0,0);
            const anchor   = sub.startDate || sub.dateAdded;
            const renDate  = getNextRenewalDate(anchor, sub.cycle);
            const diffDays = Math.ceil((renDate - today) / (1000 * 60 * 60 * 24));
            const renewalText = diffDays > 0 ? `Renews in ${diffDays} day${diffDays > 1 ? 's' : ''}` : 'Renews today';
            const textColor   = diffDays <= 3 ? 'var(--error)' : 'var(--primary)';
            const item = document.createElement('div');
            item.className = 'list-item';
            item.draggable = true;
            item.style.cssText = 'cursor:grab;margin-bottom:8px;background:var(--surface-high);';
            item.innerHTML = `
                <div class="list-item-left">
                    <div class="list-icon-wrapper" style="background:${color}20;color:${color};font-size:20px;width:40px;height:40px;">
                        ${sub.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="list-title" style="font-size:0.95rem;">${sub.name}</div>
                        <div class="list-subtitle" style="color:${textColor};font-weight:600;">${renewalText}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="list-price" style="font-size:1.1rem;">₹${parseFloat(sub.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
            `;
            item.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', sub.id));
            listEl.appendChild(item);
        });
        groupEl.appendChild(listEl);
        container.appendChild(groupEl);
    };
    if (!hasCategories) {
        createGroup('unlisted', 'Unlisted', groups['unlisted'].subs, false);
    } else {
        for (const [id, grp] of Object.entries(groups)) {
            if (id !== 'unlisted') createGroup(id, grp.name, grp.subs, true);
        }
        createGroup('unlisted', 'Unlisted', groups['unlisted'].subs, true);
    }
    renderCategoryManager();
}

window.deleteCategory = function (id) {
    if (confirm('Delete category? Subscriptions will be moved to Unlisted.')) {
        categories = categories.filter(c => c.id !== id);
        subscriptions.forEach(sub => { if (sub.category === id) sub.category = 'unlisted'; });
        saveState();
        renderAnalytics();
    }
};

function renderCategoryManager() {
    const activeChips = document.getElementById('active-category-chips');
    const presetChips = document.getElementById('preset-category-chips');
    activeChips.innerHTML = '';
    presetChips.innerHTML = '';
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
        chip.onclick = () => addCategory(preset);
        presetChips.appendChild(chip);
    });
    if (categories.length === 0) activeChips.innerHTML = '<div style="color:var(--on-surface-variant);font-size:0.8rem;">No categories yet</div>';
}

function addCategory(name) {
    name = name.trim();
    if (!name || categories.find(c => c.name.toLowerCase() === name.toLowerCase())) return;
    categories.push({ id: 'cat_' + Date.now(), name });
    saveState();
    document.getElementById('add-category-input').value = '';
    renderAnalytics();
}

// --- Initial Load ---
renderApp();
renderProfilePage();

// --- Swipe Navigation ---
(function () {
    const swipePageOrder = ['dashboard-page', 'analytics-page', 'profile-page'];
    const container = document.querySelector('.container');
    let touchStartX = 0, touchStartY = 0, touchStartedInScroll = false;
    container.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartedInScroll = !!e.target.closest('.horizontal-scroll');
    }, { passive: true });
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

// --- Calendar ---
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelectedDate = null;

function buildRenewalMap(year, month) {
    const map = {};
    const monthStart = new Date(year, month, 1);
    const monthEnd   = new Date(year, month + 1, 0);
    subscriptions.forEach(sub => {
        const anchor = sub.startDate || sub.dateAdded;
        const start  = new Date(anchor);
        start.setHours(0, 0, 0, 0);
        let cursor = new Date(start);
        if (sub.cycle === 'Yearly') {
            while (cursor < monthStart) cursor.setFullYear(cursor.getFullYear() + 1);
        } else {
            const inc = sub.cycle === 'Monthly' ? 30 : parseInt(sub.cycle);
            while (cursor < monthStart) cursor.setDate(cursor.getDate() + inc);
        }
        while (cursor <= monthEnd) {
            const key = cursor.toISOString().split('T')[0];
            if (!map[key]) map[key] = [];
            map[key].push(sub);
            cursor = new Date(cursor);
            if (sub.cycle === 'Yearly') cursor.setFullYear(cursor.getFullYear() + 1);
            else { const inc = sub.cycle === 'Monthly' ? 30 : parseInt(sub.cycle); cursor.setDate(cursor.getDate() + inc); }
        }
    });
    return map;
}

function renderCalendar() {
    const monthLabel = document.getElementById('cal-month-label');
    const grid       = document.getElementById('cal-grid');
    const detail     = document.getElementById('cal-detail');
    if (!monthLabel || !grid || !detail) return;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthLabel.textContent = `${monthNames[calMonth]} ${calYear}`;
    grid.innerHTML = '';
    detail.style.display = 'none';
    calSelectedDate = null;
    const renewalMap  = buildRenewalMap(calYear, calMonth);
    const firstDay    = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevDays    = new Date(calYear, calMonth, 0).getDate();
    const today       = new Date(); today.setHours(0,0,0,0);
    const expenseMap  = {};
    expenses.forEach(exp => {
        const d = new Date(exp.date);
        if (d.getMonth() === calMonth && d.getFullYear() === calYear) {
            const key = exp.date.split('T')[0];
            expenseMap[key] = (expenseMap[key] || 0) + parseFloat(exp.amount);
        }
    });
    function heatBg(spend) {
        if (spend <= 0) return null;
        const t = Math.min(spend / 1000, 1);
        return `rgba(105,106,219,${(0.08 + t * 0.67).toFixed(2)})`;
    }
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell other-month';
        cell.innerHTML = `<div class="cal-date">${prevDays - firstDay + 1 + i}</div>`;
        grid.appendChild(cell);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj   = new Date(calYear, calMonth, d);
        const key       = dateObj.toISOString().split('T')[0];
        const subs      = renewalMap[key] || [];
        const dayExpAmt = expenseMap[key] || 0;
        const totalSpend = subs.reduce((s, sub) => s + parseFloat(sub.price), 0) + dayExpAmt;
        const isToday   = dateObj.getTime() === today.getTime();
        const hasAny    = subs.length > 0 || dayExpAmt > 0;
        const cell = document.createElement('div');
        cell.className = 'cal-cell' + (hasAny ? ' has-events' : '') + (isToday ? ' today' : '');
        const heat = heatBg(totalSpend);
        if (heat) cell.style.background = heat;
        const dateEl = document.createElement('div');
        dateEl.className = 'cal-date';
        dateEl.textContent = d;
        cell.appendChild(dateEl);
        if (subs.length) {
            const dotsEl = document.createElement('div');
            dotsEl.className = 'cal-dots';
            subs.slice(0, 3).forEach(sub => {
                const dot = document.createElement('div');
                dot.className = 'cal-dot';
                dot.style.background = colorFromName(sub.name);
                dotsEl.appendChild(dot);
            });
            cell.appendChild(dotsEl);
        }
        if (hasAny) {
            cell.addEventListener('click', () => {
                if (calSelectedDate === key) {
                    calSelectedDate = null;
                    grid.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
                    detail.style.display = 'none';
                    return;
                }
                calSelectedDate = key;
                grid.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                renderCalendarDetail(key, subs);
            });
        }
        grid.appendChild(cell);
    }
    const trailing = (firstDay + daysInMonth) % 7;
    if (trailing > 0) {
        for (let i = 1; i <= 7 - trailing; i++) {
            const cell = document.createElement('div');
            cell.className = 'cal-cell other-month';
            cell.innerHTML = `<div class="cal-date">${i}</div>`;
            grid.appendChild(cell);
        }
    }
}

function renderCalendarDetail(dateKey, subs) {
    const detail  = document.getElementById('cal-detail');
    const d       = new Date(dateKey);
    const label   = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    const fmt     = n => parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dayExps = expenses.filter(e => e.date.split('T')[0] === dateKey);
    let html = `<div class="cal-detail-date">${label}</div>`;
    subs.forEach(sub => {
        const color = colorFromName(sub.name);
        html += `<div class="cal-detail-item">
            <div class="cal-detail-left">
                <div class="cal-detail-icon" style="background:${color}20;color:${color};">${sub.name.charAt(0).toUpperCase()}</div>
                <div><div class="cal-detail-name">${sub.name}</div><div class="cal-detail-cycle">${formatCycle(sub.cycle)} renewal</div></div>
            </div>
            <div class="cal-detail-price">₹${fmt(sub.price)}</div>
        </div>`;
    });
    if (dayExps.length) {
        if (subs.length) html += `<div style="border-top:1px solid var(--surface);margin:8px 0 6px;"></div><div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--on-surface-variant);margin-bottom:6px;">One-time expenses</div>`;
        dayExps.forEach(exp => {
            html += `<div class="cal-detail-item">
                <div class="cal-detail-left">
                    <div class="cal-detail-icon" style="background:var(--surface-high);color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:16px;">receipt_long</span></div>
                    <div><div class="cal-detail-name">${exp.name}</div><div class="cal-detail-cycle">One-time expense</div></div>
                </div>
                <div class="cal-detail-price">₹${fmt(exp.amount)}</div>
            </div>`;
        });
    }
    if (subs.length && dayExps.length) {
        const subTotal = subs.reduce((s, sub) => s + parseFloat(sub.price), 0);
        const expTotal = dayExps.reduce((s, e) => s + parseFloat(e.amount), 0);
        html += `<div style="border-top:1px solid var(--surface);margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:0.75rem;color:var(--on-surface-variant);font-weight:600;">Total today</div>
            <div style="font-size:1rem;font-weight:800;color:var(--primary);">₹${fmt(subTotal + expTotal)}</div>
        </div>`;
    }
    detail.innerHTML = html;
    detail.style.display = 'block';
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
});

document.getElementById('cal-back-btn').addEventListener('click', e => {
    e.preventDefault();
    switchPage('dashboard-page');
});

document.getElementById('calendar-link').addEventListener('click', e => {
    e.preventDefault();
    switchPage('calendar-page');
});
