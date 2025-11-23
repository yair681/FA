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

// סכמות MongoDB
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  createdAt: { type: Date, default: Date.now }
});

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  maxStudents: { type: Number, default: 20 },
  createdAt: { type: Date, default: Date.now }
});

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['global', 'class'], required: true }, // Global or Class-specific
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' }, // Optional
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
    grade: String
  }],
  createdAt: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const mediaSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, enum: ['image', 'video', 'file'], required: true },
  date: { type: Date, default: Date.now },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});


// מודלים
const User = mongoose.model('User', userSchema);
const Class = mongoose.model('Class', classSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);
const Event = mongoose.model('Event', eventSchema);
const Media = mongoose.model('Media', mediaSchema);


// פונקציית אימות טוקן
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401).json({ error: 'Token missing' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};


// חיבור לבסיס הנתונים
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        // הפעלת השרת רק לאחר חיבור מוצלח לבסיס הנתונים
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });

// --- Routes ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({
            name,
            email,
            password: hashedPassword,
            role
        });

        await user.save();
        
        // יצירת טוקן והחזרתו
        const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        res.status(201).json({ 
            token, 
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                classes: user.classes
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        res.json({ 
            token, 
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                classes: user.classes
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/validate-token', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- User Management Routes (Admin only) ---
app.get('/api/users', authenticateToken, async (req, res) => {
    // Only Admin and Teacher can view users
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Access denied' });
    }
    const users = await User.find().select('-password');
    res.json(users);
});

app.post('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const { name, email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, role });
        await newUser.save();
        res.status(201).json(newUser);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const { name, email, password, role } = req.body;
        const updateData = { name, email, role };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
        res.json(updatedUser);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    // Remove user from all classes before deletion
    await Class.updateMany(
        { $or: [{ students: req.params.id }, { teachers: req.params.id }, { teacher: req.params.id }] },
        { $pull: { students: req.params.id, teachers: req.params.id } }
    );
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
});


// --- Class Routes ---
app.get('/api/classes', authenticateToken, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'student') {
            // Students only see classes they are enrolled in
            const user = await User.findById(req.user.userId);
            query = { students: user._id };
        } else if (req.user.role === 'teacher') {
            // Teachers see classes they teach or assist
            query = { $or: [{ teacher: req.user.userId }, { teachers: req.user.userId }] };
        }
        
        const classes = await Class.find(query)
            .populate('teacher', 'name email')
            .populate('teachers', 'name email')
            .populate('students', 'name email');
        
        res.json(classes);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// New: Get single class by ID
app.get('/api/classes/:id', authenticateToken, async (req, res) => {
    try {
        const classItem = await Class.findById(req.params.id)
            .populate('teacher', 'name email')
            .populate('teachers', 'name email')
            .populate('students', 'name email');
        
        if (!classItem) return res.status(404).json({ error: 'Class not found' });

        // Basic authorization check: must be a student, teacher, or admin associated with the class
        const userId = req.user.userId.toString();
        const isTeacherOrAdmin = req.user.role === 'admin' || classItem.teachers.some(t => t._id.toString() === userId);
        const isStudent = classItem.students.some(s => s._id.toString() === userId);

        if (!isTeacherOrAdmin && !isStudent && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json(classItem);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/classes', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const { name, maxStudents, teacherId } = req.body;
        // If teacherId is provided, use it. Otherwise, the creator is the primary teacher.
        const primaryTeacher = teacherId || req.user.userId;
        const newClass = new Class({ name, teacher: primaryTeacher, teachers: [primaryTeacher], maxStudents });
        await newClass.save();

        // עדכון המשתמש המורה עם הכיתה החדשה
        await User.findByIdAndUpdate(primaryTeacher, { $addToSet: { classes: newClass._id } });

        res.status(201).json(newClass);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// New: Update class (for adding/removing students/teachers)
app.put('/api/classes/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const { students, teachers, name, maxStudents } = req.body;
        const classId = req.params.id;

        const updatedClass = await Class.findByIdAndUpdate(
            classId,
            { name, maxStudents, students, teachers }, // Overwrite the arrays or update other fields
            { new: true }
        )
        .populate('teacher', 'name email')
        .populate('teachers', 'name email')
        .populate('students', 'name email');

        if (!updatedClass) return res.status(404).json({ error: 'Class not found' });

        // Sync user's classes array (Important)
        const allAssociatedUsers = [...updatedClass.students.map(s => s._id), ...updatedClass.teachers.map(t => t._id)];

        // 1. Remove this class from old users who are no longer students/teachers
        await User.updateMany(
            { classes: classId, _id: { $nin: allAssociatedUsers } },
            { $pull: { classes: classId } }
        );

        // 2. Add this class to new users who are now students/teachers
        await User.updateMany(
            { _id: { $in: allAssociatedUsers } },
            { $addToSet: { classes: classId } }
        );

        res.json(updatedClass);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const classItem = await Class.findById(req.params.id);
        if (!classItem) return res.status(404).json({ error: 'Class not found' });
        
        // Remove class from all associated users
        await User.updateMany(
            { $or: [{ classes: classItem._id }] },
            { $pull: { classes: classItem._id } }
        );

        // Delete associated assignments and announcements
        await Assignment.deleteMany({ class: classItem._id });
        await Announcement.deleteMany({ class: classItem._id });

        await classItem.deleteOne();
        res.json({ message: 'Class deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- Class specific data ---
app.get('/api/classes/:id/assignments', authenticateToken, async (req, res) => {
    const assignments = await Assignment.find({ class: req.params.id })
        .populate('teacher', 'name email')
        .sort({ dueDate: 1 });
    res.json(assignments);
});

app.get('/api/classes/:id/announcements', authenticateToken, async (req, res) => {
    const announcements = await Announcement.find({ class: req.params.id, type: 'class' })
        .populate('author', 'name')
        .sort({ createdAt: -1 });
    res.json(announcements);
});


// --- Announcement Routes ---
app.get('/api/announcements', authenticateToken, async (req, res) => {
    // Logic to fetch all announcements (global and class-specific)
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const globalAnnouncements = await Announcement.find({ type: 'global' })
            .populate('author', 'name')
            .sort({ createdAt: -1 });

        const classAnnouncements = await Announcement.find({ 
            type: 'class', 
            class: { $in: user.classes } 
        })
            .populate('author', 'name')
            .sort({ createdAt: -1 });

        const announcements = [...globalAnnouncements, ...classAnnouncements];
        res.json(announcements);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/announcements', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const { title, content, type, classId } = req.body;
        
        if (type === 'class' && !classId) {
            return res.status(400).json({ error: 'Class ID is required for class announcements' });
        }

        const newAnnouncement = new Announcement({
            title,
            content,
            type,
            class: type === 'class' ? classId : null,
            author: req.user.userId
        });

        await newAnnouncement.save();
        res.status(201).json(newAnnouncement);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/announcements/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Announcement deleted' });
});


// --- Assignment Routes ---
app.get('/api/assignments', authenticateToken, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'student') {
            const user = await User.findById(req.user.userId);
            query = { class: { $in: user.classes } };
        } else if (req.user.role === 'teacher') {
            const teacherClasses = await Class.find({ $or: [{ teacher: req.user.userId }, { teachers: req.user.userId }] }).select('_id');
            const classIds = teacherClasses.map(c => c._id);
            query = { class: { $in: classIds } };
        } else if (req.user.role === 'admin') {
            query = {}; // Admins see all
        } else {
            return res.status(403).json({ error: 'Access denied' });
        }

        const assignments = await Assignment.find(query)
            .populate('class', 'name')
            .populate('teacher', 'name')
            .sort({ dueDate: 1 });

        res.json(assignments);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/assignments', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    const { title, description, classId, dueDate } = req.body;
    try {
        const assignment = new Assignment({
            title,
            description,
            class: classId,
            teacher: req.user.userId,
            dueDate,
            submissions: []
        });
        await assignment.save();
        res.status(201).json(assignment);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/assignments/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    const { title, description, dueDate } = req.body;
    try {
        const updatedAssignment = await Assignment.findByIdAndUpdate(
            req.params.id,
            { title, description, dueDate },
            { new: true }
        );
        res.json(updatedAssignment);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/assignments/submit', authenticateToken, upload.single('file'), async (req, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Access denied' });
    const { assignmentId, submission } = req.body;
    const studentId = req.user.userId;
    let fileUrl = null;

    if (req.file) {
        fileUrl = `/uploads/${req.file.filename}`;
    }

    try {
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

        // Check if student is enrolled in the class
        const classItem = await Class.findById(assignment.class);
        if (!classItem.students.includes(studentId)) {
            return res.status(403).json({ error: 'Student not enrolled in this class' });
        }

        // Check if submission already exists
        const existingSubmission = assignment.submissions.find(s => s.student.toString() === studentId.toString());

        if (existingSubmission) {
            // Update existing submission
            existingSubmission.submission = submission;
            existingSubmission.fileUrl = fileUrl;
            existingSubmission.submittedAt = new Date();
        } else {
            // Add new submission
            assignment.submissions.push({
                student: studentId,
                submission: submission,
                fileUrl: fileUrl,
                submittedAt: new Date(),
                grade: 'טרם נבדק'
            });
        }

        await assignment.save();
        res.json({ message: 'Submission successful' });

    } catch (error) {
        res.status(500).json({ error: 'Submission failed: ' + error.message });
    }
});

app.post('/api/assignments/grade', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    const { assignmentId, studentId, grade } = req.body;

    try {
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

        const submission = assignment.submissions.find(s => s.student.toString() === studentId);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });

        submission.grade = grade;
        await assignment.save();

        res.json({ message: 'Grade updated successfully', submission });

    } catch (error) {
        res.status(500).json({ error: 'Grading failed: ' + error.message });
    }
});

app.delete('/api/assignments/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    await Assignment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Assignment deleted' });
});


// --- Events Routes ---
app.get('/api/events', authenticateToken, async (req, res) => {
    const events = await Event.find().populate('author', 'name').sort({ date: 1 });
    res.json(events);
});

app.post('/api/events', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    const { title, description, date } = req.body;
    try {
        const newEvent = new Event({ title, description, date, author: req.user.userId });
        await newEvent.save();
        res.status(201).json(newEvent);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted' });
});

// --- Media Routes ---
app.get('/api/media', authenticateToken, async (req, res) => {
    const media = await Media.find().populate('author', 'name').sort({ date: -1 });
    res.json(media);
});

app.post('/api/media', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { title, type, date } = req.body;
        const fileUrl = `/uploads/${req.file.filename}`;
        const mediaDate = date || new Date(); 

        const media = new Media({ 
            title: title || 'ללא כותרת', 
            type: type || 'file', 
            url: fileUrl, 
            date: mediaDate, 
            author: req.user.userId 
        });
        
        await media.save();
        res.json(media);
    } catch (error) {
        res.status(500).json({ error: 'Error uploading media: ' + error.message });
    }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    await Media.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});

// Serve the client application for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});
