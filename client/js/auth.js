// Authentication Manager for MongoDB backend
export class AuthManager { // ✅ שינוי: הוספת export
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.init();
    }

    async init() {
        if (this.token) {
            await this.validateToken();
        }
        console.log('🔐 Auth Manager initialized');
        
        // Update UI after initialization
        if (typeof updateUI === 'function') {
            setTimeout(updateUI, 100);
        }
    }

    async validateToken() {
        try {
            const response = await fetch('/api/validate-token', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                this.currentUser = userData;
                console.log('✅ User validated:', userData.name);
                
                // Update UI after validation
                if (typeof updateUI === 'function') {
                    updateUI();
                }
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Token validation error:', error);
            this.logout();
            return false;
        }
    }

    async login(email, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('token', this.token);
                this.currentUser = data.user;
                console.log('✅ User logged in:', data.user.name);
                
                // Update UI after successful login
                if (typeof updateUI === 'function') {
                    updateUI();
                }
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    }

    async register(name, email, password, role = 'student') {
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password, role })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('token', this.token);
                this.currentUser = data.user;
                console.log('✅ User registered:', data.user.name);
                
                // Update UI after successful registration
                if (typeof updateUI === 'function') {
                    updateUI();
                }
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    }

    async logout() {
        this.currentUser = null;
        this.token = null;
        localStorage.removeItem('token');
        console.log('✅ User logged out');
        
        // Update UI after logout
        if (typeof updateUI === 'function') {
            updateUI();
        }
        return { success: true };
    }

    getAuthHeaders() {
        if (this.token) {
            return {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            };
        }
        return { 'Content-Type': 'application/json' };
    }

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }

    isTeacher() {
        return this.currentUser && (this.currentUser.role === 'teacher' || this.currentUser.role === 'admin');
    }

    isStudent() {
        return this.currentUser && this.currentUser.role === 'student';
    }

    isAuthenticated() {
        return !!this.currentUser;
    }
}

// ✅ שמירת מופע גלובלי (window) עבור קבצים המסתמכים על המשתנה הגלובלי
window.authManager = new AuthManager();
