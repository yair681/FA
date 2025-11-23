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
            if (contentType && contentType.indexOf('application/json') !== -1) {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Request failed');
                }
                return data;
            } else {
                // Handle non-JSON response (e.g., DELETE with 200/204, or file upload with 200)
                if (response.status === 204 || response.status === 200) {
                     return { message: options.method === 'DELETE' ? 'Deleted successfully' : 'Success' };
                }
                // For other cases, throw error
                throw new Error('Server returned non-JSON response: ' + response.statusText);
            }
        } catch (error) {
            console.error(`❌ API Error for ${endpoint}:`, error.message);
            throw error;
        }
    }
    
    isPublicEndpoint(endpoint) {
        return endpoint === '/announcements' || endpoint === '/events' || endpoint === '/media' || endpoint === '/health';
    }

    // ===== CLASS METHODS =====
    async getClasses() {
        return this.makeRequest('/classes');
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
    
    // ===== STUDENT MANAGEMENT METHODS (NEW) =====
    
    async getAvailableStudentsForClass(classId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/classes/${classId}/available-students`);
    }

    async getAssignedStudentsForClass(classId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/classes/${classId}/assigned-students`);
    }

    async assignStudentToClass(classId, studentId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/classes/${classId}/students`, {
            method: 'POST',
            body: JSON.stringify({ studentId })
        });
    }

    async removeStudentFromClass(classId, studentId) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest(`/classes/${classId}/students/${studentId}`, {
            method: 'DELETE'
        });
    }
    
    // ===== USER METHODS =====
    async getUsers() {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isAdmin()) {
            throw new Error('Admin access required');
        }
        return this.makeRequest('/users');
    }

    // ===== ANNOUNCEMENT METHODS =====
    async getAnnouncements() {
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

    // ===== ASSIGNMENT METHODS =====
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
        return this.makeRequest('/assignments', {
            method: 'POST',
            body: JSON.stringify(assignmentData)
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

    // ===== MEDIA METHODS =====
    async getMedia() {
        return this.makeRequest('/media');
    }

    async createMedia(formData) {
        if (!authManager || !authManager.isAuthenticated() || !authManager.isTeacher()) {
            throw new Error('Teacher or admin access required');
        }
        
        // Custom request for FormData (no 'Content-Type': 'application/json')
        try {
            const headers = {
                'Authorization': `Bearer ${authManager.token}`,
            };

            console.log(`🔄 API Call: ${this.API_BASE}/media`);
            const response = await fetch(`${this.API_BASE}/media`, {
                method: 'POST',
                headers: headers,
                body: formData // FormData handles the content type as multipart/form-data
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }
            return data;
            
        } catch (error) {
            console.error('❌ API Error for /media:', error.message);
            throw error;
        }
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
console.log('✅ Database Manager created');
window.databaseManager = new DatabaseManager();
