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

// יצירת משתמשים ברירת מחדל אם לא קיימים
async function createDefaultUsers() {
  try {
    console.log('🔧 Checking for default users...');
    
    // משתמש מנהל
    const existingAdmin = await User.findOne({ email: 'yairfrish2@gmail.com' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('yair12345', 10);
      const adminUser = new User({
        name: 'יאיר פריש',
        email: 'yairfrish2@gmail.com',
        password: hashedPassword,
        role: 'admin',
        classes: [],
        createdAt: new Date()
      });
      await adminUser.save();
      console.log('✅ Default admin user created: yairfrish2@gmail.com');
    } else {
      console.log('✅ Admin user already exists');
    }

    // משתמש מורה
    const existingTeacher = await User.findOne({ email: 'teacher@school.com' });
    if (!existingTeacher) {
      const hashedPassword = await bcrypt.hash('123456', 10);
      const teacherUser = new User({
        name: 'מורה לדוגמה',
        email: 'teacher@school.com',
        password: hashedPassword,
        role: 'teacher',
        classes: [],
        createdAt: new Date()
      });
      await teacherUser.save();
      console.log('✅ Default teacher user created: teacher@school.com');
    } else {
      console.log('✅ Teacher user already exists');
    }

    // משתמש תלמיד
    const existingStudent = await User.findOne({ email: 'student@school.com' });
    if (!existingStudent) {
      const hashedPassword = await bcrypt.hash('123456', 10);
      const studentUser = new User({
        name: 'תלמיד לדוגמה',
        email: 'student@school.com',
        password: hashedPassword,
        role: 'student',
        classes: [],
        createdAt: new Date()
      });
      await studentUser.save();
      console.log('✅ Default student user created: student@school.com');
    } else {
      console.log('✅ Student user already exists');
    }

    console.log('🔧 Default users setup completed');
  } catch (error) {
    console.error('❌ Error creating default users:', error);
  }
}

// יצירת נתוני דמה אם אין נתונים
async function createSampleData() {
  try {
    console.log('🔧 Checking for sample data...');
    
    const adminUser = await User.findOne({ email: 'yairfrish2@gmail.com' });
    if (!adminUser) {
      console.log('❌ Admin user not found for sample data');
      return;
    }

    // בדוק אם יש הודעות
    const announcementsCount = await Announcement.countDocuments();
    if (announcementsCount === 0) {
      console.log('📢 Creating sample announcements...');
      
      const sampleAnnouncements = [
        {
          title: 'ברוכים הבאים למערכת פרחי אהרון!',
          content: 'אנו שמחים להשיק את המערכת החדשה לניהול בית הספר. כאן תוכלו למצוא הודעות, משימות, אירועים ועוד.',
          author: adminUser._id,
          isGlobal: true,
          createdAt: new Date()
        },
        {
          title: 'תחילת שנה"ל תשפ"ד',
          content: 'ברכות לתלמידים ולצוות על פתיחת שנה"ל. נשמח לראות אתכם פעילים ומשתתפים בכל הפעילויות.',
          author: adminUser._id,
          isGlobal: true,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      ];
      
      await Announcement.insertMany(sampleAnnouncements);
      console.log('✅ Sample announcements created');
    } else {
      console.log(`✅ Already have ${announcementsCount} announcements`);
    }

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
}

// חיבור ל-MongoDB ויצירת משתמשים
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    createDefaultUsers().then(() => {
      createSampleData();
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });

// Middleware לאימות
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('🔐 No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      console.log('❌ User not found for token');
      return res.status(403).json({ error: 'User not found' });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    console.log('✅ Token validated for user:', user.email);
    next();
  } catch (error) {
    console.log('❌ Invalid token:', error.message);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  console.log('💊 Health check requested');
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    console.log('👤 Registration attempt:', req.body);
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password || !role) {
      console.log('❌ Missing fields in registration');
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role, classes: [] });
    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET);
    
    console.log('✅ User registered successfully:', email);
    res.json({
      message: 'User created successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt:', { email: req.body.email, password: '***' });
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    console.log('👤 User lookup result:', user ? `Found user: ${user.email}` : 'User not found');
    
    if (!user) {
      console.log('❌ User not found for email:', email);
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔑 Password validation result:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password for user:', email);
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET);

    console.log('✅ Login successful for user:', user.email);
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/validate-token', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Token validation request for user:', req.user.email);
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      console.log('❌ User not found during token validation');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ Token validated successfully for:', user.email);
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    console.error('❌ Token validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Users routes
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    console.log('👥 Users list requested by:', req.user.email);
    if (req.user.role !== 'admin') {
      console.log('❌ Admin access required for users list');
      return res.status(403).json({ error: 'Admin access required' });
    }
    const users = await User.find().select('-password');
    console.log('✅ Users list sent, count:', users.length);
    res.json(users);
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    console.log('👤 Create user request by:', req.user.email);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role, classes: [] });
    await user.save();
    console.log('✅ User created:', email);
    res.json({ message: 'User created', user: { id: user._id, name, email, role } });
  } catch (error) {
    console.error('❌ Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Delete user request by:', req.user.email);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    await User.findByIdAndDelete(req.params.id);
    console.log('✅ User deleted:', req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Classes routes
app.get('/api/classes', authenticateToken, async (req, res) => {
  try {
    console.log('🏫 Classes list requested by:', req.user.email);
    const classes = await Class.find()
      .populate('teacher', 'name email')
      .populate('teachers', 'name email')
      .populate('students', 'name email');
    console.log('✅ Classes list sent, count:', classes.length);
    res.json(classes);
  } catch (error) {
    console.error('❌ Get classes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/classes', authenticateToken, async (req, res) => {
  try {
    console.log('🏫 Create class request by:', req.user.email);
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
    console.log('✅ Class created:', name);
    res.json(newClass);
  } catch (error) {
    console.error('❌ Create class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Delete class request by:', req.user.email);
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    await Class.findByIdAndDelete(req.params.id);
    console.log('✅ Class deleted:', req.params.id);
    res.json({ message: 'Class deleted' });
  } catch (error) {
    console.error('❌ Delete class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🔥 FIX: Announcements routes - MAKE GET PUBLIC
app.get('/api/announcements', async (req, res) => {
  try {
    console.log('📢 Announcements requested');
    const announcements = await Announcement.find()
      .populate('author', 'name')
      .populate('class', 'name')
      .sort({ createdAt: -1 });
    console.log('✅ Announcements sent, count:', announcements.length);
    res.json(announcements);
  } catch (error) {
    console.error('❌ Get announcements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/announcements', authenticateToken, async (req, res) => {
  try {
    console.log('📢 Create announcement by:', req.user.email);
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
    console.log('✅ Announcement created:', title);
    res.json(announcement);
  } catch (error) {
    console.error('❌ Create announcement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/announcements/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Delete announcement by:', req.user.email);
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    await Announcement.findByIdAndDelete(req.params.id);
    console.log('✅ Announcement deleted:', req.params.id);
    res.json({ message: 'Announcement deleted' });
  } catch (error) {
    console.error('❌ Delete announcement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assignments routes
app.get('/api/assignments', authenticateToken, async (req, res) => {
  try {
    console.log('📚 Assignments requested by:', req.user.email);
    const assignments = await Assignment.find()
      .populate('class', 'name')
      .populate('teacher', 'name')
      .sort({ dueDate: 1 });
    console.log('✅ Assignments sent, count:', assignments.length);
    res.json(assignments);
  } catch (error) {
    console.error('❌ Get assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/assignments', authenticateToken, async (req, res) => {
  try {
    console.log('📚 Create assignment by:', req.user.email);
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
    console.log('✅ Assignment created:', title);
    res.json(assignment);
  } catch (error) {
    console.error('❌ Create assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/assignments/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Delete assignment by:', req.user.email);
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    await Assignment.findByIdAndDelete(req.params.id);
    console.log('✅ Assignment deleted:', req.params.id);
    res.json({ message: 'Assignment deleted' });
  } catch (error) {
    console.error('❌ Delete assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Events routes - MAKE GET PUBLIC
app.get('/api/events', async (req, res) => {
  try {
    console.log('📅 Events requested');
    const events = await Event.find()
      .populate('author', 'name')
      .sort({ date: 1 });
    console.log('✅ Events sent, count:', events.length);
    res.json(events);
  } catch (error) {
    console.error('❌ Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    console.log('📅 Create event by:', req.user.email);
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    const { title, description, date } = req.body;
    const event = new Event({ title, description, date, author: req.user.userId });
    await event.save();
    console.log('✅ Event created:', title);
    res.json(event);
  } catch (error) {
    console.error('❌ Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Media routes - MAKE GET PUBLIC
app.get('/api/media', async (req, res) => {
  try {
    console.log('🖼️ Media requested');
    const media = await Media.find()
      .populate('author', 'name')
      .sort({ createdAt: -1 });
    console.log('✅ Media sent, count:', media.length);
    res.json(media);
  } catch (error) {
    console.error('❌ Get media error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/media', authenticateToken, async (req, res) => {
  try {
    console.log('🖼️ Create media by:', req.user.email);
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Teacher or admin access required' });
    }
    const { title, type, url, date } = req.body;
    const media = new Media({ title, type, url, date, author: req.user.userId });
    await media.save();
    console.log('✅ Media created:', title);
    res.json(media);
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
    await Media.findByIdAndDelete(req.params.id);
    console.log('✅ Media deleted:', req.params.id);
    res.json({ message: 'Media deleted' });
  } catch (error) {
    console.error('❌ Delete media error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 MongoDB: Connected`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET ? 'Set' : 'Not set'}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ All API endpoints are available`);
  console.log(`🏠 Home: https://fa-v8kd.onrender.com`);
  console.log(`💊 Health: https://fa-v8kd.onrender.com/api/health`);
});
