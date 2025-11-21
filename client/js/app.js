// Main application initialization
function updateUI() {
    const user = authManager.currentUser;
    const userDisplay = document.getElementById('user-display');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsLink = document.getElementById('settings-link');
    const adminLink = document.getElementById('admin-link');

    console.log('🔄 Updating UI for user:', user ? user.name : 'Guest');

    if (user) {
        userDisplay.textContent = user.name;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        settingsLink.style.display = 'block';

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
            'add-user-btn',
            'admin-add-class-btn'
        ];
        
        addButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.style.display = isTeacher ? 'block' : 'none';
            }
        });

        // Show teacher assignments section
        const teacherSection = document.getElementById('teacher-assignments-section');
        if (teacherSection) {
            teacherSection.style.display = isTeacher ? 'block' : 'none';
        }
    } else {
        userDisplay.textContent = 'אורח';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        settingsLink.style.display = 'none';
        adminLink.style.display = 'none';

        // Hide all teacher/admin buttons
        const addButtons = document.querySelectorAll('[id*="add-"]');
        addButtons.forEach(btn => {
            if (btn.id.includes('add-') && btn.tagName === 'BUTTON') {
                btn.style.display = 'none';
            }
        });

        const teacherSection = document.getElementById('teacher-assignments-section');
        if (teacherSection) {
            teacherSection.style.display = 'none';
        }
    }

    // Reload current page data
    if (window.uiManager && window.uiManager.currentPage) {
        console.log('🔄 Reloading page data for:', window.uiManager.currentPage);
        window.uiManager.loadPageData(window.uiManager.currentPage);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('School website initialized');
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            if (window.uiManager) {
                window.uiManager.closeAllModals();
            }
        }
    });

    // Wait for auth manager to initialize, then update UI
    const checkAuthReady = setInterval(() => {
        if (window.authManager) {
            clearInterval(checkAuthReady);
            console.log('✅ Auth manager ready, updating UI');
            updateUI();
            
            // Initialize UI Manager if it exists
            if (window.uiManager) {
                window.uiManager.showPage('home');
            }
            
            console.log('✅ Application fully initialized');
        }
    }, 100);
});

// Make updateUI globally available
window.updateUI = updateUI;
