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
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.\u0590-\u05FF]/g, '_');
        cb(null, uniqueSuffix + '-' + cleanName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// --- Mongoose Schemas ---

// שינוי: הוספת מערך students לכיתה
const classSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // מערך של תלמידים בכיתה
}, { timestamps: true });

// שינוי: הוספת מערך classes למשתמש
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }], // מערך של כיתות שהמשתמש משויך אליהן
    createdAt: { type: Date, default: Date.now }
});

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['global', 'class'], required: true }, // global or class
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: function() { return this.type === 'class'; } },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const assignmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    dueDate: { type: Date, required: true },
    fileUrl: { type: String },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const submissionSchema = new mongoose.Schema({
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fileUrl: { type: String, required: true },
    grade: { type: Number, default: null },
    comments: { type: String },
    submittedAt: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    location: { type: String },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const mediaSchema = new mongoose.Schema({
    title: { type: String },
    type: { type: String, enum: ['image', 'video', 'file'], required: true },
    url: { type: String, required: true },
    date: { type: Date, default: Date.now },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Class = mongoose.model('Class', classSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);
const Submission = mongoose.model('Submission', submissionSchema);
const Event = mongoose.model('Event', eventSchema);
const Media = mongoose.model('Media', mediaSchema);

// --- JWT Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification failed:', err);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// Public route for token validation
app.get('/api/validate-token', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ userId: user._id, name: user.name, email: user.email, role: user.role });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Routes ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// User routes
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { userId: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// שינוי: יצירת משתמש חדש (מנהל מערכת בלבד יכול ליצור משתמשים) - ודא שאין שיוך אוטומטי
app.post('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    const { name, email, password, role } = req.body;
    try {
        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (await User.findOne({ email })) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // ודא ש classes: [] מוגדר כדי למנוע שיוך אוטומטי
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role,
            classes: [] // תלמיד חדש נוצר ללא שיוך כיתה
        });
        
        await newUser.save();
        res.status(201).json({ userId: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to get all users (Admin/Teacher only)
app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Access denied' });
    }
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to get a specific user (Admin/Teacher only)
app.get('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Access denied' });
    }
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Class routes
// שינוי: יצירת כיתה חדשה - ודא שאין שיוך אוטומטי של תלמידים
app.post('/api/classes', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { name, description, teacherId } = req.body;
    try {
        if (!name || !teacherId) return res.status(400).json({ error: 'Name and teacher are required' });
        
        const teacher = await User.findById(teacherId);
        if (!teacher || (teacher.role !== 'teacher' && teacher.role !== 'admin')) {
            return res.status(400).json({ error: 'Invalid teacher ID or role' });
        }

        // ודא ש students: [] מוגדר
        const newClass = new Class({
            name,
            description,
            teacher: teacherId,
            students: [] // כיתה חדשה נוצרת ללא תלמידים
        });
        
        await newClass.save();
        res.status(201).json(newClass);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to get all classes (for all roles, populates teacher)
app.get('/api/classes', authenticateToken, async (req, res) => {
    try {
        // Teacher/Admin can see all classes, Student only sees their classes
        if (req.user.role === 'student') {
            const user = await User.findById(req.user.userId);
            if (!user) return res.status(404).json({ error: 'User not found' });
            // Populate teacher and count students
            const classes = await Class.find({ _id: { $in: user.classes } })
                .populate('teacher', 'name email');
            
            // Add student count manually
            const classesWithCount = classes.map(c => ({
                ...c.toObject(),
                studentCount: c.students.length // The students array is populated but we only need the count for the list
            }));
            return res.json(classesWithCount);
        }

        const classes = await Class.find()
            .populate('teacher', 'name email');

        // Add student count manually
        const classesWithCount = classes.map(c => ({
            ...c.toObject(),
            studentCount: c.students.length
        }));

        res.json(classesWithCount);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to get a specific class (including students for admin/teacher)
app.get('/api/classes/:id', authenticateToken, async (req, res) => {
    try {
        const classItem = await Class.findById(req.params.id)
            .populate('teacher', 'name email');
            
        if (!classItem) return res.status(404).json({ error: 'Class not found' });

        if (req.user.role === 'student' && !classItem.students.map(id => id.toString()).includes(req.user.userId)) {
            return res.status(403).json({ error: 'Access denied to this class' });
        }

        // For admin/teacher, populate students as well
        if (req.user.role === 'admin' || req.user.role === 'teacher') {
            await classItem.populate('students', 'name email role');
        }
        
        res.json(classItem);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to delete a class (Admin only)
app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    try {
        const classToDelete = await Class.findById(req.params.id);
        if (!classToDelete) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // Remove the class ID from all associated students
        await User.updateMany(
            { _id: { $in: classToDelete.students } },
            { $pull: { classes: classToDelete._id } }
        );

        await Class.findByIdAndDelete(req.params.id);
        res.json({ message: 'Class deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- NEW ROUTES FOR STUDENT/CLASS MANAGEMENT ---

// שיוך תלמיד לכיתה (Admin/Teacher only)
app.post('/api/classes/:classId/students', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Access denied. Admin or Teacher access required.' });
    }
    const { studentId } = req.body;
    try {
        const classItem = await Class.findById(req.params.classId);
        const student = await User.findById(studentId);

        if (!classItem) return res.status(404).json({ error: 'Class not found' });
        if (!student || student.role !== 'student') return res.status(404).json({ error: 'Student not found or invalid role' });

        // מורה יכול לשייך רק אם הוא המורה של הכיתה, מנהל יכול לשייך תמיד
        if (req.user.role === 'teacher' && classItem.teacher && classItem.teacher.toString() !== req.user.userId) {
             return res.status(403).json({ error: 'Access denied. Teacher can only manage their own classes.' });
        }

        if (classItem.students.map(id => id.toString()).includes(studentId)) {
            return res.status(400).json({ error: 'Student is already in this class' });
        }

        // הוספת התלמיד למערך התלמידים של הכיתה
        classItem.students.push(studentId);
        await classItem.save();

        // הוספת הכיתה למערך הכיתות של התלמיד
        student.classes.push(req.params.classId);
        await student.save();

        res.json({ message: 'Student assigned to class successfully', classItem });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// הסרת תלמיד מכיתה (Admin/Teacher only)
app.delete('/api/classes/:classId/students/:studentId', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Access denied. Admin or Teacher access required.' });
    }
    try {
        const { classId, studentId } = req.params;

        const classItem = await Class.findById(classId);
        const student = await User.findById(studentId);

        if (!classItem) return res.status(404).json({ error: 'Class not found' });
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // מורה יכול להסיר רק אם הוא המורה של הכיתה, מנהל יכול להסיר תמיד
        if (req.user.role === 'teacher' && classItem.teacher && classItem.teacher.toString() !== req.user.userId) {
             return res.status(403).json({ error: 'Access denied. Teacher can only manage their own classes.' });
        }
        
        // הסרת התלמיד ממערך התלמידים של הכיתה
        classItem.students = classItem.students.filter(id => id.toString() !== studentId);
        await classItem.save();

        // הסרת הכיתה ממערך הכיתות של התלמיד
        student.classes = student.classes.filter(id => id.toString() !== classId);
        await student.save();

        res.json({ message: 'Student removed from class successfully', classItem });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to get all student users (for class management dropdowns)
app.get('/api/students', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Access denied. Admin or Teacher access required.' });
    }
    try {
        const students = await User.find({ role: 'student' }).select('-password');
        res.json(students);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Assignment routes
app.get('/api/assignments', authenticateToken, async (req, res) => {
    // ... (rest of assignment routes)
    // ... (existing routes for announcements, assignments, submissions, events, media)
    
    // Serve uploaded files
    app.use('/uploads', express.static(uploadDir));

    // Serve static files (HTML, CSS, JS)
    app.use(express.static(path.join(__dirname, 'public')));

    // Fallback to index.html for SPA
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    });

    // Start server
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
});
