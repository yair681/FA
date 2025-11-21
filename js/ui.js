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

        // Login form
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
        if (!authManager.currentUser) return;
        
        const classes = await dbManager.getUserClasses(
            authManager.currentUser.uid, 
            authManager.currentUser.role
        );
        this.renderClasses(classes, 'classes-list');
    }

    async loadAssignmentsPage() {
        if (!authManager.currentUser) return;
        
        if (authManager.currentUser.role === 'student') {
            const userClasses = await dbManager.getUserClasses(
                authManager.currentUser.uid, 
                'student'
            );
            const classIds = userClasses.map(c => c.id);
            const assignments = await dbManager.getAssignments();
            const userAssignments = assignments.filter(a => classIds.includes(a.classId));
            this.renderAssignments(userAssignments, 'assignments-list');
        }

        if (authManager.currentUser.role === 'teacher' || authManager.currentUser.role === 'admin') {
            const teacherClasses = await dbManager.getUserClasses(
                authManager.currentUser.uid, 
                'teacher'
            );
            const classIds = teacherClasses.map(c => c.id);
            const assignments = await dbManager.getAssignments();
            const teacherAssignments = assignments.filter(a => classIds.includes(a.classId));
            this.renderTeacherAssignments(teacherAssignments, 'teacher-assignments-list');
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
        if (!authManager.currentUser) return;
        
        const classes = await dbManager.getUserClasses(
            authManager.currentUser.uid, 
            authManager.currentUser.role
        );
        this.renderUserClasses(classes, 'user-classes-list');

        document.getElementById('change-password-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleChangePassword();
        });
    }

    async loadAdminPage() {
        if (!authManager.currentUser || !authManager.isAdmin()) return;
        
        const users = await dbManager.getUsers();
        this.renderUsers(users, 'users-list');

        const classes = await dbManager.getClasses();
        this.renderAdminClasses(classes, 'admin-classes-list');
    }

    // Render functions
    renderAnnouncements(announcements, containerId, showActions = false) {
        const container = document.getElementById(containerId);
        
        if (announcements.length === 0) {
            container.innerHTML = '<p>אין הודעות להצגה</p>';
            return;
        }

        container.innerHTML = announcements.map(announcement => `
            <div class="announcement">
                ${showActions && authManager.isTeacher() ? `
                    <div class="announcement-actions">
                        <button class="btn btn-danger btn-sm" onclick="uiManager.deleteAnnouncement('${announcement.id}')">
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
                        ${announcement.authorName || 'מערכת'}
                    </span>
                </div>
            </div>
        `).join('');
    }

    renderClasses(classes, containerId) {
        const container = document.getElementById(containerId);
        
        if (classes.length === 0) {
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
        
        if (assignments.length === 0) {
            container.innerHTML = '<p>אין משימות להצגה</p>';
            return;
        }

        container.innerHTML = assignments.map(assignment => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${assignment.title}</div>
                    <div class="announcement-date">תאריך הגשה: ${assignment.dueDate}</div>
                </div>
                <div class="announcement-content">${assignment.description}</div>
                <div class="announcement-meta">
                    <span class="badge badge-warning">${assignment.teacherName || 'מורה'}</span>
                </div>
                <button class="btn" style="margin-top:0.5rem;" onclick="uiManager.submitAssignment('${assignment.id}')">
                    הגשת משימה
                </button>
            </div>
        `).join('');
    }

    renderTeacherAssignments(assignments, containerId) {
        const container = document.getElementById(containerId);
        
        if (assignments.length === 0) {
            container.innerHTML = '<p>אין משימות להצגה</p>';
            return;
        }

        container.innerHTML = assignments.map(assignment => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${assignment.title}</div>
                    <div class="announcement-date">תאריך הגשה: ${assignment.dueDate}</div>
                </div>
                <div class="announcement-content">${assignment.description}</div>
                <div class="announcement-content">
                    <strong>מספר הגשות:</strong> ${assignment.submissions?.length || 0}
                </div>
                <div style="margin-top: 1rem;">
                    <button class="btn" onclick="uiManager.viewSubmissions('${assignment.id}')">צפייה בהגשות</button>
                    <button class="btn btn-danger" onclick="uiManager.deleteAssignment('${assignment.id}')" style="margin-right:0.5rem;">מחיקה</button>
                </div>
            </div>
        `).join('');
    }

    renderEvents(events, containerId) {
        const container = document.getElementById(containerId);
        
        if (events.length === 0) {
            container.innerHTML = '<p>אין אירועים להצגה</p>';
            return;
        }

        container.innerHTML = events.map(event => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${event.title}</div>
                    <div class="announcement-date">${event.date}</div>
                </div>
                <div class="announcement-content">${event.description}</div>
                <div class="announcement-meta">
                    <span style="color: var(--gray); font-size: 0.9rem;">${event.authorName || 'מערכת'}</span>
                </div>
            </div>
        `).join('');
    }

    renderMedia(media, containerId) {
        const container = document.getElementById(containerId);
        
        if (media.length === 0) {
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
                            <p>${item.date}</p>
                            <p style="color: var(--gray); font-size: 0.9rem;">${item.authorName || 'מערכת'}</p>
                            ${authManager.isAdmin() ? `
                                <button class="btn btn-danger btn-sm" onclick="uiManager.deleteMedia('${item.id}')" style="margin-top: 0.5rem;">
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
        
        if (classes.length === 0) {
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
        
        if (users.length === 0) {
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
                        <button class="btn btn-warning" onclick="uiManager.editUser('${user.id}')">עריכה</button>
                        ${user.role !== 'admin' ? `
                            <button class="btn btn-danger" onclick="uiManager.deleteUser('${user.id}')" style="margin-right:0.5rem;">מחיקה</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderAdminClasses(classes, containerId) {
        const container = document.getElementById(containerId);
        
        if (classes.length === 0) {
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
                        <button class="btn btn-warning" onclick="uiManager.editClass('${classItem.id}')">עריכה</button>
                        <button class="btn btn-danger" onclick="uiManager.deleteClass('${classItem.id}')" style="margin-right:0.5rem;">מחיקה</button>
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
        const modal = document.getElementById('add-announcement-modal');
        modal.style.display = 'flex';
        
        // Populate classes dropdown if user is teacher
        if (authManager.isTeacher()) {
            const classes = await dbManager.getUserClasses(authManager.currentUser.uid, 'teacher');
            const classSelect = document.getElementById('announcement-class');
            classSelect.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        
        document.getElementById('add-announcement-form').onsubmit = (e) => this.handleAddAnnouncement(e);
    }

    async openAddAssignmentModal() {
        const modal = document.getElementById('add-assignment-modal');
        modal.style.display = 'flex';
        
        // Populate classes dropdown
        const classes = await dbManager.getUserClasses(authManager.currentUser.uid, 'teacher');
        const classSelect = document.getElementById('assignment-class');
        classSelect.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        document.getElementById('add-assignment-form').onsubmit = (e) => this.handleAddAssignment(e);
    }

    openAddUserModal() {
        const modal = document.getElementById('add-user-modal');
        modal.style.display = 'flex';
        document.getElementById('add-user-form').onsubmit = (e) => this.handleAddUser(e);
    }

    async openAddClassModal() {
        const modal = document.getElementById('add-class-modal');
        modal.style.display = 'flex';
        
        // Populate teachers dropdown
        const teachers = await dbManager.getTeachers();
        const teachersSelect = document.getElementById('class-teachers');
        teachersSelect.innerHTML = teachers
            .filter(t => t.id !== authManager.currentUser.uid) // Exclude current user
            .map(t => `<option value="${t.id}">${t.name} (${t.email})</option>`)
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
            document.getElementById('login-error').style.display = 'none';
            this.showPage('home');
        } else {
            document.getElementById('login-error').style.display = 'block';
            document.getElementById('login-error').textContent = result.error;
        }
    }

    async handleAddAnnouncement(e) {
        e.preventDefault();
        
        const title = document.getElementById('announcement-title').value;
        const content = document.getElementById('announcement-content').value;
        const type = document.getElementById('announcement-type').value;
        const classId = type === 'class' ? document.getElementById('announcement-class').value : null;
        
        const announcement = {
            title,
            content,
            authorId: authManager.currentUser.uid,
            authorName: authManager.currentUser.name,
            isGlobal: type === 'global',
            classId: classId
        };
        
        const result = await dbManager.addAnnouncement(announcement);
        
        if (result.success) {
            alert('ההודעה פורסמה בהצלחה');
            this.closeAllModals();
            this.loadPageData(this.currentPage);
        } else {
            alert('שגיאה בפרסום ההודעה: ' + result.error);
        }
    }

    async handleAddAssignment(e) {
        e.preventDefault();
        
        const title = document.getElementById('assignment-title').value;
        const description = document.getElementById('assignment-description').value;
        const classId = document.getElementById('assignment-class').value;
        const dueDate = document.getElementById('assignment-due-date').value;
        
        const assignment = {
            title,
            description,
            classId,
            teacherId: authManager.currentUser.uid,
            teacherName: authManager.currentUser.name,
            dueDate
        };
        
        const result = await dbManager.addAssignment(assignment);
        
        if (result.success) {
            alert('המשימה נוספה בהצלחה');
            this.closeAllModals();
            this.loadPageData('assignments');
        } else {
            alert('שגיאה בהוספת המשימה: ' + result.error);
        }
    }

    async handleAddUser(e) {
        e.preventDefault();
        
        const name = document.getElementById('user-name').value;
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;
        
        const userData = {
            name,
            email,
            password,
            role
        };
        
        const result = await authManager.createUser(userData);
        
        if (result.success) {
            alert('המשתמש נוצר בהצלחה');
            this.closeAllModals();
            this.loadPageData('admin');
        } else {
            alert('שגיאה ביצירת המשתמש: ' + result.error);
        }
    }

    async handleAddClass(e) {
        e.preventDefault();
        
        const name = document.getElementById('class-name').value;
        const teachersSelect = document.getElementById('class-teachers');
        const selectedTeachers = Array.from(teachersSelect.selectedOptions).map(option => option.value);
        
        // Include current user as teacher
        const allTeachers = [authManager.currentUser.uid, ...selectedTeachers];
        
        const classData = {
            name,
            teacherId: authManager.currentUser.uid,
            teachers: allTeachers,
            students: [],
            maxStudents: 20
        };
        
        const result = await dbManager.addClass(classData);
        
        if (result.success) {
            alert('הכיתה נוצרה בהצלחה');
            this.closeAllModals();
            this.loadPageData('classes');
        } else {
            alert('שגיאה ביצירת הכיתה: ' + result.error);
        }
    }

    async logout() {
        await authManager.logout();
        this.showPage('home');
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[data-page="home"]').classList.add('active');
    }

    async handleChangePassword() {
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            alert('הסיסמאות אינן תואמות');
            return;
        }
        
        if (newPassword.length < 6) {
            alert('הסיסמה חייבת להכיל לפחות 6 תווים');
            return;
        }
        
        const result = await authManager.changePassword(newPassword);
        
        if (result.success) {
            alert('הסיסמה שונתה בהצלחה');
            document.getElementById('change-password-form').reset();
        } else {
            alert('שגיאה בשינוי הסיסמה: ' + result.error);
        }
    }

    // Utility functions
    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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

    // Action methods
    async deleteAnnouncement(announcementId) {
        if (confirm('האם אתה בטוח שברצונך למחוק הודעה זו?')) {
            const result = await dbManager.deleteAnnouncement(announcementId);
            if (result.success) {
                this.loadPageData(this.currentPage);
            } else {
                alert('שגיאה במחיקת ההודעה: ' + result.error);
            }
        }
    }

    async deleteUser(userId) {
        if (confirm('האם אתה בטוח שברצונך למחוק משתמש זה?')) {
            const result = await dbManager.deleteUser(userId);
            if (result.success) {
                this.loadPageData('admin');
            } else {
                alert('שגיאה במחיקת המשתמש: ' + result.error);
            }
        }
    }

    async deleteClass(classId) {
        if (confirm('האם אתה בטוח שברצונך למחוק כיתה זו?')) {
            const result = await dbManager.deleteClass(classId);
            if (result.success) {
                this.loadPageData('admin');
            } else {
                alert('שגיאה במחיקת הכיתה: ' + result.error);
            }
        }
    }

    async deleteMedia(mediaId) {
        if (confirm('האם אתה בטוח שברצונך למחוק פריט זה?')) {
            const result = await dbManager.deleteMedia(mediaId);
            if (result.success) {
                this.loadPageData('history');
            } else {
                alert('שגיאה במחיקת הפריט: ' + result.error);
            }
        }
    }

    submitAssignment(assignmentId) {
        alert('פונקציונליות הגשת משימה תיושם בגרסה הבאה');
    }

    viewSubmissions(assignmentId) {
        alert('פונקציונליות צפייה בהגשות תיושם בגרסה הבאה');
    }

    deleteAssignment(assignmentId) {
        alert('פונקציונליות מחיקת משימה תיושם בגרסה הבאה');
    }

    editUser(userId) {
        alert('פונקציונליות עריכת משתמש תיושם בגרסה הבאה');
    }

    editClass(classId) {
        alert('פונקציונליות עריכת כיתה תיושם בגרסה הבאה');
    }

    openAddEventModal() {
        alert('פונקציונליות הוספת אירוע תיושם בגרסה הבאה');
    }

    openAddMediaModal() {
        alert('פונקציונליות הוספת מדיה תיושם בגרסה הבאה');
    }
}

const uiManager = new UIManager();