// Database Manager
class DatabaseManager {
    constructor() {
        this.db = db;
        this.BASE_PATH = BASE_PATH;
    }

    // ===== USERS =====
    async getUsers() {
        try {
            const snapshot = await db.collection(`${this.BASE_PATH}/users`).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    }

    async updateUser(uid, updates) {
        try {
            updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection(`${this.BASE_PATH}/users`).doc(uid).update(updates);
            return { success: true };
        } catch (error) {
            console.error('Error updating user:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteUser(uid) {
        try {
            await db.collection(`${this.BASE_PATH}/users`).doc(uid).delete();
            return { success: true };
        } catch (error) {
            console.error('Error deleting user:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== CLASSES =====
    async getClasses() {
        try {
            const snapshot = await db.collection(`${this.BASE_PATH}/public/data/classes`).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting classes:', error);
            return [];
        }
    }

    async getClass(classId) {
        try {
            const doc = await db.collection(`${this.BASE_PATH}/public/data/classes`).doc(classId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('Error getting class:', error);
            return null;
        }
    }

    async getUserClasses(userId, role) {
        try {
            let classes = await this.getClasses();
            
            if (role === 'student') {
                return classes.filter(c => c.students && c.students.includes(userId));
            } else if (role === 'teacher' || role === 'admin') {
                return classes.filter(c => c.teachers && c.teachers.includes(userId));
            }
            
            return [];
        } catch (error) {
            console.error('Error getting user classes:', error);
            return [];
        }
    }

    async addClass(classData) {
        try {
            const classDoc = {
                ...classData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await db.collection(`${this.BASE_PATH}/public/data/classes`).add(classDoc);
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error adding class:', error);
            return { success: false, error: error.message };
        }
    }

    async updateClass(classId, updates) {
        try {
            updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection(`${this.BASE_PATH}/public/data/classes`).doc(classId).update(updates);
            return { success: true };
        } catch (error) {
            console.error('Error updating class:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteClass(classId) {
        try {
            await db.collection(`${this.BASE_PATH}/public/data/classes`).doc(classId).delete();
            return { success: true };
        } catch (error) {
            console.error('Error deleting class:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== ANNOUNCEMENTS =====
    async getAnnouncements(classId = null) {
        try {
            let query = db.collection(`${this.BASE_PATH}/public/data/announcements`)
                .orderBy('createdAt', 'desc');
            
            if (classId) {
                query = query.where('classId', '==', classId);
            } else {
                query = query.where('isGlobal', '==', true);
            }

            const snapshot = await query.get();
            const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Get author names for each announcement
            for (let announcement of announcements) {
                if (announcement.authorId) {
                    const user = await this.getUserData(announcement.authorId);
                    announcement.authorName = user ? user.name : 'Unknown';
                }
            }
            
            return announcements;
        } catch (error) {
            console.error('Error getting announcements:', error);
            return [];
        }
    }

    async addAnnouncement(announcement) {
        try {
            const announcementDoc = {
                ...announcement,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection(`${this.BASE_PATH}/public/data/announcements`).add(announcementDoc);
            return { success: true };
        } catch (error) {
            console.error('Error adding announcement:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteAnnouncement(announcementId) {
        try {
            await db.collection(`${this.BASE_PATH}/public/data/announcements`).doc(announcementId).delete();
            return { success: true };
        } catch (error) {
            console.error('Error deleting announcement:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== ASSIGNMENTS =====
    async getAssignments(classId = null) {
        try {
            let query = db.collection(`${this.BASE_PATH}/public/data/assignments`);
            
            if (classId) {
                query = query.where('classId', '==', classId);
            }

            const snapshot = await query.get();
            const assignments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Get teacher names for each assignment
            for (let assignment of assignments) {
                if (assignment.teacherId) {
                    const user = await this.getUserData(assignment.teacherId);
                    assignment.teacherName = user ? user.name : 'Unknown';
                }
            }
            
            return assignments;
        } catch (error) {
            console.error('Error getting assignments:', error);
            return [];
        }
    }

    async addAssignment(assignment) {
        try {
            const assignmentDoc = {
                ...assignment,
                submissions: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection(`${this.BASE_PATH}/public/data/assignments`).add(assignmentDoc);
            return { success: true };
        } catch (error) {
            console.error('Error adding assignment:', error);
            return { success: false, error: error.message };
        }
    }

    async submitAssignment(assignmentId, submission) {
        try {
            const assignmentRef = db.collection(`${this.BASE_PATH}/public/data/assignments`).doc(assignmentId);
            await assignmentRef.update({
                submissions: firebase.firestore.FieldValue.arrayUnion(submission)
            });
            return { success: true };
        } catch (error) {
            console.error('Error submitting assignment:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== EVENTS =====
    async getEvents() {
        try {
            const snapshot = await db.collection(`${this.BASE_PATH}/public/data/events`)
                .orderBy('date', 'asc')
                .get();
            
            const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Get author names for each event
            for (let event of events) {
                if (event.authorId) {
                    const user = await this.getUserData(event.authorId);
                    event.authorName = user ? user.name : 'Unknown';
                }
            }
            
            return events;
        } catch (error) {
            console.error('Error getting events:', error);
            return [];
        }
    }

    async addEvent(event) {
        try {
            const eventDoc = {
                ...event,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection(`${this.BASE_PATH}/public/data/events`).add(eventDoc);
            return { success: true };
        } catch (error) {
            console.error('Error adding event:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== MEDIA =====
    async getMedia() {
        try {
            const snapshot = await db.collection(`${this.BASE_PATH}/public/data/media`)
                .orderBy('createdAt', 'desc')
                .get();
            
            const media = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Get author names for each media item
            for (let item of media) {
                if (item.authorId) {
                    const user = await this.getUserData(item.authorId);
                    item.authorName = user ? user.name : 'Unknown';
                }
            }
            
            return media;
        } catch (error) {
            console.error('Error getting media:', error);
            return [];
        }
    }

    async addMedia(media) {
        try {
            const mediaDoc = {
                ...media,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection(`${this.BASE_PATH}/public/data/media`).add(mediaDoc);
            return { success: true };
        } catch (error) {
            console.error('Error adding media:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteMedia(mediaId) {
        try {
            await db.collection(`${this.BASE_PATH}/public/data/media`).doc(mediaId).delete();
            return { success: true };
        } catch (error) {
            console.error('Error deleting media:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== HELPER METHODS =====
    async getUserData(uid) {
        try {
            const doc = await db.collection(`${this.BASE_PATH}/users`).doc(uid).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    }

    async getTeachers() {
        try {
            const snapshot = await db.collection(`${this.BASE_PATH}/users`)
                .where('role', 'in', ['teacher', 'admin'])
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting teachers:', error);
            return [];
        }
    }
}

const dbManager = new DatabaseManager();