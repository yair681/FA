// Database Manager for MongoDB backend
class DatabaseManager {
    constructor() {
        this.API_BASE = window.location.origin + '/api';
    }

    async makeRequest(endpoint, options = {}) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...authManager.getAuthHeaders(),
                ...options.headers
            };

            const config = {
                ...options,
                headers
            };

            console.log(`🔄 API Call: ${this.API_BASE}${endpoint}`);
            const response = await fetch(`${this.API_BASE}${endpoint}`, config);
            
            if (response.status === 401) {
                authManager.logout();
                throw new Error('Authentication required');
            }

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text.substring(0, 100));
                throw new Error('Server returned HTML instead of JSON');
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    // Users
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

    // Classes
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

    // Announcements
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

    // Assignments
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

    // Events
    async getEvents() {
        return this.makeRequest('/events');
    }

    async createEvent(eventData) {
        return this.makeRequest('/events', {
            method: 'POST',
            body: JSON.stringify(eventData)
        });
    }

    // Media
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

    // Utility methods
    async getTeachers() {
        const users = await this.getUsers();
        return users.filter(user => user.role === 'teacher' || user.role === 'admin');
    }

    async getUserClasses() {
        return this.makeRequest('/classes');
    }
}

const dbManager = new DatabaseManager();
