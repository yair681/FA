// UI Manager
class UIManager {
    constructor() {
        this.currentPage = 'home';
        this.currentAssignmentId = null;
        this.currentFile = null;
        this.classIdToManage = null; // New property to hold the class ID being managed
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
        document.getElementById('add-user-form')?.addEventListener('submit', (e) => this.handleAddUser(e));
        document.getElementById('add-class-form')?.addEventListener('submit', (e) => this.handleAddClass(e));
        document.getElementById('add-event-form')?.addEventListener('submit', (e) => this.handleAddEvent(e));
        document.getElementById('add-media-form')?.addEventListener('submit', (e) => this.handleAddMedia(e));
        document.getElementById('edit-assignment-form')?.addEventListener('submit', (e) => this.handleEditAssignment(e));
        document.getElementById('edit-user-form')?.addEventListener('submit', (e) => this.handleEditUser(e));
        
        // NEW: Assign student form handler
        document.getElementById('assign-student-form')?.addEventListener('submit', (e) => this.handleAssignStudent(e));
        
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
                if (e.dataTransfer.files.length) {
                    submissionFile.files = e.dataTransfer.files;
                    this.updateFileNameDisplay(submissionFile, document.getElementById('file-upload-name'));
                }
            });

            submissionFile.addEventListener('change', () => {
                this.updateFileNameDisplay(submissionFile, document.getElementById('file-upload-name'));
            });
        }
        
        // Media file upload
        const mediaUploadArea = document.getElementById('media-upload-area');
        const mediaFile = document.getElementById('media-file');

        if (mediaUploadArea && mediaFile) {
            mediaUploadArea.addEventListener('click', () => mediaFile.click());
            
            mediaUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                mediaUploadArea.classList.add('dragover');
            });
            
            mediaUploadArea.addEventListener('dragleave', () => {
                mediaUploadArea.classList.remove('dragover');
            });

            mediaUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                mediaUploadArea.classList.remove('dragover');
                if (e.dataTransfer.files.length) {
                    mediaFile.files = e.dataTransfer.files;
                    this.updateFileNameDisplay(mediaFile, document.getElementById('media-preview'));
                }
            });

            mediaFile.addEventListener('change', () => {
                this.updateFileNameDisplay(mediaFile, document.getElementById('media-preview'));
            });
        }
    }
    
    updateFileNameDisplay(fileInput, displayElement) {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            
            // File size check (100MB)
            if (file.size > 100 * 1024 * 1024) {
                this.showError('גודל הקובץ חייב להיות קטן מ-100MB');
                fileInput.value = ''; // Clear file selection
                displayElement.innerHTML = '<p style="color:red;">גודל הקובץ חורג מהמגבלה.</p>';
                return;
            }

            // Display file name
            displayElement.style.display = 'block';
            displayElement.innerHTML = `
                <i class="fas fa-file-alt"></i>
                <span>${file.name}</span>
            `;
        } else {
            displayElement.style.display = 'none';
            displayElement.innerHTML = '';
        }
    }

    logout() {
        authManager.logout();
        this.showPage('home');
        this.showSuccess('התנתקת בהצלחה.');
        updateUI();
    }

    openLoginModal() {
        document.getElementById('login-modal').style.display = 'flex';
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const result = await authManager.login(email, password);
            if (result.success) {
                this.closeAllModals();
                this.showSuccess('התחברת בהצלחה. ברוך הבא, ' + result.user.name);
                this.showPage('home'); // Redirect to home on successful login
                updateUI();
            } else {
                this.showError(result.error || 'שגיאה בהתחברות');
            }
        } catch (error) {
            this.showError('שגיאת רשת או שרת: ' + error.message);
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showPage(pageName) {
        this.currentPage = pageName;
        document.querySelectorAll('.page-content').forEach(page => {
            page.style.display = 'none';
        });
        document.getElementById(pageName + '-page').style.display = 'block';

        // Load content dynamically
        if (pageName === 'announcements') this.renderAnnouncements();
        if (pageName === 'classes') this.renderClasses();
        if (pageName === 'assignments') this.renderAssignments();
        if (pageName === 'events') this.renderEvents();
        if (pageName === 'history') this.renderHistory();
        if (pageName === 'admin') this.renderAdminPage();
        if (pageName === 'home') this.renderHome();
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

    // --- Page Render Functions ---
    // ... (renderHome, renderAnnouncements, renderAssignments, renderEvents, renderHistory, renderAdminPage)

    async renderClasses() {
        console.log('🔄 Rendering Classes page');
        const classesList = document.getElementById('classes-list');
        classesList.innerHTML = '<div class="loading">טוען כיתות...</div>';
        
        const isManager = authManager.isTeacher();
        
        if (isManager) {
            document.getElementById('add-class-btn-container').style.display = 'block';
        } else {
            document.getElementById('add-class-btn-container').style.display = 'none';
        }

        try {
            const classes = await databaseManager.getClasses();
            
            if (classes.length === 0) {
                classesList.innerHTML = '<p class="empty-state">אין כיתות להצגה.</p>';
                return;
            }

            classesList.innerHTML = classes.map(classItem => {
                const isTeacher = authManager.isTeacher() && classItem.teacher && classItem.teacher._id === authManager.currentUser.userId;
                const isAdmin = authManager.isAdmin();
                const canManage = isTeacher || isAdmin;
                const canDelete = isAdmin;
                
                return `
                    <div class="announcement">
                        <div class="announcement-header">
                            <div class="announcement-title">${classItem.name}</div>
                            ${canManage ? `
                            <div class="announcement-actions">
                                <button class="btn btn-info btn-sm" onclick="uiManager.viewClassDetails('${classItem._id}')" style="margin-left:0.5rem;">
                                    <i class="fas fa-info-circle"></i> פרטים
                                </button>
                                <button class="btn btn-primary btn-sm" onclick="uiManager.openManageStudentsModal('${classItem._id}', '${classItem.name}')" style="margin-left:0.5rem;">
                                    <i class="fas fa-users"></i> ניהול תלמידים
                                </button>
                                ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="uiManager.deleteClass('${classItem._id}')">
                                    <i class="fas fa-trash"></i> מחיקה
                                </button>` : ''}
                            </div>
                            ` : ''}
                        </div>
                        <div class="announcement-content">
                            <p><strong>תיאור:</strong> ${classItem.description || 'אין תיאור'}</p>
                            <p><strong>מורה:</strong> ${classItem.teacher ? classItem.teacher.name : 'לא שויך מורה'}</p>
                            <p><strong>מספר תלמידים:</strong> ${classItem.studentCount !== undefined ? classItem.studentCount : 'טוען...'}</p>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            classesList.innerHTML = `<p class="error-state">שגיאה בטעינת הכיתות: ${error.message}</p>`;
            this.showError('שגיאה בטעינת הכיתות: ' + error.message);
        }
    }

    async viewClassDetails(classId) {
        // ... (existing viewClassDetails)
    }

    async deleteClass(classId) {
        // ... (existing deleteClass)
    }

    async handleAddClass(e) {
        // ... (existing handleAddClass)
    }
    
    // NEW: Open modal for managing students in a class
    async openManageStudentsModal(classId, className) {
        if (!authManager.isTeacher()) {
            this.showError('אין לך הרשאה לנהל תלמידים בכיתה.');
            return;
        }
        
        this.classIdToManage = classId;
        document.getElementById('manage-class-name').textContent = className;
        document.getElementById('manage-students-error').style.display = 'none';
        document.getElementById('manage-class-students-modal').style.display = 'flex';
        
        // Load all students and current class details
        this.loadClassStudents(classId);
    }
    
    // NEW: Load students for the class management modal
    async loadClassStudents(classId) {
        const studentsListEl = document.getElementById('current-students-list');
        const selectEl = document.getElementById('student-to-assign');
        studentsListEl.innerHTML = '<div class="loading">טוען תלמידים משויכים...</div>';
        selectEl.innerHTML = '<option value="">טוען תלמידים זמינים...</option>';
        document.getElementById('manage-students-error').style.display = 'none';

        try {
            const [allStudents, classDetails] = await Promise.all([
                databaseManager.getStudents(),
                databaseManager.getClassById(classId)
            ]);
            
            const currentStudentIds = classDetails.students.map(s => s._id);
            
            // Render current students
            this.renderStudentsForClassManagement(classDetails.students, classId);

            // Render students for assignment dropdown (only students NOT in the class)
            const assignableStudents = allStudents.filter(student => !currentStudentIds.includes(student._id));
            
            selectEl.innerHTML = '<option value="">בחר תלמיד לשיוך</option>' + assignableStudents.map(student => `
                <option value="${student._id}">${student.name} (${student.email})</option>
            `).join('');

            if (assignableStudents.length === 0) {
                selectEl.innerHTML = '<option value="">אין תלמידים זמינים לשיוך</option>';
            }

        } catch (error) {
            document.getElementById('manage-students-error').textContent = 'שגיאה בטעינת נתוני הכיתה/תלמידים: ' + error.message;
            document.getElementById('manage-students-error').style.display = 'block';
            studentsListEl.innerHTML = `<p class="error-state">שגיאה: ${error.message}</p>`;
            selectEl.innerHTML = '<option value="">שגיאת טעינה</option>';
        }
    }
    
    // NEW: Render the list of students currently in the class
    renderStudentsForClassManagement(currentStudents, classId) {
        const studentsListEl = document.getElementById('current-students-list');
        const countEl = document.getElementById('current-students-count');
        countEl.textContent = currentStudents.length;

        if (currentStudents.length === 0) {
            studentsListEl.innerHTML = '<p class="empty-state">לא משויכים תלמידים לכיתה זו.</p>';
            return;
        }

        studentsListEl.innerHTML = currentStudents.map(student => `
            <div class="list-item student-item">
                <span>${student.name} (${student.email})</span>
                <button class="btn btn-danger btn-sm" onclick="uiManager.handleRemoveStudent('${classId}', '${student._id}', '${student.name}')">
                    <i class="fas fa-user-minus"></i> הסרה
                </button>
            </div>
        `).join('');
    }

    // NEW: Handle assigning a student to a class
    async handleAssignStudent(e) {
        e.preventDefault();
        const studentId = document.getElementById('student-to-assign').value;
        const classId = this.classIdToManage;

        if (!studentId || !classId) {
            this.showError('שגיאה: חסר מזהה כיתה או תלמיד.');
            return;
        }
        
        try {
            await databaseManager.assignStudentToClass(classId, studentId);
            this.showSuccess('התלמיד שויך בהצלחה לכיתה!');
            // Reload the student list in the modal and refresh the classes page
            await this.loadClassStudents(classId);
            this.renderClasses();
        } catch (error) {
            this.showError('שגיאה בשיוך התלמיד: ' + error.message);
        }
    }

    // NEW: Handle removing a student from a class
    async handleRemoveStudent(classId, studentId, studentName) {
        if (!confirm(`האם אתה בטוח שברצונך להסיר את התלמיד ${studentName} מהכיתה?`)) {
            return;
        }

        try {
            await databaseManager.removeStudentFromClass(classId, studentId);
            this.showSuccess('התלמיד הוסר בהצלחה מהכיתה.');
            // Reload the student list in the modal and refresh the classes page
            await this.loadClassStudents(classId);
            this.renderClasses();
        } catch (error) {
            this.showError('שגיאה בהסרת התלמיד: ' + error.message);
        }
    }

    // ... (rest of the UIManager class methods)
    
    async renderHome() {
        // ... (existing renderHome)
    }
    
    async renderAnnouncements() {
        // ... (existing renderAnnouncements)
    }

    async renderAssignments() {
        // ... (existing renderAssignments)
    }

    async renderEvents() {
        // ... (existing renderEvents)
    }

    async renderHistory() {
        // ... (existing renderHistory)
    }

    async renderAdminPage() {
        // ... (existing renderAdminPage)
    }
    
    openAddAnnouncementModal() {
        // ... (existing openAddAnnouncementModal)
    }

    handleAddAnnouncement(e) {
        // ... (existing handleAddAnnouncement)
    }

    deleteAnnouncement(announcementId) {
        // ... (existing deleteAnnouncement)
    }

    openAddAssignmentModal() {
        // ... (existing openAddAssignmentModal)
    }

    openEditAssignmentModal(assignment) {
        // ... (existing openEditAssignmentModal)
    }

    handleAddAssignment(e) {
        // ... (existing handleAddAssignment)
    }

    handleEditAssignment(e) {
        // ... (existing handleEditAssignment)
    }

    deleteAssignment(assignmentId) {
        // ... (existing deleteAssignment)
    }
    
    openAddUserModal() {
        // ... (existing openAddUserModal)
    }
    
    handleAddUser(e) {
        // ... (existing handleAddUser)
    }
    
    deleteUser(userId) {
        // ... (existing deleteUser)
    }

    openEditUserModal(user) {
        // ... (existing openEditUserModal)
    }

    handleEditUser(e) {
        // ... (existing handleEditUser)
    }

    openAddClassModal() {
        // ... (existing openAddClassModal)
    }

    openAddEventModal() {
        // ... (existing openAddEventModal)
    }

    handleAddEvent(e) {
        // ... (existing handleAddEvent)
    }

    deleteEvent(eventId) {
        // ... (existing deleteEvent)
    }

    openAddMediaModal() {
        // ... (existing openAddMediaModal)
    }

    handleAddMedia(e) {
        // ... (existing handleAddMedia)
    }

    deleteMedia(mediaId) {
        // ... (existing deleteMedia)
    }
    
    viewAssignmentSubmissions(assignmentId) {
        // ... (existing viewAssignmentSubmissions)
    }

    openGradeModal(submission) {
        // ... (existing openGradeModal)
    }

    handleGradeSubmission(e) {
        // ... (existing handleGradeSubmission)
    }

    // ... (other utility functions)
}

// Create global instance
const uiManager = new UIManager();
window.uiManager = uiManager;
