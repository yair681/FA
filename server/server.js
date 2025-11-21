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
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// ✅ FIXED: Serve static files from the CORRECT path
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/css', express.static(path.join(__dirname, '..', 'client', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'client', 'js')));

// חיבור ל-MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔗 Connecting to MongoDB...');
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });

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
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isGlobal: { type: Boolean, default: false },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
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
    submittedAt: { type: Date, default: Date.now },
    grade: String
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
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
    const user = new User({ name, email, password: hashedPassword, role, classes: [] });
    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET);
    
    res.json({
      message: 'User created successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
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

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Users routes
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role, classes: [] });
    await user.save();
    res.json({ message: 'User created', user: { id: user._id, name, email, role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Classes routes
app.get('/api/classes', authenticateToken, async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('teacher', 'name email')
      .populate('teachers', 'name email')
      .populate('students', 'name email');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/classes', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    const { name, teachers } = req.body;
    const newClass = new Class({
      name,
      teacher: req.user.userId,
      teachers: [req.user.userId, ...(teachers || [])],
      students: []
    });
    await newClass.save();
    res.json(newClass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    await Class.findByIdAndDelete(req.params.id);
    res.json({ message: 'Class deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Announcements routes
app.get('/api/announcements', authenticateToken, async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('author', 'name')
      .populate('class', 'name')
      .sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/announcements', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    const { title, content, isGlobal, classId } = req.body;
    const announcement = new Announcement({
      title,
      content,
      author: req.user.userId,
      isGlobal: isGlobal || false,
      class: classId || null
    });
    await announcement.save();
    await announcement.populate('author', 'name');
    res.json(announcement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/announcements/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assignments routes
app.get('/api/assignments', authenticateToken, async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate('class', 'name')
      .populate('teacher', 'name')
      .sort({ dueDate: 1 });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assignments', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    const { title, description, classId, dueDate } = req.body;
    const assignment = new Assignment({
      title,
      description,
      class: classId,
      teacher: req.user.userId,
      dueDate,
      submissions: []
    });
    await assignment.save();
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/assignments/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    await Assignment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Assignment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Events routes
app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find()
      .populate('author', 'name')
      .sort({ date: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    const { title, description, date } = req.body;
    const event = new Event({ title, description, date, author: req.user.userId });
    await event.save();
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Media routes
app.get('/api/media', async (req, res) => {
  try {
    const media = await Media.find()
      .populate('author', 'name')
      .sort({ createdAt: -1 });
    res.json(media);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/media', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    const { title, type, url, date } = req.body;
    const media = new Media({ title, type, url, date, author: req.user.userId });
    await media.save();
    res.json(media);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    await Media.findByIdAndDelete(req.params.id);
    res.json({ message: 'Media deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ All API endpoints are available`);
});
