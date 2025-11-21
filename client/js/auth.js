// Authentication Manager for MongoDB backend
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.init();
    }

    init() {
        if (this.token) {
            this.validateToken();
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
                updateUI();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Token validation error:', error);
            this.logout();
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
                this.currentUser = data.user;
                localStorage.setItem('token', this.token);
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    }

    async register(userData) {
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('token', this.token);
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
        updateUI();
        return { success: true };
    }

    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
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
}

const authManager = new AuthManager();