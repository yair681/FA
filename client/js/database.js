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
                throw new Error('Authentication required');
            }

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('❌ Non-JSON response:', text.substring(0, 200));
                throw new Error('Server returned HTML instead of JSON. Check if API endpoint exists.');
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            console.log(`✅ API Success: ${endpoint}`, data);
            return data;
        } catch (error) {
            console.error('❌ API request error:', error.message);
            throw error;
        }
    }

    // ===== USERS =====
    async getUsers() {
        return this.makeRequest('/users');
    }

    async createUser(userData) {
        return this.makeRequest('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(userId) {
        return this.makeRequest(`/users/${userId}`, {
            method: 'DELETE'
        });
    }

    // ===== CLASSES =====
    async getClasses() {
        return this.makeRequest('/classes');
    }

    async createClass(classData) {
        return this.makeRequest('/classes', {
            method: 'POST',
            body: JSON.stringify(classData)
        });
    }

    async deleteClass(classId) {
        return this.makeRequest(`/classes/${classId}`, {
            method: 'DELETE'
        });
    }

    // ===== ANNOUNCEMENTS =====
    async getAnnouncements() {
        return this.makeRequest('/announcements');
    }

    async createAnnouncement(announcementData) {
        return this.makeRequest('/announcements', {
            method: 'POST',
            body: JSON.stringify(announcementData)
        });
    }

    async deleteAnnouncement(announcementId) {
        return this.makeRequest(`/announcements/${announcementId}`, {
            method: 'DELETE'
        });
    }

    // ===== ASSIGNMENTS =====
    async getAssignments() {
        return this.makeRequest('/assignments');
    }

    async createAssignment(assignmentData) {
        return this.makeRequest('/assignments', {
            method: 'POST',
            body: JSON.stringify(assignmentData)
        });
    }

    async deleteAssignment(assignmentId) {
        return this.makeRequest(`/assignments/${assignmentId}`, {
            method: 'DELETE'
        });
    }

    // ===== EVENTS =====
    async getEvents() {
        return this.makeRequest('/events');
    }

    async createEvent(eventData) {
        return this.makeRequest('/events', {
            method: 'POST',
            body: JSON.stringify(eventData)
        });
    }

    async deleteEvent(eventId) {
        return this.makeRequest(`/events/${eventId}`, {
            method: 'DELETE'
        });
    }

    // ===== MEDIA =====
    async getMedia() {
        return this.makeRequest('/media');
    }

    async createMedia(mediaData) {
        return this.makeRequest('/media', {
            method: 'POST',
            body: JSON.stringify(mediaData)
        });
    }

    async deleteMedia(mediaId) {
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

    async getUserClasses() {
        return this.makeRequest('/classes');
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
console.log('🚀 Creating database manager instance...');
const dbManager = new DatabaseManager();

