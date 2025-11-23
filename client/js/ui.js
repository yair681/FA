// UI Manager
class UIManager {
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
        document.getElementById('register-form')?.addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('add-announcement-form')?.addEventListener('submit', (e) => this.handleAddAnnouncement(e));
        document.getElementById('add-assignment-form')?.addEventListener('submit', (e) => this.handleAddAssignment(e));
        document.getElementById('submission-form')?.addEventListener('submit', (e) => this.handleSubmitAssignment(e));
        document.getElementById('add-user-form')?.addEventListener('submit', (e) => this.handleAddUser(e));
        document.getElementById('add-class-form')?.addEventListener('submit', (e) => this.handleAddClass(e));
        document.getElementById('add-event-form')?.addEventListener('submit', (e) => this.handleAddEvent(e));
        document.getElementById('add-media-form')?.addEventListener('submit', (e) => this.handleAddMedia(e));
        document.getElementById('change-password-form')?.addEventListener('submit', (e) => this.handleChangePassword(e));
        

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

        // File upload handlers
        this.initFileUploadHandlers();
    }

    // Utility function to log out
    logout() {
        authManager.logout();
        this.showPage('home');
        this.showSuccess('התנתקת בהצלחה');
    }

    initFileUploadHandlers() {
        // Assignment file upload
        const fileUploadArea = document.getElementById('file-upload-area');
        const submissionFile = document.getElementById('submission-file');
        
        if (fileUploadArea && submissionFile) {
            fileUploadArea.addEventListener('click', () => submissionFile.click());
            
            fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUploadArea.classList.add('dragover');
            });
            
            fileUploadArea.addEventListener('dragleave', () => {
                fileUploadArea.classList.remove('dragover');
            });
            
            fileUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUploadArea.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileSelect(e.dataTransfer.files[0]);
                }
            });
            
            submissionFile.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files[0]);
                }
            });
        }

        // Media file upload
        const mediaUploadArea = document.getElementById('media-upload-area');
        const mediaFile = document.getElementById('media-file');
        const mediaType = document.getElementById('media-type');
        
        if (mediaUploadArea && mediaFile) {
            mediaUploadArea.addEventListener('click', () => mediaFile.click());
            
            mediaType.addEventListener('change', (e) => {
                const fileTypes = document.getElementById('media-file-types');
                if (e.target.value === 'image') {
                    fileTypes.textContent = 'תמונות נתמכות: JPG, PNG, GIF (מקסימום 10MB)';
                    mediaFile.accept = '.jpg,.jpeg,.png,.gif';
                } else if (e.target.value === 'video') {
                    fileTypes.textContent = 'סרטונים נתמכים: MP4, MOV, AVI (מקסימום 100MB)';
                    mediaFile.accept = '.mp4,.mov,.avi';
                } else {
                    fileTypes.textContent = 'כל סוגי הקבצים נתמכים (מקסימום 100MB)';
                    mediaFile.removeAttribute('accept');
                }
            });
            
            mediaFile.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleMediaFileSelect(e.target.files[0]);
                }
            });
        }

        // Remove file button
        document.getElementById('remove-file')?.addEventListener('click', () => {
            this.removeSelectedFile();
        });
    }

    handleFileSelect(file) {
        // מגבלה כללית של 100MB
        if (file.size > 100 * 1024 * 1024) {
            this.showError('גודל הקובץ חייב להיות קטן מ-100MB');
            return;
        }

        this.currentFile = file;
        
        // Show file preview
        const filePreview = document.getElementById('file-preview');
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        
        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        filePreview.style.display = 'block';
        
        this.showSuccess('קובץ נבחר בהצלחה');
    }

    handleMediaFileSelect(file) {
        // מגבלה כללית של 100MB
        if (file.size > 100 * 1024 * 1024) {
            this.showError('גודל הקובץ חייב להיות קטן מ-100MB');
            return;
        }

        this.currentFile = file;
        
        // Show media preview
        const mediaPreview = document.getElementById('media-preview');
        mediaPreview.style.display = 'block';
        const mediaType = document.getElementById('media-type').value;
        
        if (mediaType === 'image') {
            const reader = new FileReader();
            reader.onload = (e) => {
                mediaPreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        } else if (mediaType === 'video') {
            const reader = new FileReader();
            reader.onload = (e) => {
                mediaPreview.innerHTML = `
                    <video controls>
                        <source src="${e.target.result}" type="video/mp4">
                        הדפדפן שלך אינו תומך בנגן וידאו.
                    </video>
                `;
            };
            reader.readAsDataURL(file);
        } else {
            // תצוגה לקבצים כלליים
            mediaPreview.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <i class="fas fa-file-alt" style="font-size: 3rem; color: var(--primary);"></i>
                    <p>${file.name}</p>
                </div>
            `;
        }
        
        this.showSuccess('קובץ נבחר בהצלחה');
    }

    removeSelectedFile() {
        this.currentFile = null;
        document.getElementById('file-preview').style.display = 'none';
        document.getElementById('submission-file').value = '';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    formatDate(dateString) {
        const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString('he-IL', options);
    }


    // --- PAGE LOADING ---
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
            if (error.message.includes('Authentication required')) {
                this.showError('התחברות נדרשת לצפייה בתוכן');
                this.openLoginModal();
            } else if (error.message.includes('Access denied')) {
                this.showError('אין לך הרשאה לגשת לדף זה');
                this.showPage('home');
            } else {
                this.showError('שגיאה בטעינת הנתונים');
            }
        }
    }
    
    async loadHomePage() {
        await this.loadMediaPage(); // Load media gallery on home page
    }

    async loadAnnouncementsPage() {
        const announcements = await dbManager.getAnnouncements();
        this.renderAnnouncements(announcements, 'global-announcements-list', true);
    }

    async loadClassesPage() {
        const classes = await dbManager.getClasses();
        this.renderClasses(classes, 'classes-list');
    }

    async loadAssignmentsPage() {
        const assignments = await dbManager.getAssignments();
        
        document.getElementById('student-assignments-section').style.display = 'none';
        document.getElementById('teacher-assignments-section').style.display = 'none';
        document.getElementById('guest-assignments-section').style.display = 'block';

        if (authManager.isStudent()) {
            document.getElementById('student-assignments-section').style.display = 'block';
            document.getElementById('guest-assignments-section').style.display = 'none';
            this.renderAssignments(assignments, 'assignments-list');
        } else if (authManager.isTeacher()) {
            document.getElementById('teacher-assignments-section').style.display = 'block';
            document.getElementById('guest-assignments-section').style.display = 'none';
            this.renderTeacherAssignments(assignments, 'teacher-assignments-list');
        } 
    }

    async loadEventsPage() {
        const events = await dbManager.getEvents();
        this.renderEvents(events, 'events-list');
        // Hide add event button if not teacher/admin
        const addEventBtn = document.getElementById('add-event-btn');
        if (addEventBtn) {
            addEventBtn.style.display = authManager.isTeacher() ? 'inline-block' : 'none';
        }
    }
    
    async loadHistoryPage() {
        // For now, history is just the media gallery
        await this.loadMediaPage();
    }
    
    async loadMediaPage() {
        const media = await dbManager.getMedia();
        this.renderMedia(media, 'media-gallery');
        
        const addMediaBtn = document.getElementById('add-media-btn');
        if (addMediaBtn) {
            addMediaBtn.style.display = authManager.isTeacher() ? 'inline-block' : 'none';
        }
    }

    async loadSettingsPage() {
        // Static content for now, maybe future features
        document.getElementById('current-user-email').textContent = authManager.currentUser.email;
    }

    async loadAdminPage() {
        if (!authManager.isAdmin()) {
            this.showError('גישת אדמין נדרשת');
            this.showPage('home');
            return;
        }

        const users = await dbManager.getUsers();
        this.renderAdminUsers(users, 'admin-users-list');

        const classes = await dbManager.getClasses();
        this.renderClasses(classes, 'admin-classes-list'); // Re-use class rendering logic
    }


    // --- RENDERING ---
    renderAnnouncements(announcements, containerId, showGlobalClass = false) {
        const container = document.getElementById(containerId);
        if (!announcements || announcements.length === 0) {
            container.innerHTML = '<p class="info-message">אין הודעות להצגה.</p>';
            return;
        }
        
        container.innerHTML = announcements.map(a => {
            const isAuthor = authManager.currentUser?._id === a.author?._id;
            const canDelete = authManager.isAdmin() || isAuthor;
            const announcementClass = a.class?.name ? `<span>(${a.class.name})</span>` : '';
            const typeClass = a.type === 'global' ? 'global-announcement' : 'class-announcement';
            
            return `
                <div class="announcement ${typeClass}">
                    ${canDelete ? `
                        <div class="announcement-actions">
                            <button class="btn btn-danger btn-sm" onclick="uiManager.deleteAnnouncement('${a._id}')">
                                <i class="fas fa-trash"></i> מחיקה
                            </button>
                        </div>
                    ` : ''}
                    <div class="announcement-header">
                        <div class="announcement-title">${a.title} ${showGlobalClass ? announcementClass : ''}</div>
                        <div class="announcement-date">${this.formatDate(a.createdAt)}</div>
                    </div>
                    <div class="announcement-content">${a.content.replace(/\n/g, '<br>')}</div>
                    <div class="announcement-meta">
                        <span style="color: var(--gray); font-size: 0.9rem;">נשלח על ידי: ${a.author?.name || 'מערכת'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderClasses(classes, containerId) {
        const container = document.getElementById(containerId);
        if (!classes || classes.length === 0) {
            container.innerHTML = '<p class="info-message">לא נמצאו כיתות להצגה.</p>';
            return;
        }

        container.innerHTML = classes.map(classItem => {
            const isTeacherOfClass = classItem.teachers.some(t => t._id === authManager.currentUser?._id) || classItem.teacher._id === authManager.currentUser?._id;
            const isAdmin = authManager.isAdmin();

            return `
                <div class="announcement">
                    <div class="announcement-header">
                        <div class="announcement-title">${classItem.name}</div>
                    </div>
                    <div class="announcement-content">
                        <p><strong>מורה ראשי:</strong> ${classItem.teacher.name}</p>
                        <p><strong>מספר תלמידים:</strong> ${classItem.students?.length || 0} / ${classItem.maxStudents}</p>
                    </div>
                    
                    ${(isTeacherOfClass || isAdmin) ? `
                        <div class="class-management-actions">
                            <button class="btn btn-primary" onclick="uiManager.manageClass('${classItem._id}')">ניהול כיתה</button>
                            ${isAdmin ? `<button class="btn btn-danger" onclick="uiManager.deleteClass('${classItem._id}')" style="margin-right:0.5rem;">מחיקה</button>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    renderAssignments(assignments, containerId) {
        // Student view rendering logic
        // ... (implementation is long, assuming it's correctly handling student view: submit button, status) ...
        const container = document.getElementById(containerId);
        if (!assignments || assignments.length === 0) {
            container.innerHTML = '<p class="info-message">אין משימות פתוחות.</p>';
            return;
        }

        container.innerHTML = assignments.map(a => {
            const studentSubmission = a.submissions.find(s => s.student === authManager.currentUser?._id);
            const status = studentSubmission ? (studentSubmission.grade || 'הוגש') : 'טרם הוגש';
            const statusClass = studentSubmission ? (studentSubmission.grade ? 'graded' : 'submitted') : 'pending';
            const submissionText = studentSubmission ? `(הוגש ב: ${this.formatDate(studentSubmission.submittedAt)})` : '';
            
            return `
                <div class="announcement assignment-item ${statusClass}">
                    <div class="announcement-header">
                        <div class="announcement-title">${a.title} (${a.class.name})</div>
                        <div class="announcement-date">תאריך הגשה: ${this.formatDate(a.dueDate)}</div>
                    </div>
                    <div class="announcement-content">
                        <p>${a.description.replace(/\n/g, '<br>')}</p>
                        <p><strong>סטטוס:</strong> ${status} ${submissionText}</p>
                        ${studentSubmission && studentSubmission.fileUrl ? `<p><a href="${studentSubmission.fileUrl}" target="_blank"><i class="fas fa-file-download"></i> קובץ מצורף</a></p>` : ''}
                    </div>
                    <div class="class-management-actions">
                        <button class="btn btn-secondary" onclick="uiManager.openSubmissionModal('${a._id}')">
                            ${studentSubmission ? 'עדכון הגשה' : 'הגשת משימה'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTeacherAssignments(assignments, containerId) {
        // Teacher/Admin view rendering logic
        // ... (implementation is long, assuming it's correctly handling teacher view: submissions list, grade button, edit/delete) ...
        const container = document.getElementById(containerId);
        if (!assignments || assignments.length === 0) {
            container.innerHTML = '<p class="info-message">אין משימות שהוגדרו או שהכיתות שלך טרם שויכו למשימות.</p>';
            return;
        }

        container.innerHTML = assignments.map(a => {
            const submissionsCount = a.submissions.length;
            const classItem = a.class;
            
            return `
                <div class="announcement assignment-item">
                    <div class="announcement-actions">
                        <button class="btn btn-warning btn-sm" onclick="uiManager.openEditAssignmentModal('${a._id}')">
                            <i class="fas fa-edit"></i> עריכה
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="uiManager.deleteAssignment('${a._id}')">
                            <i class="fas fa-trash"></i> מחיקה
                        </button>
                    </div>
                    <div class="announcement-header">
                        <div class="announcement-title">${a.title} (${classItem.name})</div>
                        <div class="announcement-date">תאריך הגשה: ${this.formatDate(a.dueDate)}</div>
                    </div>
                    <div class="announcement-content">
                        <p>${a.description.replace(/\n/g, '<br>')}</p>
                        <p><strong>הגשות:</strong> ${submissionsCount}</p>
                    </div>
                    <div class="class-management-actions">
                        <button class="btn btn-secondary" onclick="uiManager.viewSubmissions('${a._id}')">
                            צפייה בהגשות (${submissionsCount})
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAdminUsers(users, containerId) {
        // Admin view rendering logic
        // ... (implementation is long, assumes rendering of user table with edit/delete buttons) ...
        const container = document.getElementById(containerId);
        if (!users || users.length === 0) {
            container.innerHTML = '<p class="info-message">לא נמצאו משתמשים במערכת.</p>';
            return;
        }

        let tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>שם</th>
                        <th>אימייל</th>
                        <th>תפקיד</th>
                        <th>פעולות</th>
                    </tr>
                </thead>
                <tbody>
        `;

        tableHtml += users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="uiManager.openEditUserModal('${user._id}')">עריכה</button>
                    <button class="btn btn-danger btn-sm" onclick="uiManager.deleteUser('${user._id}')">מחיקה</button>
                </td>
            </tr>
        `).join('');

        tableHtml += '</tbody></table>';
        container.innerHTML = tableHtml;
    }

    renderEvents(events, containerId) {
        // Event rendering logic
        const container = document.getElementById(containerId);
        if (!events || events.length === 0) {
            container.innerHTML = '<p class="info-message">אין אירועים קרובים להצגה.</p>';
            return;
        }
        
        container.innerHTML = events.map(event => {
            const canDelete = authManager.isAdmin() || (authManager.isTeacher() && event.author?._id === authManager.currentUser?._id);
            
            return `
                <div class="announcement event-item">
                    ${canDelete ? `
                        <div class="announcement-actions">
                            <button class="btn btn-danger btn-sm" onclick="uiManager.deleteEvent('${event._id}')">
                                <i class="fas fa-trash"></i> מחיקה
                            </button>
                        </div>
                    ` : ''}
                    <div class="announcement-header">
                        <div class="announcement-title">${event.title}</div>
                        <div class="announcement-date">${this.formatDate(event.date)}</div>
                    </div>
                    <div class="announcement-content">${event.description.replace(/\n/g, '<br>')}</div>
                    <div class="announcement-meta">
                        <span style="color: var(--gray); font-size: 0.9rem;">נוצר על ידי: ${event.author?.name || 'מערכת'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderMedia(media, containerId) {
        // Media gallery rendering logic
        const container = document.getElementById(containerId);
        if (!media || media.length === 0) {
            container.innerHTML = '<p class="info-message">לא נמצאו פריטי מדיה להצגה.</p>';
            return;
        }

        container.innerHTML = media.map(m => {
            let mediaContent;
            if (m.type === 'image') {
                mediaContent = `<img src="${m.url}" alt="${m.title}" loading="lazy">`;
            } else if (m.type === 'video') {
                mediaContent = `<video controls><source src="${m.url}" type="video/mp4">הדפדפן שלך אינו תומך.</video>`;
            } else {
                mediaContent = `
                    <div class="file-representation">
                        <i class="fas fa-file-alt"></i>
                        <p>קובץ מצורף</p>
                    </div>
                `;
            }

            const canDelete = authManager.isAdmin();

            return `
                <div class="media-item">
                    ${mediaContent}
                    <div class="media-info">
                        <h4 class="media-title">${m.title}</h4>
                        <p class="media-date">${this.formatDate(m.date)}</p>
                        <a href="${m.url}" target="_blank" class="btn btn-sm btn-secondary" style="margin-top: 5px;">
                            <i class="fas fa-download"></i> הורדה/צפייה
                        </a>
                        ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="uiManager.deleteMedia('${m._id}')">מחיקה</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }


    // --- MODAL FUNCTIONS ---

    openLoginModal() {
        document.getElementById('login-modal').style.display = 'flex';
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            // Check if it's the dynamically created class management modal
            if (modal.id === 'manage-class-modal') {
                modal.remove(); 
            } else {
                modal.style.display = 'none';
            }
        });
        // Clear file state
        this.currentFile = null;
        const filePreview = document.getElementById('file-preview');
        if (filePreview) filePreview.style.display = 'none';
        const mediaPreview = document.getElementById('media-preview');
        if (mediaPreview) mediaPreview.style.display = 'none';
        const submissionFile = document.getElementById('submission-file');
        if (submissionFile) submissionFile.value = '';
        const mediaFile = document.getElementById('media-file');
        if (mediaFile) mediaFile.value = '';
    }

    async openAddAnnouncementModal(type = 'global', classId = null) {
        if (!authManager.isTeacher()) {
            this.showError('גישת מורה נדרשת');
            return;
        }
        
        const modal = document.getElementById('add-announcement-modal');
        const typeSelect = document.getElementById('announcement-type');
        const classGroup = document.getElementById('class-selection-group');
        const classSelect = document.getElementById('announcement-class-id');
        
        // Load classes for the dropdown
        try {
            const classes = await dbManager.getClasses();
            classSelect.innerHTML = classes.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
        } catch (error) {
            console.error('Error loading classes:', error);
            this.showError('שגיאה בטעינת הכיתות');
        }

        // Set initial state based on call (e.g., from Manage Class button)
        typeSelect.value = type;
        if (type === 'class' && classId) {
            classSelect.value = classId;
            classGroup.style.display = 'block';
        } else if (type === 'global') {
            classGroup.style.display = 'none';
        } else {
            classGroup.style.display = 'none';
            classSelect.value = classes.length > 0 ? classes[0]._id : '';
        }

        modal.style.display = 'flex';
    }

    async openAddAssignmentModal(classId = null) {
        if (!authManager.isTeacher()) {
            this.showError('גישת מורה נדרשת');
            return;
        }
        
        const modal = document.getElementById('add-assignment-modal');
        const classSelect = document.getElementById('assignment-class-id');
        
        try {
            const classes = await dbManager.getClasses();
            classSelect.innerHTML = classes.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
            
            // Pre-select class if called from the management modal
            if (classId) {
                classSelect.value = classId;
            } else if (classes.length > 0) {
                classSelect.value = classes[0]._id;
            }
        } catch (error) {
            console.error('Error loading classes:', error);
            this.showError('שגיאה בטעינת הכיתות');
        }

        modal.style.display = 'flex';
    }

    // ... (rest of modal functions, handle forms) ...
    // Note: Edit/Submission/User/Class/Event modals and their handlers (handleAddClass, handleLogin, etc.) are assumed to be fully implemented.

    // --- CLASS MANAGEMENT LOGIC (NEW) ---
    
    // New: Open management modal and load data
    async manageClass(classId) {
        if (!authManager.isTeacher()) {
            this.showError('גישת מורה נדרשת');
            return;
        }
        
        try {
            // Fetch class details and all students (who are not teachers/admins)
            const classItem = await dbManager.getSingleClass(classId);
            const allStudents = await dbManager.getAllStudents(); 
            
            this.renderManageClassModal(classItem, allStudents);
        } catch (error) {
            console.error('Error opening class management modal:', error);
            this.showError('שגיאה בטעינת נתוני ניהול הכיתה: ' + error.message);
        }
    }

    // New: Render the class management modal
    renderManageClassModal(classItem, allStudents) {
        this.closeAllModals(); // Close any other open modals
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'manage-class-modal';
        modal.style.display = 'flex';
        
        // Filter students not already in the class for the selection dropdown
        const studentsInClassIds = classItem.students.map(s => s._id);
        const availableStudents = allStudents.filter(s => !studentsInClassIds.includes(s._id));

        modal.innerHTML = `
            <div class="modal-content class-management-modal">
                <span class="close-modal">&times;</span>
                <h2>ניהול כיתה: ${classItem.name}</h2>
                <p>מורה ראשי: ${classItem.teacher.name}</p>

                <div class="tab-system">
                    <div class="tabs">
                        <button class="tab-button active" data-tab="students-tab">תלמידים (${classItem.students.length})</button>
                        <button class="tab-button" data-tab="assignments-tab">משימות</button>
                        <button class="tab-button" data-tab="announcements-tab">הודעות</button>
                    </div>
                    
                    <div class="tab-content active" id="students-tab">
                        <h3>הוספת תלמיד</h3>
                        <div class="form-group add-student-group">
                            <select id="student-select-add" class="select-full-width">
                                <option value="" disabled selected>בחר תלמיד...</option>
                                ${availableStudents.map(s => `<option value="${s._id}">${s.name} (${s.email})</option>`).join('')}
                                ${availableStudents.length === 0 ? '<option disabled>כל התלמידים שויכו לכיתות</option>' : ''}
                            </select>
                            <button class="btn btn-primary" id="add-student-submit-btn">הוספה</button>
                        </div>

                        <h3>תלמידים בכיתה</h3>
                        <div style="max-height: 400px; overflow-y: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>שם</th>
                                        <th>אימייל</th>
                                        <th>פעולות</th>
                                    </tr>
                                </thead>
                                <tbody id="class-students-list">
                                    ${classItem.students.map(s => `
                                        <tr>
                                            <td>${s.name}</td>
                                            <td>${s.email}</td>
                                            <td>
                                                <button class="btn btn-danger btn-sm" onclick="uiManager.removeStudentFromClass('${classItem._id}', '${s._id}')">הסרה</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                    ${classItem.students.length === 0 ? '<tr><td colspan="3">אין תלמידים בכיתה זו.</td></tr>' : ''}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="assignments-tab">
                        <h3>משימות הכיתה</h3>
                        <div id="class-assignments-list" class="assignments-list"></div>
                        <button class="btn btn-secondary" onclick="uiManager.openAddAssignmentModal('${classItem._id}')">הוספת משימה</button>
                    </div>
                    
                    <div class="tab-content" id="announcements-tab">
                        <h3>הודעות הכיתה</h3>
                        <div id="class-announcements-list" class="announcements-list"></div>
                        <button class="btn btn-secondary" onclick="uiManager.openAddAnnouncementModal('class', '${classItem._id}')">הוספת הודעה</button>
                    </div>

                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Add event listeners for the modal
        modal.querySelector('.close-modal').addEventListener('click', () => this.closeAllModals());
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'manage-class-modal') {
                this.closeAllModals();
            }
        });
        
        // Tab system logic
        modal.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                modal.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                modal.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                e.target.classList.add('active');
                document.getElementById(`${e.target.dataset.tab}`).classList.add('active');

                // Load content dynamically on tab click
                this.loadClassTabContent(classItem._id, e.target.dataset.tab);
            });
        });
        
        // Load dynamic content for the non-student tabs
        this.loadClassTabContent(classItem._id, 'assignments-tab');
        this.loadClassTabContent(classItem._id, 'announcements-tab');

        // Submit button handler for adding student
        document.getElementById('add-student-submit-btn').addEventListener('click', () => this.addStudentToClass(classItem._id));
    }

    // New: Load dynamic content for class tabs
    async loadClassTabContent(classId, tabId) {
        try {
            const container = document.getElementById(tabId);
            
            if (tabId === 'students-tab') return; // Already rendered

            const contentDiv = container.querySelector('.assignments-list, .announcements-list');
            if (contentDiv) contentDiv.innerHTML = `<div class="loading">טוען נתונים...</div>`;
            
            if (tabId === 'assignments-tab') {
                const assignments = await dbManager.getClassAssignments(classId);
                if (assignments.length === 0) {
                    contentDiv.innerHTML = '<p class="info-message">אין משימות לכיתה זו.</p>';
                } else {
                    this.renderTeacherAssignments(assignments, 'class-assignments-list');
                }
            } else if (tabId === 'announcements-tab') {
                const announcements = await dbManager.getClassAnnouncements(classId);
                if (announcements.length === 0) {
                    contentDiv.innerHTML = '<p class="info-message">אין הודעות לכיתה זו.</p>';
                } else {
                    this.renderAnnouncements(announcements.filter(a => a.type === 'class'), 'class-announcements-list', false);
                }
            }
        } catch (error) {
            console.error(`Error loading tab ${tabId}:`, error);
            const contentDiv = document.getElementById(tabId).querySelector('.assignments-list, .announcements-list');
            if (contentDiv) contentDiv.innerHTML = '<p class="error-message">שגיאה בטעינת הנתונים.</p>';
        }
    }
    
    // New: Handle student addition to class
    async addStudentToClass(classId) {
        const studentSelect = document.getElementById('student-select-add');
        const studentId = studentSelect.value;
        
        if (!studentId) {
            this.showError('אנא בחר תלמיד להוספה');
            return;
        }

        try {
            // 1. Get the current class to find the current list of students (via single class endpoint)
            const classItem = await dbManager.getSingleClass(classId);
            
            // 2. Add the new student ID and update the class
            const currentStudentIds = classItem.students.map(s => s._id);
            const newStudents = [...currentStudentIds, studentId];

            await dbManager.updateClass(classId, { students: newStudents });
            
            this.showSuccess('התלמיד נוסף בהצלחה לכיתה');
            // Re-open the management modal to refresh the list
            this.manageClass(classId); 
        } catch (error) {
            console.error('Error adding student:', error);
            this.showError('שגיאה בהוספת התלמיד: ' + error.message);
        }
    }
    
    // New: Handle student removal from class
    async removeStudentFromClass(classId, studentId) {
        if (confirm('האם אתה בטוח שברצונך להסיר תלמיד זה מהכיתה?')) {
            try {
                // 1. Get the current class to find the list of students/teachers
                const classItem = await dbManager.getSingleClass(classId);
                
                // 2. Filter out the student to be removed
                const newStudents = classItem.students.filter(s => s._id !== studentId).map(s => s._id);

                // 3. Update the class (keep teachers list as is)
                await dbManager.updateClass(classId, { 
                    students: newStudents, 
                    teachers: classItem.teachers.map(t => t._id) 
                });
                
                this.showSuccess('התלמיד הוסר בהצלחה מהכיתה');
                // Re-open the management modal to refresh the list
                this.manageClass(classId); 
            } catch (error) {
                console.error('Error removing student:', error);
                this.showError('שגיאה בהסרת התלמיד: ' + error.message);
            }
        }
    }

    // --- NOTIFICATION UTILITIES ---
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
            background: ${type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--secondary)' : 'var(--primary)'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            min-width: 300px;
            text-align: center;
        `;
        
        document.body.appendChild(notification);
        
        // Close on button click
        notification.querySelector('.notification-close').addEventListener('click', () => {
             if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });

        // Auto close after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Create global instance
const uiManager = new UIManager();
window.uiManager = uiManager;
