// Main application initialization
function updateUI() {
    // הפונקציה הזו כעת בטוחה מכיוון שהיא נקראת רק כאשר authManager קיים
    const user = authManager.currentUser;
    const userDisplay = document.getElementById('user-display');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsLink = document.getElementById('settings-link');
    const adminLink = document.getElementById('admin-link');
    const assignmentsLink = document.getElementById('assignments-link');

    console.log('🔄 Updating UI for user:', user ? user.name : 'Guest');

    if (user) {
        userDisplay.textContent = user.name;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        settingsLink.style.display = 'block';
        assignmentsLink.style.display = 'block'; // Show assignments link for logged-in users

        // Show admin link for admin users
        if (user.role === 'admin') {
            adminLink.style.display = 'block';
        } else {
            adminLink.style.display = 'none';
        }

        // Show/hide teacher/admin buttons
        const isTeacher = authManager.isTeacher();
        
        // Show add buttons for teachers/admins
        const addButtons = [
            'add-announcement-btn',
            'add-global-announcement-btn', 
            'add-class-btn',
            'add-assignment-btn',
            'add-event-btn',
            'add-media-btn',
            'admin-add-class-btn',
            'add-user-btn'
        ];
        
        addButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.style.display = isTeacher ? 'inline-block' : 'none';
            }
        });
        
        // Show/hide assignment sections
        const teacherAssignmentsSection = document.getElementById('teacher-assignments-section');
        const studentAssignmentsSection = document.getElementById('student-assignments-section');
        
        if (teacherAssignmentsSection) teacherAssignmentsSection.style.display = isTeacher ? 'block' : 'none';
        if (studentAssignmentsSection) studentAssignmentsSection.style.display = !isTeacher ? 'block' : 'none';
        
    } else {
        userDisplay.textContent = 'אורח';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        settingsLink.style.display = 'none';
        adminLink.style.display = 'none';
        assignmentsLink.style.display = 'none'; // Hide assignments link for guests
        
        // Hide teacher/admin buttons
        const addButtons = [
            'add-announcement-btn',
            'add-global-announcement-btn', 
            'add-class-btn',
            'add-assignment-btn',
            'add-event-btn',
            'add-media-btn',
            'admin-add-class-btn',
            'add-user-btn'
        ];
        addButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.style.display = 'none';
            }
        });

        // Show guest assignment message
        const guestAssignmentsSection = document.getElementById('guest-assignments-section');
        if (guestAssignmentsSection) guestAssignmentsSection.style.display = 'block';
        const teacherAssignmentsSection = document.getElementById('teacher-assignments-section');
        if (teacherAssignmentsSection) teacherAssignmentsSection.style.display = 'none';
        const studentAssignmentsSection = document.getElementById('student-assignments-section');
        if (studentAssignmentsSection) studentAssignmentsSection.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 School website initialized');

    // Handle closing modals by clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.onclick = (e) => {
            if (e.target === modal && window.uiManager) {
                window.uiManager.closeAllModals();
            }
        }
    });

    // ❌ הוסר הבלוק שהפעיל את showPage('home') מוקדם מדי.

    let isInitialized = false;

    // Wait for both managers to initialize before starting the application
    const checkReady = setInterval(() => {
        if (window.authManager && window.uiManager && !isInitialized) {
            clearInterval(checkReady);
            isInitialized = true;

            // 1. הפעל את עדכון ה-UI הראשון
            console.log('✅ Managers ready, performing initial UI update...');
            updateUI(); 

            // 2. טען את דף הבית
            console.log('✅ Showing home page and loading data');
            window.uiManager.showPage('home');
            
            console.log('✅ Application fully initialized');
        }
    }, 100);

    // ❌ הוסרה לולאת ה-setTimeout הגיבוי המיותרת.
});

// Make updateUI globally available
window.updateUI = updateUI;

// Add global error handler
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
});
