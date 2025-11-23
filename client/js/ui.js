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
        document.getElementById('add-class-form')?.addEventListener('submit', (e) => this.handleAddClass(e));
        document.getElementById('add-assignment-form')?.addEventListener('submit', (e) => this.handleAddAssignment(e));
        document.getElementById('add-event-form')?.addEventListener('submit', (e) => this.handleAddEvent(e));
        document.getElementById('add-media-form')?.addEventListener('submit', (e) => this.handleAddMedia(e));
        document.getElementById('add-announcement-form')?.addEventListener('submit', (e) => this.handleAddAnnouncement(e));


        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Add buttons
        document.getElementById('add-announcement-btn')?.addEventListener('click', () => this.openAddAnnouncementModal(false));
        document.getElementById('add-global-announcement-btn')?.addEventListener('click', () => this.openAddAnnouncementModal(true));
        document.getElementById('add-class-btn')?.addEventListener('click', () => this.openAddClassModal());
        document.getElementById('add-assignment-btn')?.addEventListener('click', () => this.openAddAssignmentModal());
        document.getElementById('add-event-btn')?.addEventListener('click', () => this.openAddEventModal());
        document.getElementById('add-media-btn')?.addEventListener('click', () => this.openAddMediaModal());

        // Register button
        document.getElementById('register-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openRegisterModal();
        });
        document.getElementById('register-form')?.addEventListener('submit', (e) => this.handleRegister(e));

        // Media upload drag and drop
        const mediaUploadArea = document.getElementById('media-upload-area');
        if (mediaUploadArea) {
            mediaUploadArea.addEventListener('click', () => document.getElementById('media-file').click());
            mediaUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                mediaUploadArea.classList.add('drag-over');
            });
            mediaUploadArea.addEventListener('dragleave', () => {
                mediaUploadArea.classList.remove('drag-over');
            });
            mediaUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                mediaUploadArea.classList.remove('drag-over');
                const fileInput = document.getElementById('media-file');
                if (e.dataTransfer.files.length) {
                    fileInput.files = e.dataTransfer.files;
                    this.handleMediaFileChange({ target: fileInput });
                }
            });
            document.getElementById('media-file')?.addEventListener('change', (e) => this.handleMediaFileChange(e));
        }
    }

    handleMediaFileChange(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('media-preview');
        const uploadArea = document.getElementById('media-upload-area');
        this.currentFile = file;

        if (file) {
            uploadArea.querySelector('p').textContent = file.name;
            uploadArea.querySelector('small').textContent = `גודל: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
            
            preview.style.display = 'block';
            preview.innerHTML = ''; 

            const reader = new FileReader();
            reader.onload = (e) => {
                if (file.type.startsWith('image/')) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="תצוגה מקדימה" style="max-width: 100%; max-height: 200px; display: block; margin: 10px auto;">`;
                } else if (file.type.startsWith('video/')) {
                    preview.innerHTML = `<video src="${e.target.result}" controls style="max-width: 100%; max-height: 200px; display: block; margin: 10px auto;"></video>`;
                } else {
                    preview.innerHTML = `<p class="text-center mt-2">קובץ: ${file.name}</p>`;
                }
            };
            reader.readAsDataURL(file);

        } else {
            uploadArea.querySelector('p').textContent = 'גרור קובץ לכאן או לחץ לבחירה';
            uploadArea.querySelector('small').textContent = 'כל סוגי הקבצים נתמכים (מקסימום 100MB)';
            preview.style.display = 'none';
            preview.innerHTML = '';
        }
    }


    // --- General UI Methods ---

    showPage(page) {
        this.currentPage = page;
        document.querySelectorAll('.page-content').forEach(div => {
            div.style.display = 'none';
        });
        document.getElementById(`${page}-page`).style.display = 'block';
        this.loadPageData(page);
    }

    async loadPageData(page) {
        // Dynamic loading of page-specific data
        const functionName = `load${page.charAt(0).toUpperCase() + page.slice(1)}`;
        if (this[functionName]) {
            try {
                // Before calling specific load functions, ensure data managers are ready
                if (page === 'assignments' && authManager.isTeacher() && !authManager.isAdmin()) {
                    // Specific logic for teachers to see their assignments first
                    await this.loadTeacherAssignments(); 
                } else if (page === 'home' || page === 'announcements' || page === 'classes' || page === 'events' || page === 'settings' || page === 'history') {
                    await this[functionName]();
                } else {
                    // Fallback for any other page or user role
                    await this[functionName]();
                }

            } catch (error) {
                console.error(`Error loading page ${page}:`, error);
                this.showError(`שגיאה בטעינת נתוני דף ${page}: ${error.message}`);
            }
        }
    }

    // --- Page Loaders ---

    async loadHome() {
        console.log('🔄 Loading home page data...');
        // Home page doesn't usually load complex data, maybe just some quick stats or latest announcements.
        await this.loadAnnouncements(true); // Load announcements on home page
    }

    async loadAnnouncements(isHome = false) {
        console.log('🔄 Loading announcements...');
        const announcementsContent = document.getElementById(isHome ? 'home-announcements-list' : 'announcements-content');
        if (!announcementsContent) return; 

        announcementsContent.innerHTML = '<p class="text-center">טוען הודעות...</p>';
        try {
            const announcements = await databaseManager.getAnnouncements();

            if (announcements.length === 0) {
                announcementsContent.innerHTML = '<p class="text-center text-muted">אין הודעות להצגה.</p>';
                return;
            }

            announcementsContent.innerHTML = announcements.map(a => `
                <div class="card mb-3 announcement-card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div>
                            <i class="fas fa-bullhorn me-1"></i>
                            <strong>${a.title}</strong>
                            <span class="badge ${a.isGlobal ? 'badge-primary' : 'badge-secondary'}">${a.isGlobal ? 'הודעה כללית' : `כיתה: ${a.class?.name || 'לא ידוע'}`}</span>
                        </div>
                        <small class="text-muted">מאת: ${a.author.name} | פורסם: ${new Date(a.createdAt).toLocaleDateString('he-IL')}</small>
                        ${authManager.isTeacher() || authManager.isAdmin() ? `<button class="btn btn-sm btn-danger delete-announcement-btn" data-id="${a._id}">מחק</button>` : ''}
                    </div>
                    <div class="card-body">
                        <p>${a.content}</p>
                    </div>
                </div>
            `).join('');
            
            this.initDeleteAnnouncementListeners();

        } catch (error) {
            announcementsContent.innerHTML = `<p class="text-center text-danger">שגיאה בטעינת הודעות: ${error.message}</p>`;
        }
    }

    async loadClasses() {
        console.log('🔄 Loading classes...');
        const classesContent = document.getElementById('classes-content');
        classesContent.innerHTML = '<p class="text-center">טוען כיתות...</p>';
        
        const isTeacher = authManager.isTeacher();
        const isAdmin = authManager.isAdmin();

        try {
            let classes = await databaseManager.getClasses(); // Gets ALL classes

            if (!isAdmin && !isTeacher) {
                // Students should only see their own classes if we use the generic route
                // Using getUserClasses for filtered list if needed, but for the 'Classes' page showing all, filtering usually happens on the route, which we don't have here. 
                // For simplicity, let's assume the client loads the user's classes for the 'classes' page unless admin/teacher.
                classes = await databaseManager.getUserClasses();
            }

            if (classes.length === 0) {
                classesContent.innerHTML = '<p class="text-center text-muted">אין כיתות להצגה.</p>';
                return;
            }

            classesContent.innerHTML = `
                <div class="classes-grid">
                    ${classes.map(cls => {
                        let actionsHtml = '';
                        // ⭐️ הוספת כפתור ניהול כיתה למורים/מנהלים
                        if (isTeacher || isAdmin) {
                            actionsHtml += `<button class="btn btn-sm btn-info manage-class-btn" data-class-id="${cls._id}"><i class="fas fa-edit"></i> ניהול כיתה</button>`;
                        }
                        
                        return `
                            <div class="card class-card">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h3>${cls.name}</h3>
                                    ${isAdmin ? `<button class="btn btn-sm btn-danger delete-class-btn" data-id="${cls._id}">מחק</button>` : ''}
                                </div>
                                <div class="card-body">
                                    <p><strong>מורה ראשי:</strong> ${cls.teacher.name}</p>
                                    <p><strong>מורים נוספים:</strong> ${cls.teachers.length > 1 ? cls.teachers.filter(t => t._id !== cls.teacher._id).map(t => t.name).join(', ') : 'אין'}</p>
                                    <p><strong>תלמידים:</strong> ${cls.students.length} / ${cls.maxStudents}</p>
                                    <div class="mt-3">
                                        ${actionsHtml}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            // Event Listeners for new buttons
            if (isTeacher || isAdmin) {
                document.querySelectorAll('.manage-class-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const classId = e.target.dataset.classId;
                        this.openManageClassModal(classId);
                    });
                });
            }
            this.initDeleteClassListeners();

        } catch (error) {
            classesContent.innerHTML = `<p class="text-center text-danger">שגיאה בטעינת כיתות: ${error.message}</p>`;
        }
    }

    async loadAssignments() {
        console.log('🔄 Loading assignments...');
        const assignmentsContent = document.getElementById('assignments-content');
        assignmentsContent.innerHTML = '<p class="text-center">טוען משימות...</p>';

        try {
            let assignments = await databaseManager.getAssignments();
            
            if (assignments.length === 0) {
                assignmentsContent.innerHTML = '<p class="text-center text-muted">אין משימות להצגה.</p>';
                return;
            }

            assignmentsContent.innerHTML = assignments.map(a => this.renderAssignmentCard(a)).join('');
            this.initAssignmentEventListeners();

        } catch (error) {
            assignmentsContent.innerHTML = `<p class="text-center text-danger">שגיאה בטעינת משימות: ${error.message}</p>`;
        }
    }
    
    async loadTeacherAssignments() {
        console.log('🔄 Loading teacher assignments...');
        const assignmentsContent = document.getElementById('assignments-content');
        assignmentsContent.innerHTML = '<p class="text-center">טוען משימות שנוצרו על ידך...</p>';

        try {
            const assignments = await databaseManager.getTeacherAssignments();
            
            if (assignments.length === 0) {
                assignmentsContent.innerHTML = '<p class="text-center text-muted">לא יצרת משימות עדיין.</p>';
                return;
            }

            assignmentsContent.innerHTML = assignments.map(a => this.renderAssignmentCard(a)).join('');
            this.initAssignmentEventListeners();

        } catch (error) {
            assignmentsContent.innerHTML = `<p class="text-center text-danger">שגיאה בטעינת משימות: ${error.message}</p>`;
        }
    }
    
    // ... (rest of the load functions: loadEvents, loadHistory, loadSettings)

    async loadEvents() {
        console.log('🔄 Loading events...');
        const eventsContent = document.getElementById('events-content');
        eventsContent.innerHTML = '<p class="text-center">טוען אירועים...</p>';
        try {
            const events = await databaseManager.getEvents();
            if (events.length === 0) {
                eventsContent.innerHTML = '<p class="text-center text-muted">אין אירועים קרובים.</p>';
                return;
            }

            eventsContent.innerHTML = events.map(e => `
                <div class="card mb-3 event-card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div>
                            <i class="fas fa-calendar-alt me-1"></i>
                            <strong>${e.title}</strong>
                        </div>
                        <small class="text-muted">מאת: ${e.author.name} | תאריך: ${new Date(e.date).toLocaleDateString('he-IL')}</small>
                        ${authManager.isTeacher() || authManager.isAdmin() ? `<button class="btn btn-sm btn-danger delete-event-btn" data-id="${e._id}">מחק</button>` : ''}
                    </div>
                    <div class="card-body">
                        <p>${e.description}</p>
                    </div>
                </div>
            `).join('');
            
            this.initDeleteEventListeners();

        } catch (error) {
            eventsContent.innerHTML = `<p class="text-center text-danger">שגיאה בטעינת אירועים: ${error.message}</p>`;
        }
    }

    async loadHistory() {
        console.log('🔄 Loading history...');
        const historyContent = document.getElementById('history-content');
        historyContent.innerHTML = '<p class="text-center">טוען קבצי מדיה...</p>';
        
        const isTeacher = authManager.isTeacher();
        const isAdmin = authManager.isAdmin();

        try {
            const mediaItems = await databaseManager.getMedia();
            
            if (mediaItems.length === 0) {
                historyContent.innerHTML = '<p class="text-center text-muted">אין קבצי מדיה להצגה.</p>';
                return;
            }

            historyContent.innerHTML = `
                <div class="media-grid">
                    ${mediaItems.map(m => `
                        <div class="card media-item">
                            ${m.type.startsWith('image') ? `<img src="${m.url}" alt="${m.title}">` : ''}
                            ${m.type.startsWith('video') ? `<video src="${m.url}" controls></video>` : ''}
                            ${!m.type.startsWith('image') && !m.type.startsWith('video') ? `<div class="media-placeholder"><i class="fas fa-file-alt"></i></div>` : ''}
                            <div class="media-info">
                                <strong>${m.title}</strong>
                                <small class="d-block text-muted">${m.type} | ${new Date(m.date).toLocaleDateString('he-IL')}</small>
                                <a href="${m.url}" target="_blank" class="btn btn-sm btn-primary mt-2">צפייה</a>
                                ${isAdmin ? `<button class="btn btn-sm btn-danger delete-media-btn" data-id="${m._id}">מחק</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            this.initDeleteMediaListeners();

        } catch (error) {
            historyContent.innerHTML = `<p class="text-center text-danger">שגיאה בטעינת מדיה: ${error.message}</p>`;
        }
    }

    async loadSettings() {
        console.log('🔄 Loading settings page data...');
        const settingsContent = document.getElementById('settings-content');
        if (!settingsContent) return;
        
        settingsContent.innerHTML = ''; // מנקה תוכן ישן

        const user = authManager.currentUser;
        if (!user) {
             settingsContent.innerHTML = '<p class="text-center text-danger">משתמש לא מחובר.</p>';
             return; 
        }

        const html = `
            <div class="card p-4">
                <h2>פרטי משתמש:</h2>
                <p><strong>שם:</strong> ${user.name}</p>
                <p><strong>אימייל:</strong> ${user.email}</p>
                <p><strong>תפקיד:</strong> ${user.role === 'admin' ? 'מנהל' : user.role === 'teacher' ? 'מורה' : 'תלמיד'}</p>
            </div>
            
            <div class="card p-4 mt-4">
                <h2>שינוי סיסמה:</h2>
                <form id="change-password-form">
                    <div class="form-group">
                        <label for="new-password">סיסמה חדשה</label>
                        <input type="password" id="new-password" required>
                    </div>
                    <div class="form-group">
                        <label for="confirm-password">אישור סיסמה חדשה</label>
                        <input type="password" id="confirm-password" required>
                    </div>
                    <button type="submit" class="btn btn-primary">שנה סיסמה</button>
                </form>
            </div>
        `;

        settingsContent.innerHTML = html;
        document.getElementById('change-password-form').addEventListener('submit', (e) => this.handleChangePassword(e));
    }


    // --- Class Management Methods ---

    // ⭐️ חדש: פתיחת מודל ניהול כיתה
    async openManageClassModal(classId) {
        this.showModal('manage-class-modal');
        const modalBody = document.getElementById('manage-class-modal-body');
        modalBody.innerHTML = '<p class="text-center">טוען נתונים...</p>';
        document.getElementById('manage-class-modal-title').textContent = 'טוען...';

        try {
            // 1. שליפת פרטי כיתה
            const classData = await databaseManager.getClassById(classId);
            document.getElementById('manage-class-modal-title').textContent = `ניהול כיתה: ${classData.name}`;

            // 2. שליפת נתונים קשורים במקביל
            const [assignments, announcements, allStudents] = await Promise.all([
                databaseManager.getAssignmentsByClass(classId),
                databaseManager.getAnnouncementsByClass(classId),
                databaseManager.getStudents() 
            ]);
            
            // רינדור התוכן
            modalBody.innerHTML = this.renderManageClassContent(classData, assignments, announcements, allStudents);

            // הוספת Event Listeners
            this.initManageClassEventListeners(classData, allStudents);

        } catch (error) {
            this.showError(`שגיאה בטעינת נתוני הכיתה: ${error.message}`);
            modalBody.innerHTML = `<p class="text-center text-danger">שגיאה בטעינת נתונים.</p>`;
        }
    }

    // ⭐️ חדש: רינדור תוכן מודל ניהול כיתה
    renderManageClassContent(classData, assignments, announcements, allStudents) {
        const currentStudentIds = classData.students.map(s => s._id);
        const availableStudents = allStudents.filter(s => !currentStudentIds.includes(s._id));

        return `
            <div class="class-management-tabs">
                <button class="btn btn-tab active" data-tab="students"><i class="fas fa-user-graduate"></i> תלמידים (${classData.students.length})</button>
                <button class="btn btn-tab" data-tab="assignments"><i class="fas fa-clipboard-list"></i> משימות (${assignments.length})</button>
                <button class="btn btn-tab" data-tab="announcements"><i class="fas fa-bullhorn"></i> הודעות (${announcements.length})</button>
            </div>

            <div id="students-tab" class="tab-content active">
                <h4>ניהול תלמידים</h4>
                <div class="card p-3 mb-4">
                    <p><strong>הוספת תלמיד:</strong></p>
                    <div class="d-flex align-items-center">
                        <select id="add-student-select-${classData._id}" class="form-control me-2" style="flex-grow: 1;">
                            <option value="">בחר תלמיד להוספה</option>
                            ${availableStudents.map(s => `<option value="${s._id}">${s.name} (${s.email})</option>`).join('')}
                            ${availableStudents.length === 0 ? '<option disabled>כל התלמידים במערכת כבר בכיתה זו</option>' : ''}
                        </select>
                        <button class="btn btn-secondary" id="add-student-btn-${classData._id}" 
                                data-class-id="${classData._id}">הוסף</button>
                    </div>
                </div>

                <h5>רשימת תלמידים בכיתה:</h5>
                <ul class="list-group" id="student-list-${classData._id}">
                    ${classData.students.map(s => `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            ${s.name} (${s.email})
                            <button class="btn btn-sm btn-danger remove-student-btn" 
                                data-class-id="${classData._id}" data-student-id="${s._id}">הסר</button>
                        </li>
                    `).join('')}
                    ${classData.students.length === 0 ? '<li class="list-group-item text-center text-muted">אין תלמידים בכיתה זו.</li>' : ''}
                </ul>
            </div>

            <div id="assignments-tab" class="tab-content">
                <h4>משימות לכיתה ${classData.name}</h4>
                ${this.renderClassAssignments(assignments)}
            </div>

            <div id="announcements-tab" class="tab-content">
                <h4>הודעות לכיתה ${classData.name}</h4>
                ${this.renderClassAnnouncements(announcements)}
            </div>
        `;
    }

    // ⭐️ חדש: רינדור משימות לכיתה
    renderClassAssignments(assignments) {
        if (assignments.length === 0) return '<p class="text-center text-muted">אין משימות משויכות לכיתה זו.</p>';
        return `
            <ul class="list-group">
                ${assignments.map(a => `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${a.title}</strong>
                            <small class="d-block text-muted">תאריך יעד: ${new Date(a.dueDate).toLocaleDateString('he-IL')}</small>
                            <small class="d-block text-muted">מאת: ${a.teacher.name}</small>
                        </div>
                        <button class="btn btn-sm btn-primary view-submissions-btn" data-assignment-id="${a._id}">צפה בהגשות</button>
                    </li>
                `).join('')}
            </ul>
        `;
    }
    
    // ⭐️ חדש: רינדור הודעות לכיתה
    renderClassAnnouncements(announcements) {
        // מציג רק הודעות ספציפיות לכיתה
        const classSpecificAnnouncements = announcements.filter(a => !a.isGlobal); 

        if (classSpecificAnnouncements.length === 0) return '<p class="text-center text-muted">אין הודעות מיוחדות לכיתה זו.</p>';
        return `
            <ul class="list-group">
                ${classSpecificAnnouncements.map(a => `
                    <li class="list-group-item">
                        <strong>${a.title}</strong>
                        <small class="d-block text-muted">מאת: ${a.author.name} | פורסם: ${new Date(a.createdAt).toLocaleDateString('he-IL')}</small>
                        <p class="mb-0">${a.content.substring(0, 150)}${a.content.length > 150 ? '...' : ''}</p>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    // ⭐️ חדש: אתחול אירועי מודל הניהול
    initManageClassEventListeners(classData, allStudents) {
        const classId = classData._id;

        // Tab switching logic
        document.querySelectorAll('.class-management-tabs .btn-tab').forEach(tabBtn => {
            tabBtn.addEventListener('click', (e) => {
                document.querySelectorAll('.class-management-tabs .btn-tab').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                document.getElementById(`${e.target.dataset.tab}-tab`).classList.add('active');
            });
        });

        // Add Student logic
        document.getElementById(`add-student-btn-${classId}`)?.addEventListener('click', (e) => {
            const select = document.getElementById(`add-student-select-${classId}`);
            const studentId = select.value;
            if (studentId) {
                this.handleAddRemoveStudent(classId, studentId, 'add');
            } else {
                this.showError('בחר תלמיד לפני ההוספה.');
            }
        });

        // Remove Student logic
        document.getElementById(`student-list-${classId}`)?.querySelectorAll('.remove-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const studentId = e.target.dataset.studentId;
                this.handleAddRemoveStudent(classId, studentId, 'remove');
            });
        });

        // View Submissions logic (Placeholder)
        document.querySelectorAll('.view-submissions-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const assignmentId = e.target.dataset.assignmentId;
                // You would need to implement openSubmissionsModal(assignmentId) here
                this.showError(`פתיחת הגשות למשימה ID: ${assignmentId} - דורש פיתוח נוסף.`);
            });
        });
    }

    // ⭐️ חדש: הוספה/הסרה של תלמיד מהכיתה
    async handleAddRemoveStudent(classId, studentId, action) {
        try {
            this.showNotification(`מעדכן כיתה...`, 'info');
            
            // Fetch the current class data to get the *existing* list of student IDs
            const currentClassData = await databaseManager.getClassById(classId);
            const currentStudentIds = currentClassData.students.map(s => s._id.toString());
            let newStudentIds = [...currentStudentIds];

            if (action === 'add') {
                if (!newStudentIds.includes(studentId)) {
                    newStudentIds.push(studentId);
                } else {
                    this.showError('התלמיד כבר בכיתה.');
                    return;
                }
            } else if (action === 'remove') {
                newStudentIds = newStudentIds.filter(id => id !== studentId);
            } else {
                return;
            }

            // Update the class on the server
            await databaseManager.updateClass(classId, { 
                students: newStudentIds 
            });

            this.showSuccess(`התלמיד ${action === 'add' ? 'נוסף' : 'הוסר'} בהצלחה.`);
            
            // Re-open the modal and re-render the main page to show the update
            this.closeAllModals(); 
            this.openManageClassModal(classId); 
            this.loadClasses(); // Refresh main class list (if visible)

        } catch (error) {
            this.showError(`שגיאה בעדכון כיתה: ${error.message}`);
        }
    }

    // --- Modal Handlers ---
    // ... (All existing modal handlers: openLoginModal, handleLogin, logout, openRegisterModal, handleRegister, openAddAnnouncementModal, handleAddAnnouncement, initDeleteAnnouncementListeners, openAddClassModal, handleAddClass, initDeleteClassListeners, openAddAssignmentModal, handleAddAssignment, initAssignmentEventListeners, handleAssignmentSubmission, openSubmissionsModal, handleGradeSubmission, openAddEventModal, handleAddEvent, initDeleteEventListeners, openAddMediaModal, handleAddMedia, initDeleteMediaListeners, handleChangePassword, closeAllModals, showModal)

    // ... (utility functions like renderAssignmentCard, showError, showSuccess, showNotification)

    renderAssignmentCard(assignment) {
        // ... (existing implementation)
    }

    showError(message) {
        // ... (existing implementation)
    }

    showSuccess(message) {
        // ... (existing implementation)
    }

    showNotification(message, type = 'info') {
        // ... (existing implementation)
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
    
    showModal(id) {
        document.getElementById(id).style.display = 'block';
    }

    // ... (rest of the methods)
}

// Create global instance
console.log('⚙️ Initializing UI Manager');
const uiManager = new UIManager();
window.uiManager = uiManager;
