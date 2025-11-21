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
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

// Middleware - CORS
app.use(cors({
  origin: ['https://fa-v8kd.onrender.com', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from client directory - FIXED
app.use(express.static(path.join(__dirname, 'client')));
app.use('/css', express.static(path.join(__dirname, 'client', 'css')));
app.use('/js', express.static(path.join(__dirname, 'client', 'js')));

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
    
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      classes: []
    });

    await user.save();

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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

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

// Route בסיסי - הגשת קובץ ה-HTML
app.get('/', (req, res) => {
  console.log('📄 Serving index.html');
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Serve all other routes to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// האזנה לשרת
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 MongoDB: Connected`);
  console.log(`🔐 JWT Secret: Set`);
  console.log(`🌐 Environment: production`);
  console.log(`🏠 Home: https://fa-v8kd.onrender.com`);
  console.log(`💊 Health: https://fa-v8kd.onrender.com/api/health`);
});
