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
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'API Request failed');
                }
                return data;
            } else if (response.ok) {
                // No content or not JSON, but successful (e.g., DELETE)
                return {}; 
            } else {
                // Non-JSON error
                const errorText = await response.text();
                throw new Error(errorText || `API Request failed with status ${response.status}`);
            }
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    isPublicEndpoint(endpoint) {
        return endpoint.startsWith('/health');
    }

    // ===== USER METHODS =====
    async getUsers() {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            console.log('🔒 Authentication required for users');
            return [];
        }
        return this.makeRequest('/users');
    }
    
    // שינוי חדש: אחזור רשימת תלמידים בלבד
    async getStudents() {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/students');
    }

    async getUserById(userId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/users/${userId}`);
    }

    async createUser(userData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    // ... (other user-related methods like updateUser, deleteUser)

    // ===== CLASS METHODS =====
    async getClasses() {
        if (!authManager || !authManager.isAuthenticated()) {
            console.log('🔒 Authentication required for classes');
            return [];
        }
        return this.makeRequest('/classes');
    }

    async getClassById(classId) {
        if (!authManager || !authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest(`/classes/${classId}`);
    }

    async createClass(classData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest('/classes', {
            method: 'POST',
            body: JSON.stringify(classData)
        });
    }

    async deleteClass(classId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/classes/${classId}`, {
            method: 'DELETE'
        });
    }

    // שינוי חדש: שיוך תלמיד לכיתה
    async assignStudentToClass(classId, studentId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/classes/${classId}/students`, {
            method: 'POST',
            body: JSON.stringify({ studentId })
        });
    }

    // שינוי חדש: הסרת תלמיד מכיתה
    async removeStudentFromClass(classId, studentId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/classes/${classId}/students/${studentId}`, {
            method: 'DELETE'
        });
    }

    // ===== ANNOUNCEMENT METHODS =====
    async getAnnouncements() {
        if (!authManager || !authManager.isAuthenticated()) {
            console.log('🔒 Authentication required for announcements');
            return [];
        }
        return this.makeRequest('/announcements');
    }

    async createAnnouncement(announcementData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/announcements', {
            method: 'POST',
            body: JSON.stringify(announcementData)
        });
    }

    async deleteAnnouncement(announcementId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/announcements/${announcementId}`, {
            method: 'DELETE'
        });
    }
    
    // ===== ASSIGNMENT METHODS =====
    async getAssignments() {
        if (!authManager || !authManager.isAuthenticated()) {
            console.log('🔒 Authentication required for assignments');
            return [];
        }
        return this.makeRequest('/assignments');
    }

    async createAssignment(assignmentData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/assignments', {
            method: 'POST',
            body: JSON.stringify(assignmentData)
        });
    }
    
    async updateAssignment(assignmentId, assignmentData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/assignments/${assignmentId}`, {
            method: 'PUT',
            body: JSON.stringify(assignmentData)
        });
    }

    async deleteAssignment(assignmentId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/assignments/${assignmentId}`, {
            method: 'DELETE'
        });
    }
    
    // ... (rest of the methods: getSubmissions, createSubmission, updateGrade, getEvents, createEvent, deleteEvent, getMedia, createMedia, deleteMedia, getTeachers, checkHealth)

    // ===== SUBMISSION METHODS =====
    async getSubmissions(assignmentId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/submissions/assignment/${assignmentId}`);
    }

    async getStudentSubmissions(assignmentId, studentId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/submissions/assignment/${assignmentId}/student/${studentId}`);
    }

    async createSubmission(submissionData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isStudent()) {
            throw new Error('Student access required');
        }
        // This is handled by UI manager with FormData
        throw new Error('Use FormData for submission creation with files');
    }
    
    async updateGrade(assignmentId, studentId, gradeData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/assignments/grade`, {
            method: 'POST',
            body: JSON.stringify({ assignmentId, studentId, grade: gradeData.grade, comments: gradeData.comments })
        });
    }
    
    // ===== EVENT METHODS =====
    async getEvents() {
        if (!authManager || !authManager.isAuthenticated()) {
            console.log('🔒 Authentication required for events');
            return [];
        }
        return this.makeRequest('/events');
    }

    async createEvent(eventData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/events', {
            method: 'POST',
            body: JSON.stringify(eventData)
        });
    }

    async deleteEvent(eventId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/events/${eventId}`, {
            method: 'DELETE'
        });
    }

    // ===== MEDIA METHODS =====
    async getMedia() {
        return this.makeRequest('/media');
    }

    async createMedia(mediaData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        // For file uploads, we'll use FormData directly in the UI manager
        throw new Error('Use FormData for media creation with files');
    }

    async deleteMedia(mediaId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/media/${mediaId}`, {
            method: 'DELETE'
        });
    }

    // ===== UTILITY METHODS =====
    async getTeachers() {
        try {
            const users = await this.getUsers();
            return users.filter(user => user.role === 'teacher' || user.role === 'admin');
        } catch (error) {
            console.error('Error getting teachers:', error);
            return [];
        }
    }

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
const databaseManager = new DatabaseManager();
window.databaseManager = databaseManager;
