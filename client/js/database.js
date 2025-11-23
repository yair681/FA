// ✅ תיקון: ייבוא מפורש של המחלקה AuthManager מהמודול auth.js
import { AuthManager } from './auth.js'; 

// Database Manager for MongoDB backend
export class DatabaseManager { // ✅ שינוי: הוספת export
    constructor() {
        this.API_BASE = window.location.origin + '/api';
        console.log('📊 Database Manager initialized with base:', this.API_BASE);
    }

    async makeRequest(endpoint, options = {}) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                // ✅ גישה גלובלית ל-authManager (כפי שהוגדר ב-auth.js)
                ...(window.authManager ? window.authManager.getAuthHeaders() : {}),
                ...options.headers
            };

            const config = {
                ...options,
                headers
            };

            console.log(`🔄 API Call: ${this.API_BASE}${endpoint}`);
            const response = await fetch(`${this.API_BASE}${endpoint}`, config);
            
            if (response.status === 401) {
                if (window.authManager) {
                    window.authManager.logout();
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
                console.error('❌ Non-JSON response:', text.substring(0, 200));
                throw new Error('Server returned HTML instead of JSON. Check if API endpoint exists.');
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || response.statusText);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ API Error:', error.message);
            throw error;
        }
    }

    isPublicEndpoint(endpoint) {
        return endpoint.startsWith('/announcements/global') || endpoint.startsWith('/events');
    }

    // ===== ANNOUNCEMENTS =====
    async getAnnouncements() {
        return this.makeRequest('/announcements');
    }

    async createAnnouncement(announcementData) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/announcements', {
            method: 'POST',
            body: JSON.stringify(announcementData)
        });
    }

    async deleteAnnouncement(announcementId) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/announcements/${announcementId}`, {
            method: 'DELETE'
        });
    }

    // ===== USERS (ADMIN ONLY) =====
    async getUsers() {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isAdmin()) {
            return []; // לא נזרוק שגיאה אלא נחזיר ריק
        }
        return this.makeRequest('/users');
    }

    async createUser(userData) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updateUser(userId, userData) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(userId) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/users/${userId}`, {
            method: 'DELETE'
        });
    }

    async changePassword(currentPassword, newPassword) {
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest('/users/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }

    // ===== CLASSES =====
    async getClasses() {
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            console.log('🔒 Authentication required for classes');
            return [];
        }
        return this.makeRequest('/classes');
    }

    async getUserClasses() {
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            return [];
        }
        return this.makeRequest('/classes/my');
    }

    async createClass(classData) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/classes', {
            method: 'POST',
            body: JSON.stringify(classData)
        });
    }

    async updateClass(classId, classData) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/classes/${classId}`, {
            method: 'PUT',
            body: JSON.stringify(classData)
        });
    }

    async deleteClass(classId) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/classes/${classId}`, {
            method: 'DELETE'
        });
    }

    // ===== ASSIGNMENTS =====
    async getAssignments() {
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            return [];
        }
        return this.makeRequest('/assignments');
    }

    async getTeacherAssignments() {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isStudent()) {
            return this.makeRequest('/assignments/teacher');
        }
        return [];
    }

    async createAssignment(assignmentData) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/assignments', {
            method: 'POST',
            body: JSON.stringify(assignmentData)
        });
    }

    async updateAssignment(assignmentId, assignmentData) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/assignments/${assignmentId}`, {
            method: 'PUT',
            body: JSON.stringify(assignmentData)
        });
    }

    async deleteAssignment(assignmentId) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/assignments/${assignmentId}`, {
            method: 'DELETE'
        });
    }

    // ===== EVENTS =====
    async getEvents() {
        return this.makeRequest('/events');
    }

    async createEvent(eventData) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/events', {
            method: 'POST',
            body: JSON.stringify(eventData)
        });
    }

    async deleteEvent(eventId) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/events/${eventId}`, {
            method: 'DELETE'
        });
    }

    // ===== MEDIA (HISTORY) =====
    async getMedia() {
        return this.makeRequest('/media');
    }

    async createMedia(mediaData) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        // For file uploads, we'll use FormData directly in the UI manager
        throw new Error('Use FormData for media creation with files');
    }

    async deleteMedia(mediaId) {
        if (!window.authManager || !window.authManager.isAuthenticated() || !window.authManager.isAdmin()) {
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

// ✅ שמירת מופע גלובלי (window) עבור קבצים המסתמכים על המשתנה הגלובלי
console.log('🚀 Creating database manager instance...');
window.dbManager = new DatabaseManager();
