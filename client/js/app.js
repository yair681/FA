// Main application initialization
function updateUI() {
    // ✅ שימוש במשתנים הגלובליים (window.)
    const user = window.authManager.currentUser;
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
        const isTeacher = window.authManager.isTeacher();
        
        // Show add buttons for teachers/admins
        const addButtons = [
            'add-announcement-btn',
            'add-global-announcement-btn', 
            'add-class-btn',
            'add-assignment-btn',
            'add-event-btn',
            'add-media-btn',
            'admin-link',
            'settings-link'
        ];

        addButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                // מציג למורה או מנהל, או שומר על הגדרה קיימת
                if (isTeacher) {
                    btn.style.display = 'inline-block';
                } else if (!user.role) {
                    btn.style.display = 'none';
                }
            }
        });

        // הסתרת קישור ניהול אם המשתמש הוא מורה/תלמיד
        if (user.role === 'teacher' || user.role === 'student') {
            adminLink.style.display = 'none';
        }

    } else {
        userDisplay.textContent = 'אורח';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        settingsLink.style.display = 'none';
        adminLink.style.display = 'none';
        
        // הסתרת כל כפתורי ההוספה לאורח
        const allAddButtons = [
            'add-announcement-btn', 'add-global-announcement-btn', 'add-class-btn',
            'add-assignment-btn', 'add-event-btn', 'add-media-btn', 'admin-link', 'settings-link'
        ];
        allAddButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.style.display = 'none';
        });

        // הצגת קישור המשימות רק אם יש משימות ציבוריות (כרגע מוסתר לאורח)
        assignmentsLink.style.display = 'block';
    }
    
    // טעינת נתונים עבור הדף הנוכחי
    if (window.uiManager) {
        window.uiManager.loadPageData(window.uiManager.currentPage);
    }
}

// Global initialization logic (runs when app.js module is loaded)
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 School website initialized');

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (window.uiManager) {
                window.uiManager.closeAllModals();
            }
        }
    });

    // Initialize UI Manager first - show home page
    if (window.uiManager) {
        console.log('✅ UI Manager found, showing home page');
        window.uiManager.showPage('home');
    } else {
        console.log('❌ UI Manager not found');
    }
    
    // Wait for auth manager to initialize, then update UI
    const checkAuthReady = setInterval(() => {
        if (window.authManager) {
            clearInterval(checkAuthReady);
            console.log('✅ Auth manager ready, updating UI');
            
            // Force update UI after auth is ready
            setTimeout(() => {
                updateUI();
                console.log('✅ Application fully initialized');
            }, 500);
        }
    }, 100);

    // Also try to update UI after a longer delay as backup
    setTimeout(() => {
        if (window.authManager && window.uiManager) {
            console.log('🕒 Backup UI update');
            updateUI();
        }
    }, 2000);
});

// Make updateUI globally available (so auth.js can call it)
window.updateUI = updateUI;

// Add global error handler
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    if (window.uiManager && e.reason instanceof ReferenceError) {
        // מציג הודעת שגיאה כללית למשתמש
        // window.uiManager.showError('שגיאה קריטית: אנא רענן את הדף');
    }
});
