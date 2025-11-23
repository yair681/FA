// ✅ תיקון: ייבוא מפורש של המחלקות
import { AuthManager } from './auth.js';
import { DatabaseManager } from './database.js';

// UI Manager
export class UIManager { // ✅ שינוי: הוספת export
    constructor() {
        this.currentPage = 'home';
        this.currentAssignmentId = null;
        this.currentFile = null;
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
        document.getElementById('add-announcement-form')?.addEventListener('submit', (e) => this.handleAddAnnouncement(e));
        document.getElementById('add-assignment-form')?.addEventListener('submit', (e) => this.handleAddAssignment(e));
        document.getElementById('submit-assignment-form')?.addEventListener('submit', (e) => this.handleSubmitAssignment(e));
        document.getElementById('add-user-form')?.addEventListener('submit', (e) => this.handleAddUser(e));
        document.getElementById('add-class-form')?.addEventListener('submit', (e) => this.handleAddClass(e));
        document.getElementById('admin-add-class-btn')?.addEventListener('click', () => this.openAddClassModal());
        document.getElementById('change-password-form')?.addEventListener('submit', (e) => this.handleChangePassword(e));
        document.getElementById('add-event-form')?.addEventListener('submit', (e) => this.handleAddEvent(e));
        document.getElementById('add-media-form')?.addEventListener('submit', (e) => this.handleAddMedia(e));

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
        document.getElementById('add-event-btn')?.addEventListener('click', () => this.openAddEventModal());
        document.getElementById('add-media-btn')?.addEventListener('click', () => this.openAddMediaModal());

        // File handling
        document.getElementById('submission-file')?.addEventListener('change', (e) => this.handleFileSelect(e, 'submission'));
        document.getElementById('file-upload-area')?.addEventListener('click', () => document.getElementById('submission-file').click());
        document.getElementById('remove-file')?.addEventListener('click', () => this.clearFileSelection('submission'));
        
        document.getElementById('media-file')?.addEventListener('change', (e) => this.handleFileSelect(e, 'media'));
        document.getElementById('media-upload-area')?.addEventListener('click', () => document.getElementById('media-file').click());
        
        // Dynamic select changes
        document.getElementById('announcement-type')?.addEventListener('change', (e) => {
            const classSelectGroup = document.getElementById('class-selection-group');
            if (e.target.value === 'class') {
                classSelectGroup.style.display = 'block';
                this.loadClassOptions(document.getElementById('announcement-class'));
            } else {
                classSelectGroup.style.display = 'none';
            }
        });
    }

    async loadClassOptions(selectElement, classesToPreSelect = []) {
        try {
            const classes = await window.dbManager.getClasses();
            selectElement.innerHTML = ''; // Clear previous options
            
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls._id;
                option.textContent = cls.name;
                if (classesToPreSelect.includes(cls._id)) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });
        } catch (error) {
            this.showError('שגיאה בטעינת כיתות');
            console.error(error);
        }
    }

    async loadTeacherOptions(selectElement, teachersToPreSelect = []) {
        try {
            const teachers = await window.dbManager.getTeachers();
            selectElement.innerHTML = '';
            teachers.forEach(teacher => {
                const option = document.createElement('option');
                option.value = teacher._id;
                option.textContent = teacher.name;
                if (teachersToPreSelect.includes(teacher._id)) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });
        } catch (error) {
            this.showError('שגיאה בטעינת מורים');
            console.error(error);
        }
    }

    handleFileSelect(e, context) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 100 * 1024 * 1024) { // 100MB limit
            this.showError('הקובץ גדול מדי. הגודל המקסימלי הוא 100MB.');
            e.target.value = null; // Clear the input
            this.clearFileSelection(context);
            return;
        }

        this.currentFile = file;

        if (context === 'submission') {
            document.getElementById('file-preview').style.display = 'block';
            document.getElementById('file-name').textContent = file.name;
            document.getElementById('file-size').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
            document.getElementById('file-upload-area').style.display = 'none';
        } else if (context === 'media') {
            const preview = document.getElementById('media-preview');
            preview.innerHTML = `<p>קובץ נבחר: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</p>`;
            preview.style.display = 'block';
        }
    }

    clearFileSelection(context) {
        this.currentFile = null;
        if (context === 'submission') {
            document.getElementById('submission-file').value = null;
            document.getElementById('file-preview').style.display = 'none';
            document.getElementById('file-upload-area').style.display = 'flex';
        } else if (context === 'media') {
            document.getElementById('media-file').value = null;
            document.getElementById('media-preview').style.display = 'none';
            document.getElementById('media-preview').innerHTML = '';
        }
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.style.display = 'none';
        });
        document.getElementById(`${pageId}-page`).style.display = 'block';
        this.currentPage = pageId;
        this.loadPageData(pageId);
    }

    async loadPageData(pageId) {
        // ... (קוד טעינת הנתונים נשאר זהה) ...
        switch (pageId) {
            case 'announcements':
                this.loadAnnouncements();
                break;
            case 'classes':
                this.loadUserClasses();
                break;
            case 'assignments':
                this.loadAssignmentsPage();
                break;
            case 'events':
                this.loadEvents();
                break;
            case 'history':
                this.loadMediaGallery();
                break;
            case 'settings':
                this.loadSettings();
                break;
            case 'admin':
                this.loadAdminPage();
                break;
            default:
                break;
        }
    }

    // Helper functions for loading data
    async loadAnnouncements() {
        // ... (קוד loadAnnouncements נשאר זהה) ...
        try {
            const list = document.getElementById('global-announcements-list');
            list.innerHTML = '<div class="loading">טוען הודעות...</div>';
            const announcements = await window.dbManager.getAnnouncements();
            list.innerHTML = '';
            
            if (announcements.length === 0) {
                list.innerHTML = '<p>אין הודעות כלליות כרגע.</p>';
                return;
            }

            announcements.forEach(announcement => {
                const date = new Date(announcement.createdAt).toLocaleDateString('he-IL');
                const item = document.createElement('div');
                item.className = 'card announcement-item';
                item.innerHTML = `
                    <div class="card-header">
                        <h3 class="card-title">${announcement.title}</h3>
                        ${(window.authManager.isTeacher() || window.authManager.isAdmin()) ? 
                            `<button class="btn btn-danger btn-sm delete-announcement" data-id="${announcement._id}">מחק</button>` : ''}
                    </div>
                    <div class="announcement-content">
                        <p>${announcement.content}</p>
                        <small>פורסם בתאריך: ${date} ע"י ${announcement.author?.name || 'מערכת'}</small>
                    </div>
                `;
                list.appendChild(item);
            });

            document.querySelectorAll('.delete-announcement').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleDeleteAnnouncement(e.target.dataset.id));
            });
        } catch (error) {
            this.showError('שגיאה בטעינת הודעות');
            console.error(error);
        }
    }

    async loadUserClasses() {
        // ... (קוד loadUserClasses נשאר זהה) ...
        try {
            const list = document.getElementById('classes-list');
            list.innerHTML = '<div class="loading">טוען כיתות...</div>';
            
            const classes = await window.dbManager.getUserClasses();
            list.innerHTML = '';

            if (classes.length === 0) {
                list.innerHTML = '<p>לא שויכת לכיתות.</p>';
                return;
            }

            classes.forEach(cls => {
                const item = document.createElement('div');
                item.className = 'card class-item';
                item.innerHTML = `
                    <div class="card-header">
                        <h3 class="card-title">${cls.name}</h3>
                        <div class="class-actions">
                            ${(window.authManager.isTeacher() || window.authManager.isAdmin()) ? 
                                `<button class="btn btn-secondary btn-sm edit-class" data-id="${cls._id}">ערוך כיתה</button>` : ''}
                        </div>
                    </div>
                    <div class="class-info">
                        <p><strong>מורים:</strong> ${cls.teachers.map(t => t.name).join(', ')}</p>
                        <p><strong>תלמידים:</strong> ${cls.students.length} תלמידים</p>
                    </div>
                `;
                list.appendChild(item);
            });

            document.querySelectorAll('.edit-class').forEach(btn => {
                btn.addEventListener('click', (e) => this.openEditClassModal(e.target.dataset.id));
            });
        } catch (error) {
            this.showError('שגיאה בטעינת הכיתות שלך');
            console.error(error);
        }
    }

    async loadAssignmentsPage() {
        const isTeacher = window.authManager.isTeacher();
        const isAuthenticated = window.authManager.isAuthenticated();
        
        document.getElementById('student-assignments-section').style.display = 'none';
        document.getElementById('teacher-assignments-section').style.display = 'none';
        document.getElementById('guest-assignments-section').style.display = 'block'; // Default for guest

        if (isAuthenticated) {
            document.getElementById('guest-assignments-section').style.display = 'none';
            if (isTeacher) {
                document.getElementById('teacher-assignments-section').style.display = 'block';
                this.loadTeacherAssignments();
            } else { // Student
                document.getElementById('student-assignments-section').style.display = 'block';
                this.loadStudentAssignments();
            }
        }
    }

    async loadStudentAssignments() {
        // ... (קוד loadStudentAssignments נשאר זהה) ...
        try {
            const list = document.getElementById('assignments-list');
            list.innerHTML = '<div class="loading">טוען משימות...</div>';
            
            const assignments = await window.dbManager.getAssignments(); // Gets assignments for the user's classes
            list.innerHTML = '';

            if (assignments.length === 0) {
                list.innerHTML = '<p>אין משימות פתוחות כרגע.</p>';
                return;
            }

            assignments.forEach(assignment => {
                const dueDate = new Date(assignment.dueDate).toLocaleDateString('he-IL');
                const isSubmitted = assignment.submissions.some(sub => sub.student === window.authManager.currentUser._id);

                const item = document.createElement('div');
                item.className = `card assignment-item ${isSubmitted ? 'submitted' : ''}`;
                item.innerHTML = `
                    <div class="card-header">
                        <h3 class="card-title">${assignment.title}</h3>
                        <div class="assignment-actions">
                            <span class="badge ${isSubmitted ? 'badge-success' : 'badge-danger'}">${isSubmitted ? 'הוגש' : 'טרם הוגש'}</span>
                            <button class="btn btn-primary btn-sm submit-assignment" data-id="${assignment._id}" ${isSubmitted ? 'disabled' : ''}>הגשה</button>
                        </div>
                    </div>
                    <div class="assignment-content">
                        <p><strong>כיתה:</strong> ${assignment.class.name}</p>
                        <p><strong>הגשה עד:</strong> ${dueDate}</p>
                        <p>${assignment.description}</p>
                    </div>
                `;
                list.appendChild(item);
            });

            document.querySelectorAll('.submit-assignment').forEach(btn => {
                btn.addEventListener('click', (e) => this.openSubmitAssignmentModal(e.target.dataset.id));
            });
        } catch (error) {
            this.showError('שגיאה בטעינת משימות');
            console.error(error);
        }
    }

    async loadTeacherAssignments() {
        // ... (קוד loadTeacherAssignments נשאר זהה) ...
        try {
            const list = document.getElementById('teacher-assignments-list');
            list.innerHTML = '<div class="loading">טוען משימות...</div>';

            const assignments = await window.dbManager.getTeacherAssignments(); 
            list.innerHTML = '';

            if (assignments.length === 0) {
                list.innerHTML = '<p>לא יצרת משימות עדיין.</p>';
                return;
            }

            assignments.forEach(assignment => {
                const dueDate = new Date(assignment.dueDate).toLocaleDateString('he-IL');
                const item = document.createElement('div');
                item.className = 'card assignment-item';
                item.innerHTML = `
                    <div class="card-header">
                        <h3 class="card-title">${assignment.title} (${assignment.class.name})</h3>
                        <div class="assignment-actions">
                            <span class="badge badge-info">${assignment.submissions.length} הגשות</span>
                            <button class="btn btn-secondary btn-sm view-submissions" data-id="${assignment._id}">צפייה בהגשות</button>
                            <button class="btn btn-danger btn-sm delete-assignment" data-id="${assignment._id}">מחק</button>
                        </div>
                    </div>
                    <div class="assignment-content">
                        <p><strong>הגשה עד:</strong> ${dueDate}</p>
                        <p>${assignment.description.substring(0, 100)}...</p>
                    </div>
                `;
                list.appendChild(item);
            });

            document.querySelectorAll('.view-submissions').forEach(btn => {
                btn.addEventListener('click', (e) => this.openViewSubmissionsModal(e.target.dataset.id));
            });
            document.querySelectorAll('.delete-assignment').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleDeleteAssignment(e.target.dataset.id));
            });

        } catch (error) {
            this.showError('שגיאה בטעינת משימות לניהול');
            console.error(error);
        }
    }

    async loadEvents() {
        // ... (קוד loadEvents נשאר זהה) ...
        try {
            const list = document.getElementById('events-list');
            list.innerHTML = '<div class="loading">טוען אירועים...</div>';
            
            const events = await window.dbManager.getEvents();
            list.innerHTML = '';

            if (events.length === 0) {
                list.innerHTML = '<p>אין אירועים קרובים כרגע.</p>';
                return;
            }

            events.sort((a, b) => new Date(a.date) - new Date(b.date));

            events.forEach(event => {
                const date = new Date(event.date).toLocaleDateString('he-IL');
                const item = document.createElement('div');
                item.className = 'card event-item';
                item.innerHTML = `
                    <div class="card-header">
                        <h3 class="card-title">${event.title}</h3>
                        ${(window.authManager.isTeacher() || window.authManager.isAdmin()) ? 
                            `<button class="btn btn-danger btn-sm delete-event" data-id="${event._id}">מחק</button>` : ''}
                    </div>
                    <div class="event-content">
                        <p><strong>תאריך:</strong> ${date}</p>
                        <p>${event.description}</p>
                    </div>
                `;
                list.appendChild(item);
            });

            document.querySelectorAll('.delete-event').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleDeleteEvent(e.target.dataset.id));
            });
        } catch (error) {
            this.showError('שגיאה בטעינת אירועים');
            console.error(error);
        }
    }

    async loadMediaGallery() {
        // ... (קוד loadMediaGallery נשאר זהה) ...
        try {
            const gallery = document.getElementById('media-gallery');
            gallery.innerHTML = '<div class="loading">טוען מדיה...</div>';

            const mediaItems = await window.dbManager.getMedia();
            gallery.innerHTML = '';
            gallery.className = 'media-gallery';

            if (mediaItems.length === 0) {
                gallery.innerHTML = '<p>אין פריטי מדיה בגלריה.</p>';
                return;
            }

            mediaItems.forEach(item => {
                const date = new Date(item.date).toLocaleDateString('he-IL');
                let mediaContent;
                if (item.type === 'image') {
                    mediaContent = `<img src="${item.url}" alt="${item.title}">`;
                } else if (item.type === 'video') {
                    mediaContent = `<video controls src="${item.url}"></video>`;
                } else {
                    mediaContent = `<a href="${item.url}" target="_blank" class="file-link"><i class="fas fa-file-alt"></i> הורדת קובץ</a>`;
                }

                const mediaElement = document.createElement('div');
                mediaElement.className = 'media-item';
                mediaElement.innerHTML = `
                    ${mediaContent}
                    <div class="media-info">
                        <h4>${item.title}</h4>
                        <small>${date}</small>
                        ${(window.authManager.isAdmin()) ? 
                            `<button class="btn btn-danger btn-sm delete-media" data-id="${item._id}">מחק</button>` : ''}
                    </div>
                `;
                gallery.appendChild(mediaElement);
            });

            document.querySelectorAll('.delete-media').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleDeleteMedia(e.target.dataset.id));
            });
        } catch (error) {
            this.showError('שגיאה בטעינת גלריית המדיה');
            console.error(error);
        }
    }

    async loadAdminPage() {
        // ... (קוד loadAdminPage נשאר זהה) ...
        try {
            if (!window.authManager.isAdmin()) {
                document.getElementById('admin-page').innerHTML = '<div class="card"><p>אין לך הרשאות ניהול.</p></div>';
                return;
            }

            // Load Users
            const usersList = document.getElementById('users-list');
            usersList.innerHTML = '<div class="loading">טוען משתמשים...</div>';
            const users = await window.dbManager.getUsers();
            usersList.innerHTML = '';

            users.forEach(user => {
                const item = document.createElement('div');
                item.className = 'user-item card';
                item.innerHTML = `
                    <div class="card-header">
                        <h3 class="card-title">${user.name}</h3>
                        <div class="user-actions">
                            <span class="badge badge-info">${user.role}</span>
                            <button class="btn btn-secondary btn-sm edit-user" data-id="${user._id}">ערוך</button>
                            <button class="btn btn-danger btn-sm delete-user" data-id="${user._id}">מחק</button>
                        </div>
                    </div>
                    <p>אימייל: ${user.email}</p>
                    <p>כיתות משויכות: ${user.classes.length}</p>
                `;
                usersList.appendChild(item);
            });

            document.querySelectorAll('.edit-user').forEach(btn => {
                btn.addEventListener('click', (e) => this.openEditUserModal(e.target.dataset.id, users.find(u => u._id === e.target.dataset.id)));
            });
            document.querySelectorAll('.delete-user').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleDeleteUser(e.target.dataset.id));
            });

            // Load All Classes
            const adminClassesList = document.getElementById('admin-classes-list');
            adminClassesList.innerHTML = '<div class="loading">טוען כיתות...</div>';
            const allClasses = await window.dbManager.getClasses();
            adminClassesList.innerHTML = '';

            allClasses.forEach(cls => {
                const item = document.createElement('div');
                item.className = 'class-item card';
                item.innerHTML = `
                    <div class="card-header">
                        <h3 class="card-title">${cls.name}</h3>
                        <div class="class-actions">
                            <button class="btn btn-secondary btn-sm edit-class" data-id="${cls._id}">ערוך</button>
                            <button class="btn btn-danger btn-sm delete-class" data-id="${cls._id}">מחק</button>
                        </div>
                    </div>
                    <p>מורים: ${cls.teachers.map(t => t.name).join(', ')}</p>
                    <p>תלמידים: ${cls.students.length}</p>
                `;
                adminClassesList.appendChild(item);
            });

            document.querySelectorAll('.edit-class').forEach(btn => {
                btn.addEventListener('click', (e) => this.openEditClassModal(e.target.dataset.id));
            });
            document.querySelectorAll('.delete-class').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleDeleteClass(e.target.dataset.id));
            });

        } catch (error) {
            this.showError('שגיאה בטעינת נתוני הניהול');
            console.error(error);
        }
    }

    // Modal Opening/Closing/Form Handling
    openLoginModal() {
        document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('login-error').style.display = 'none';
        document.getElementById('login-form').reset();
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        
        try {
            // הקריאה למנהל האימות הגלובלי (window.authManager)
            const result = await window.authManager.login(email, password); 

            if (result.success) {
                this.showSuccess('התחברת בהצלחה');
                this.closeAllModals();
            } else {
                errorDiv.textContent = result.error;
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('שגיאת התחברות: ' + error.message);
        }
    }
    
    // ... (שאר שיטות ה-Modal וה-Handlers) ...

    logout() {
        window.authManager.logout();
        this.showSuccess('התנתקת בהצלחה');
        this.showPage('home');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    // ... (שאר שיטות ה-Modal Opening/Closing/Form Handling) ...
    openAddAnnouncementModal() {
        document.getElementById('add-announcement-form').reset();
        document.getElementById('class-selection-group').style.display = 'none';
        document.getElementById('announcement-type').value = 'global';
        document.getElementById('add-announcement-modal').style.display = 'flex';
    }

    async handleAddAnnouncement(e) {
        e.preventDefault();
        const type = document.getElementById('announcement-type').value;
        const announcementData = {
            title: document.getElementById('announcement-title').value,
            content: document.getElementById('announcement-content').value,
            type: type,
            classId: type === 'class' ? document.getElementById('announcement-class').value : null,
        };

        try {
            await window.dbManager.createAnnouncement(announcementData);
            this.showSuccess('הודעה פורסמה בהצלחה!');
            this.closeAllModals();
            this.loadAnnouncements();
        } catch (error) {
            this.showError('שגיאה בפרסום הודעה: ' + error.message);
        }
    }

    async handleDeleteAnnouncement(id) {
        if (!confirm('האם אתה בטוח שברצונך למחוק הודעה זו?')) return;
        try {
            await window.dbManager.deleteAnnouncement(id);
            this.showSuccess('הודעה נמחקה בהצלחה');
            this.loadAnnouncements();
        } catch (error) {
            this.showError('שגיאה במחיקת הודעה: ' + error.message);
        }
    }

    openAddAssignmentModal() {
        document.getElementById('add-assignment-form').reset();
        this.loadClassOptions(document.getElementById('assignment-class'));
        document.getElementById('add-assignment-modal').style.display = 'flex';
    }

    async handleAddAssignment(e) {
        e.preventDefault();
        const assignmentData = {
            title: document.getElementById('assignment-title').value,
            description: document.getElementById('assignment-description').value,
            classId: document.getElementById('assignment-class').value,
            dueDate: document.getElementById('assignment-due-date').value,
        };

        try {
            await window.dbManager.createAssignment(assignmentData);
            this.showSuccess('משימה נוצרה בהצלחה!');
            this.closeAllModals();
            this.loadTeacherAssignments();
        } catch (error) {
            this.showError('שגיאה ביצירת משימה: ' + error.message);
        }
    }

    async handleDeleteAssignment(id) {
        if (!confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) return;
        try {
            await window.dbManager.deleteAssignment(id);
            this.showSuccess('המשימה נמחקה בהצלחה');
            this.loadTeacherAssignments();
        } catch (error) {
            this.showError('שגיאה במחיקת משימה: ' + error.message);
        }
    }

    openSubmitAssignmentModal(assignmentId) {
        this.currentAssignmentId = assignmentId;
        document.getElementById('submission-assignment-id').value = assignmentId;
        document.getElementById('submit-assignment-form').reset();
        this.clearFileSelection('submission');
        document.getElementById('submit-assignment-modal').style.display = 'flex';
    }

    async handleSubmitAssignment(e) {
        e.preventDefault();
        const assignmentId = document.getElementById('submission-assignment-id').value;
        const submissionText = document.getElementById('submission-text').value;

        if (!submissionText && !this.currentFile) {
            this.showError('יש להגיש טקסט או קובץ.');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('assignmentId', assignmentId);
            formData.append('submissionText', submissionText);
            
            if (this.currentFile) {
                formData.append('file', this.currentFile);
            }

            // Using fetch directly for file upload (not via dbManager.makeRequest)
            const response = await fetch(`/api/assignments/${assignmentId}/submit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.authManager.token}`,
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || response.statusText);
            }

            this.showSuccess('המשימה הוגשה בהצלחה!');
            this.closeAllModals();
            this.loadStudentAssignments();
        } catch (error) {
            this.showError('שגיאה בהגשת משימה: ' + error.message);
        }
    }

    openViewSubmissionsModal(assignmentId) {
        this.currentAssignmentId = assignmentId;
        this.loadSubmissions(assignmentId);
        document.getElementById('view-submissions-modal').style.display = 'flex';
    }

    async loadSubmissions(assignmentId) {
        // ... (קוד loadSubmissions נשאר זהה) ...
        const list = document.getElementById('submissions-list');
        list.innerHTML = '<div class="loading">טוען הגשות...</div>';

        try {
            const response = await fetch(`/api/assignments/${assignmentId}/submissions`, {
                headers: {
                    'Authorization': `Bearer ${window.authManager.token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || response.statusText);
            }

            const submissions = await response.json();
            list.innerHTML = '';

            if (submissions.length === 0) {
                list.innerHTML = '<p>עדיין לא הוגשו משימות.</p>';
                return;
            }

            submissions.forEach(submission => {
                const date = new Date(submission.createdAt).toLocaleDateString('he-IL');
                let fileLink = submission.fileUrl ? 
                    `<p><strong>קובץ מצורף:</strong> <a href="${submission.fileUrl}" target="_blank">הורדת קובץ</a></p>` : '';
                
                const item = document.createElement('div');
                item.className = 'card submission-item';
                item.innerHTML = `
                    <div class="card-header">
                        <h4 class="card-title">הגשה מאת: ${submission.student.name}</h4>
                        <small>תאריך: ${date}</small>
                    </div>
                    <div class="submission-content">
                        <p><strong>תוכן:</strong> ${submission.submissionText || 'אין תוכן טקסטואלי'}</p>
                        ${fileLink}
                    </div>
                `;
                list.appendChild(item);
            });

        } catch (error) {
            this.showError('שגיאה בטעינת הגשות: ' + error.message);
            console.error(error);
        }
    }

    openAddUserModal() {
        document.getElementById('add-user-form').reset();
        document.getElementById('add-user-modal').style.display = 'flex';
    }

    async handleAddUser(e) {
        e.preventDefault();
        const userData = {
            name: document.getElementById('user-name').value,
            email: document.getElementById('user-email').value,
            password: document.getElementById('user-password').value,
            role: document.getElementById('user-role').value,
        };

        try {
            await window.dbManager.createUser(userData);
            this.showSuccess('משתמש נוצר בהצלחה!');
            this.closeAllModals();
            this.loadAdminPage();
        } catch (error) {
            this.showError('שגיאה ביצירת משתמש: ' + error.message);
        }
    }

    async handleDeleteUser(id) {
        if (!confirm('האם אתה בטוח שברצונך למחוק משתמש זה?')) return;
        try {
            await window.dbManager.deleteUser(id);
            this.showSuccess('משתמש נמחק בהצלחה');
            this.loadAdminPage();
        } catch (error) {
            this.showError('שגיאה במחיקת משתמש: ' + error.message);
        }
    }

    openEditUserModal(userId, user) {
        document.getElementById('edit-user-form').dataset.userId = userId;
        document.getElementById('edit-user-name').value = user.name;
        document.getElementById('edit-user-email').value = user.email;
        document.getElementById('edit-user-role').value = user.role;
        document.getElementById('edit-user-password').value = ''; 
        document.getElementById('edit-user-modal').style.display = 'flex';
    }

    // ... (שאר שיטות ה-Modal Opening/Closing/Form Handling) ...

    openAddClassModal() {
        document.getElementById('add-class-form').reset();
        this.loadTeacherOptions(document.getElementById('class-teachers'));
        document.getElementById('add-class-modal').style.display = 'flex';
    }

    async handleAddClass(e) {
        e.preventDefault();
        const classData = {
            name: document.getElementById('class-name').value,
            teachers: Array.from(document.getElementById('class-teachers').selectedOptions).map(opt => opt.value)
        };

        try {
            await window.dbManager.createClass(classData);
            this.showSuccess('כיתה נוצרה בהצלחה!');
            this.closeAllModals();
            this.loadAdminPage();
            this.loadUserClasses();
        } catch (error) {
            this.showError('שגיאה ביצירת כיתה: ' + error.message);
        }
    }

    async handleDeleteClass(id) {
        if (!confirm('האם אתה בטוח שברצונך למחוק כיתה זו?')) return;
        try {
            await window.dbManager.deleteClass(id);
            this.showSuccess('הכיתה נמחקה בהצלחה');
            this.loadAdminPage();
            this.loadUserClasses();
        } catch (error) {
            this.showError('שגיאה במחיקת כיתה: ' + error.message);
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            this.showError('הסיסמה החדשה ואימות הסיסמה אינם תואמים.');
            return;
        }

        try {
            await window.dbManager.changePassword(currentPassword, newPassword);
            this.showSuccess('הסיסמה שונתה בהצלחה!');
            document.getElementById('change-password-form').reset();
        } catch (error) {
            this.showError('שגיאה בשינוי סיסמה: ' + error.message);
        }
    }

    openAddEventModal() {
        document.getElementById('add-event-form').reset();
        document.getElementById('add-event-modal').style.display = 'flex';
    }

    async handleAddEvent(e) {
        e.preventDefault();
        const eventData = {
            title: document.getElementById('event-title').value,
            description: document.getElementById('event-description').value,
            date: document.getElementById('event-date').value,
        };

        try {
            await window.dbManager.createEvent(eventData);
            this.showSuccess('אירוע נוצר בהצלחה!');
            this.closeAllModals();
            this.loadEvents();
        } catch (error) {
            this.showError('שגיאה ביצירת אירוע: ' + error.message);
        }
    }

    async handleDeleteEvent(id) {
        if (!confirm('האם אתה בטוח שברצונך למחוק אירוע זה?')) return;
        try {
            await window.dbManager.deleteEvent(id);
            this.showSuccess('האירוע נמחק בהצלחה');
            this.loadEvents();
        } catch (error) {
            this.showError('שגיאה במחיקת אירוע: ' + error.message);
        }
    }

    openAddMediaModal() {
        document.getElementById('add-media-form').reset();
        this.clearFileSelection('media');
        document.getElementById('add-media-modal').style.display = 'flex';
    }

    async handleAddMedia(e) {
        e.preventDefault();

        if (!this.currentFile) {
            this.showError('יש לבחור קובץ להעלאה.');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('title', document.getElementById('media-title').value);
            formData.append('type', document.getElementById('media-type').value);
            formData.append('date', document.getElementById('media-date').value);
            formData.append('file', this.currentFile);

            // Using fetch directly for file upload (not via dbManager.makeRequest)
            const response = await fetch('/api/media', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.authManager.token}`,
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || response.statusText);
            }

            this.showSuccess('המדיה הועלתה בהצלחה!');
            this.closeAllModals();
            this.loadMediaGallery();
        } catch (error) {
            this.showError('שגיאה בהעלאת מדיה: ' + error.message);
        }
    }

    async handleDeleteMedia(id) {
        if (!confirm('האם אתה בטוח שברצונך למחוק פריט מדיה זה?')) return;
        try {
            await window.dbManager.deleteMedia(id);
            this.showSuccess('פריט המדיה נמחק בהצלחה');
            this.loadMediaGallery();
        } catch (error) {
            this.showError('שגיאה במחיקת מדיה: ' + error.message);
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
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
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        notification.querySelector('.notification-close').addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

} // סוף המחלקה

// ✅ יצירת מופע גלובלי
window.uiManager = new UIManager();
