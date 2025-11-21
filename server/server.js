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
// The files are in /opt/render/project/src/client/ NOT /opt/render/project/src/server/client/
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

// סכמות ומודלים (מקוצר)
const userSchema = new mongoose.Schema({
  name: String, email: String, password: String, role: String, classes: Array,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Routes בסיסיים
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    paths: {
      currentDir: __dirname,
      clientDir: path.join(__dirname, '..', 'client')
    }
  });
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({ name, email, password: hashedPassword, role, classes: [] });
    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET);
    
    res.json({ message: 'User created', token, user: { id: user._id, name, email, role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ message: 'Login successful', token, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ FIXED: Serve index.html from the CORRECT path
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Current directory: ${__dirname}`);
  console.log(`📁 Client directory: ${path.join(__dirname, '..', 'client')}`);
  console.log(`✅ Static files should be served from: ${path.join(__dirname, '..', 'client')}`);
});
