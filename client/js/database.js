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
                console.error('❌ Non-JSON response:', text.substring(0, 200));
                throw new Error('Server returned HTML instead of JSON. Check if API endpoint exists.');
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            console.log(`✅ API Success: ${endpoint}`, Array.isArray(data) ? `Array(${data.length})` : data);
            return data;
        } catch (error) {
            console.error('❌ API request error:', error.message);
            
            // For public endpoints, return empty array instead of throwing error
            if (this.isPublicEndpoint(endpoint)) {
                console.log('🔒 Returning empty data for public endpoint after error');
                return [];
            }
            
            throw error;
        }
    }

    // Check if endpoint is public (doesn't require authentication)
    isPublicEndpoint(endpoint) {
        const publicEndpoints = [
            '/announcements',
            '/events', 
            '/media',
            '/health'
        ];
        
        return publicEndpoints.some(publicEndpoint => 
            endpoint.startsWith(publicEndpoint) && 
            !endpoint.includes('/api/announcements') // exclude specific API paths if needed
        );
    }

    // ===== USERS =====
    async getUsers() {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest('/users');
    }

    async createUser(userData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest('/users', { method: 'POST', body: JSON.stringify(userData) });
    }

    async updateUser(userId, userData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/users/${userId}`, { method: 'PUT', body: JSON.stringify(userData) });
    }

    async deleteUser(userId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/users/${userId}`, { method: 'DELETE' });
    }

    // ===== CLASSES =====
    async getClasses() {
        if (!authManager || !authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest('/classes');
    }

    async getUserClasses() {
        if (!authManager || !authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest(`/users/${authManager.currentUser.id}/classes`);
    }

    async createClass(classData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/classes', { method: 'POST', body: JSON.stringify(classData) });
    }

    async updateClass(classId, classData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/classes/${classId}`, { method: 'PUT', body: JSON.stringify(classData) });
    }

    async deleteClass(classId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/classes/${classId}`, { method: 'DELETE' });
    }

    // ===== CLASS-SPECIFIC DATA =====
    async getClassAssignments(classId) {
        if (!authManager || !authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest(`/classes/${classId}/assignments`);
    }

    async getClassAnnouncements(classId) {
        if (!authManager || !authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest(`/classes/${classId}/announcements`);
    }

    // ===== ANNOUNCEMENTS =====
    async getAnnouncements() {
        // Announcements are public, but we handle 401 gracefully
        return this.makeRequest('/announcements');
    }

    async createAnnouncement(announcementData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/announcements', { method: 'POST', body: JSON.stringify(announcementData) });
    }

    async deleteAnnouncement(announcementId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/announcements/${announcementId}`, { method: 'DELETE' });
    }

    // ===== ASSIGNMENTS =====
    async getAssignments() {
        if (!authManager || !authManager.isAuthenticated()) {
            throw new Error('Authentication required');
        }
        return this.makeRequest('/assignments');
    }

    async createAssignment(assignmentData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/assignments', { method: 'POST', body: JSON.stringify(assignmentData) });
    }

    async submitAssignment(formData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isStudent()) {
            throw new Error('Student access required');
        }
        // Note: FormData is used directly, so we remove Content-Type
        const headers = authManager.getAuthHeaders();
        delete headers['Content-Type']; 

        return this.makeRequest('/assignments/submit', { 
            method: 'POST', 
            body: formData,
            headers: headers
        });
    }

    async gradeAssignment(gradeData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/assignments/grade', { method: 'POST', body: JSON.stringify(gradeData) });
    }

    async deleteAssignment(assignmentId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/assignments/${assignmentId}`, { method: 'DELETE' });
    }

    // ===== EVENTS =====
    async getEvents() {
        // Events are public, but we handle 401 gracefully
        return this.makeRequest('/events');
    }

    async createEvent(eventData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest('/events', { method: 'POST', body: JSON.stringify(eventData) });
    }

    // ✅ ADDED: Delete Event function
    async deleteEvent(eventId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        return this.makeRequest(`/events/${eventId}`, {
            method: 'DELETE'
        });
    }

    // ===== MEDIA =====
    async getMedia() {
        // Media is public, but we handle 401 gracefully
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
console.log('✅ Database Manager code loaded');
const dbManager = new DatabaseManager();
