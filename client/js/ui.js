// UI Manager
class UIManager {
    constructor() {
        this.currentPage = 'home';
        this.currentAssignmentId = null;
        this.currentFile = null;
        this.initEventListeners();
    }

    initEventListeners() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showPage(link.dataset.page);
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

        document.getElementById('login-btn').addEventListener('click', () => this.openLoginModal());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => this.closeAllModals()));

        document.getElementById('add-announcement-btn')?.addEventListener('click', () => this.openAddAnnouncementModal());
        document.getElementById('add-global-announcement-btn')?.addEventListener('click', () => this.openAddAnnouncementModal());
        document.getElementById('add-assignment-btn')?.addEventListener('click', () => this.openAddAssignmentModal());
        document.getElementById('add-user-btn')?.addEventListener('click', () => this.openAddUserModal());
        document.getElementById('add-class-btn')?.addEventListener('click', () => this.openAddClassModal());
        document.getElementById('admin-add-class-btn')?.addEventListener('click', () => this.openAddClassModal());
        document.getElementById('add-event-btn')?.addEventListener('click', () => this.openAddEventModal());
        document.getElementById('add-media-btn')?.addEventListener('click', () => this.openAddMediaModal());

        document.getElementById('announcement-type')?.addEventListener('change', (e) => {
            document.getElementById('class-selection-group').style.display = e.target.value === 'class' ? 'block' : 'none';
        });

        this.initFileUploadHandlers();
    }

    initFileUploadHandlers() {
        // (קוד העלאת קבצים נשאר ללא שינוי, מקוצר כאן לנוחות)
        const fileUploadArea = document.getElementById('file-upload-area');
        const submissionFile = document.getElementById('submission-file');
        if (fileUploadArea && submissionFile) {
            fileUploadArea.addEventListener('click', () => submissionFile.click());
            submissionFile.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        }
        
        const mediaUploadArea = document.getElementById('media-upload-area');
        const mediaFile = document.getElementById('media-file');
        if (mediaUploadArea && mediaFile) {
            mediaUploadArea.addEventListener('click', () => mediaFile.click());
            mediaFile.addEventListener('change', (e) => this.handleMediaFileSelect(e.target.files[0]));
        }
    }

    handleFileSelect(file) {
        if (file.size > 100 * 1024 * 1024) return this.showError('קובץ גדול מדי');
        this.currentFile = file;
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-preview').style.display = 'block';
    }

    handleMediaFileSelect(file) {
        if (file.size > 100 * 1024 * 1024) return this.showError('קובץ גדול מדי');
        this.currentFile = file;
        document.getElementById('media-preview').style.display = 'block';
        document.getElementById('media-preview').innerHTML = `<p>${file.name}</p>`;
    }

    removeSelectedFile() {
        this.currentFile = null;
        document.getElementById('file-preview').style.display = 'none';
        document.getElementById('submission-file').value = '';
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
            switch (pageId) {
                case 'announcements': await this.loadAnnouncementsPage(); break;
                case 'classes': await this.loadClassesPage(); break;
                case 'assignments': await this.loadAssignmentsPage(); break;
                case 'events': await this.loadEventsPage(); break;
                case 'history': await this.loadHistoryPage(); break;
                case 'settings': await this.loadSettingsPage(); break;
                case 'admin': await this.loadAdminPage(); break;
            }
        } catch (error) {
            console.error(error);
        }
    }

    async loadAnnouncementsPage() {
        const announcements = await dbManager.getAnnouncements();
        this.renderAnnouncements(announcements, 'global-announcements-list', true);
    }

    async loadClassesPage() {
        if (!authManager.currentUser) return;
        const classes = await dbManager.getUserClasses();
        this.renderClasses(classes, 'classes-list');
    }

    async loadAssignmentsPage() {
        if (!authManager.currentUser) {
            document.getElementById('guest-assignments-section').style.display = 'block';
            return;
        }
        const assignments = await dbManager.getAssignments();
        if (authManager.isStudent()) {
            document.getElementById('student-assignments-section').style.display = 'block';
            this.renderAssignments(assignments, 'assignments-list');
        }
        if (authManager.isTeacher()) {
            document.getElementById('teacher-assignments-section').style.display = 'block';
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
        if (!authManager.currentUser) return;
        const classes = await dbManager.getUserClasses();
        this.renderUserClasses(classes, 'user-classes-list');
        document.getElementById('change-password-form').onsubmit = (e) => this.handleChangePassword(e);
    }

    async loadAdminPage() {
        if (!authManager.isAdmin()) return;
        const users = await dbManager.getUsers();
        this.renderUsers(users, 'users-list');
        const classes = await dbManager.getClasses();
        this.renderAdminClasses(classes, 'admin-classes-list');
    }

    // --- Render Functions ---

    renderClasses(classes, containerId) {
        const container = document.getElementById(containerId);
        if (!classes || classes.length === 0) {
            container.innerHTML = '<p>אין כיתות להצגה</p>';
            return;
        }

        container.innerHTML = classes.map(classItem => {
            const isTeacherOfClass = authManager.isAdmin() || 
                classItem.teachers?.some(t => t._id === authManager.currentUser.id) ||
                classItem.teacher?._id === authManager.currentUser.id;
            
            return `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${classItem.name}</div>
                </div>
                <div class="announcement-content">
                    <p><strong>מספר תלמידים:</strong> ${classItem.students?.length || 0}</p>
                    <p><strong>מספר מורים:</strong> ${classItem.teachers?.length || 0}</p>
                    ${isTeacherOfClass ? `
                        <div class="class-management-actions">
                            <button class="btn btn-secondary" onclick="uiManager.manageClass('${classItem._id}')">ניהול תלמידים וכיתה</button>
                            <button class="btn btn-warning" onclick="uiManager.editClass('${classItem._id}')">עריכה</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `}).join('');
    }

    renderUsers(users, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = users.map(user => `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${user.name}</div>
                    <div class="announcement-date">${this.getRoleDisplayName(user.role)}</div>
                </div>
                <div class="announcement-content">
                    <p>${user.email}</p>
                    ${user.role !== 'admin' ? `
                        <button class="btn btn-danger btn-sm" onclick="uiManager.deleteUser('${user._id}')">מחיקה</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    renderAdminClasses(classes, containerId) {
        this.renderClasses(classes, containerId); // Reuse renderClasses logic
    }

    // --- Modal & Action Functions ---

    // ✅ פונקציה ראשית לניהול כיתה (מציגה תלמידים + כפתורי הוספה/הסרה)
    async manageClass(classId) {
        try {
            const classes = await dbManager.getClasses();
            const classItem = classes.find(c => c._id === classId);
            
            if (!classItem) return this.showError('כיתה לא נמצאה');

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2>ניהול כיתה - ${classItem.name}</h2>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="announcement-content">
                        <h3>מורים:</h3>
                        <ul>${classItem.teachers?.map(t => `<li>${t.name}</li>`).join('') || 'אין'}</ul>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 10px;">
                            <h3>תלמידים (${classItem.students?.length || 0}):</h3>
                            <button class="btn btn-sm" onclick="uiManager.openAddStudentToClassModal('${classId}')">
                                <i class="fas fa-plus"></i> הוסף תלמיד לכיתה
                            </button>
                        </div>
                        <ul style="max-height: 250px; overflow-y: auto; background: #f9f9f9; padding: 10px; margin-top: 10px;">
                            ${classItem.students?.length > 0 ? classItem.students.map(s => `
                                <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                                    <span>${s.name} (${s.email})</span>
                                    <button class="btn btn-danger btn-sm" onclick="uiManager.removeStudentFromClass('${classId}', '${s._id}')" title="הסר תלמיד מהכיתה">
                                        <i class="fas fa-times"></i> הסר
                                    </button>
                                </li>
                            `).join('') : '<li>אין תלמידים משויכים לכיתה זו</li>'}
                        </ul>
                        
                        <div class="class-management-actions" style="margin-top: 20px;">
                            <button class="btn" onclick="uiManager.viewClassAssignments('${classId}')">משימות</button>
                            <button class="btn btn-secondary" onclick="uiManager.viewClassAnnouncements('${classId}')">הודעות</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.querySelector('.close-modal').onclick = () => document.body.removeChild(modal);
            modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };
        } catch (error) {
            this.showError('שגיאה בטעינת כיתה: ' + error.message);
        }
    }

    // ✅ פתיחת מודל הוספת תלמיד ספציפי (מציג רק תלמידים שלא בכיתה)
    async openAddStudentToClassModal(classId) {
        try {
            const [users, classes] = await Promise.all([dbManager.getUsers(), dbManager.getClasses()]);
            const currentClass = classes.find(c => c._id === classId);
            
            // סינון: רק תלמידים שעדיין לא בכיתה
            const existingStudentIds = currentClass.students.map(s => s._id);
            const availableStudents = users.filter(u => u.role === 'student' && !existingStudentIds.includes(u._id));

            const modal = document.getElementById('add-student-to-class-modal');
            const select = document.getElementById('student-select');
            document.getElementById('add-student-class-id').value = classId;

            if (availableStudents.length === 0) {
                select.innerHTML = '<option disabled selected>אין תלמידים זמינים להוספה</option>';
            } else {
                select.innerHTML = '<option value="" disabled selected>בחר תלמיד...</option>' + 
                    availableStudents.map(s => `<option value="${s._id}">${s.name} (${s.email})</option>`).join('');
            }
            
            modal.style.display = 'flex';
            document.getElementById('add-student-to-class-form').onsubmit = (e) => this.handleAddStudentToClass(e);

        } catch (error) {
            this.showError('שגיאה בטעינת תלמידים: ' + error.message);
        }
    }

    // ✅ ביצוע הוספת תלמיד בפועל
    async handleAddStudentToClass(e) {
        e.preventDefault();
        const classId = document.getElementById('add-student-class-id').value;
        const studentId = document.getElementById('student-select').value;
        
        if (!studentId) return this.showError('נא לבחור תלמיד');

        try {
            const classes = await dbManager.getClasses();
            const currentClass = classes.find(c => c._id === classId);
            
            const teacherIds = currentClass.teachers.map(t => t._id);
            const studentIds = currentClass.students.map(s => s._id);
            studentIds.push(studentId); // הוספת התלמיד

            await dbManager.updateClass(classId, { teachers: teacherIds, students: studentIds });
            
            this.showSuccess('התלמיד נוסף בהצלחה');
            document.getElementById('add-student-to-class-modal').style.display = 'none';
            
            // סגירת מודל הניהול הראשי ופתיחתו מחדש כדי לרענן את הרשימה
            document.querySelectorAll('.modal').forEach(m => { if (!m.id) m.remove(); });
            this.manageClass(classId); 
            this.loadPageData('classes'); 
        } catch (error) {
            this.showError('שגיאה: ' + error.message);
        }
    }

    // ✅ הסרת תלמיד מהכיתה
    async removeStudentFromClass(classId, studentId) {
        if (!confirm('האם להסיר את התלמיד מהכיתה?')) return;

        try {
            const classes = await dbManager.getClasses();
            const currentClass = classes.find(c => c._id === classId);
            
            const teacherIds = currentClass.teachers.map(t => t._id);
            const studentIds = currentClass.students
                .map(s => s._id)
                .filter(id => id !== studentId); // סינון התלמיד החוצה

            await dbManager.updateClass(classId, { teachers: teacherIds, students: studentIds });

            this.showSuccess('התלמיד הוסר מהכיתה');
            document.querySelectorAll('.modal').forEach(m => { if (!m.id) m.remove(); });
            this.manageClass(classId); // רענון המודל
            this.loadPageData('classes');
        } catch (error) {
            this.showError('שגיאה: ' + error.message);
        }
    }

    // יתר הפונקציות (Login, Register, Logout, וכו') נשארות זהות...
    openLoginModal() { document.getElementById('login-modal').style.display = 'flex'; }
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        this.currentFile = null;
    }
    
    async handleLogin(e) {
        e.preventDefault();
        const result = await authManager.login(document.getElementById('login-email').value, document.getElementById('login-password').value);
        if (result.success) {
            this.closeAllModals();
            this.showPage('home');
        } else {
            this.showError(result.error);
        }
    }

    async logout() {
        await authManager.logout();
        this.showPage('home');
    }

    // Helpers
    formatDate(dateString) { return dateString ? new Date(dateString).toLocaleDateString('he-IL') : ''; }
    getRoleDisplayName(role) { return role === 'student' ? 'תלמיד' : role === 'teacher' ? 'מורה' : 'מנהל'; }
    showError(msg) { this.showNotification(msg, 'error'); }
    showSuccess(msg) { this.showNotification(msg, 'success'); }
    
    showNotification(message, type = 'info') {
        const n = document.createElement('div');
        n.className = `notification notification-${type}`;
        n.innerHTML = `<div class="notification-content"><span>${message}</span><button class="notification-close">&times;</button></div>`;
        n.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: ${type==='error'?'#e74c3c':'#2ecc71'}; color: white; padding: 12px 20px; z-index: 10000; border-radius: 4px;`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 5000);
        n.querySelector('.notification-close').onclick = () => n.remove();
    }
}

const uiManager = new UIManager();
