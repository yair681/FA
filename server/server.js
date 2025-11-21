import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// חיבור ל-MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

console.log('🔗 Connecting to MongoDB...');
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// סכמות MongoDB

// סכמת משתמש
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  createdAt: { type: Date, default: Date.now }
});

// סכמת כיתה
const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  maxStudents: { type: Number, default: 20 },
  createdAt: { type: Date, default: Date.now }
});

// סכמת הודעה
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isGlobal: { type: Boolean, default: false },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  createdAt: { type: Date, default: Date.now }
});

// סכמת משימה
const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { type: Date, required: true },
  submissions: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submission: String,
    submittedAt: { type: Date, default: Date.now },
    grade: String
  }],
  createdAt: { type: Date, default: Date.now }
});

// סכמת אירוע
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

// סכמת מדיה
const mediaSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['image', 'video'], required: true },
  url: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

// מודלים
const User = mongoose.model('User', userSchema);
const Class = mongoose.model('Class', classSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);
const Event = mongoose.model('Event', eventSchema);
const Media = mongoose.model('Media', mediaSchema);

// Middleware לאימות
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // בדיקה שהמשתמש עדיין קיים במסד הנתונים
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Routes

// Route בסיסי לבדיקת חיבור
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// הרשמה
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // ולידציה
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // בדיקה אם המשתמש כבר קיים
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // הצפנת סיסמה
    const hashedPassword = await bcrypt.hash(password, 10);

    // יצירת משתמש
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      classes: []
    });

    await user.save();

    // יצירת token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// התחברות
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ולידציה
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // מציאת משתמש
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // בדיקת סיסמה
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // יצירת token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ולידציית token
app.get('/api/validate-token', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// משתמשים
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await User.find().select('-password').populate('classes', 'name');
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, email, password, role } = req.body;

    // ולידציה
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // בדיקה אם המשתמש כבר קיים
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // הצפנת סיסמה
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      classes: []
    });

    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // מניעת מחיקת מנהל המערכת הראשי
    if (user.email === 'yairfrish2@gmail.com') {
      return res.status(403).json({ error: 'Cannot delete primary admin user' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// כיתות
app.get('/api/classes', authenticateToken, async (req, res) => {
  try {
    let classes;
    
    if (req.user.role === 'admin') {
      classes = await Class.find()
        .populate('teacher', 'name email')
        .populate('teachers', 'name email')
        .populate('students', 'name email');
    } else if (req.user.role === 'teacher') {
      classes = await Class.find({
        $or: [
          { teacher: req.user.userId },
          { teachers: req.user.userId }
        ]
      })
      .populate('teacher', 'name email')
      .populate('teachers', 'name email')
      .populate('students', 'name email');
    } else {
      // תלמיד - רק הכיתות שהוא רשום אליהן
      classes = await Class.find({ students: req.user.userId })
        .populate('teacher', 'name email')
        .populate('teachers', 'name email')
        .populate('students', 'name email');
    }

    res.json(classes);
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/classes', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }

    const { name, teachers } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Class name is required' });
    }

    // יצירת מערך המורים - כולל המשתמש הנוכחי
    const allTeachers = [req.user.userId, ...(teachers || [])];

    const newClass = new Class({
      name,
      teacher: req.user.userId,
      teachers: allTeachers,
      students: []
    });

    await newClass.save();
    
    // Population for response
    await newClass.populate('teacher', 'name email');
    await newClass.populate('teachers', 'name email');

    res.status(201).json(newClass);
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }

    const classItem = await Class.findById(req.params.id);
    if (!classItem) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // וידוא שרק המורה שיצר את הכיתה או מנהל יכולים למחוק
    if (req.user.role !== 'admin' && classItem.teacher.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only delete classes you created' });
    }

    await Class.findByIdAndDelete(req.params.id);
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// הודעות
app.get('/api/announcements', authenticateToken, async (req, res) => {
  try {
    let announcements;
    
    if (req.user.role === 'student') {
      // תלמיד רואה הודעות כלליות והודעות של הכיתות שלו
      const userClasses = await Class.find({ students: req.user.userId });
      const classIds = userClasses.map(c => c._id);
      
      announcements = await Announcement.find({
        $or: [
          { isGlobal: true },
          { class: { $in: classIds } }
        ]
      })
      .populate('author', 'name')
      .populate('class', 'name')
      .sort({ createdAt: -1 });
    } else {
      // מורה או מנהל רואה הכל
      announcements = await Announcement.find()
        .populate('author', 'name')
        .populate('class', 'name')
        .sort({ createdAt: -1 });
    }

    res.json(announcements);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/announcements', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }

    const { title, content, isGlobal, classId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const announcement = new Announcement({
      title,
      content,
      author: req.user.userId,
      isGlobal: isGlobal || false,
      class: classId || null
    });

    await announcement.save();
    
    // Population for response
    await announcement.populate('author', 'name');
    await announcement.populate('class', 'name');

    res.status(201).json(announcement);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/announcements/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }

    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // וידוא שרק המחבר או מנהל יכולים למחוק
    if (req.user.role !== 'admin' && announcement.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only delete your own announcements' });
    }

    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// משימות
app.get('/api/assignments', authenticateToken, async (req, res) => {
  try {
    let assignments;
    
    if (req.user.role === 'student') {
      // תלמיד רואה משימות של הכיתות שלו
      const userClasses = await Class.find({ students: req.user.userId });
      const classIds = userClasses.map(c => c._id);
      
      assignments = await Assignment.find({ class: { $in: classIds } })
        .populate('class', 'name')
        .populate('teacher', 'name')
        .sort({ dueDate: 1 });
    } else {
      // מורה או מנהל רואה משימות שהוא יצר
      assignments = await Assignment.find({ teacher: req.user.userId })
        .populate('class', 'name')
        .populate('teacher', 'name')
        .sort({ dueDate: 1 });
    }

    res.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/assignments', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }

    const { title, description, classId, dueDate } = req.body;

    if (!title || !description || !classId || !dueDate) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // בדיקה שהכיתה קיימת ושהמורה מלמד בה
    const classItem = await Class.findById(classId);
    if (!classItem) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (!classItem.teachers.includes(req.user.userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not a teacher in this class' });
    }

    const assignment = new Assignment({
      title,
      description,
      class: classId,
      teacher: req.user.userId,
      dueDate,
      submissions: []
    });

    await assignment.save();
    
    // Population for response
    await assignment.populate('class', 'name');
    await assignment.populate('teacher', 'name');

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/assignments/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // וידוא שרק המחבר או מנהל יכולים למחוק
    if (req.user.role !== 'admin' && assignment.teacher.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only delete your own assignments' });
    }

    await Assignment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// אירועים
app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find()
      .populate('author', 'name')
      .sort({ date: 1 });
    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }

    const { title, description, date } = req.body;

    if (!title || !description || !date) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const event = new Event({
      title,
      description,
      date,
      author: req.user.userId
    });

    await event.save();
    await event.populate('author', 'name');

    res.status(201).json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // וידוא שרק המחבר או מנהל יכולים למחוק
    if (req.user.role !== 'admin' && event.author.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only delete your own events' });
    }

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// מדיה
app.get('/api/media', async (req, res) => {
  try {
    const media = await Media.find()
      .populate('author', 'name')
      .sort({ createdAt: -1 });
    res.json(media);
  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/media', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }

    const { title, type, url, date } = req.body;

    if (!title || !type || !url || !date) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['image', 'video'].includes(type)) {
      return res.status(400).json({ error: 'Type must be image or video' });
    }

    const media = new Media({
      title,
      type,
      url,
      date,
      author: req.user.userId
    });

    await media.save();
    await media.populate('author', 'name');

    res.status(201).json(media);
  } catch (error) {
    console.error('Create media error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const media = await Media.findById(req.params.id);
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    await Media.findByIdAndDelete(req.params.id);
    res.json({ message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route בסיסי - הגשת קובץ ה-HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Serve all other routes to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// טיפול בשגיאות 404 עבור API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// טיפול בשגיאות כלליות
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// האזנה לשרת
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 MongoDB: ${MONGODB_URI ? 'Connected' : 'Not connected'}`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET ? 'Set' : 'Not set'}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
});