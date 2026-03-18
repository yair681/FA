// ===== App Router & UI =====

// ── Router ────────────────────────────────────────────────────────────────────
function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const el = document.getElementById('page-' + page);
    if (el) el.style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (navLink) navLink.classList.add('active');
    if (page === 'dashboard') loadDashboard();
    else if (page === 'meetings') loadMyMeetings();
    else if (page === 'settings') loadAccountSettings();
    else if (page === 'admin') loadAdminPage();
}

function detectRoute() {
    const path = window.location.pathname;
    const joinMatch = path.match(/^\/join\/(.+)$/);
    if (joinMatch) {
        showJoinPage(joinMatch[1]);
        return true;
    }
    return false;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function showAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    document.querySelector(`.auth-tab[data-tab="${tab}"]`)?.classList.add('active');
    const form = document.getElementById('form-' + tab);
    if (form) form.style.display = 'block';
    const errEl = document.getElementById('auth-error');
    if (errEl) errEl.textContent = '';
}

async function onAuthSuccess() {
    document.getElementById('page-auth').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    const user = window.authManager.currentUser;
    const nameEl = document.getElementById('header-username');
    if (nameEl) nameEl.textContent = user.name;

    const adminNav = document.getElementById('nav-admin');
    if (adminNav) adminNav.style.display = user.role === 'admin' ? '' : 'none';

    window.zoomManager.init(user.name, user.id, user.role);
    navigate('dashboard');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function loadDashboard() {
    window.zoomManager.loadRoomsList();
    apiFetch('/api/admin/settings').then(s => {
        window.zoomManager.applyCreatePermission({ locked: s.lockMeetingCreation });
    }).catch(() => {});
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'flex';
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
}

// ── Meeting creation ──────────────────────────────────────────────────────────
async function startInstantMeeting() {
    const user = window.authManager.currentUser;
    try {
        const meeting = await createMeeting(user.name + ' - שיחה מיידית', 'instant', null, {});
        closeModal('modal-instant');
        navigate('dashboard');
        await window.zoomManager.joinRoom(meeting.roomId, meeting.title, true, 'instant');
    } catch(e) {
        showToast('שגיאה ביצירת שיחה: ' + e.message);
    }
}

async function createScheduledMeeting() {
    const title = document.getElementById('sched-title')?.value.trim();
    const dateVal = document.getElementById('sched-date')?.value;
    const timeVal = document.getElementById('sched-time')?.value;
    if (!title || !dateVal || !timeVal) { showToast('יש למלא את כל השדות'); return; }
    const scheduledAt = new Date(dateVal + 'T' + timeVal).toISOString();
    try {
        await createMeeting(title, 'scheduled', scheduledAt, {});
        closeModal('modal-schedule');
        showToast('הפגישה נוצרה בהצלחה!');
        if (document.getElementById('page-meetings')?.style.display !== 'none') loadMyMeetings();
    } catch(e) {
        showToast('שגיאה ביצירת פגישה: ' + e.message);
    }
}

async function createPermanentMeeting() {
    const title = document.getElementById('perm-title')?.value.trim();
    if (!title) { showToast('יש להזין שם לפגישה'); return; }
    const requireApproval = document.getElementById('perm-require-approval')?.checked || false;
    const allowEntryBefore = document.getElementById('perm-allow-entry-before')?.checked || false;
    try {
        await createMeeting(title, 'permanent', null, { requireApproval, allowEntryBeforeHost: allowEntryBefore });
        closeModal('modal-permanent');
        showToast('פגישה קבועה נוצרה!');
        if (document.getElementById('page-meetings')?.style.display !== 'none') loadMyMeetings();
    } catch(e) {
        showToast('שגיאה ביצירת פגישה: ' + e.message);
    }
}

// ── My Meetings ───────────────────────────────────────────────────────────────
async function loadMyMeetings() {
    const list = document.getElementById('my-meetings-list');
    if (!list) return;
    list.innerHTML = '<p style="color:var(--gray)">טוען...</p>';
    try {
        const meetings = await getMyMeetings();
        const permanent = meetings.filter(m => m.type === 'permanent');
        const scheduled = meetings.filter(m => m.type === 'scheduled');
        const instant   = meetings.filter(m => m.type === 'instant');
        let html = '';
        if (permanent.length) {
            html += '<h3 class="meetings-section-title"><i class="fas fa-infinity"></i> פגישות קבועות</h3>';
            html += permanent.map(renderMeetingCard).join('');
        }
        if (scheduled.length) {
            html += '<h3 class="meetings-section-title"><i class="fas fa-calendar"></i> פגישות מתוזמנות</h3>';
            html += scheduled.map(renderMeetingCard).join('');
        }
        if (instant.length) {
            html += '<h3 class="meetings-section-title"><i class="fas fa-bolt"></i> שיחות מיידיות</h3>';
            html += instant.map(renderMeetingCard).join('');
        }
        if (!meetings.length) html = '<p class="empty-state"><i class="fas fa-video-slash"></i><br>אין פגישות עדיין</p>';
        list.innerHTML = html;
    } catch(e) {
        list.innerHTML = '<p style="color:var(--danger)">שגיאה בטעינת פגישות</p>';
    }
}

function renderMeetingCard(m) {
    const dateStr = m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('he-IL') : '';
    const typeLabel = { instant: 'מיידי', scheduled: 'מתוזמן', permanent: 'קבוע' }[m.type] || m.type;
    const typeIcon  = { instant: 'bolt',  scheduled: 'calendar', permanent: 'infinity' }[m.type] || 'video';
    return `<div class="meeting-card">
        <div class="meeting-card-header">
            <span class="meeting-type-badge ${m.type}"><i class="fas fa-${typeIcon}"></i> ${typeLabel}</span>
            <span class="meeting-card-title">${m.title}</span>
        </div>
        ${dateStr ? `<div class="meeting-card-date"><i class="fas fa-clock"></i> ${dateStr}</div>` : ''}
        <div class="meeting-card-link">
            <input type="text" readonly value="${window.location.origin}/join/${m.roomId}" class="form-control" style="font-size:0.8rem;">
            <button class="btn btn-sm btn-secondary" onclick="copyText('${window.location.origin}/join/${m.roomId}')"><i class="fas fa-copy"></i></button>
        </div>
        <div class="meeting-card-actions">
            <button class="btn btn-primary btn-sm" onclick="joinMyMeeting('${m.roomId}','${m.title.replace(/'/g,"\\'")}')">
                <i class="fas fa-video"></i> הצטרף
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteMyMeeting('${m._id}')">
                <i class="fas fa-trash"></i> מחק
            </button>
        </div>
    </div>`;
}

async function joinMyMeeting(roomId, title) {
    navigate('dashboard');
    await window.zoomManager.joinRoom(roomId, title, true, 'permanent');
}

async function deleteMyMeeting(id) {
    if (!confirm('למחוק פגישה זו?')) return;
    try {
        await deleteMeeting(id);
        loadMyMeetings();
        showToast('הפגישה נמחקה');
    } catch(e) {
        showToast('שגיאה במחיקה: ' + e.message);
    }
}

function copyMeetingLink() {
    const linkEl = document.getElementById('zoom-room-link');
    if (linkEl) copyText(linkEl.value);
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => showToast('הקישור הועתק!')).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        showToast('הקישור הועתק!');
    });
}

// ── Join Page (for /join/:roomId links) ───────────────────────────────────────
async function showJoinPage(roomId) {
    document.getElementById('page-auth') && (document.getElementById('page-auth').style.display = 'none');
    document.getElementById('app') && (document.getElementById('app').style.display = 'none');
    const joinPage = document.getElementById('page-join');
    if (joinPage) joinPage.style.display = 'flex';
    try {
        const meeting = await getMeetingByRoom(roomId);
        const titleEl = document.getElementById('join-meeting-title');
        if (titleEl) titleEl.textContent = meeting.title || 'פגישה';
    } catch(e) {}
    window._joinRoomId = roomId;
}

async function proceedJoin() {
    const roomId = window._joinRoomId;
    if (!roomId) return;

    if (window.authManager.isLoggedIn()) {
        const user = window.authManager.currentUser;
        document.getElementById('page-join').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        window.zoomManager.init(user.name, user.id, user.role);
        navigate('dashboard');
        await window.zoomManager.requestJoin(roomId);
        return;
    }

    const nameInput = document.getElementById('join-guest-name');
    const guestName = nameInput?.value.trim();
    if (!guestName) { showToast('יש להזין שם'); return; }

    document.getElementById('page-join').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    const guestId = 'guest-' + Date.now();
    const nameEl = document.getElementById('header-username');
    if (nameEl) nameEl.textContent = guestName;
    document.querySelectorAll('.nav-link:not([data-page="dashboard"])').forEach(el => el.style.display = 'none');

    window.zoomManager.init(guestName, guestId, 'guest');
    navigate('dashboard');
    await window.zoomManager.requestJoin(roomId);
}

// ── Account Settings ──────────────────────────────────────────────────────────
function loadAccountSettings() {
    const user = window.authManager.currentUser;
    if (!user) return;
    const nameInput = document.getElementById('settings-name');
    if (nameInput) nameInput.value = user.name;
    const emailEl = document.getElementById('settings-email');
    if (emailEl) emailEl.textContent = user.email;
}

async function saveName() {
    const newName = document.getElementById('settings-name')?.value.trim();
    if (!newName) { showToast('יש להזין שם'); return; }
    try {
        await window.authManager.updateProfile({ name: newName });
        showToast('השם עודכן בהצלחה!');
    } catch(e) { showToast('שגיאה: ' + e.message); }
}

async function savePassword() {
    const current = document.getElementById('settings-current-password')?.value;
    const newPass  = document.getElementById('settings-new-password')?.value;
    const confirm  = document.getElementById('settings-confirm-password')?.value;
    if (!current || !newPass || !confirm) { showToast('יש למלא את כל השדות'); return; }
    if (newPass !== confirm) { showToast('הסיסמאות אינן תואמות'); return; }
    if (newPass.length < 6) { showToast('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
    try {
        await window.authManager.updateProfile({ currentPassword: current, newPassword: newPass });
        showToast('הסיסמה עודכנה בהצלחה!');
        ['settings-current-password','settings-new-password','settings-confirm-password']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    } catch(e) { showToast('שגיאה: ' + e.message); }
}

async function deleteAccount() {
    if (!confirm('האם אתה בטוח שברצונך למחוק את חשבונך? פעולה זו בלתי הפיכה.')) return;
    try {
        await window.authManager.deleteAccount();
    } catch(e) { showToast('שגיאה: ' + e.message); }
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
function loadAdminPage() { showAdminTab('users'); }

function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));
    const content = document.getElementById('admin-tab-' + tab);
    if (content) content.style.display = 'block';
    const btn = document.querySelector(`.admin-tab-btn[data-tab="${tab}"]`);
    if (btn) btn.classList.add('active');
    if (tab === 'users') loadAdminUsers();
    else if (tab === 'meetings') loadAdminMeetings();
    else if (tab === 'settings') loadAdminSettings();
}

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray)">טוען...</td></tr>';
    try {
        const users = await apiFetch('/api/admin/users');
        if (!users.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">אין משתמשים</td></tr>'; return; }
        tbody.innerHTML = users.map(u => `<tr>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td><span class="role-badge ${u.role}">${u.role === 'admin' ? 'מנהל' : 'משתמש'}</span></td>
            <td>${new Date(u.createdAt).toLocaleDateString('he-IL')}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="openEditUser('${u._id}','${u.name.replace(/'/g,"\\'")}','${u.email}','${u.role}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="adminDeleteUser('${u._id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
    } catch(e) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--danger)">שגיאה בטעינה</td></tr>'; }
}

async function loadAdminMeetings() {
    const list = document.getElementById('admin-meetings-list');
    if (!list) return;
    list.innerHTML = '<p style="color:var(--gray)">טוען...</p>';
    try {
        const meetings = await apiFetch('/api/admin/meetings/active');
        if (!meetings.length) { list.innerHTML = '<p style="color:var(--gray)">אין פגישות פעילות</p>'; return; }
        list.innerHTML = meetings.map(m => `<div class="admin-meeting-row">
            <span><i class="fas fa-video"></i> ${m.title} <small style="color:var(--gray)">(${m.participants || 0} משתתפים)</small></span>
            <div>
                <button class="btn btn-sm btn-secondary" onclick="adminJoinMeeting('${m.roomId}','${m.title.replace(/'/g,"\\'")}')">הצטרף</button>
                <button class="btn btn-sm btn-danger" onclick="adminCloseMeeting('${m.roomId}')">סגור</button>
            </div>
        </div>`).join('');
    } catch(e) { list.innerHTML = '<p style="color:var(--danger)">שגיאה בטעינה</p>'; }
}

async function loadAdminSettings() {
    try {
        const s = await apiFetch('/api/admin/settings');
        const lockEl = document.getElementById('admin-lock-creation');
        if (lockEl) lockEl.checked = s.lockMeetingCreation;
    } catch(e) {}
}

async function saveAdminSettings() {
    const lockEl = document.getElementById('admin-lock-creation');
    try {
        await apiFetch('/api/admin/settings', { method: 'PUT', body: { lockMeetingCreation: lockEl?.checked || false } });
        showToast('הגדרות נשמרו!');
    } catch(e) { showToast('שגיאה: ' + e.message); }
}

function openEditUser(id, name, email, role) {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-user-name').value = name;
    document.getElementById('edit-user-email').value = email;
    document.getElementById('edit-user-role').value = role;
    openModal('modal-edit-user');
}

async function saveEditUser() {
    const id    = document.getElementById('edit-user-id')?.value;
    const name  = document.getElementById('edit-user-name')?.value.trim();
    const email = document.getElementById('edit-user-email')?.value.trim();
    const role  = document.getElementById('edit-user-role')?.value;
    if (!name || !email) { showToast('יש למלא את כל השדות'); return; }
    try {
        await apiFetch('/api/admin/users/' + id, { method: 'PUT', body: { name, email, role } });
        closeModal('modal-edit-user');
        loadAdminUsers();
        showToast('המשתמש עודכן!');
    } catch(e) { showToast('שגיאה: ' + e.message); }
}

async function adminDeleteUser(id) {
    if (!confirm('למחוק משתמש זה?')) return;
    try {
        await apiFetch('/api/admin/users/' + id, { method: 'DELETE' });
        loadAdminUsers();
        showToast('המשתמש נמחק');
    } catch(e) { showToast('שגיאה: ' + e.message); }
}

async function adminJoinMeeting(roomId, title) {
    navigate('dashboard');
    await window.zoomManager.joinRoom(roomId, title, false, 'instant');
}

function adminCloseMeeting(roomId) {
    if (!confirm('לסגור פגישה זו?')) return;
    window.zoomManager.adminClose(roomId);
    showToast('הפגישה נסגרה');
    setTimeout(loadAdminMeetings, 500);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (detectRoute()) return;

    await window.authManager.init();

    if (window.authManager.isLoggedIn()) {
        await onAuthSuccess();
    } else {
        document.getElementById('page-auth').style.display = 'flex';
        showAuthTab('login');
    }

    // Close modals on backdrop click
    window.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) closeModal(e.target.id);
    });
});
