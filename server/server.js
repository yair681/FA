import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer'; // נדרש להעלאת קבצים

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

// הגדרת Multer לאחסון קבצים (נניח תיקיית uploads בתוך client)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // נניח שתיקיית client/uploads קיימת
    cb(null, path.join(__dirname, '..', 'client', 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });


// ✅ FIXED: Serve static files from the CORRECT path
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/css', express.static(path.join(__dirname, '..', 'client', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'client', 'js')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'client', 'uploads'))); // הגשת קבצים שהועלו

// חיבור ל-MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔗 Connecting to MongoDB...');
// ודא שחיבור ל-DB מתבצע כאן

// סכמות MongoDB (בהנחה שקיימות)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  createdAt: { type: Date, default: Date.now },
});

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
});

const announcementSchema = new mongoose.Schema({
  title: String,
  content: String,
  isGlobal: { type: Boolean, default: false },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

const assignmentSchema = new mongoose.Schema({
  title: String,
  description: String,
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dueDate: Date,
  // submissions יאוכלסו בנפרד בד"כ או יאוחסנו במודל נפרד
});

const eventSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: Date,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

const mediaSchema = new mongoose.Schema({
    title: String,
    url: String,
    type: { type: String, enum: ['image', 'video'] },
    date: Date,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Class = mongoose.model('Class', classSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);
const Event = mongoose.model('Event', eventSchema);
const Media = mongoose.model('Media', mediaSchema);

// פונקציית Middleware לאימות טוקן
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.status(401).json({ error: 'Token missing' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('❌ JWT Verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user; // מכיל { id, email, role }
        next();
    });
};

// =================================================================
// 🔑 AUTH ROUTES
// =================================================================

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );
        
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/validate-token', authenticateToken, (req, res) => {
    // If authenticateToken succeeds, req.user is set.
    res.json({ 
        id: req.user.id, 
        name: req.user.name, 
        email: req.user.email, 
        role: req.user.role 
    });
});

app.post('/api/change-password', authenticateToken, async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(req.user.id, { password: hashedPassword });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('❌ Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// =================================================================
// 👨‍💻 USER ROUTES
// =================================================================

// קבלת כל המשתמשים (למנהל בלבד)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ✅ ADDED/FIXED: קבלת כיתות של משתמש ספציפי (תיקון השגיאה שדווחה)
app.get('/api/users/:id/classes', authenticateToken, async (req, res) => {
    try {
        // ודא שהמשתמש מורשה לצפות במידע הזה (הוא עצמו או מנהל)
        if (req.user.id !== req.params.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const userId = req.params.id;
        
        // 1. קבל את הכיתות שהמשתמש משויך אליהן כתלמיד (אם רלוונטי)
        // אם המשתמש הוא מורה/מנהל, אולי הוא משויך דרך שדה ה-teachers
        
        // נניח ש-students ו-teachers נמצאים במודל Class
        let classes;
        if (req.user.role === 'student') {
            classes = await Class.find({ students: userId })
                .populate('teachers', 'name email');
        } else {
            // מורה או מנהל רואים כיתות שהם מלמדים
            classes = await Class.find({ teachers: userId })
                .populate('teachers', 'name email');
            
            // מנהל יכול לראות את כל הכיתות, אבל בדף כיתות הוא רואה את אלה שקשורות אליו
            // אם המודל User מחזיק רשימת classes, נשלב אותן כאן
            const user = await User.findById(userId).populate('classes', 'name');
            if (user && user.classes) {
                const classIds = classes.map(c => c._id.toString());
                user.classes.forEach(c => {
                    if (!classIds.includes(c._id.toString())) {
                        classes.push(c);
                    }
                });
            }
        }
        
        res.json(classes);
    } catch (error) {
        console.error('❌ Get user classes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// =================================================================
// 🏫 CLASS ROUTES
// =================================================================

app.get('/api/classes', authenticateToken, async (req, res) => {
    try {
        // מנהל רואה את כל הכיתות, מורה רואה את הכיתות שלו
        let query = {};
        if (req.user.role === 'teacher' && req.user.role !== 'admin') {
            query.teachers = req.user.id;
        }

        const classes = await Class.find(query)
            .populate('teachers', 'name email')
            .populate('students', 'name email');
        
        res.json(classes);
    } catch (error) {
        console.error('❌ Get classes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
// 📅 EVENT ROUTES
// =================================================================

// קבלת כל האירועים (ציבורי)
app.get('/api/events', async (req, res) => {
    try {
        const events = await Event.find()
            .populate('author', 'name email')
            .sort({ date: 1 });
        res.json(events);
    } catch (error) {
        console.error('❌ Get events error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// יצירת אירוע (מורה/מנהל)
app.post('/api/events', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Teacher or admin access required' });
        }
        
        const newEvent = new Event({
            ...req.body,
            author: req.user.id,
        });

        await newEvent.save();
        const savedEvent = await newEvent.populate('author', 'name');

        res.status(201).json(savedEvent);
    } catch (error) {
        console.error('❌ Create event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ✅ ADDED: מחיקת אירוע (מורה/מנהל)
app.delete('/api/events/:id', authenticateToken, async (req, res) => {
    try {
        console.log('🗑️ Delete event by:', req.user.email);
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Teacher or admin access required' });
        }
        
        const eventId = req.params.id;
        const event = await Event.findById(eventId);
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        // ניתן להוסיף כאן בדיקה אם המשתמש הוא היוצר של האירוע או מנהל, אם רוצים הרשאה מחמירה יותר
        
        await Event.findByIdAndDelete(eventId);
        console.log('✅ Event deleted:', eventId);
        res.json({ message: 'Event deleted' });
    } catch (error) {
        console.error('❌ Delete event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
// 🖼️ MEDIA ROUTES
// =================================================================

app.post('/api/media', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const { title, type, date } = req.body;
    
    // הנתיב לשמירה בבסיס הנתונים
    const fileUrl = `/uploads/${req.file.filename}`;

    const newMedia = new Media({
      title,
      type,
      date,
      url: fileUrl,
      author: req.user.id,
    });

    await newMedia.save();
    console.log('✅ Media created:', newMedia._id);
    res.status(201).json(newMedia);
  } catch (error) {
    console.error('❌ Create media error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Delete media by:', req.user.email);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    // ניתן להוסיף כאן לוגיקה למחיקת הקובץ הפיזי מהשרת אם רוצים
    await Media.findByIdAndDelete(req.params.id);
    console.log('✅ Media deleted:', req.params.id);
    res.json({ message: 'Media deleted' });
  } catch (error) {
    console.error('❌ Delete media error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =================================================================
// 📄 CATCH ALL ROUTES
// =================================================================

// Serve index.html for all other routes
app.get('*', (req, res) => {
  console.log('📄 Serving index.html for route:', req.url);
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Error handling
app.use((error, req, res, next) => {
  console.error('🔥 Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
