// server.js - קוד מלא לאחר שינויים

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// הגדרת העלאת קבצים (Multer)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // תמיכה בשמות קבצים בעברית
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.א-ת\-\_]/g, '_');
        cb(null, uniqueSuffix + '-' + cleanName);
    }
});

// הגדלת המגבלה ל-100MB
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } 
});

// חשיפת קבצים סטטיים
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/css', express.static(path.join(__dirname, '..', 'client', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'client', 'js')));
app.use('/uploads', express.static(uploadDir));


// חיבור ל-MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔗 Connecting to MongoDB...');

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));


// סכמות MongoDB
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }], // רשימת הכיתות שהמשתמש שייך אליהן
  createdAt: { type: Date, default: Date.now }
});

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // רשימת התלמידים בכיתה
  createdAt: { type: Date, default: Date.now }
});

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['global', 'class'], default: 'global' },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: function() { return this.type === 'class'; } },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { type: Date, required: true },
  submissions: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submission: String,
    fileUrl: String,
    submittedAt: { type: Date, default: Date.now },
    grade: Number,
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gradeDate: Date
  }],
  createdAt: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const mediaSchema = new mongoose.Schema({
    title: { type: String, default: 'ללא כותרת' },
    type: { type: String, enum: ['image', 'video', 'file'], default: 'file' },
    url: { type: String, required: true },
    date: { type: Date, default: Date.now },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Class = mongoose.model('Class', classSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);
const Event = mongoose.model('Event', eventSchema);
const Media = mongoose.model('Media', mediaSchema);


// פונקציות עזר
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeRole = (roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
};

// ===== נתיבי משתמשים (User Routes) =====

// רישום משתמש חדש
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // ודא שהתפקיד חוקי
        if (!['student', 'teacher', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // הצפנת סיסמה
        const hashedPassword = await bcrypt.hash(password, 10);

        // יצירת משתמש חדש - ללא שיוך אוטומטי
        const user = new User({
            name,
            email,
            password: hashedPassword,
            role,
            classes: [] 
        });

        await user.save();

        // יצירת טוקן
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({ token, user: { name: user.name, email: user.email, role: user.role, userId: user._id, classes: user.classes } });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// התחברות
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).populate('classes');

        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, user: { name: user.name, email: user.email, role: user.role, userId: user._id, classes: user.classes.map(c => c._id) } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
});

// אימות טוקן
app.get('/api/validate-token', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password').populate('classes');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ name: user.name, email: user.email, role: user.role, userId: user._id, classes: user.classes.map(c => c._id) });
    } catch (error) {
        res.status(500).json({ error: 'Token validation failed' });
    }
});

// קבלת כל המשתמשים (למנהלי מערכת)
app.get('/api/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching users: ' + error.message });
    }
});

// **נתיב חדש: קבלת כל התלמידים (לצורך ניהול כיתות)**
app.get('/api/users/students', authenticateToken, authorizeRole(['teacher', 'admin']), async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('_id name email classes');
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching students: ' + error.message });
    }
});


// ===== נתיבי כיתות (Class Routes) =====

// יצירת כיתה חדשה
app.post('/api/classes', authenticateToken, authorizeRole(['teacher', 'admin']), async (req, res) => {
    try {
        const { name } = req.body;
        
        // יצירת כיתה חדשה - ללא שיוך אוטומטי של תלמידים
        const newClass = new Class({
            name,
            teachers: [req.user.userId], // המורה היוצר משויך אוטומטית כמורה
            students: [] 
        });

        await newClass.save();

        // עדכון המורה: הוספת הכיתה לרשימת הכיתות שלו
        await User.findByIdAndUpdate(req.user.userId, { $addToSet: { classes: newClass._id } });

        res.status(201).json(newClass);
    } catch (error) {
        res.status(500).json({ error: 'Error creating class: ' + error.message });
    }
});

// קבלת רשימת כיתות
app.get('/api/classes', authenticateToken, async (req, res) => {
    try {
        // טען את כל הכיתות וקשר מורים ותלמידים
        const classes = await Class.find()
            .populate('teachers', 'name email _id')
            .populate('students', 'name email _id');
        
        // סנן לפי תפקיד:
        if (req.user.role === 'admin') {
            // מנהל רואה את כל הכיתות
            res.json(classes);
        } else {
            // מורה/תלמיד רואה רק את הכיתות שמשויך אליהן
            const userClasses = classes.filter(c => 
                c.teachers.some(t => t._id.toString() === req.user.userId) ||
                c.students.some(s => s._id.toString() === req.user.userId)
            );
            res.json(userClasses);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error fetching classes: ' + error.message });
    }
});

// קבלת כיתה ספציפית
app.get('/api/classes/:id', authenticateToken, async (req, res) => {
    try {
        const classItem = await Class.findById(req.params.id)
            .populate('teachers', 'name email _id')
            .populate('students', 'name email _id');

        if (!classItem) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        // ודא שהמשתמש משויך לכיתה
        const isUserInClass = classItem.teachers.some(t => t._id.toString() === req.user.userId) || 
                              classItem.students.some(s => s._id.toString() === req.user.userId) ||
                              req.user.role === 'admin';

        if (!isUserInClass) {
            return res.status(403).json({ error: 'Access denied: Not a member of this class' });
        }

        res.json(classItem);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching class: ' + error.message });
    }
});

// מחיקת כיתה
app.delete('/api/classes/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const classId = req.params.id;
        const deletedClass = await Class.findByIdAndDelete(classId);

        if (!deletedClass) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // הסר את ה-ID של הכיתה מכל המשתמשים שהיו משויכים אליה
        await User.updateMany(
            { $or: [{ classes: classId }, { classes: classId }] }, 
            { $pull: { classes: classId } }
        );

        // מחק את כל המשימות וההודעות שקשורות לכיתה
        await Assignment.deleteMany({ class: classId });
        await Announcement.deleteMany({ class: classId });
        
        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting class: ' + error.message });
    }
});


// **נתיבים חדשים: ניהול תלמידים בכיתה (שיוך והסרה)**

// **שיוך תלמיד לכיתה**
app.post('/api/classes/:classId/students/:studentId', authenticateToken, authorizeRole(['teacher', 'admin']), async (req, res) => {
    try {
        const { classId, studentId } = req.params;

        const classUpdate = await Class.findByIdAndUpdate(
            classId,
            { $addToSet: { students: studentId } }, // הוסף תלמיד לכיתה
            { new: true }
        );

        const userUpdate = await User.findByIdAndUpdate(
            studentId,
            { $addToSet: { classes: classId } }, // הוסף כיתה למשתמש
            { new: true }
        );

        if (!classUpdate || !userUpdate) {
            return res.status(404).json({ error: 'Class or Student not found' });
        }

        res.json({ message: 'Student added to class successfully', class: classUpdate, user: userUpdate });
    } catch (error) {
        res.status(500).json({ error: 'Error adding student to class: ' + error.message });
    }
});

// **הסרת תלמיד מכיתה**
app.delete('/api/classes/:classId/students/:studentId', authenticateToken, authorizeRole(['teacher', 'admin']), async (req, res) => {
    try {
        const { classId, studentId } = req.params;

        const classUpdate = await Class.findByIdAndUpdate(
            classId,
            { $pull: { students: studentId } }, // הסר תלמיד מהכיתה
            { new: true }
        );

        const userUpdate = await User.findByIdAndUpdate(
            studentId,
            { $pull: { classes: classId } }, // הסר כיתה מרשימת הכיתות של המשתמש
            { new: true }
        );

        if (!classUpdate || !userUpdate) {
            return res.status(404).json({ error: 'Class or Student not found' });
        }

        res.json({ message: 'Student removed from class successfully', class: classUpdate, user: userUpdate });
    } catch (error) {
        res.status(500).json({ error: 'Error removing student from class: ' + error.message });
    }
});


// ... (שאר נתיבי ה-API: /api/announcements, /api/assignments, /api/events, /api/media, /api/upload)


// נתיב Fallback להגשת קבצים סטטיים
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// הפעלת השרת
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
