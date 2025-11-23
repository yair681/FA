// Database Manager for MongoDB backend
class DatabaseManager {
    constructor() {
        this.API_BASE = window.location.origin + '/api';
        console.log('📊 Database Manager initialized with base:', this.API_BASE);
    }

    async makeRequest(endpoint, options = {}) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...(authManager ? authManager.getAuthHeaders() : {}),
                ...options.headers
            };

            const config = {
                ...options,
                headers
            };

            console.log(`🔄 API Call: ${this.API_BASE}${endpoint}`);
            const response = await fetch(`${this.API_BASE}${endpoint}`, config);
            
            if (response.status === 401) {
                if (authManager) {
                    authManager.logout();
                } else {
                    localStorage.removeItem('token');
                    window.location.reload();
                }
                // Return empty data instead of throwing error for public endpoints
                if (this.isPublicEndpoint(endpoint)) {
                    console.log('🔒 Public endpoint - returning empty data');
                    return [];
                }
                throw new Error('Authentication required');
            }

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            const isJson = contentType && contentType.includes('application/json');

            if (!response.ok) {
                if (isJson) {
                    const errorData = await response.json();
                    const errorMessage = `API Error: ${errorData.error || response.statusText}`;
                    console.error('❌ API Error:', errorMessage, errorData);
                    throw new Error(errorMessage);
                } else {
                    const errorText = await response.text();
                    console.error('❌ API Error (Non-JSON):', response.status, errorText);
                    throw new Error(`API Error: ${response.status} (${errorText.substring(0, 50)}...)`);
                }
            }

            if (isJson) {
                return await response.json();
            } else {
                return response.text();
            }

        } catch (error) {
            console.error(`❌ API Request Failed for ${endpoint}:`, error);
            throw error;
        }
    }

    isPublicEndpoint(endpoint) {
        return ['/announcements', '/health', '/login', '/register', '/events', '/media'].some(publicPath => endpoint.startsWith(publicPath));
    }

    // ===== USER METHODS =====

    async getUsers() {
        if (!authManager || !authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest('/users');
    }

    // ⭐️ חדש: שליפת תלמידים בלבד
    async getStudents() {
        try {
            const users = await this.getUsers();
            return users.filter(user => user.role === 'student');
        } catch (error) {
            console.error('Error getting students:', error);
            return [];
        }
    }
    
    // ... (existing getTeachers method)

    async getTeachers() {
        try {
            const users = await this.getUsers();
            return users.filter(user => user.role === 'teacher' || user.role === 'admin');
        } catch (error) {
            console.error('Error getting teachers:', error);
            return [];
        }
    }

    async changePassword(newPassword) {
        if (!authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }

        return this.makeRequest('/change-password', {
            method: 'POST',
            body: JSON.stringify({ newPassword })
        });
    }

    // ===== CLASS METHODS =====

    async getClasses() {
        return this.makeRequest('/classes');
    }

    async getUserClasses() {
        if (authManager.isStudent() || authManager.isTeacher() || authManager.isAdmin()) {
            return this.makeRequest('/classes/my');
        }
        return [];
    }

    // ⭐️ חדש: שליפת כיתה בודדת
    async getClassById(classId) {
        if (!authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest(`/classes/${classId}`);
    }

    async createClass(classData) {
        if (!authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/classes', {
            method: 'POST',
            body: JSON.stringify(classData)
        });
    }
    
    // ⭐️ חדש: עדכון כיתה (משמש להוספה/הסרת תלמידים)
    async updateClass(classId, data) {
        if (!authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/classes/${classId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // ===== ANNOUNCEMENT METHODS =====
    // ... (existing announcement methods)

    // ===== ASSIGNMENT METHODS =====
    // ... (existing assignment methods)
    
    // ⭐️ חדש: שליפת משימות לפי כיתה
    async getAssignmentsByClass(classId) {
        if (!authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest(`/classes/${classId}/assignments`);
    }

    // ⭐️ חדש: שליפת הודעות לפי כיתה
    async getAnnouncementsByClass(classId) {
        return this.makeRequest(`/classes/${classId}/announcements`);
    }
    
    // ... (rest of methods)
    
    async getTeacherAssignments() {
        if (!authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/assignments/teacher');
    }

    async getAssignments() {
        return this.makeRequest('/assignments');
    }
    
    async createAssignment(assignmentData) {
        if (!authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/assignments', {
            method: 'POST',
            body: JSON.stringify(assignmentData)
        });
    }
    // ... (other methods)

    // ===== MEDIA METHODS =====
    // ... (existing media methods)

    // ===== UTILITY METHODS =====
    
    // ===== CHECK API HEALTH =====
    async checkHealth() {
        try {
            const response = await fetch(`${this.API_BASE}/health`);
            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
console.log('⚙️ Initializing Database Manager');
const databaseManager = new DatabaseManager();
window.databaseManager = databaseManager;
