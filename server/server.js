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
const JWT_SECRET = processs.env.JWT_SECRET || 'fallback-secret-key';

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
const upload = multer({ storage: storage });

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ Could not connect to MongoDB:', err));

// Schemas
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'teacher', 'student'], default: 'student' },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }], // Class IDs the user is associated with
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const classSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Student IDs in the class
    gradeLevel: String,
    description: String,
    createdAt: { type: Date, default: Date.now }
});
const Class = mongoose.model('Class', classSchema);

const announcementSchema = new mongoose.Schema({
    title: String,
    content: String,
    targetClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: false }, // Null for global
    isGlobal: { type: Boolean, default: false },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model('Announcement', announcementSchema);

const assignmentSchema = new mongoose.Schema({
    title: String,
    description: String,
    dueDate: Date,
    targetClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});
const Assignment = mongoose.model('Assignment', assignmentSchema);

const eventSchema = new mongoose.Schema({
    title: String,
    description: String,
    date: Date,
    location: String,
    targetClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: false }, // Null for all
    isGlobal: { type: Boolean, default: false },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});
const Event = mongoose.model('Event', eventSchema);

const mediaSchema = new mongoose.Schema({
    title: String,
    type: { type: String, enum: ['image', 'video', 'file'], default: 'file' },
    url: String, // Path to the file
    date: Date,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});
const Media = mongoose.model('Media', mediaSchema);

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('JWT Error:', err.message);
            return res.sendStatus(403); // Forbidden
        }
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Basic validation
        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Ensure student and teacher accounts start with empty classes array
        const newUser = new User({ 
            name, 
            email, 
            password: hashedPassword, 
            role, 
            classes: [] // Crucial for new student/teacher accounts
        });

        await newUser.save();
        
        // Generate token and send user info (without password)
        const token = jwt.sign({ userId: newUser._id, role: newUser.role, name: newUser.name }, JWT_SECRET, { expiresIn: '24h' });
        const userObj = newUser.toObject();
        delete userObj.password;
        
        res.status(201).json({ token, user: userObj });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ userId: user._id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
        const userObj = user.toObject();
        delete userObj.password;

        res.json({ token, user: userObj });
    } catch (error) {
        res.status(500).json({ error: 'Login failed: ' + error.message });
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
        res.status(500).json({ error: 'Token validation failed' });
    }
});

// --- CLASS ROUTES ---
app.post('/api/classes', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const { name, teacherId, gradeLevel, description } = req.body;
        
        const newClass = new Class({
            name,
            teacher: teacherId || null, // Allow class creation without a teacher initially
            gradeLevel,
            description,
            students: [] // Crucial: New class starts with an empty students array
        });

        await newClass.save();

        // Update teacher's classes array if a teacher was assigned
        if (teacherId) {
            await User.findByIdAndUpdate(teacherId, { $addToSet: { classes: newClass._id } });
        }
        
        res.status(201).json(newClass);
    } catch (error) {
        res.status(500).json({ error: 'Error creating class: ' + error.message });
    }
});

app.get('/api/classes', async (req, res) => {
    try {
        const classes = await Class.find()
            .populate('teacher', 'name email')
            .populate('students', 'name email role')
            .sort({ name: 1 });
        res.json(classes);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching classes' });
    }
});

app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const classToDelete = await Class.findById(req.params.id);
        if (!classToDelete) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // Remove class from associated teachers/students
        await User.updateMany(
            { classes: req.params.id },
            { $pull: { classes: req.params.id } }
        );

        await Class.findByIdAndDelete(req.params.id);
        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting class' });
    }
});

// --- STUDENT MANAGEMENT ROUTES (NEW) ---

// GET students available for assignment to a class (role=student and not in any class yet, or not in this specific class)
app.get('/api/classes/:classId/available-students', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const classId = req.params.classId;
        const availableStudents = await User.find({ 
            role: 'student',
            classes: { $ne: classId } // Not currently in this specific class
        }).select('name email _id');
        
        res.json(availableStudents);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching available students: ' + error.message });
    }
});

// GET students currently assigned to a class
app.get('/api/classes/:classId/assigned-students', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const classId = req.params.classId;
        const classData = await Class.findById(classId).populate('students', 'name email _id');
        
        if (!classData) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        res.json(classData.students);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching assigned students: ' + error.message });
    }
});

// POST to assign a student to a class
app.post('/api/classes/:classId/students', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const { studentId } = req.body;
        const classId = req.params.classId;

        // 1. Update Class model: add studentId to students array
        const updatedClass = await Class.findByIdAndUpdate(
            classId,
            { $addToSet: { students: studentId } },
            { new: true }
        );

        // 2. Update User model: add classId to classes array for the student
        await User.findByIdAndUpdate(
            studentId,
            { $addToSet: { classes: classId } }
        );

        res.json({ message: 'Student assigned successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error assigning student: ' + error.message });
    }
});

// DELETE to remove a student from a class
app.delete('/api/classes/:classId/students/:studentId', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const { classId, studentId } = req.params;

        // 1. Update Class model: pull studentId from students array
        await Class.findByIdAndUpdate(
            classId,
            { $pull: { students: studentId } }
        );

        // 2. Update User model: pull classId from classes array for the student
        await User.findByIdAndUpdate(
            studentId,
            { $pull: { classes: classId } }
        );

        res.json({ message: 'Student removed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error removing student: ' + error.message });
    }
});

// --- USER ROUTES ---
app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const users = await User.find().select('-password').sort({ name: 1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// --- ANNOUNCEMENT ROUTES ---
app.post('/api/announcements', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const { title, content, targetClassId, isGlobal } = req.body;

        const newAnnouncement = new Announcement({
            title,
            content,
            targetClass: isGlobal ? null : targetClassId,
            isGlobal: isGlobal || false,
            author: req.user.userId
        });

        await newAnnouncement.save();
        res.status(201).json(newAnnouncement);
    } catch (error) {
        res.status(500).json({ error: 'Error creating announcement' });
    }
});

app.get('/api/announcements', async (req, res) => {
    try {
        let query = { $or: [{ isGlobal: true }] };
        
        if (req.user) {
            // Logged-in users (including students and teachers) see announcements for their classes
            const user = await User.findById(req.user.userId);
            if (user && user.classes.length > 0) {
                query.$or.push({ targetClass: { $in: user.classes } });
            }
        }
        
        const announcements = await Announcement.find(query)
            .populate('author', 'name')
            .populate('targetClass', 'name')
            .sort({ createdAt: -1 });
            
        res.json(announcements);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching announcements' });
    }
});

// --- ASSIGNMENT ROUTES ---
app.post('/api/assignments', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const { title, description, dueDate, targetClassId } = req.body;

        const newAssignment = new Assignment({
            title,
            description,
            dueDate,
            targetClass: targetClassId,
            author: req.user.userId
        });

        await newAssignment.save();
        res.status(201).json(newAssignment);
    } catch (error) {
        res.status(500).json({ error: 'Error creating assignment: ' + error.message });
    }
});

app.get('/api/assignments', authenticateToken, async (req, res) => {
    try {
        let query = {};
        
        if (req.user.role === 'student') {
            const user = await User.findById(req.user.userId);
            if (user.classes.length > 0) {
                query.targetClass = { $in: user.classes };
            } else {
                return res.json([]); // Student not in any class, no assignments
            }
        } else if (req.user.role === 'teacher') {
            // Teachers see assignments for classes they teach (assuming they are assigned as teacher)
            const classesTaught = await Class.find({ teacher: req.user.userId }).select('_id');
            const classIds = classesTaught.map(c => c._id);
            query.targetClass = { $in: classIds };
        } 
        
        // Admins see all assignments (default query is empty)
        
        const assignments = await Assignment.find(query)
            .populate('author', 'name')
            .populate('targetClass', 'name')
            .sort({ dueDate: 1 });
            
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching assignments' });
    }
});

// --- EVENT ROUTES ---
app.post('/api/events', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const { title, description, date, location, targetClassId, isGlobal } = req.body;

        const newEvent = new Event({
            title,
            description,
            date,
            location,
            targetClass: isGlobal ? null : targetClassId,
            isGlobal: isGlobal || false,
            author: req.user.userId
        });

        await newEvent.save();
        res.status(201).json(newEvent);
    } catch (error) {
        res.status(500).json({ error: 'Error creating event: ' + error.message });
    }
});

app.get('/api/events', async (req, res) => {
    try {
        let query = { $or: [{ isGlobal: true }] };
        
        if (req.user) {
            // Logged-in users (including students and teachers) see events for their classes
            const user = await User.findById(req.user.userId);
            if (user && user.classes.length > 0) {
                query.$or.push({ targetClass: { $in: user.classes } });
            }
        }
        
        const events = await Event.find(query)
            .populate('author', 'name')
            .populate('targetClass', 'name')
            .sort({ date: 1 });
            
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching events' });
    }
});


// --- MEDIA ROUTES ---
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

app.get('/api/media', async (req, res) => {
    try {
        const mediaItems = await Media.find()
            .populate('author', 'name')
            .sort({ date: -1 });
        res.json(mediaItems);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching media' });
    }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    await Media.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});


// --- STATIC FILES & FALLBACK ---

// Serve files uploaded to /uploads
app.use('/uploads', express.static(uploadDir));

// Serve static assets from the client directory
app.use(express.static(path.join(__dirname, 'client')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
