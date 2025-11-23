// UI Manager
class UIManager {
    constructor() {
        this.currentPage = 'home';
        this.currentAssignmentId = null;
        this.currentFile = null;
        this.initEventListeners();
        
        // 🔥 חדש: משתנים לשמירת נתונים לצורך ניהול תלמידים
        this.allUsers = []; 
        this.currentClassToManage = null;
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
        document.getElementById('add-global-announcement-btn')?.addEventListener('click', () => this.openAddAnnouncementModal(true));
        document.getElementById('add-class-btn')?.addEventListener('click', () => this.openAddClassModal());
        document.getElementById('add-assignment-btn')?.addEventListener('click', () => this.openAddAssignmentModal());
        document.getElementById('add-event-btn')?.addEventListener('click', () => this.openAddEventModal());
        document.getElementById('add-media-btn')?.addEventListener('click', () => this.openAddMediaModal());

        // Form submissions
        document.getElementById('add-announcement-form')?.addEventListener('submit', (e) => this.handleAddAnnouncement(e));
        document.getElementById('add-class-form')?.addEventListener('submit', (e) => this.handleAddClass(e));
        document.getElementById('add-assignment-form')?.addEventListener('submit', (e) => this.handleAddAssignment(e));
        document.getElementById('assignment-submission-form')?.addEventListener('submit', (e) => this.handleSubmitAssignment(e));
        document.getElementById('add-event-form')?.addEventListener('submit', (e) => this.handleAddEvent(e));
        document.getElementById('add-media-form')?.addEventListener('submit', (e) => this.handleAddMedia(e));
        document.getElementById('register-form')?.addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('change-password-form')?.addEventListener('submit', (e) => this.handleChangePassword(e));
        
        // File drag and drop for media
        const mediaUploadArea = document.getElementById('media-upload-area');
        if (mediaUploadArea) {
            mediaUploadArea.addEventListener('click', () => document.getElementById('media-file').click());
            mediaUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); });
            mediaUploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); });
            mediaUploadArea.addEventListener('drop', (e) => this.handleMediaDrop(e));
            document.getElementById('media-file').addEventListener('change', (e) => this.handleMediaSelect(e));
        }

        // Grade submission
        document.getElementById('grade-form')?.addEventListener('submit', (e) => this.handleGradeSubmission(e));
    }

    async logout() {
        await authManager.logout();
        this.showPage('home'); // חוזרים לדף הבית
        this.showNotification('התנתקת בהצלחה', 'success');
        this.closeAllModals();
        updateUI();
    }
    
    // --- Page Rendering ---
    
    showPage(page) {
        this.currentPage = page;
        document.querySelectorAll('.page').forEach(p => {
            p.style.display = 'none';
        });
        const pageElement = document.getElementById(page + '-page');
        if (pageElement) {
            pageElement.style.display = 'block';
            
            // טעינת התוכן הרלוונטי
            if (page === 'announcements') this.renderAnnouncements();
            if (page === 'classes') this.renderClassesPage();
            if (page === 'assignments') this.renderAssignmentsPage();
            if (page === 'events') this.renderEvents();
            if (page === 'history') this.renderMedia();
        }
    }

    // --- Modals ---

    openModal(modalId) {
        this.closeAllModals();
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => {
            m.style.display = 'none';
        });
    }

    openLoginModal() {
        this.openModal('login-modal');
    }
    
    openRegisterModal() {
        this.openModal('register-modal');
    }

    openSettingsModal() {
        this.openModal('settings-modal');
    }

    openAddAnnouncementModal(isGlobal = false) {
        document.getElementById('announcement-global-checkbox').checked = isGlobal;
        document.getElementById('announcement-class-group').style.display = isGlobal ? 'none' : 'block';
        
        // טעינת כיתות רק אם לא גלובלי
        if (!isGlobal) {
            this.populateClassesDropdown('announcement-class', 'dbManager.getClasses');
        }
        
        this.openModal('add-announcement-modal');
    }

    openAddClassModal() {
        // טעינת מורים לרשימת המורים הנוספים
        this.populateTeachersList('class-teachers-list');
        this.openModal('add-class-modal');
    }
    
    openAddAssignmentModal() {
        this.populateClassesDropdown('assignment-class', 'dbManager.getClasses');
        this.openModal('add-assignment-modal');
    }
    
    openAddEventModal() {
        this.openModal('add-event-modal');
    }

    openAddMediaModal() {
        this.openModal('add-media-modal');
    }
    
    openAssignmentDetailsModal(assignmentId) {
        this.currentAssignmentId = assignmentId;
        this.renderAssignmentDetails(assignmentId);
        this.openModal('assignment-details-modal');
    }

    openGradeSubmissionModal(submissionId, assignmentId) {
        document.getElementById('grade-submission-id').value = submissionId;
        document.getElementById('grade-assignment-id').value = assignmentId;
        this.openModal('grade-submission-modal');
    }
    
    // --- Utility Functions ---
    
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

    async populateClassesDropdown(elementId, fetchFunction, selectedClassId = null) {
        const dropdown = document.getElementById(elementId);
        if (!dropdown) return;
        
        dropdown.innerHTML = '<option value="">בחר כיתה</option>';

        try {
            // קורא את הפונקציה הנדרשת (dbManager.getClasses או dbManager.getUserClasses)
            const classes = await eval(fetchFunction)(); 
            
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls._id;
                option.textContent = cls.name;
                if (selectedClassId && selectedClassId === cls._id) {
                    option.selected = true;
                }
                dropdown.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating classes dropdown:', error);
            this.showNotification('שגיאה בטעינת הכיתות', 'error');
        }
    }
    
    async populateTeachersList(elementId) {
        const list = document.getElementById(elementId);
        if (!list) return;
        
        list.innerHTML = '';
        
        try {
            const teachers = await dbManager.getTeachers();
            
            teachers.forEach(teacher => {
                const listItem = document.createElement('div');
                listItem.className = 'checkbox-item';
                listItem.innerHTML = `
                    <input type="checkbox" id="teacher-${teacher._id}" name="teachers" value="${teacher._id}">
                    <label for="teacher-${teacher._id}">${teacher.name} (${teacher.email})</label>
                `;
                list.appendChild(listItem);
            });
        } catch (error) {
            console.error('Error populating teachers list:', error);
            this.showNotification('שגיאה בטעינת רשימת המורים', 'error');
        }
    }
    
    // --- Handlers ---
    
    async handleLogin(e) { 
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const result = await authManager.login(email, password);
            if (result.success) {
                this.closeAllModals();
                this.showNotification('התחברת בהצלחה!', 'success');
                this.showPage('home');
            } else {
                this.showNotification(result.error || 'שגיאת התחברות', 'error');
            }
        } catch (error) {
             this.showNotification('שגיאת תקשורת עם השרת.', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const role = document.getElementById('register-role').value;

        try {
            const result = await authManager.register(name, email, password, role);
            if (result.success) {
                this.closeAllModals();
                this.showNotification('נרשמת בהצלחה! התחבר כעת.', 'success');
                this.openLoginModal();
            } else {
                this.showNotification(result.error || 'שגיאת הרשמה', 'error');
            }
        } catch (error) {
             this.showNotification('שגיאת תקשורת עם השרת.', 'error');
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            this.showNotification('הסיסמאות אינן תואמות.', 'error');
            return;
        }

        try {
            await authManager.changePassword(newPassword);
            this.showNotification('הסיסמה שונתה בהצלחה!', 'success');
            document.getElementById('change-password-form').reset();
            this.closeAllModals();
        } catch (error) {
            this.showNotification('שגיאה בשינוי סיסמה: ' + error.message, 'error');
        }
    }
    
    async handleAddAnnouncement(e) { 
        e.preventDefault();
        const form = e.target;
        const title = form.elements['announcement-title'].value;
        const content = form.elements['announcement-content'].value;
        const isGlobal = form.elements['announcement-global'].checked;
        const classId = isGlobal ? null : form.elements['announcement-class'].value;
        
        if (!title || !content || (!isGlobal && !classId)) {
            this.showNotification('נא למלא את כל השדות הנדרשים.', 'error');
            return;
        }
        
        try {
            await dbManager.createAnnouncement({ title, content, isGlobal, classId });
            this.showNotification('ההודעה נוספה בהצלחה.', 'success');
            this.closeAllModals();
            this.renderAnnouncements();
        } catch (error) {
            this.showNotification('שגיאה בהוספת הודעה: ' + error.message, 'error');
        }
    }
    
    async handleAddClass(e) { 
        e.preventDefault();
        const form = e.target;
        const name = form.elements['class-name'].value;
        
        // אוספים את מזהי המורים הנוספים
        const selectedTeachers = Array.from(form.elements['teachers'])
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);
            
        try {
            await dbManager.createClass({ name, teachers: selectedTeachers });
            this.showNotification('הכיתה נוצרה בהצלחה!', 'success');
            this.closeAllModals();
            this.renderClassesPage();
        } catch (error) {
            this.showNotification('שגיאה ביצירת כיתה: ' + error.message, 'error');
        }
    }

    async handleDeleteClass(classId) {
        if (!confirm('האם אתה בטוח שברצונך למחוק כיתה זו?')) return;

        try {
            await dbManager.deleteClass(classId);
            this.showNotification('הכיתה נמחקה בהצלחה.', 'success');
            this.renderClassesPage();
        } catch (error) {
            this.showNotification('שגיאה במחיקת כיתה: ' + error.message, 'error');
        }
    }

    async handleAddAssignment(e) { 
        e.preventDefault();
        const form = e.target;
        const title = form.elements['assignment-title'].value;
        const description = form.elements['assignment-description'].value;
        const classId = form.elements['assignment-class'].value;
        const dueDate = form.elements['assignment-due-date'].value;
        
        if (!title || !description || !classId || !dueDate) {
            this.showNotification('נא למלא את כל שדות המשימה.', 'error');
            return;
        }

        try {
            await dbManager.createAssignment({ title, description, classId, dueDate });
            this.showNotification('המשימה נוספה בהצלחה.', 'success');
            this.closeAllModals();
            this.renderAssignmentsPage();
        } catch (error) {
            this.showNotification('שגיאה בהוספת משימה: ' + error.message, 'error');
        }
    }
    
    async handleSubmitAssignment(e) { 
        e.preventDefault();
        const form = e.target;
        const assignmentId = this.currentAssignmentId;
        const submissionText = form.elements['submission-text'].value;
        const fileInput = form.elements['submission-file'];

        if (!assignmentId || (!submissionText && !fileInput.files[0])) {
            this.showNotification('יש להזין טקסט או לצרף קובץ.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('assignmentId', assignmentId);
        formData.append('submission', submissionText);
        if (fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }

        try {
            const token = authManager.token;
            const response = await fetch('/api/assignments/submit', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // FormData handles Content-Type for file uploads
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                 throw new Error(data.error || 'Submission failed');
            }

            this.showNotification('ההגשה נשלחה בהצלחה.', 'success');
            this.closeAllModals();
            // רנדור מחדש של פרטי המשימה
            this.renderAssignmentDetails(assignmentId); 
            this.renderAssignmentsPage();

        } catch (error) {
            console.error('Submission Error:', error);
            this.showNotification('שגיאה בהגשת משימה: ' + error.message, 'error');
        }
    }

    async handleGradeSubmission(e) {
        e.preventDefault();
        const form = e.target;
        const submissionId = form.elements['grade-submission-id'].value;
        const assignmentId = form.elements['grade-assignment-id'].value;
        const grade = form.elements['submission-grade'].value;
        const remarks = form.elements['submission-remarks'].value;
        
        const fullGrade = `${grade} (${remarks})`;

        try {
            const token = authManager.token;
            const response = await fetch(`/api/assignments/grade/${submissionId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ grade: fullGrade })
            });

            const data = await response.json();
            if (!response.ok) {
                 throw new Error(data.error || 'Grading failed');
            }
            
            this.showNotification('הציון נשמר בהצלחה.', 'success');
            this.closeAllModals();
            this.renderAssignmentDetails(assignmentId);

        } catch (error) {
            this.showNotification('שגיאה בשמירת ציון: ' + error.message, 'error');
        }
    }

    async handleAddEvent(e) { 
        e.preventDefault();
        const form = e.target;
        const title = form.elements['event-title'].value;
        const description = form.elements['event-description'].value;
        const date = form.elements['event-date'].value;

        if (!title || !description || !date) {
            this.showNotification('נא למלא את כל שדות האירוע.', 'error');
            return;
        }
        
        try {
            await dbManager.createEvent({ title, description, date });
            this.showNotification('האירוע נוסף בהצלחה.', 'success');
            this.closeAllModals();
            this.renderEvents();
        } catch (error) {
            this.showNotification('שגיאה בהוספת אירוע: ' + error.message, 'error');
        }
    }

    async handleAddMedia(e) { 
        e.preventDefault();
        const form = e.target;
        const title = form.elements['media-title'].value;
        const type = form.elements['media-type'].value;
        const date = form.elements['media-date'].value;
        const fileInput = document.getElementById('media-file');
        
        if (!title || !type || !date || !fileInput.files[0]) {
            this.showNotification('נא למלא את כל שדות המדיה ולצרף קובץ.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('type', type);
        formData.append('date', date);
        formData.append('file', fileInput.files[0]);

        try {
            const token = authManager.token;
            const response = await fetch('/api/media', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                 throw new Error(data.error || 'Upload failed');
            }

            this.showNotification('הקובץ הועלה בהצלחה.', 'success');
            this.closeAllModals();
            this.renderMedia();
        } catch (error) {
            console.error('Upload Error:', error);
            this.showNotification('שגיאה בהעלאת מדיה: ' + error.message, 'error');
        }
    }

    handleMediaDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) {
            document.getElementById('media-file').files = e.dataTransfer.files;
            this.handleMediaSelect({ target: { files: [file] } });
        }
    }

    handleMediaSelect(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('media-preview');
        preview.innerHTML = '';

        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                let element;
                if (file.type.startsWith('image/')) {
                    element = document.createElement('img');
                    element.src = event.target.result;
                } else if (file.type.startsWith('video/')) {
                    element = document.createElement('video');
                    element.src = event.target.result;
                    element.controls = true;
                } else {
                    element = document.createElement('p');
                    element.textContent = `קובץ מצורף: ${file.name}`;
                }
                
                element.style.maxWidth = '100%';
                element.style.maxHeight = '150px';
                element.style.objectFit = 'contain';
                element.style.borderRadius = '4px';

                preview.appendChild(element);
                document.getElementById('media-upload-area').style.display = 'none';
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            document.getElementById('media-upload-area').style.display = 'flex';
            preview.style.display = 'none';
        }
    }

    // --- Class Page ---

    async renderClassesPage() {
        const classesList = document.getElementById('classes-list');
        classesList.innerHTML = '<p class="loading-text">טוען כיתות...</p>';

        try {
            const classes = await dbManager.getClasses();
            classesList.innerHTML = '';

            if (classes.length === 0) {
                classesList.innerHTML = '<p class="empty-list">טרם נוצרו כיתות במערכת.</p>';
                return;
            }
            
            const isTeacherOrAdmin = authManager.isTeacher();

            classes.forEach(cls => {
                const classElement = document.createElement('div');
                classElement.className = 'card class-item';
                
                const studentCount = cls.students ? cls.students.length : 0;
                
                let actionButtons = '';
                if (isTeacherOrAdmin) {
                    // ✅ כפתור ניהול תלמידים חדש
                    actionButtons += `
                        <button class="btn btn-sm btn-info" onclick="uiManager.openManageStudentsModal('${cls._id}')" title="ניהול תלמידים">
                            <i class="fas fa-user-plus"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-class-btn" data-id="${cls._id}" title="מחיקת כיתה">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                }

                classElement.innerHTML = `
                    <div class="card-header">
                        <h2>${cls.name}</h2>
                        <div class="actions">${actionButtons}</div>
                    </div>
                    <div class="card-body">
                        <p><strong>מורה ראשי:</strong> ${cls.teacher.name}</p>
                        <p><strong>מורים נוספים:</strong> ${cls.teachers.map(t => t.name).join(', ') || 'אין'}</p>
                        <p><strong>מספר תלמידים:</strong> ${studentCount} / ${cls.maxStudents}</p>
                        <ul class="student-list" style="max-height: 150px; overflow-y: auto;">
                            ${cls.students.length > 0 ? cls.students.map(s => `<li>${s.name} (${s.email})</li>`).join('') : '<li>אין תלמידים משויכים כרגע.</li>'}
                        </ul>
                    </div>
                `;
                classesList.appendChild(classElement);
            });
            
            // Event listeners for delete buttons
            document.querySelectorAll('.delete-class-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleDeleteClass(e.currentTarget.dataset.id));
            });

        } catch (error) {
            console.error('Error rendering classes:', error);
            classesList.innerHTML = '<p class="error-text">שגיאה בטעינת הכיתות.</p>';
        }
    }
    
    // --- Student Management Modal (NEW) ---

    // פתיחת מודאל ניהול תלמידים לכיתה ספציפית
    async openManageStudentsModal(classId) {
        this.openModal('manage-students-modal');
        const modalTitle = document.getElementById('manage-students-modal-title');
        const studentsInClassList = document.getElementById('students-in-class-list');
        const availableStudentsList = document.getElementById('available-students-list');
        
        modalTitle.textContent = 'טוען...';
        studentsInClassList.innerHTML = '<p>טוען תלמידים משויכים...</p>';
        availableStudentsList.innerHTML = '<p>טוען תלמידים זמינים...</p>';

        try {
            // 1. טעינת כל המשתמשים (רק אם לא נטענו כבר)
            if (this.allUsers.length === 0) {
                const allUsers = await dbManager.getUsers();
                // שומרים רק משתמשים שהם תלמידים
                this.allUsers = allUsers.filter(u => u.role === 'student'); 
            }
            
            // 2. טעינת פרטי הכיתה הנוכחית (שנוכל לקבל את רשימת התלמידים העדכנית)
            const classes = await dbManager.getClasses(); // קוראים את הכל כדי למצוא את הנוכחית
            const currentClass = classes.find(c => c._id === classId);
            this.currentClassToManage = currentClass;

            if (!currentClass) {
                throw new Error('Class not found');
            }
            
            modalTitle.textContent = `ניהול תלמידים: ${currentClass.name}`;
            
            // רשימת מזהי התלמידים שכבר משויכים
            const studentIdsInClass = currentClass.students.map(s => s._id); 
            
            // סינון לרשימות: תלמידים משויכים ותלמידים זמינים
            const studentsInClass = this.allUsers.filter(u => studentIdsInClass.includes(u._id));
            const availableStudents = this.allUsers.filter(u => !studentIdsInClass.includes(u._id));
            
            // 3. הצגת תלמידים משויכים (עם כפתור הסרה)
            studentsInClassList.innerHTML = studentsInClass.length > 0 
                ? studentsInClass.map(s => `
                    <div class="list-item student-item">
                        <span>${s.name} (${s.email})</span>
                        <button class="btn btn-sm btn-danger" onclick="uiManager.handleStudentAction('${currentClass._id}', '${s._id}', 'remove')">הסר</button>
                    </div>
                `).join('')
                : '<p class="empty-list">אין תלמידים בכיתה זו.</p>';
                
            // 4. הצגת תלמידים זמינים (עם כפתור הוספה)
            availableStudentsList.innerHTML = availableStudents.length > 0
                ? availableStudents.map(s => `
                    <div class="list-item student-item">
                        <span>${s.name} (${s.email})</span>
                        <button class="btn btn-sm btn-secondary" onclick="uiManager.handleStudentAction('${currentClass._id}', '${s._id}', 'add')">הוסף</button>
                    </div>
                `).join('')
                : '<p class="empty-list">כל התלמידים משויכים או שאין תלמידים במערכת.</p>';

        } catch (error) {
            console.error('Error rendering manage students modal:', error);
            this.showNotification(`שגיאה בטעינת נתוני ניהול: ${error.message}`, 'error');
            studentsInClassList.innerHTML = '';
            availableStudentsList.innerHTML = '';
        }
    }

    // טיפול בהוספה/הסרה של תלמיד
    async handleStudentAction(classId, studentId, action) {
        if (!this.currentClassToManage || this.currentClassToManage._id !== classId) {
             this.showNotification('שגיאה: נתוני הכיתה אינם טעונים כראוי.', 'error');
             return;
        }

        const currentStudents = this.currentClassToManage.students.map(s => s._id);
        let newStudentsList;
        
        if (action === 'add') {
            if (currentStudents.includes(studentId)) return; // כבר קיים
            newStudentsList = [...currentStudents, studentId];
        } else if (action === 'remove') {
            newStudentsList = currentStudents.filter(id => id !== studentId);
        } else {
            return;
        }
        
        try {
            const result = await dbManager.updateClass(classId, { students: newStudentsList });
            
            // עדכון המשתנים המקומיים לאחר הצלחה
            this.currentClassToManage = result;
            
            this.showNotification(`התלמיד ${action === 'add' ? 'הוסף' : 'הוסר'} בהצלחה.`, 'success');
            
            // טעינה מחדש של המודאל כדי לשקף את השינוי
            this.openManageStudentsModal(classId); 
            // עדכון דף הכיתות ברקע
            this.renderClassesPage();

        } catch (error) {
            console.error('Error updating students list:', error);
            this.showNotification(`שגיאה ב${action === 'add' ? 'הוספת' : 'הסרת'} תלמיד: ${error.message}`, 'error');
        }
    }
    
    // --- Assignment Submission Details ---
    
    async renderAssignmentDetails(assignmentId) {
        const detailsContainer = document.getElementById('assignment-details-content');
        detailsContainer.innerHTML = '<p class="loading-text">טוען פרטי משימה...</p>';
        
        try {
            const allAssignments = await dbManager.getAssignments();
            const assignment = allAssignments.find(a => a._id === assignmentId);
            
            if (!assignment) {
                detailsContainer.innerHTML = '<p class="error-text">המשימה לא נמצאה.</p>';
                return;
            }

            const isTeacher = authManager.isTeacher();
            const currentUser = authManager.currentUser;
            
            let submissionFormHTML = '';
            let submissionsListHTML = '';
            let userSubmission = null;

            if (currentUser) {
                 userSubmission = assignment.submissions.find(s => s.student.toString() === currentUser.id);
            }
            
            const now = new Date();
            const dueDate = new Date(assignment.dueDate);
            const isLate = now > dueDate;
            
            // עבור תלמידים: הצגת טופס הגשה או סטטוס הגשה
            if (authManager.isStudent()) {
                if (isLate && !userSubmission) {
                    submissionFormHTML = '<p class="text-danger">מועד ההגשה עבר ולא הוגשה עבודה.</p>';
                } else if (userSubmission) {
                    const gradeInfo = userSubmission.grade ? `<span class="badge badge-success">${userSubmission.grade}</span>` : '<span class="badge badge-warning">טרם נבדק</span>';
                    submissionFormHTML = `
                        <h3>סטטוס הגשה</h3>
                        <p><strong>הוגש ב:</strong> ${new Date(userSubmission.submittedAt).toLocaleString('he-IL')}</p>
                        <p><strong>ציון:</strong> ${gradeInfo}</p>
                        <p><strong>תוכן הגשה:</strong> ${userSubmission.submission || 'ללא טקסט'}</p>
                        ${userSubmission.fileUrl ? `<p><strong>קובץ מצורף:</strong> <a href="${userSubmission.fileUrl}" target="_blank" class="btn btn-sm btn-primary">הורד קובץ</a></p>` : ''}
                        <hr>
                        <p class="text-info">ניתן לשלוח מחדש כדי לעדכן את ההגשה.</p>
                        ${isLate && !userSubmission ? '' : `
                            <form id="assignment-submission-form" style="margin-top: 1rem;">
                                <h3>עדכון הגשה</h3>
                                <div class="form-group">
                                    <label for="submission-text">הגשה (טקסט):</label>
                                    <textarea id="submission-text" name="submission-text" rows="4">${userSubmission.submission || ''}</textarea>
                                </div>
                                <div class="form-group">
                                    <label for="submission-file">קובץ מצורף (עדכון):</label>
                                    <input type="file" id="submission-file" name="submission-file">
                                </div>
                                <button type="submit" class="btn btn-secondary">עדכון הגשה</button>
                            </form>
                        `}
                    `;
                } else {
                    submissionFormHTML = `
                        <form id="assignment-submission-form">
                            <h3>הגשת משימה</h3>
                            <div class="form-group">
                                <label for="submission-text">הגשה (טקסט):</label>
                                <textarea id="submission-text" name="submission-text" rows="4" placeholder="הכנס כאן את תוכן המשימה..."></textarea>
                            </div>
                            <div class="form-group">
                                <label for="submission-file">קובץ מצורף:</label>
                                <input type="file" id="submission-file" name="submission-file">
                            </div>
                            <button type="submit" class="btn btn-primary">שלח הגשה</button>
                        </form>
                    `;
                }
            } 
            
            // עבור מורים/מנהלים: הצגת רשימת הגשות
            if (isTeacher) {
                submissionsListHTML = `
                    <h3>הגשות (סה"כ: ${assignment.submissions.length})</h3>
                    <div class="submissions-list list-manager-container">
                        ${assignment.submissions.length > 0 ? assignment.submissions.map(sub => `
                            <div class="list-item">
                                <span>
                                    <strong>${sub.student.name}</strong> (${new Date(sub.submittedAt).toLocaleDateString('he-IL')}) - 
                                    ${sub.grade ? `ציון: <span class="badge badge-success">${sub.grade}</span>` : 'טרם נבדק'}
                                </span>
                                <div class="actions">
                                    <button class="btn btn-sm btn-secondary" onclick="uiManager.openSubmissionContentModal('${sub._id}')" title="צפייה בהגשה">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-primary" onclick="uiManager.openGradeSubmissionModal('${sub._id}', '${assignmentId}')" title="מתן ציון">
                                        <i class="fas fa-award"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('') : '<p>טרם הוגשו משימות.</p>'}
                    </div>
                `;
            }

            // רנדור ראשי
            detailsContainer.innerHTML = `
                <h2>${assignment.title}</h2>
                <p><strong>כיתה:</strong> ${assignment.class.name}</p>
                <p><strong>מורה:</strong> ${assignment.teacher.name}</p>
                <p><strong>תאריך יעד:</strong> ${new Date(assignment.dueDate).toLocaleString('he-IL')}</p>
                <hr>
                <p>${assignment.description.replace(/\n/g, '<br>')}</p>
                <hr>
                
                ${isTeacher ? submissionsListHTML : submissionFormHTML}
            `;
            
            // אם מדובר בטופס הגשה חדש או עדכון, יש להוסיף Event Listener
            if (document.getElementById('assignment-submission-form')) {
                document.getElementById('assignment-submission-form').addEventListener('submit', (e) => this.handleSubmitAssignment(e));
            }

        } catch (error) {
            console.error('Error rendering assignment details:', error);
            detailsContainer.innerHTML = `<p class="error-text">שגיאה בטעינת פרטי המשימה: ${error.message}</p>`;
        }
    }
    
    openSubmissionContentModal(submissionId) {
        const modal = document.getElementById('submission-content-modal');
        const contentDiv = document.getElementById('submission-content-data');
        contentDiv.innerHTML = '<p class="loading-text">טוען תוכן הגשה...</p>';
        this.openModal('submission-content-modal');

        const assignment = dbManager.allAssignments.find(a => a._id === this.currentAssignmentId);
        if (!assignment) {
            contentDiv.innerHTML = '<p class="error-text">שגיאה: משימה לא נמצאה.</p>';
            return;
        }

        const submission = assignment.submissions.find(s => s._id === submissionId);
        if (!submission) {
            contentDiv.innerHTML = '<p class="error-text">שגיאה: הגשה לא נמצאה.</p>';
            return;
        }

        contentDiv.innerHTML = `
            <h3>הגשת התלמיד: ${submission.student.name}</h3>
            <p><strong>הוגש ב:</strong> ${new Date(submission.submittedAt).toLocaleString('he-IL')}</p>
            <p><strong>ציון:</strong> ${submission.grade || 'טרם נבדק'}</p>
            <hr>
            <h4>תוכן טקסטואלי:</h4>
            <div class="content-box">
                ${submission.submission.replace(/\n/g, '<br>') || '<p style="color:var(--gray);">אין תוכן טקסטואלי.</p>'}
            </div>
            ${submission.fileUrl ? `
                <h4 style="margin-top: 1rem;">קובץ מצורף:</h4>
                <a href="${submission.fileUrl}" target="_blank" class="btn btn-secondary">
                    <i class="fas fa-download"></i> הורד קובץ
                </a>
            ` : ''}
        `;
    }
    
    // --- Render Functions (Announcements, Assignments, Events, Media) ---

    async renderAnnouncements() {
        const announcementsList = document.getElementById('announcements-list');
        announcementsList.innerHTML = '<p class="loading-text">טוען הודעות...</p>';
        
        try {
            const announcements = await dbManager.getAnnouncements();
            announcementsList.innerHTML = '';
            
            if (announcements.length === 0) {
                 announcementsList.innerHTML = '<p class="empty-list">אין הודעות להצגה כרגע.</p>';
                 return;
            }

            announcements.forEach(ann => {
                const isGlobal = ann.isGlobal;
                const targetText = isGlobal ? 'הודעה גלובלית' : `כיתה: ${ann.class ? ann.class.name : 'לא ידוע'}`;
                
                const annElement = document.createElement('div');
                annElement.className = `card announcement-item ${isGlobal ? 'global' : 'class'}`;
                
                let actionButton = '';
                if (authManager.isTeacher()) {
                    actionButton = `
                        <button class="btn btn-sm btn-danger" onclick="uiManager.handleDeleteAnnouncement('${ann._id}')" title="מחיקת הודעה">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                }

                annElement.innerHTML = `
                    <div class="card-header">
                        <h2>${ann.title}</h2>
                        <div class="actions">${actionButton}</div>
                    </div>
                    <div class="card-body">
                        <p>${ann.content}</p>
                        <small>פורסם על ידי: ${ann.author.name} | יעד: ${targetText} | בתאריך: ${new Date(ann.createdAt).toLocaleDateString('he-IL')}</small>
                    </div>
                `;
                announcementsList.appendChild(annElement);
            });
            
        } catch (error) {
            console.error('Error rendering announcements:', error);
            announcementsList.innerHTML = '<p class="error-text">שגיאה בטעינת ההודעות.</p>';
        }
    }

    async handleDeleteAnnouncement(announcementId) {
        if (!confirm('האם אתה בטוח שברצונך למחוק הודעה זו?')) return;
        
        try {
            await dbManager.deleteAnnouncement(announcementId);
            this.showNotification('ההודעה נמחקה בהצלחה.', 'success');
            this.renderAnnouncements();
        } catch (error) {
            this.showNotification('שגיאה במחיקת הודעה: ' + error.message, 'error');
        }
    }
    
    async renderAssignmentsPage() {
        const assignmentsList = document.getElementById('assignments-list');
        assignmentsList.innerHTML = '<p class="loading-text">טוען משימות...</p>';
        
        try {
            const assignments = await dbManager.getAssignments();
            dbManager.allAssignments = assignments; // שמירה לעיון בפרטים
            assignmentsList.innerHTML = '';

            if (assignments.length === 0) {
                 assignmentsList.innerHTML = '<p class="empty-list">אין משימות להצגה כרגע.</p>';
                 return;
            }
            
            assignments.forEach(assignment => {
                const assignmentElement = document.createElement('div');
                assignmentElement.className = 'card assignment-item';
                
                let actionButtons = '';
                if (authManager.isTeacher()) {
                    actionButtons = `
                        <button class="btn btn-sm btn-danger" onclick="uiManager.handleDeleteAssignment('${assignment._id}')" title="מחיקת משימה">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                }
                
                assignmentElement.innerHTML = `
                    <div class="card-header">
                        <h2>${assignment.title}</h2>
                        <div class="actions">
                            <button class="btn btn-sm btn-primary" onclick="uiManager.openAssignmentDetailsModal('${assignment._id}')" title="פרטים/הגשה">
                                <i class="fas fa-file-alt"></i>
                            </button>
                            ${actionButtons}
                        </div>
                    </div>
                    <div class="card-body">
                        <p><strong>כיתה:</strong> ${assignment.class.name}</p>
                        <p><strong>תאריך יעד:</strong> ${new Date(assignment.dueDate).toLocaleDateString('he-IL')}</p>
                        <p class="description-snippet">${assignment.description.substring(0, 100)}${assignment.description.length > 100 ? '...' : ''}</p>
                    </div>
                `;
                assignmentsList.appendChild(assignmentElement);
            });

        } catch (error) {
             console.error('Error rendering assignments:', error);
             assignmentsList.innerHTML = '<p class="error-text">שגיאה בטעינת המשימות.</p>';
        }
    }

    async handleDeleteAssignment(assignmentId) {
        if (!confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) return;
        
        try {
            await dbManager.deleteAssignment(assignmentId);
            this.showNotification('המשימה נמחקה בהצלחה.', 'success');
            this.renderAssignmentsPage();
        } catch (error) {
            this.showNotification('שגיאה במחיקת משימה: ' + error.message, 'error');
        }
    }
    
    async renderEvents() {
        const eventsList = document.getElementById('events-list');
        eventsList.innerHTML = '<p class="loading-text">טוען אירועים...</p>';
        
        try {
            const events = await dbManager.getEvents();
            eventsList.innerHTML = '';

            if (events.length === 0) {
                 eventsList.innerHTML = '<p class="empty-list">אין אירועים קרובים להצגה.</p>';
                 return;
            }

            events.forEach(event => {
                const eventElement = document.createElement('div');
                eventElement.className = 'card event-item';
                
                let actionButton = '';
                if (authManager.isTeacher()) {
                    actionButton = `
                        <button class="btn btn-sm btn-danger" onclick="uiManager.handleDeleteEvent('${event._id}')" title="מחיקת אירוע">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                }

                eventElement.innerHTML = `
                    <div class="card-header">
                        <h2>${event.title}</h2>
                        <div class="actions">${actionButton}</div>
                    </div>
                    <div class="card-body">
                        <p><strong>תאריך:</strong> ${new Date(event.date).toLocaleDateString('he-IL')}</p>
                        <p>${event.description}</p>
                        <small>פורסם על ידי: ${event.author.name}</small>
                    </div>
                `;
                eventsList.appendChild(eventElement);
            });
            
        } catch (error) {
            console.error('Error rendering events:', error);
            eventsList.innerHTML = '<p class="error-text">שגיאה בטעינת האירועים.</p>';
        }
    }

    async handleDeleteEvent(eventId) {
        if (!confirm('האם אתה בטוח שברצונך למחוק אירוע זה?')) return;
        
        try {
            await dbManager.deleteEvent(eventId);
            this.showNotification('האירוע נמחק בהצלחה.', 'success');
            this.renderEvents();
        } catch (error) {
            this.showNotification('שגיאה במחיקת אירוע: ' + error.message, 'error');
        }
    }
    
    async renderMedia() {
        const mediaList = document.getElementById('media-list');
        mediaList.innerHTML = '<p class="loading-text">טוען פריטי מדיה...</p>';
        
        try {
            const mediaItems = await dbManager.getMedia();
            mediaList.innerHTML = '';

            if (mediaItems.length === 0) {
                 mediaList.innerHTML = '<p class="empty-list">אין פריטי מדיה להצגה כרגע.</p>';
                 return;
            }

            mediaItems.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'media-item';
                
                let mediaHTML = '';
                if (item.type.includes('image')) {
                    mediaHTML = `<img src="${item.url}" alt="${item.title}">`;
                } else if (item.type.includes('video')) {
                    mediaHTML = `<video src="${item.url}" controls></video>`;
                } else {
                    mediaHTML = `
                        <div class="file-icon-placeholder">
                            <i class="fas fa-file-alt"></i>
                            <a href="${item.url}" target="_blank" class="btn btn-sm btn-primary">הורד</a>
                        </div>
                    `;
                }
                
                let deleteButton = '';
                if (authManager.isAdmin()) {
                    deleteButton = `
                        <button class="btn btn-sm btn-danger" onclick="uiManager.handleDeleteMedia('${item._id}')" title="מחיקת מדיה">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                }

                itemElement.innerHTML = `
                    ${mediaHTML}
                    <div class="media-info">
                        <h3>${item.title}</h3>
                        <p><small>סוג: ${item.type} | תאריך: ${new Date(item.date).toLocaleDateString('he-IL')}</small></p>
                        <div class="actions" style="margin-top: 5px;">
                            <a href="${item.url}" target="_blank" class="btn btn-sm btn-secondary">צפייה</a>
                            ${deleteButton}
                        </div>
                    </div>
                `;
                mediaList.appendChild(itemElement);
            });
            
        } catch (error) {
            console.error('Error rendering media:', error);
            mediaList.innerHTML = '<p class="error-text">שגיאה בטעינת המדיה.</p>';
        }
    }
    
    async handleDeleteMedia(mediaId) {
        if (!confirm('האם אתה בטוח שברצונך למחוק פריט מדיה זה? (מחיקה פיזית של הקובץ מהשרת)')) return;
        
        try {
            await dbManager.deleteMedia(mediaId);
            this.showNotification('פריט המדיה נמחק בהצלחה.', 'success');
            this.renderMedia();
        } catch (error) {
            this.showNotification('שגיאה במחיקת מדיה: ' + error.message, 'error');
        }
    }
}

// Create global instance
console.log('🚀 Creating UI manager instance...');
const uiManager = new UIManager();
window.uiManager = uiManager;
