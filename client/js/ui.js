// UI Manager
class UIManager {
    constructor() {
        this.currentPage = 'home';
        this.initEventListeners();
    }

    initEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showPage(link.dataset.page);
                
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

        // Login/Logout
        document.getElementById('login-btn').addEventListener('click', () => this.openLoginModal());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Register/Login toggle
        document.getElementById('show-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeAllModals();
            this.openRegisterModal();
        });

        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeAllModals();
            this.openLoginModal();
        });

        // Forms
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));

        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Add buttons
        document.getElementById('add-announcement-btn')?.addEventListener('click', () => this.openAddAnnouncementModal());
        document.getElementById('add-global-announcement-btn')?.addEventListener('click', () => this.openAddAnnouncementModal());
        document.getElementById('add-assignment-btn')?.addEventListener('click', () => this.openAddAssignmentModal());
        document.getElementById('add-user-btn')?.addEventListener('click', () => this.openAddUserModal());
        document.getElementById('add-class-btn')?.addEventListener('click', () => this.openAddClassModal());
        document.getElementById('admin-add-class-btn')?.addEventListener('click', () => this.openAddClassModal());
        document.getElementById('add-event-btn')?.addEventListener('click', () => this.openAddEventModal());
        document.getElementById('add-media-btn')?.addEventListener('click', () => this.openAddMediaModal());

        // Announcement type change
        document.getElementById('announcement-type')?.addEventListener('change', (e) => {
            const classGroup = document.getElementById('class-selection-group');
            classGroup.style.display = e.target.value === 'class' ? 'block' : 'none';
        });
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.style.display = page.id === `${pageId}-page` ? 'block' : 'none';
        });
        
        this.currentPage = pageId;
        this.loadPageData(pageId);
    }

    async loadPageData(pageId) {
        try {
            console.log(`📄 Loading page data for: ${pageId}`);
            switch (pageId) {
                case 'home':
                    await this.loadHomePage();
                    break;
                case 'announcements':
                    await this.loadAnnouncementsPage();
                    break;
                case 'classes':
                    await this.loadClassesPage();
                    break;
                case 'assignments':
                    await this.loadAssignmentsPage();
                    break;
                case 'events':
                    await this.loadEventsPage();
                    break;
                case 'history':
                    await this.loadHistoryPage();
                    break;
                case 'settings':
                    await this.loadSettingsPage();
                    break;
                case 'admin':
                    await this.loadAdminPage();
                    break;
            }
        } catch (error) {
            console.error('Error loading page:', error);
            this.showError('שגיאה בטעינת הנתונים');
        }
    }

    async loadHomePage() {
        const announcements = await dbManager.getAnnouncements();
        this.renderAnnouncements(announcements, 'announcements-list');
    }

    async loadAnnouncementsPage() {
        const announcements = await dbManager.getAnnouncements();
        this.renderAnnouncements(announcements, 'global-announcements-list', true);
    }

    async loadClassesPage() {
        if (!authManager.currentUser) {
            document.getElementById('classes-list').innerHTML = '<p>יש להתחבר כדי לצפות בכיתות</p>';
            return;
        }
        
        const classes = await dbManager.getUserClasses();
        this.renderClasses(classes, 'classes-list');
    }

    async loadAssignmentsPage() {
        if (!authManager.currentUser) {
            document.getElementById('assignments-list').innerHTML = '<p>יש להתחבר כדי לצפות במשימות</p>';
            return;
        }
        
        const assignments = await dbManager.getAssignments();
        
        if (authManager.isStudent()) {
            this.renderAssignments(assignments, 'assignments-list');
        }

        if (authManager.isTeacher()) {
            this.renderTeacherAssignments(assignments, 'teacher-assignments-list');
        }
    }

    async loadEventsPage() {
        const events = await dbManager.getEvents();
        this.renderEvents(events, 'events-list');
    }

    async loadHistoryPage() {
        const media = await dbManager.getMedia();
        this.renderMedia(media, 'media-gallery');
    }

    async loadSettingsPage() {
        if (!authManager.currentUser) {
            document.getElementById('user-classes-list').innerHTML = '<p>יש להתחבר כדי לצפות בהגדרות</p>';
            return;
        }
        
        const classes = await dbManager.getUserClasses();
        this.renderUserClasses(classes, 'user-classes-list');

        document.getElementById('change-password-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleChangePassword();
        });
    }

    async loadAdminPage() {
        if (!authManager.currentUser || !authManager.isAdmin()) {
            document.getElementById('users-list').innerHTML = '<p>גישת מנהל נדרשת</p>';
            document.getElementById('admin-classes-list').innerHTML = '<p>גישת מנהל נדרשת</p>';
            return;
        }
        
        const users = await dbManager.getUsers();
        this.renderUsers(users, 'users-list');

        const classes = await dbManager.getClasses();
        this.renderAdminClasses(classes, 'admin-classes-list');
    }

    // Render functions
    renderAnnouncements(announcements, containerId, showActions = false) {
        const container = document.getElementById(containerId);
        
        if (!announcements || announcements.length === 0) {
            container.innerHTML = '<p>אין הודעות להצגה</p>';
            return;
        }

        container.innerHTML = announcements.map(announcement => `
            <div class="announcement">
                ${showActions && authManager.isTeacher() ? `
                    <div class="announcement-actions">
                        <button class="btn btn-danger btn-sm" onclick="uiManager.deleteAnnouncement('${announcement._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
                <div class="announcement-header">
                    <div class="announcement-title">${announcement.title}</div>
                    <div class="announcement-date">${this.formatDate(announcement.createdAt)}</div>
                </div>
                <div class="announcement-content">${announcement.content}</div>
                <div class="announcement-meta">
                    <span class="badge ${announcement.isGlobal ? 'badge-primary' : 'badge-secondary'}">
                        ${announcement.isGlobal ? 'הודעה ראשית' : 'הודעה לכיתה'}
                    </span>
                    <span style="margin-right: 10px; color: var(--gray); font-size: 0.9rem;">
                        ${announcement.author?.name || 'מערכת'}
                    </span>
                </div>
            </div>
        `).join('');
    }

    renderClasses(classes, containerId) {
        const container = document.getElementById(containerId);
        
        if (!classes || classes.length === 0) {
            container.innerHTML = '<p>אין כיתות להצגה</p>';
            return;
        }

        container.innerHTML = classes.map(classItem => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${classItem.name}</div>
                </div>
                <div class="announcement-content">
                    <p><strong>מספר תלמידים:</strong> ${classItem.students?.length || 0}</p>
                    <p><strong>מספר מורים:</strong> ${classItem.teachers?.length || 0}</p>
                    ${authManager.isTeacher() ? `
                        <div style="margin-top: 1rem;">
                            <button class="btn btn-secondary">ניהול כיתה</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    renderAssignments(assignments, containerId) {
        const container = document.getElementById(containerId);
        
        if (!assignments || assignments.length === 0) {
            container.innerHTML = '<p>אין משימות להצגה</p>';
            return;
        }

        container.innerHTML = assignments.map(assignment => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${assignment.title}</div>
                    <div class="announcement-date">תאריך הגשה: ${this.formatDate(assignment.dueDate)}</div>
                </div>
                <div class="announcement-content">${assignment.description}</div>
                <div class="announcement-meta">
                    <span class="badge badge-warning">${assignment.teacher?.name || 'מורה'}</span>
                </div>
                <button class="btn" style="margin-top:0.5rem;" onclick="uiManager.submitAssignment('${assignment._id}')">
                    הגשת משימה
                </button>
            </div>
        `).join('');
    }

    renderTeacherAssignments(assignments, containerId) {
        const container = document.getElementById(containerId);
        
        if (!assignments || assignments.length === 0) {
            container.innerHTML = '<p>אין משימות להצגה</p>';
            return;
        }

        container.innerHTML = assignments.map(assignment => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${assignment.title}</div>
                    <div class="announcement-date">תאריך הגשה: ${this.formatDate(assignment.dueDate)}</div>
                </div>
                <div class="announcement-content">${assignment.description}</div>
                <div class="announcement-content">
                    <strong>מספר הגשות:</strong> ${assignment.submissions?.length || 0}
                </div>
                <div style="margin-top: 1rem;">
                    <button class="btn" onclick="uiManager.viewSubmissions('${assignment._id}')">צפייה בהגשות</button>
                    <button class="btn btn-danger" onclick="uiManager.deleteAssignment('${assignment._id}')" style="margin-right:0.5rem;">מחיקה</button>
                </div>
            </div>
        `).join('');
    }

    renderEvents(events, containerId) {
        const container = document.getElementById(containerId);
        
        if (!events || events.length === 0) {
            container.innerHTML = '<p>אין אירועים להצגה</p>';
            return;
        }

        container.innerHTML = events.map(event => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${event.title}</div>
                    <div class="announcement-date">${this.formatDate(event.date)}</div>
                </div>
                <div class="announcement-content">${event.description}</div>
                <div class="announcement-meta">
                    <span style="color: var(--gray); font-size: 0.9rem;">${event.author?.name || 'מערכת'}</span>
                </div>
            </div>
        `).join('');
    }

    renderMedia(media, containerId) {
        const container = document.getElementById(containerId);
        
        if (!media || media.length === 0) {
            container.innerHTML = '<p>אין מדיה להצגה</p>';
            return;
        }

        container.innerHTML = `
            <div class="media-grid">
                ${media.map(item => `
                    <div class="media-item">
                        ${item.type === 'image' ? 
                            `<img src="${item.url}" alt="${item.title}" loading="lazy">` :
                            `<video controls>
                                <source src="${item.url}" type="video/mp4">
                                הדפדפן שלך אינו תומך בנגן וידאו.
                             </video>`
                        }
                        <div class="media-info">
                            <h4>${item.title}</h4>
                            <p>${this.formatDate(item.date)}</p>
                            <p style="color: var(--gray); font-size: 0.9rem;">${item.author?.name || 'מערכת'}</p>
                            ${authManager.isAdmin() ? `
                                <button class="btn btn-danger btn-sm" onclick="uiManager.deleteMedia('${item._id}')" style="margin-top: 0.5rem;">
                                    מחיקה
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderUserClasses(classes, containerId) {
        const container = document.getElementById(containerId);
        
        if (!classes || classes.length === 0) {
            container.innerHTML = '<p>אין כיתות להצגה</p>';
            return;
        }

        container.innerHTML = classes.map(classItem => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${classItem.name}</div>
                </div>
            </div>
        `).join('');
    }

    renderUsers(users, containerId) {
        const container = document.getElementById(containerId);
        
        if (!users || users.length === 0) {
            container.innerHTML = '<p>אין משתמשים להצגה</p>';
            return;
        }

        container.innerHTML = users.map(user => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${user.name}</div>
                    <div class="announcement-date">
                        <span class="badge ${this.getRoleBadgeClass(user.role)}">${this.getRoleDisplayName(user.role)}</span>
                    </div>
                </div>
                <div class="announcement-content">
                    <p><strong>אימייל:</strong> ${user.email}</p>
                    <p><strong>מספר כיתות:</strong> ${user.classes?.length || 0}</p>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-warning" onclick="uiManager.editUser('${user._id}')">עריכה</button>
                        ${user.role !== 'admin' ? `
                            <button class="btn btn-danger" onclick="uiManager.deleteUser('${user._id}')" style="margin-right:0.5rem;">מחיקה</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderAdminClasses(classes, containerId) {
        const container = document.getElementById(containerId);
        
        if (!classes || classes.length === 0) {
            container.innerHTML = '<p>אין כיתות להצגה</p>';
            return;
        }

        container.innerHTML = classes.map(classItem => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${classItem.name}</div>
                </div>
                <div class="announcement-content">
                    <p><strong>מספר תלמידים:</strong> ${classItem.students?.length || 0}</p>
                    <p><strong>מספר מורים:</strong> ${classItem.teachers?.length || 0}</p>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-warning" onclick="uiManager.editClass('${classItem._id}')">עריכה</button>
                        <button class="btn btn-danger" onclick="uiManager.deleteClass('${classItem._id}')" style="margin-right:0.5rem;">מחיקה</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Modal functions
    openLoginModal() {
        document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('register-modal').style.display = 'none';
    }

    openRegisterModal() {
        document.getElementById('register-modal').style.display = 'flex';
        document.getElementById('login-modal').style.display = 'none';
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    async openAddAnnouncementModal() {
        if (!authManager.isTeacher()) {
            this.showError('גישת מורה נדרשת');
            return;
        }

        const modal = document.getElementById('add-announcement-modal');
        modal.style.display = 'flex';
        
        // Populate classes dropdown if user is teacher
        if (authManager.isTeacher()) {
            const classes = await dbManager.getUserClasses();
            const classSelect = document.getElementById('announcement-class');
            classSelect.innerHTML = classes.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
        }
        
        document.getElementById('add-announcement-form').onsubmit = (e) => this.handleAddAnnouncement(e);
    }

    async openAddAssignmentModal() {
        if (!authManager.isTeacher()) {
            this.showError('גישת מורה נדרשת');
            return;
        }

        const modal = document.getElementById('add-assignment-modal');
        modal.style.display = 'flex';
        
        // Populate classes dropdown
        const classes = await dbManager.getUserClasses();
        const classSelect = document.getElementById('assignment-class');
        classSelect.innerHTML = classes.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
        
        document.getElementById('add-assignment-form').onsubmit = (e) => this.handleAddAssignment(e);
    }

    openAddUserModal() {
        if (!authManager.isAdmin()) {
            this.showError('גישת מנהל נדרשת');
            return;
        }

        const modal = document.getElementById('add-user-modal');
        modal.style.display = 'flex';
        document.getElementById('add-user-form').onsubmit = (e) => this.handleAddUser(e);
    }

    async openAddClassModal() {
        if (!authManager.isTeacher()) {
            this.showError('גישת מורה נדרשת');
            return;
        }

        const modal = document.getElementById('add-class-modal');
        modal.style.display = 'flex';
        
        // Populate teachers dropdown
        const teachers = await dbManager.getTeachers();
        const teachersSelect = document.getElementById('class-teachers');
        teachersSelect.innerHTML = teachers
            .filter(t => t._id !== authManager.currentUser.id) // Exclude current user
            .map(t => `<option value="${t._id}">${t.name} (${t.email})</option>`)
            .join('');
        
        document.getElementById('add-class-form').onsubmit = (e) => this.handleAddClass(e);
    }

    // Handler functions
    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        const result = await authManager.login(email, password);
        
        if (result.success) {
            this.closeAllModals();
            this.showError('', 'login-error');
            this.showPage('home');
        } else {
            this.showError(result.error, 'login-error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const role = document.getElementById('register-role').value;
        
        const result = await authManager.register({
            name,
            email,
            password,
            role
        });
        
        if (result.success) {
            this.closeAllModals();
            this.showError('', 'register-error');
            this.showPage('home');
        } else {
            this.showError(result.error, 'register-error');
        }
    }

    async handleAddAnnouncement(e) {
        e.preventDefault();
        
        const title = document.getElementById('announcement-title').value;
        const content = document.getElementById('announcement-content').value;
        const type = document.getElementById('announcement-type').value;
        const classId = type === 'class' ? document.getElementById('announcement-class').value : null;
        
        try {
            await dbManager.createAnnouncement({
                title,
                content,
                isGlobal: type === 'global',
                classId: classId
            });
            
            this.showSuccess('ההודעה פורסמה בהצלחה');
            this.closeAllModals();
            this.loadPageData(this.currentPage);
        } catch (error) {
            this.showError('שגיאה בפרסום ההודעה: ' + error.message);
        }
    }

    async handleAddAssignment(e) {
        e.preventDefault();
        
        const title = document.getElementById('assignment-title').value;
        const description = document.getElementById('assignment-description').value;
        const classId = document.getElementById('assignment-class').value;
        const dueDate = document.getElementById('assignment-due-date').value;
        
        try {
            await dbManager.createAssignment({
                title,
                description,
                classId,
                dueDate
            });
            
            this.showSuccess('המשימה נוספה בהצלחה');
            this.closeAllModals();
            this.loadPageData('assignments');
        } catch (error) {
            this.showError('שגיאה בהוספת המשימה: ' + error.message);
        }
    }

    async handleAddUser(e) {
        e.preventDefault();
        
        const name = document.getElementById('user-name').value;
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;
        
        try {
            await dbManager.createUser({
                name,
                email,
                password,
                role
            });
            
            this.showSuccess('המשתמש נוצר בהצלחה');
            this.closeAllModals();
            this.loadPageData('admin');
        } catch (error) {
            this.showError('שגיאה ביצירת המשתמש: ' + error.message);
        }
    }

    async handleAddClass(e) {
        e.preventDefault();
        
        const name = document.getElementById('class-name').value;
        const teachersSelect = document.getElementById('class-teachers');
        const selectedTeachers = Array.from(teachersSelect.selectedOptions).map(option => option.value);
        
        try {
            await dbManager.createClass({
                name,
                teachers: selectedTeachers
            });
            
            this.showSuccess('הכיתה נוצרה בהצלחה');
            this.closeAllModals();
            this.loadPageData('classes');
        } catch (error) {
            this.showError('שגיאה ביצירת הכיתה: ' + error.message);
        }
    }

    async logout() {
        await authManager.logout();
        this.showPage('home');
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[data-page="home"]').classList.add('active');
    }

    async handleChangePassword() {
        // Implementation for password change
        this.showSuccess('פונקציונליות שינוי סיסמה תיושם בגרסה הבאה');
    }

    // Utility functions
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('he-IL');
    }

    getRoleDisplayName(role) {
        const roles = {
            'student': 'תלמיד',
            'teacher': 'מורה',
            'admin': 'מנהל מערכת'
        };
        return roles[role] || role;
    }

    getRoleBadgeClass(role) {
        const classes = {
            'student': 'badge-secondary',
            'teacher': 'badge-primary',
            'admin': 'badge-warning'
        };
        return classes[role] || 'badge-secondary';
    }

    showError(message, elementId = null) {
        if (elementId) {
            const element = document.getElementById(elementId);
            element.textContent = message;
            element.style.display = message ? 'block' : 'none';
        } else {
            alert(message);
        }
    }

    showSuccess(message) {
        alert(message);
    }

    // Action methods
    async deleteAnnouncement(announcementId) {
        if (confirm('האם אתה בטוח שברצונך למחוק הודעה זו?')) {
            try {
                await dbManager.deleteAnnouncement(announcementId);
                this.loadPageData(this.currentPage);
            } catch (error) {
                this.showError('שגיאה במחיקת ההודעה: ' + error.message);
            }
        }
    }

    async deleteUser(userId) {
        if (confirm('האם אתה בטוח שברצונך למחוק משתמש זה?')) {
            try {
                await dbManager.deleteUser(userId);
                this.loadPageData('admin');
            } catch (error) {
                this.showError('שגיאה במחיקת המשתמש: ' + error.message);
            }
        }
    }

    async deleteClass(classId) {
        if (confirm('האם אתה בטוח שברצונך למחוק כיתה זו?')) {
            try {
                await dbManager.deleteClass(classId);
                this.loadPageData('admin');
            } catch (error) {
                this.showError('שגיאה במחיקת הכיתה: ' + error.message);
            }
        }
    }

    async deleteMedia(mediaId) {
        if (confirm('האם אתה בטוח שברצונך למחוק פריט זה?')) {
            try {
                await dbManager.deleteMedia(mediaId);
                this.loadPageData('history');
            } catch (error) {
                this.showError('שגיאה במחיקת הפריט: ' + error.message);
            }
        }
    }

    submitAssignment(assignmentId) {
        this.showSuccess('פונקציונליות הגשת משימה תיושם בגרסה הבאה');
    }

    viewSubmissions(assignmentId) {
        this.showSuccess('פונקציונליות צפייה בהגשות תיושם בגרסה הבאה');
    }

    deleteAssignment(assignmentId) {
        this.showSuccess('פונקציונליות מחיקת משימה תיושם בגרסה הבאה');
    }

    editUser(userId) {
        this.showSuccess('פונקציונליות עריכת משתמש תיושם בגרסה הבאה');
    }

    editClass(classId) {
        this.showSuccess('פונקציונליות עריכת כיתה תיושם בגרסה הבאה');
    }

    openAddEventModal() {
        this.showSuccess('פונקציונליות הוספת אירוע תיושם בגרסה הבאה');
    }

    openAddMediaModal() {
        this.showSuccess('פונקציונליות הוספת מדיה תיושם בגרסה הבאה');
    }
}

const uiManager = new UIManager();
