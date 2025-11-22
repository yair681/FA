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
                } else {
                    fileTypes.textContent = 'סרטונים נתמכים: MP4, MOV, AVI (מקסימום 50MB)';
                    mediaFile.accept = '.mp4,.mov,.avi';
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
        // Check file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('גודל הקובץ חייב להיות קטן מ-10MB');
            return;
        }

        // Check file type
        const allowedTypes = ['application/pdf', 'application/msword', 
                             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                             'image/jpeg', 'image/jpg', 'image/png'];
        
        if (!allowedTypes.includes(file.type)) {
            this.showError('סוג קובץ לא נתמך. אנא העלה קובץ PDF, Word או תמונה');
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
        const mediaType = document.getElementById('media-type').value;
        const maxSize = mediaType === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
        
        if (file.size > maxSize) {
            this.showError(`גודל הקובץ חייב להיות קטן מ-${mediaType === 'image' ? '10MB' : '50MB'}`);
            return;
        }

        this.currentFile = file;
        
        // Show media preview
        const mediaPreview = document.getElementById('media-preview');
        mediaPreview.style.display = 'block';
        
        if (mediaType === 'image') {
            const reader = new FileReader();
            reader.onload = (e) => {
                mediaPreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        } else {
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
        // Home page content is static
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
        console.log('📚 Loading assignments page for user:', authManager.currentUser?.email);
        
        if (!authManager.currentUser) {
            // Show guest message - no assignments data needed
            console.log('👤 User not logged in, showing guest message');
            document.getElementById('guest-assignments-section').style.display = 'block';
            document.getElementById('student-assignments-section').style.display = 'none';
            document.getElementById('teacher-assignments-section').style.display = 'none';
            return;
        }
        
        try {
            console.log('🔄 Fetching assignments data...');
            const assignments = await dbManager.getAssignments();
            console.log('✅ Assignments data received:', assignments);
            
            // Show student assignments only to students
            if (authManager.isStudent()) {
                console.log('🎒 Showing student assignments section');
                document.getElementById('student-assignments-section').style.display = 'block';
                document.getElementById('teacher-assignments-section').style.display = 'none';
                document.getElementById('guest-assignments-section').style.display = 'none';
                this.renderAssignments(assignments, 'assignments-list');
            }

            // Show teacher assignments only to teachers/admins
            if (authManager.isTeacher()) {
                console.log('👨‍🏫 Showing teacher assignments section');
                document.getElementById('teacher-assignments-section').style.display = 'block';
                document.getElementById('student-assignments-section').style.display = 'none';
                document.getElementById('guest-assignments-section').style.display = 'none';
                this.renderTeacherAssignments(assignments, 'teacher-assignments-list');
            }
        } catch (error) {
            console.error('❌ Error loading assignments page:', error);
            this.showError('שגיאה בטעינת המשימות');
            
            // Show appropriate section even on error
            if (authManager.isStudent()) {
                document.getElementById('student-assignments-section').style.display = 'block';
                document.getElementById('assignments-list').innerHTML = '<p>שגיאה בטעינת המשימות. נסה שוב מאוחר יותר.</p>';
            } else if (authManager.isTeacher()) {
                document.getElementById('teacher-assignments-section').style.display = 'block';
                document.getElementById('teacher-assignments-list').innerHTML = '<p>שגיאה בטעינת המשימות. נסה שוב מאוחר יותר.</p>';
            }
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

        container.innerHTML = announcements.map(announcement => {
            const canDelete = authManager.isAdmin() || 
                (authManager.isTeacher() && announcement.author?._id === authManager.currentUser.id);
            
            return `
            <div class="announcement">
                ${showActions && canDelete ? `
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
                        ${announcement.isGlobal ? 'הודעה כללית' : 'הודעה לכיתה'}
                    </span>
                    <span style="margin-right: 10px; color: var(--gray); font-size: 0.9rem;">
                        ${announcement.author?.name || 'מערכת'}
                    </span>
                </div>
            </div>
        `}).join('');
    }

    renderClasses(classes, containerId) {
        const container = document.getElementById(containerId);
        
        if (!classes || classes.length === 0) {
            container.innerHTML = '<p>אין כיתות להצגה</p>';
            return;
        }

        container.innerHTML = classes.map(classItem => {
            const isTeacherOfClass = authManager.isAdmin() || 
                classItem.teachers?.some(t => t._id === authManager.currentUser.id);
            
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
                            <button class="btn btn-secondary" onclick="uiManager.manageClass('${classItem._id}')">ניהול כיתה</button>
                            <button class="btn" onclick="uiManager.viewClassStudents('${classItem._id}')">צפייה בתלמידים</button>
                            <button class="btn btn-warning" onclick="uiManager.editClass('${classItem._id}')">עריכת כיתה</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `}).join('');
    }

    renderAssignments(assignments, containerId) {
        const container = document.getElementById(containerId);
        
        console.log('🎨 Rendering assignments for student, count:', assignments?.length || 0);
        
        if (!assignments || assignments.length === 0) {
            container.innerHTML = '<p>אין משימות להצגה כרגע</p>';
            return;
        }

        container.innerHTML = assignments.map(assignment => {
            // Check if assignment exists and has required properties
            if (!assignment || !assignment._id) {
                console.warn('⚠️ Invalid assignment found:', assignment);
                return '';
            }

            const userSubmission = assignment.submissions?.find(s => s.student === authManager.currentUser.id);
            const isSubmitted = !!userSubmission;
            const isOverdue = new Date(assignment.dueDate) < new Date();
            
            return `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${assignment.title || 'ללא כותרת'}</div>
                    <div class="announcement-date">
                        תאריך הגשה: ${this.formatDate(assignment.dueDate)}
                        ${isOverdue ? '<span class="badge badge-danger" style="margin-right:10px;">איחור</span>' : ''}
                    </div>
                </div>
                <div class="announcement-content">${assignment.description || 'ללא תיאור'}</div>
                <div class="announcement-meta">
                    <span class="badge badge-warning">${assignment.class?.name || 'לא ידוע'}</span>
                    <span style="margin-right: 10px; color: var(--gray); font-size: 0.9rem;">
                        ${assignment.teacher?.name || 'מערכת'}
                    </span>
                </div>
                <div class="assignment-actions">
                    ${isSubmitted ? `
                        <span class="badge badge-success">הוגש בהצלחה</span>
                        ${userSubmission.grade ? `<span class="badge badge-primary">ציון: ${userSubmission.grade}</span>` : '<span class="badge badge-secondary">טרם נבדק</span>'}
                        <button class="btn btn-warning btn-sm" onclick="uiManager.openSubmitAssignmentModal('${assignment._id}')">
                            עריכת הגשה
                        </button>
                    ` : `
                        <button class="btn btn-primary btn-sm" ${isOverdue ? 'disabled' : ''} onclick="uiManager.openSubmitAssignmentModal('${assignment._id}')">
                            הגשת משימה
                        </button>
                    `}
                </div>
            </div>
        `}).join('');
    }

    renderTeacherAssignments(assignments, containerId) {
        const container = document.getElementById(containerId);
        
        if (!assignments || assignments.length === 0) {
            container.innerHTML = '<p>אין משימות להצגה כרגע</p>';
            return;
        }

        const isMod = authManager.isTeacher();

        container.innerHTML = assignments.map(assignment => {
            const submissionCount = assignment.submissions?.length || 0;
            return `
            <div class="announcement">
                <div class="announcement-header">
                    <div class="announcement-title">${assignment.title || 'ללא כותרת'}</div>
                    <div class="announcement-date">
                        תאריך הגשה: ${this.formatDate(assignment.dueDate)}
                    </div>
                </div>
                <div class="announcement-content">
                    <p>${assignment.description || 'ללא תיאור'}</p>
                    <p><strong>כיתה:</strong> ${assignment.class?.name || 'לא ידוע'}</p>
                </div>
                <div class="assignment-actions">
                    <button class="btn btn-primary btn-sm" onclick="uiManager.viewSubmissions('${assignment._id}')">
                        צפייה בהגשות (${submissionCount})
                    </button>
                    ${isMod ? `
                        <button class="btn btn-warning btn-sm" onclick="uiManager.openEditAssignmentModal('${assignment._id}')">
                            עריכה
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="uiManager.deleteAssignment('${assignment._id}')">
                            מחק
                        </button>
                    ` : ''}
                </div>
            </div>
        `}).join('');
    }

    // ✅ UPDATED: renderEvents - Added delete button for teachers/admins
    renderEvents(events, containerId) {
        const list = document.getElementById(containerId);
        if (!list) return;

        list.innerHTML = '';
        const isMod = authManager.isTeacher(); // בודק אם מורה או מנהל

        events.forEach(event => {
            const item = document.createElement('div');
            item.className = 'card event-item';
            
            // יצירת התאריך בפורמט קריא
            const eventDate = new Date(event.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            item.innerHTML = `
                <div class="card-header">
                    <h2>${event.title}</h2>
                    <div class="event-actions">
                        <span class="date">${eventDate}</span>
                        ${isMod ? `<button class="btn btn-danger btn-sm" data-id="${event._id}" onclick="uiManager.handleDeleteEvent('${event._id}')">מחק אירוע</button>` : ''}
                    </div>
                </div>
                <p>${event.description}</p>
                <small>נוסף על ידי: ${event.author?.name || 'משתמש לא ידוע'}</small>
            `;
            list.appendChild(item);
        });
        
        // אם אין אירועים
        if (events.length === 0) {
            list.innerHTML = '<p class="empty-state">אין אירועים פעילים כרגע.</p>';
        }
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
                </div>
                <div class="announcement-content">
                    <p><strong>מייל:</strong> ${user.email}</p>
                    <p><strong>תפקיד:</strong> ${user.role}</p>
                </div>
                <div class="assignment-actions">
                    <button class="btn btn-warning btn-sm" onclick="uiManager.openEditUserModal('${user._id}')">
                        עריכה
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="uiManager.deleteUser('${user._id}')">
                        מחק
                    </button>
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
                    <p><strong>מורה ראשי:</strong> ${classItem.teacher?.name || 'לא ידוע'}</p>
                    <p><strong>תלמידים:</strong> ${classItem.students?.length || 0}</p>
                </div>
                <div class="assignment-actions">
                    <button class="btn btn-secondary btn-sm" onclick="uiManager.manageClass('${classItem._id}')">
                        ניהול כיתה
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="uiManager.deleteClass('${classItem._id}')">
                        מחק
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Modal Opening Functions

    openLoginModal() {
        // Reset and open modal
        document.getElementById('login-form').reset();
        this.showError('', 'login-error');
        document.getElementById('login-modal').style.display = 'flex';
    }

    openAddAnnouncementModal() {
        if (!authManager.isTeacher()) {
            this.showError('גישת מורה נדרשת');
            return;
        }
        const modal = document.getElementById('add-announcement-modal');
        modal.style.display = 'flex';
        
        // Populate classes dropdown
        dbManager.getClasses().then(classes => {
            const classSelect = document.getElementById('announcement-class');
            const teacherClasses = classes.filter(c => c.teachers?.some(t => t._id === authManager.currentUser.id) || authManager.isAdmin() );
            classSelect.innerHTML = teacherClasses.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
        }).catch(e => this.showError('שגיאה בטעינת כיתות: ' + e.message));

        document.getElementById('add-announcement-form').onsubmit = (e) => this.handleAddAnnouncement(e);
    }

    async openAddAssignmentModal() {
        if (!authManager.isTeacher()) {
            this.showError('גישת מורה נדרשת');
            return;
        }
        const modal = document.getElementById('add-assignment-modal');
        modal.style.display = 'flex';
        
        // Populate classes dropdown only with classes the teacher has access to
        const classes = await dbManager.getClasses(); // Changed to getClasses to allow admin to see all
        const teacherClasses = classes.filter(c => c.teachers?.some(t => t._id === authManager.currentUser.id) || authManager.isAdmin() );
        const classSelect = document.getElementById('assignment-class');
        classSelect.innerHTML = teacherClasses.map(c => `<option value="${c._id}">${c.name}</option>`).join('');

        document.getElementById('add-assignment-form').onsubmit = (e) => this.handleAddAssignment(e);
    }

    openSubmitAssignmentModal(assignmentId) {
        if (!authManager.isStudent()) {
            this.showError('גישת תלמיד נדרשת');
            return;
        }
        this.currentAssignmentId = assignmentId;
        const modal = document.getElementById('submit-assignment-modal');
        modal.style.display = 'flex';
        
        // Reset form
        document.getElementById('submission-text').value = '';
        this.removeSelectedFile();

        document.getElementById('submit-assignment-form').onsubmit = (e) => this.handleSubmitAssignment(e);
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
        
        teachersSelect.innerHTML = teachers.map(t => {
            const isSelected = t._id === authManager.currentUser.id; // Select current user by default
            return `<option value="${t._id}" ${isSelected ? 'selected' : ''}>${t.name} (${t.role})</option>`;
        }).join('');

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
        this.currentFile = null;
        document.getElementById('media-preview').style.display = 'none';
        document.getElementById('add-media-form').onsubmit = (e) => this.handleAddMedia(e);
    }

    // Modal Closing
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.getElementById('login-form').reset();
    }

    // Utility
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('he-IL');
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
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        };
    }

    showError(message, elementId = 'global-error') {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = message ? 'block' : 'none';
        } else {
            this.showNotification(message, 'error');
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    // Complex Modal Openers

    async manageClass(classId) {
        try {
            const classes = await dbManager.getClasses();
            const classItem = classes.find(c => c._id === classId);
            if (!classItem) {
                this.showError('כיתה לא נמצאה');
                return;
            }

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
                        <h3>מורים בכיתה:</h3>
                        <ul>
                            ${classItem.teachers?.map(t => `<li>${t.name} (${t.email})</li>`).join('') || '<li>אין מורים נוספים</li>'}
                        </ul>
                        <h3>תלמידים בכיתה:</h3>
                        <ul>
                            ${classItem.students?.map(s => `<li>${s.name} (${s.email})</li>`).join('') || '<li>אין תלמידים</li>'}
                        </ul>
                        <div class="class-management-actions">
                            <button class="btn btn-warning" onclick="uiManager.editClass('${classId}')">עריכת כיתה</button>
                            <button class="btn" onclick="uiManager.viewClassAssignments('${classId}')">משימות הכיתה</button>
                            <button class="btn btn-secondary" onclick="uiManager.viewClassAnnouncements('${classId}')">הודעות הכיתה</button>
                        </div>
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
        } catch (error) {
            this.showError('שגיאה בטעינת פרטי הכיתה: ' + error.message);
        }
    }

    async viewClassStudents(classId) {
        try {
            const classes = await dbManager.getClasses();
            const classItem = classes.find(c => c._id === classId);
            if (!classItem) {
                this.showError('כיתה לא נמצאה');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2>תלמידי כיתה - ${classItem.name}</h2>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="announcement-content">
                        <h3>רשימת תלמידים (${classItem.students?.length || 0}):</h3>
                        <ul>
                            ${classItem.students?.map(s => `<li>${s.name} (${s.email})</li>`).join('') || '<li>אין תלמידים בכיתה זו</li>'}
                        </ul>
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
        } catch (error) {
            this.showError('שגיאה בטעינת רשימת התלמידים: ' + error.message);
        }
    }

    async viewClassAssignments(classId) {
        try {
            const assignments = await dbManager.getClassAssignments(classId);
            const classItem = (await dbManager.getClasses()).find(c => c._id === classId);
            if (!classItem) {
                this.showError('כיתה לא נמצאה');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2>משימות כיתה - ${classItem.name}</h2>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="assignments-list">
                        ${assignments.length === 0 ? '<p>אין משימות בכיתה זו</p>' : ''}
                        ${assignments.map(assignment => `
                            <div class="announcement">
                                <div class="announcement-header">
                                    <div class="announcement-title">${assignment.title}</div>
                                    <div class="announcement-date">
                                        תאריך הגשה: ${this.formatDate(assignment.dueDate)}
                                    </div>
                                </div>
                                <div class="announcement-content">
                                    <p>${assignment.description}</p>
                                </div>
                                <div class="assignment-actions">
                                    <button class="btn btn-primary btn-sm" onclick="uiManager.viewSubmissions('${assignment._id}')">
                                        צפייה בהגשות (${assignment.submissions.length})
                                    </button>
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
        } catch (error) {
            this.showError('שגיאה בטעינת משימות הכיתה: ' + error.message);
        }
    }

    async viewClassAnnouncements(classId) {
        try {
            const response = await fetch(`/api/classes/${classId}/announcements`, { headers: authManager.getAuthHeaders() });
            if (response.ok) {
                const announcements = await response.json();
                this.showClassAnnouncementsModal(announcements, classId);
            } else {
                this.showError('שגיאה בטעינת הודעות הכיתה');
            }
        } catch (error) {
            this.showError('שגיאה בטעינת הודעות הכיתה: ' + error.message);
        }
    }

    showClassAnnouncementsModal(announcements, classId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2>הודעות הכיתה</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="announcements-list">
                    ${announcements.length === 0 ? '<p>אין הודעות בכיתה זו</p>' : ''}
                    ${announcements.map(announcement => `
                        <div class="announcement">
                            <div class="announcement-header">
                                <div class="announcement-title">${announcement.title}</div>
                                <div class="announcement-date">${this.formatDate(announcement.createdAt)}</div>
                            </div>
                            <div class="announcement-content">${announcement.content}</div>
                            <div class="announcement-meta">
                                <span style="color: var(--gray); font-size: 0.9rem;">
                                    ${announcement.author?.name || 'מערכת'}
                                </span>
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

    async viewSubmissions(assignmentId) {
        try {
            const response = await fetch(`/api/assignments/${assignmentId}/submissions`, { headers: authManager.getAuthHeaders() });
            if (response.ok) {
                const submissions = await response.json();
                this.showSubmissionsModal(submissions, assignmentId);
            } else {
                this.showError('שגיאה בטעינת הגשות המשימה');
            }
        } catch (error) {
            this.showError('שגיאה בטעינת הגשות המשימה: ' + error.message);
        }
    }

    showSubmissionsModal(submissions, assignmentId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2>הגשות למשימה (${submissions.length})</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="submissions-list">
                    ${submissions.length === 0 ? '<p>אין הגשות למשימה זו</p>' : ''}
                    ${submissions.map(sub => `
                        <div class="submission-item">
                            <h4>${sub.student?.name || 'תלמיד לא ידוע'}</h4>
                            <p><strong>הוגש בתאריך:</strong> ${this.formatDate(sub.submittedAt)}</p>
                            ${sub.submission ? `<p><strong>טקסט:</strong> ${sub.submission}</p>` : ''}
                            ${sub.fileUrl ? `<p><strong>קובץ מצורף:</strong> <a href="${sub.fileUrl}" target="_blank">צפייה בקובץ</a></p>` : ''}
                            <div class="grade-section">
                                <input type="text" id="grade-input-${sub.student._id}" placeholder="הכנס ציון" value="${sub.grade || ''}" style="width: 150px; margin-left: 10px;">
                                <button class="btn btn-primary btn-sm" onclick="uiManager.handleGradeAssignment('${assignmentId}', '${sub.student._id}')">
                                    שמירת ציון
                                </button>
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

    async openEditAssignmentModal(assignmentId) {
        try {
            const response = await fetch(`/api/assignments`); // Fetch all assignments
            if (!response.ok) throw new Error('Failed to fetch assignments');
            const assignments = await response.json();
            const assignment = assignments.find(a => a._id === assignmentId);
            if (!assignment) throw new Error('Assignment not found');

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            
            // Format date for input field
            const dueDate = assignment.dueDate.split('T')[0];

            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>עריכת משימה</h2>
                        <button class="close-modal">&times;</button>
                    </div>
                    <form id="edit-assignment-form">
                        <div class="form-group">
                            <label for="edit-assignment-title">כותרת</label>
                            <input type="text" id="edit-assignment-title" value="${assignment.title}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit-assignment-description">תיאור</label>
                            <textarea id="edit-assignment-description" required>${assignment.description}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit-assignment-date">תאריך הגשה</label>
                            <input type="date" id="edit-assignment-date" value="${dueDate}" required>
                        </div>
                        <button type="submit" class="btn">שמירת שינויים</button>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('edit-assignment-form').onsubmit = async (e) => {
                e.preventDefault();
                const title = document.getElementById('edit-assignment-title').value;
                const description = document.getElementById('edit-assignment-description').value;
                const newDueDate = document.getElementById('edit-assignment-date').value;

                try {
                    // Update assignment
                    const response = await fetch(`/api/assignments/${assignmentId}`, { 
                        method: 'PUT', 
                        headers: authManager.getAuthHeaders(), 
                        body: JSON.stringify({ title, description, dueDate: newDueDate }) 
                    });
                    
                    if (response.ok) {
                        this.showSuccess('המשימה עודכנה בהצלחה');
                        document.body.removeChild(modal);
                        this.loadPageData('assignments');
                    } else {
                        const error = await response.json();
                        this.showError('שגיאה בעדכון המשימה: ' + error.error);
                    }
                } catch (error) {
                    this.showError('שגיאה בעדכון המשימה: ' + error.message);
                }
            };

            // Close modal handlers
            modal.querySelector('.close-modal').onclick = () => {
                document.body.removeChild(modal);
            };
            modal.onclick = (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            };
        } catch (error) {
            this.showError('שגיאה בטעינת פרטי המשימה: ' + error.message);
        }
    }


    // Handler functions

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        this.showError('', 'login-error'); // Clear previous errors
        this.showNotification('מתחבר...', 'info');

        const result = await authManager.login(email, password);
        
        if (result.success) {
            this.showNotification('התחברת בהצלחה!', 'success');
            this.closeAllModals();
            this.showPage('home');
        } else {
            this.showNotification('שגיאת התחברות: ' + result.error, 'error');
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
            await dbManager.createAnnouncement({ title, content, isGlobal: type === 'global', classId });
            this.showSuccess('הודעה נוספה בהצלחה');
            this.closeAllModals();
            this.loadPageData('announcements');
        } catch (error) {
            this.showError('שגיאה בהוספת הודעה: ' + error.message);
        }
    }

    async handleAddAssignment(e) {
        e.preventDefault();
        const title = document.getElementById('assignment-title').value;
        const description = document.getElementById('assignment-description').value;
        const classId = document.getElementById('assignment-class').value;
        const dueDate = document.getElementById('assignment-due-date').value;

        try {
            await dbManager.createAssignment({ title, description, classId, dueDate });
            this.showSuccess('המשימה נוצרה בהצלחה');
            this.closeAllModals();
            this.loadPageData('assignments');
        } catch (error) {
            this.showError('שגיאה ביצירת המשימה: ' + error.message);
        }
    }

    async handleSubmitAssignment(e) {
        e.preventDefault();
        const submissionText = document.getElementById('submission-text').value;
        const assignmentId = this.currentAssignmentId;

        if (!submissionText && !this.currentFile) {
            this.showError('יש להזין טקסט או לבחור קובץ');
            return;
        }

        this.showNotification('מעלה הגשה...', 'info');

        try {
            const formData = new FormData();
            formData.append('assignmentId', assignmentId);
            formData.append('submission', submissionText);
            if (this.currentFile) {
                formData.append('file', this.currentFile);
            }

            await dbManager.submitAssignment(formData);
            this.showSuccess('הגשה נשלחה בהצלחה!');
            this.closeAllModals();
            this.loadPageData('assignments');
        } catch (error) {
            this.showError('שגיאה בהגשת משימה: ' + error.message);
        }
    }

    async handleGradeAssignment(assignmentId, studentId) {
        const grade = document.getElementById(`grade-input-${studentId}`).value;
        if (!grade) {
            this.showNotification('יש להזין ציון', 'error');
            return;
        }

        try {
            await dbManager.gradeAssignment({ assignmentId, studentId, grade });
            this.showSuccess('הציון נשמר בהצלחה');
            // Re-render submissions modal with updated data
            this.viewSubmissions(assignmentId);
        } catch (error) {
            this.showError('שגיאה בשמירת ציון: ' + error.message);
        }
    }

    async handleAddUser(e) {
        e.preventDefault();
        const name = document.getElementById('user-name').value;
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;

        try {
            await dbManager.createUser({ name, email, password, role });
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
            await dbManager.createClass({ name, teachers: selectedTeachers });
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
            await dbManager.createEvent({ title, description, date });
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
        const date = document.getElementById('media-date').value;

        if (!this.currentFile) {
            this.showError('יש לבחור קובץ להעלאה');
            return;
        }

        this.showNotification('מעלה מדיה...', 'info');

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('type', type);
            formData.append('date', date);
            formData.append('file', this.currentFile); // Attach the file

            // Must use a custom fetch call since dbManager.createMedia throws an error
            const headers = authManager.getAuthHeaders();
            delete headers['Content-Type']; // Remove Content-Type so the browser sets it to multipart/form-data

            const response = await fetch(`${dbManager.API_BASE}/media`, {
                method: 'POST',
                body: formData,
                headers: headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            this.showSuccess('המדיה הועלתה בהצלחה');
            this.closeAllModals();
            this.loadPageData('history');
        } catch (error) {
            this.showError('שגיאה בהוספת מדיה: ' + error.message);
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;

        try {
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: authManager.getAuthHeaders(),
                body: JSON.stringify({ newPassword })
            });

            const data = await response.json();
            
            if (response.ok) {
                this.showSuccess('הסיסמה שונתה בהצלחה');
                document.getElementById('change-password-form').reset();
            } else {
                this.showError(data.error || 'שגיאה בשינוי סיסמה');
            }
        } catch (error) {
            this.showError('שגיאה ברשת: ' + error.message);
        }
    }


    // Delete functions

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

    async deleteAnnouncement(announcementId) {
        if (confirm('האם אתה בטוח שברצונך למחוק הודעה זו?')) {
            try {
                await dbManager.deleteAnnouncement(announcementId);
                this.loadPageData('announcements');
                this.showSuccess('ההודעה נמחקה בהצלחה');
            } catch (error) {
                this.showError('שגיאה במחיקת ההודעה: ' + error.message);
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

    // ✅ ADDED: Delete Event handler
    async handleDeleteEvent(eventId) {
        if (!confirm('האם אתה בטוח שברצונך למחוק אירוע זה?')) {
            return;
        }

        this.showNotification('מוחק אירוע...', 'info');
        try {
            await dbManager.deleteEvent(eventId);
            this.showNotification('האירוע נמחק בהצלחה!', 'success');
            this.loadPageData('events'); // טעינה מחדש של הדף
        } catch (error) {
            this.showNotification('שגיאה במחיקת אירוע: ' + (error.message || 'שגיאה כללית'), 'error');
        }
    }

}

// Create global instance
console.log('✅ UI Manager code loaded');
const uiManager = new UIManager();
