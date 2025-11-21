// Authentication Manager
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.initAuthListener();
    }

    initAuthListener() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const userData = await this.getUserData(user.uid);
                    if (userData) {
                        this.currentUser = { 
                            uid: user.uid,
                            email: user.email,
                            ...userData 
                        };
                        console.log('User logged in:', this.currentUser);
                    } else {
                        console.error('User data not found');
                        await this.logout();
                    }
                } catch (error) {
                    console.error('Error getting user data:', error);
                }
            } else {
                this.currentUser = null;
                console.log('User logged out');
            }
            updateUI();
        });
    }

    async login(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const userData = await this.getUserData(userCredential.user.uid);
            
            if (!userData) {
                await this.logout();
                return { success: false, error: 'User data not found' };
            }

            this.currentUser = { 
                uid: userCredential.user.uid,
                email: userCredential.user.email,
                ...userData 
            };
            
            return { success: true, user: this.currentUser };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            await auth.signOut();
            this.currentUser = null;
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserData(uid) {
        try {
            const doc = await db.collection(`${BASE_PATH}/users`).doc(uid).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    }

    async changePassword(newPassword) {
        try {
            await this.currentUser.updatePassword(newPassword);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async createUser(userData) {
        try {
            // Create user in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(
                userData.email, 
                userData.password
            );
            
            // Create user document in Firestore
            const userDoc = {
                uid: userCredential.user.uid,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                classes: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection(`${BASE_PATH}/users`).doc(userCredential.user.uid).set(userDoc);
            
            return { success: true, user: userDoc };
        } catch (error) {
            console.error('Error creating user:', error);
            return { success: false, error: error.message };
        }
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