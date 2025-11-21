// Main application initialization
function updateUI() {
    const user = authManager.currentUser;
    const userDisplay = document.getElementById('user-display');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsLink = document.getElementById('settings-link');
    const adminLink = document.getElementById('admin-link');

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
        
        document.getElementById('add-announcement-btn').style.display = isTeacher ? 'block' : 'none';
        document.getElementById('add-global-announcement-btn').style.display = isTeacher ? 'block' : 'none';
        document.getElementById('add-class-btn').style.display = isTeacher ? 'block' : 'none';
        document.getElementById('add-event-btn').style.display = isTeacher ? 'block' : 'none';
        document.getElementById('add-media-btn').style.display = isTeacher ? 'block' : 'none';

        if (isTeacher) {
            document.getElementById('teacher-assignments-section').style.display = 'block';
        } else {
            document.getElementById('teacher-assignments-section').style.display = 'none';
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

        document.getElementById('teacher-assignments-section').style.display = 'none';
    }

    // Reload current page data
    if (uiManager.currentPage) {
        uiManager.loadPageData(uiManager.currentPage);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('School website initialized');
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            uiManager.closeAllModals();
        }
    });

    // Initialize with home page
    uiManager.showPage('home');
    
    // Initial UI update
    updateUI();
});