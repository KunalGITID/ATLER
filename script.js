const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

// --- Global State ---
let profile = JSON.parse(localStorage.getItem('atelier_profile')) || {
    name: 'Atler',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'
};

let subscriptions = JSON.parse(localStorage.getItem('atelier_subscriptions')) || [];
let categories    = JSON.parse(localStorage.getItem('atelier_categories'))    || [];
let expenses      = JSON.parse(localStorage.getItem('atelier_expenses'))      || [];

let activeSubId = null;

// Which analytics tab is active
let analyticsView = 'subscriptions'; // 'subscriptions' | 'expenses'

const presetCategories = ['Entertainment', 'Productivity', 'Utilities', 'Health', 'Food', 'Education'];

// Backwards-compatibility migration
subscriptions.forEach(sub => {
    if (!sub.category) sub.category = 'unlisted';
});

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
        while (next <= today) {
            next.setFullYear(next.getFullYear() + 1);
        }
    } else {
        const incDays = cycle === 'Monthly' ? 30 : parseInt(cycle);
        while (next <= today) {
            next.setDate(next.getDate() + incDays);
        }
    }
    return next;
}

// Returns the most-recently-passed renewal date (the last time it was due)
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

// Unique deterministic color from name string
function colorFromName(name) {
    const palette = ['#1db954', '#e50914', '#c0c1ff', '#4edea3', '#ffb4ab', '#4b4dd8', '#f59e0b', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
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

        // lastRenewal is the most recent due date (in the past or today)
        // Only log if it's a real past date (not in the future)
        if (lastRenewal > today) return;

        const lastRenewalISO = lastRenewal.toISOString().split('T')[0];

        // Skip if already logged for this renewal cycle
        if (sub.lastLoggedRenewal === lastRenewalISO) return;

        // Check: sub must have existed before or on this renewal date
        const subAddedDate = new Date(sub.dateAdded);
        subAddedDate.setHours(0, 0, 0, 0);
        if (lastRenewal < subAddedDate) return;

        // Create the auto expense
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
    document.getElementById('detail-name').textContent         = sub.name;
    document.getElementById('detail-cycle').textContent        = formatCycle(sub.cycle) + ' Plan';
    document.getElementById('detail-price').textContent        = parseFloat(sub.price).toFixed(2);
    document.getElementById('detail-date').textContent         = formatDate(sub.dateAdded);
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

// --- Profile ---
const profileForm  = document.getElementById('profile-form');
const nameInput    = document.getElementById('profile-name');
const avatarInput  = document.getElementById('profile-avatar');

profileForm.addEventListener('submit', e => {
    e.preventDefault();
    profile.name   = nameInput.value.trim()  || 'User';
    profile.avatar = avatarInput.value.trim() || profile.avatar;
    saveState();
    renderApp();
    switchPage('dashboard-page');
});

// --- Add Subscription Form ---
const addForm        = document.getElementById('add-form');
const cycleSelect    = document.getElementById('add-cycle');
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
    const startDate   = document.getElementById('add-start-date').value;
    const customDays  = document.getElementById('add-custom-days').value;

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
    // mode: 'subscription' | 'expense'
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

// Drag-to-dismiss on handle
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

// --- Analytics Segmented Toggle ---
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

    // Total of ALL expenses ever recorded
    const allExpensesTotal = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    document.getElementById('expenses-month-total-val').textContent = allExpensesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (expenses.length === 0) {
        container.innerHTML = `<div class="expenses-empty">No expenses logged yet.<br>Tap (+) to add one.</div>`;
        return;
    }

    // Sort newest first
    const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group by date label
    const todayStr     = todayISO();
    const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })();

    function dateLabel(iso) {
        if (iso === todayStr)     return 'Today';
        if (iso === yesterdayStr) return 'Yesterday';
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    // Build groups: [{label, date, items:[]}]
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
        // Day label
        const dayLabel = document.createElement('div');
        dayLabel.className = 'exp-day-label';
        dayLabel.textContent = group.label;
        container.appendChild(dayLabel);

        // Rows
        group.items.forEach(exp => {
            const row = document.createElement('div');
            row.className = 'exp-row';
            row.innerHTML = `
                <span class="exp-name">${exp.name}</span>
                <span class="exp-amount">₹${parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            `;
            container.appendChild(row);
        });

        // Divider between groups (not after last)
        if (gi < groups.length - 1) {
            const div = document.createElement('div');
            div.className = 'exp-divider';
            container.appendChild(div);
        }
    });
}

// --- Render Core App ---
function renderApp() {
    // Auto-log renewals on every render
    autoLogRenewals();

    // Profile
    document.getElementById('user-display-name').textContent = profile.name;
    document.getElementById('user-avatar-img').src           = profile.avatar;
    nameInput.value   = profile.name;
    avatarInput.value = profile.avatar;

    let totalMonthly = 0;
    subscriptions.forEach(sub => { totalMonthly += getMonthlyCost(sub); });

    const portfolioList  = document.getElementById('portfolio-list');
    const upcomingScroll = document.getElementById('upcoming-scroll');
    portfolioList.innerHTML  = '';
    upcomingScroll.innerHTML = '';

    if (subscriptions.length === 0 && expenses.filter(e => e.type === 'manual').length === 0) {
        portfolioList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--on-surface-variant); font-size: 0.9rem; background: var(--surface-low); border-radius: var(--radius-md);">No entries yet. Tap (+) to add.</div>';
    } else {
        document.getElementById('spend-trend').style.display = 'inline-flex';
    }

    // Build mixed list: subscriptions + manual expenses, sorted by date descending
    const subItems = subscriptions.map(sub => ({
        _type: 'sub',
        _sortDate: new Date(sub.startDate || sub.dateAdded),
        data: sub
    }));
    const expItems = expenses
        .filter(e => e.type === 'manual')
        .map(exp => ({
            _type: 'exp',
            _sortDate: new Date(exp.date),
            data: exp
        }));
    const mixedItems = [...subItems, ...expItems]
        .sort((a, b) => b._sortDate - a._sortDate);

    // Show only the 5 most recent items in The Money Pit
    const visibleItems = mixedItems.slice(0, 5);

    visibleItems.forEach(entry => {
        if (entry._type === 'sub') {
            const sub = entry.data;
            const color = colorFromName(sub.name);

            const item = document.createElement('div');
            item.className = 'list-item';
            item.style.cursor = 'pointer';
            item.innerHTML = `
                <div class="list-item-left">
                    <div class="list-icon-wrapper" style="background: ${color}20; color: ${color}; font-size: 24px;">
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

            // Upcoming mini card (subscriptions only)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const anchor  = sub.startDate || sub.dateAdded;
            const renDate = getNextRenewalDate(anchor, sub.cycle);
            const diffDays = Math.ceil((renDate - today) / (1000 * 60 * 60 * 24));

            let renewalText = 'N/A';
            if (diffDays > 0)        renewalText = `Renews in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
            else if (diffDays === 0)  renewalText = 'Renews today';
            const textColor = diffDays <= 3 ? 'var(--error)' : 'var(--primary)';

            const miniCard = document.createElement('div');
            miniCard.className = 'card-mini';
            miniCard.innerHTML = `
                <div class="card-icon" style="background: ${color}20; color: ${color};">
                    <span class="material-symbols-outlined">payments</span>
                </div>
                <h3>${sub.name}</h3>
                <p style="font-size: 0.85rem; color: ${textColor}; font-weight: 600; white-space: nowrap;">${renewalText}</p>
            `;
            miniCard.addEventListener('click', () => viewDetails(sub.id));
            upcomingScroll.appendChild(miniCard);

        } else {
            // One-time expense row — receipt icon, no abort button
            const exp = entry.data;
            const item = document.createElement('div');
            item.className = 'list-item';
            item.style.cursor = 'default';
            item.innerHTML = `
                <div class="list-item-left">
                    <div class="list-icon-wrapper" style="background: var(--surface-high); color: var(--on-surface-variant); font-size: 20px;">
                        <span class="material-symbols-outlined" style="font-size: 20px;">receipt_long</span>
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

    // View all link — only shown when there are more than 5 items
    if (mixedItems.length > 5) {
        const viewAll = document.createElement('div');
        viewAll.style.cssText = 'text-align: center; padding: 12px 0 4px;';
        viewAll.innerHTML = `<a href="#" style="color: var(--primary); font-size: 0.85rem; font-weight: 600; text-decoration: none;">View all</a>`;
        viewAll.querySelector('a').addEventListener('click', e => {
            e.preventDefault();
            analyticsView = 'expenses';
            switchPage('analytics-page');
            // Sync the toggle pill state
            document.querySelectorAll('.seg-pill').forEach(p => {
                p.classList.toggle('active', p.getAttribute('data-view') === 'expenses');
            });
        });
        portfolioList.appendChild(viewAll);
    }

    // Dashboard hero: subscriptions + this month's one-time expenses
    const now = new Date();
    const thisMonthExpenses = expenses
        .filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    document.getElementById('total-spend').textContent = (totalMonthly + thisMonthExpenses).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Analytics subscriptions view: monthly subscriptions only
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    document.getElementById('ytd-spend').textContent = totalMonthly.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    renderAnalyticsView();
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
            const color = colorFromName(sub.name);
            const today = new Date(); today.setHours(0,0,0,0);
            const anchor = sub.startDate || sub.dateAdded;
            const renDate = getNextRenewalDate(anchor, sub.cycle);
            const diffDays = Math.ceil((renDate - today) / (1000 * 60 * 60 * 24));
            const renewalText = diffDays > 0 ? `Renews in ${diffDays} day${diffDays > 1 ? 's' : ''}` : diffDays === 0 ? 'Renews today' : 'N/A';
            const textColor = diffDays <= 3 ? 'var(--error)' : 'var(--primary)';

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

    if (categories.length === 0) {
        activeChips.innerHTML = '<div style="color:var(--on-surface-variant);font-size:0.8rem;">No categories yet</div>';
    }
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
        if (currentId === 'details-page') return;
        const idx = swipePageOrder.indexOf(currentId);
        if (idx === -1) return;

        const nextIdx = deltaX < 0 ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= swipePageOrder.length) return;
        switchPage(swipePageOrder[nextIdx]);
    }, { passive: true });
})();
