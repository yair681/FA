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
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                // If it's the root HTML, just return null/empty object instead of throwing error
                if (text.startsWith('<!DOCTYPE html>')) {
                    return {};
                }
                console.error('❌ Non-JSON response:', text.substring(0, 200));
                if (!response.ok) {
                    throw new Error(`Server error: ${response.statusText}`);
                }
                return {};
            }

            const data = await response.json();

            if (!response.ok) {
                console.error('❌ API Error:', data.error);
                throw new Error(data.error || 'API Request Failed');
            }

            return data;

        } catch (error) {
            console.error('❌ Network or API Error:', error);
            throw error;
        }
    }

    isPublicEndpoint(endpoint) {
        // Define public endpoints if any, but in this system, most are protected
        return endpoint === '/health';
    }

    // ===== AUTH & USER METHODS =====
    async validateToken() {
        return this.makeRequest('/validate-token');
    }

    async getUsers() {
        if (!authManager || !authManager.isAuthenticated() || (!authManager.isAdmin() && !authManager.isTeacher())) {
            throw new Error('Admin or teacher access required');
        }
        return this.makeRequest('/users');
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

    async updateUser(userId, updateData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    async deleteUser(userId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/users/${userId}`, {
            method: 'DELETE'
        });
    }

    // ===== CLASS METHODS =====
    async getClasses() {
        if (!authManager || !authManager.isAuthenticated()) {
            console.log('🔒 Authentication required for classes');
            return [];
        }
        return this.makeRequest('/classes');
    }

    // New: Get single class
    async getSingleClass(classId) {
        if (!authManager || !authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest(`/classes/${classId}`);
    }

    async createClass(classData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/classes', { 
            method: 'POST', 
            body: JSON.stringify(classData) 
        });
    }

    // New: Update class (for student management)
    async updateClass(classId, updateData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/classes/${classId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    async deleteClass(classId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/classes/${classId}`, {
            method: 'DELETE'
        });
    }


    // ===== ANNOUNCEMENT METHODS =====
    async getAnnouncements() {
        if (!authManager || !authManager.isAuthenticated()) return [];
        return this.makeRequest('/announcements');
    }
    
    // New: Get class-specific announcements
    async getClassAnnouncements(classId) {
        if (!authManager || !authManager.isAuthenticated()) return [];
        return this.makeRequest(`/classes/${classId}/announcements`);
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
        if (!authManager || !authManager.isAuthenticated()) return [];
        return this.makeRequest('/assignments');
    }
    
    // New: Get class-specific assignments
    async getClassAssignments(classId) {
        if (!authManager || !authManager.isAuthenticated()) return [];
        return this.makeRequest(`/classes/${classId}/assignments`);
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

    async submitAssignment(formData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isStudent()) {
            throw new Error('Student access required');
        }
        // FormData is used here, so Content-Type header should NOT be set manually (browser handles it)
        const token = authManager.token;
        const response = await fetch(`${this.API_BASE}/assignments/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        if (!response.ok) {
            console.error('❌ API Error:', data.error);
            throw new Error(data.error || 'Submission Failed');
        }
        return data;
    }

    async gradeSubmission(gradeData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/assignments/grade', {
            method: 'POST',
            body: JSON.stringify(gradeData)
        });
    }

    // ===== EVENT METHODS =====
    async getEvents() {
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
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/events/${eventId}`, {
            method: 'DELETE'
        });
    }

    // ===== MEDIA METHODS =====
    async getMedia() {
        return this.makeRequest('/media');
    }

    async createMedia(formData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        
        const token = authManager.token;
        const response = await fetch(`${this.API_BASE}/media`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('❌ API Error:', data.error);
            throw new Error(data.error || 'Media Upload Failed');
        }
        return data;
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

    // New: Get all students
    async getAllStudents() {
        try {
            const users = await this.getUsers();
            return users.filter(user => user.role === 'student');
        } catch (error) {
            console.error('Error getting all students:', error);
            // Re-throw if it's an auth error from getUsers, otherwise return empty
            if (error.message.includes('required')) throw error;
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
const dbManager = new DatabaseManager();
window.dbManager = dbManager;
