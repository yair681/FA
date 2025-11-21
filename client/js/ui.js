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

        // Forms
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));

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
            document.getElementById('teacher-assignments-list').innerHTML = '<p>יש להתחבר כדי לצפות במשימות</p>';
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

        document.getElementById('change-password-form').onsubmit = (e) => this.handleChangePassword(e);
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
                            <button class="btn btn-secondary" onclick="uiManager.manageClass('${classItem._id}')">ניהול כיתה</button>
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
                <div style="margin-top: 1rem;">
                    <button class="btn" onclick="uiManager.submitAssignment('${assignment._id}')">הגשת משימה</button>
                    ${assignment.submissions?.find(s => s.student === authManager.currentUser.id) ? `
                        <span class="badge badge-secondary" style="margin-right: 10px;">הוגש</span>
                    ` : ''}
                </div>
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
            .filter(t => t._id !== authManager.currentUser.id)
            .map(t => `<option value="${t._id}">${t.name} (${t.email})</option>`)
            .join('');
        
        document.getElementById('add-class-form').onsubmit = (e) => this.handleAddClass(e);
    }

    openAddEventModal() {
        if (!authManager.isTeacher()) {
            this.showError('גישת מורה נדרשת');
            return;
        }

        const modal = document.getElementById('add-event-modal');
        modal.style.display = 'flex';
        document.getElementById('add-event-form').onsubmit = (e) => this.handleAddEvent(e);
    }

    openAddMediaModal() {
        if (!authManager.isTeacher()) {
            this.showError('גישת מורה נדרשת');
            return;
        }

        const modal = document.getElementById('add-media-modal');
        modal.style.display = 'flex';
        document.getElementById('add-media-form').onsubmit = (e) => this.handleAddMedia(e);
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

    async handleAddEvent(e) {
        e.preventDefault();
        
        const title = document.getElementById('event-title').value;
        const description = document.getElementById('event-description').value;
        const date = document.getElementById('event-date').value;
        
        try {
            await dbManager.createEvent({
                title,
                description,
                date
            });
            
            this.showSuccess('האירוע נוסף בהצלחה');
            this.closeAllModals();
            this.loadPageData('events');
        } catch (error) {
            this.showError('שגיאה בהוספת האירוע: ' + error.message);
        }
    }

    async handleAddMedia(e) {
        e.preventDefault();
        
        const title = document.getElementById('media-title').value;
        const type = document.getElementById('media-type').value;
        const url = document.getElementById('media-url').value;
        const date = document.getElementById('media-date').value;
        
        try {
            await dbManager.createMedia({
                title,
                type,
                url,
                date
            });
            
            this.showSuccess('המדיה נוספה בהצלחה');
            this.closeAllModals();
            this.loadPageData('history');
        } catch (error) {
            this.showError('שגיאה בהוספת המדיה: ' + error.message);
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            this.showError('הסיסמאות אינן תואמות');
            return;
        }
        
        try {
            // Verify current password
            const verifyResponse = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: authManager.currentUser.email,
                    password: currentPassword
                })
            });
            
            if (!verifyResponse.ok) {
                this.showError('סיסמה נוכחית לא נכונה');
                return;
            }
            
            // Update password
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: authManager.getAuthHeaders(),
                body: JSON.stringify({
                    newPassword: newPassword
                })
            });
            
            if (response.ok) {
                this.showSuccess('סיסמה שונתה בהצלחה');
                document.getElementById('change-password-form').reset();
            } else {
                this.showError('שגיאה בשינוי הסיסמה');
            }
        } catch (error) {
            this.showError('שגיאה בשינוי הסיסמה: ' + error.message);
        }
    }

    async logout() {
        await authManager.logout();
        this.showPage('home');
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[data-page="home"]').classList.add('active');
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
            // Use a nicer notification system instead of alert
            this.showNotification(message, 'error');
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            min-width: 300px;
            text-align: center;
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Close on click
        notification.querySelector('.notification-close').onclick = () => {
            notification.parentNode.removeChild(notification);
        };
    }

    // Action methods
    async deleteAnnouncement(announcementId) {
        if (confirm('האם אתה בטוח שברצונך למחוק הודעה זו?')) {
            try {
                await dbManager.deleteAnnouncement(announcementId);
                this.loadPageData(this.currentPage);
                this.showSuccess('ההודעה נמחקה בהצלחה');
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
                this.showSuccess('המשתמש נמחק בהצלחה');
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
                this.showSuccess('הכיתה נמחקה בהצלחה');
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
                this.showSuccess('הפריט נמחק בהצלחה');
            } catch (error) {
                this.showError('שגיאה במחיקת הפריט: ' + error.message);
            }
        }
    }

    async deleteAssignment(assignmentId) {
        if (confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) {
            try {
                await dbManager.deleteAssignment(assignmentId);
                this.loadPageData('assignments');
                this.showSuccess('המשימה נמחקה בהצלחה');
            } catch (error) {
                this.showError('שגיאה במחיקת המשימה: ' + error.message);
            }
        }
    }

    async submitAssignment(assignmentId) {
        const submission = prompt('הזן את ההגשה שלך:');
        if (submission) {
            try {
                const response = await fetch('/api/assignments/submit', {
                    method: 'POST',
                    headers: authManager.getAuthHeaders(),
                    body: JSON.stringify({
                        assignmentId: assignmentId,
                        submission: submission
                    })
                });
                
                if (response.ok) {
                    this.showSuccess('המשימה הוגשה בהצלחה');
                    this.loadPageData('assignments');
                } else {
                    this.showError('שגיאה בהגשת המשימה');
                }
            } catch (error) {
                this.showError('שגיאה בהגשת המשימה: ' + error.message);
            }
        }
    }

    async viewSubmissions(assignmentId) {
        try {
            const response = await fetch(`/api/assignments/${assignmentId}/submissions`, {
                headers: authManager.getAuthHeaders()
            });
            
            if (response.ok) {
                const submissions = await response.json();
                this.showSubmissionsModal(submissions, assignmentId);
            } else {
                this.showError('שגיאה בטעינת ההגשות');
            }
        } catch (error) {
            this.showError('שגיאה בטעינת ההגשות: ' + error.message);
        }
    }

    showSubmissionsModal(submissions, assignmentId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>הגשות למשימה</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="submissions-list">
                    ${submissions.length === 0 ? '<p>אין הגשות</p>' : ''}
                    ${submissions.map(sub => `
                        <div class="submission-item">
                            <h4>${sub.student?.name || 'תלמיד'}</h4>
                            <p>${sub.submission}</p>
                            <small>הוגש: ${this.formatDate(sub.submittedAt)}</small>
                            <div class="submission-actions">
                                <input type="text" placeholder="ציון" value="${sub.grade || ''}" 
                                       onchange="uiManager.gradeSubmission('${assignmentId}', '${sub.student?._id}', this.value)">
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.close-modal').onclick = () => {
            document.body.removeChild(modal);
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
    }

    async gradeSubmission(assignmentId, studentId, grade) {
        try {
            const response = await fetch('/api/assignments/grade', {
                method: 'POST',
                headers: authManager.getAuthHeaders(),
                body: JSON.stringify({
                    assignmentId: assignmentId,
                    studentId: studentId,
                    grade: grade
                })
            });
            
            if (response.ok) {
                this.showSuccess('ציון עודכן בהצלחה');
            } else {
                this.showError('שגיאה בעדכון הציון');
            }
        } catch (error) {
            this.showError('שגיאה בעדכון הציון: ' + error.message);
        }
    }

    async editUser(userId) {
        // Implementation for editing user
        this.showSuccess('פונקציונליות עריכת משתמש תיושם בגרסה הבאה');
    }

    async editClass(classId) {
        // Implementation for editing class
        this.showSuccess('פונקציונליות עריכת כיתה תיושם בגרסה הבאה');
    }

    async manageClass(classId) {
        // Implementation for class management
        this.showSuccess('פונקציונליות ניהול כיתה תיושם בגרסה הבאה');
    }
}

const uiManager = new UIManager();
