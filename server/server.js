import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
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
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// --- Zoom / WebRTC Room Management ---
const zoomRooms = new Map();
let zoomCreatePermission = 'teacher'; // 'teacher' | 'all'

function getParticipants(room) {
  const list = [];
  room.users.forEach((u, sid) => {
    list.push({ socketId: sid, name: u.name, userId: u.userId,
      isHost: sid === room.hostSocketId, isCoHost: u.isCoHost });
  });
  return list;
}
function isHostOrCoHost(socketId, room) {
  if (socketId === room.hostSocketId) return true;
  const u = room.users.get(socketId); return u && u.isCoHost;
}
function broadcastRooms() {
  const list = [];
  zoomRooms.forEach((r, id) => list.push({ roomId: id, name: r.name, participants: r.users.size }));
  io.emit('zoom:rooms-list', list);
}
function notifyWaitingUpdate(room) {
  const waitingList = Array.from(room.waitingRoom.values()).map(w => ({ socketId: w.socketId, name: w.name }));
  const targets = [room.hostSocketId, ...Array.from(room.users.entries()).filter(([,u]) => u.isCoHost).map(([sid]) => sid)];
  targets.forEach(sid => io.to(sid).emit('zoom:waiting-update', { waitingList }));
}
function admitUser(targetSocket, room, roomId, userName, userId) {
  room.users.set(targetSocket.id, { name: userName, userId, isCoHost: false });
  targetSocket.join(roomId);
  const existingUsers = [];
  room.users.forEach((u, sid) => {
    if (sid !== targetSocket.id) existingUsers.push({ socketId: sid, name: u.name, isCoHost: u.isCoHost, isHost: sid === room.hostSocketId });
  });
  targetSocket.emit('zoom:room-joined', { roomId, roomName: room.name, existingUsers, isHost: false, chatMode: room.chatMode || 'everyone', permissions: room.permissions || { allowMic: true, allowCamera: true, allowScreenShare: true } });
  targetSocket.to(roomId).emit('zoom:user-joined', { socketId: targetSocket.id, name: userName });
  io.to(roomId).emit('zoom:participants-update', { participants: getParticipants(room) });
  broadcastRooms();
}
function handleUserLeave(socket, roomId) {
  const room = zoomRooms.get(roomId); if (!room) return;
  room.users.delete(socket.id);
  room.waitingRoom.delete(socket.id);
  socket.leave(roomId);
  if (room.screenShareSocketId === socket.id) {
    room.screenShareSocketId = null;
    io.to(roomId).emit('zoom:screen-share-stopped', { socketId: socket.id });
  }
  socket.to(roomId).emit('zoom:user-left', { socketId: socket.id });
  if (socket.id === room.hostSocketId && room.users.size > 0) {
    // העבר מארחות לאחד מהמשתתפים
    let newHost = null;
    for (const [sid, u] of room.users.entries()) { if (u.isCoHost) { newHost = sid; break; } }
    if (!newHost) newHost = room.users.keys().next().value;
    room.hostSocketId = newHost;
    if (room.users.has(newHost)) room.users.get(newHost).isCoHost = false;
    io.to(newHost).emit('zoom:role-changed', { role: 'host' });
    io.to(roomId).emit('zoom:participants-update', { participants: getParticipants(room) });
  } else if (room.users.size === 0) {
    zoomRooms.delete(roomId);
  } else {
    io.to(roomId).emit('zoom:participants-update', { participants: getParticipants(room) });
  }
  broadcastRooms();
}

io.on('connection', (socket) => {

  socket.on('zoom:create-room', ({ roomId, roomName, userName, userId, userRole }) => {
    if (zoomCreatePermission === 'teacher' && userRole !== 'teacher' && userRole !== 'admin') {
      socket.emit('zoom:error', { message: 'אין לך הרשאה ליצור חדרי שיחה' }); return;
    }
    zoomRooms.set(roomId, {
      name: roomName, hostSocketId: socket.id, hostUserId: userId,
      users: new Map([[socket.id, { name: userName, userId, isCoHost: false }]]),
      waitingRoom: new Map(),
      whitelist: new Set(),
      screenShareSocketId: null,
      chatMode: 'everyone',
      permissions: { allowMic: true, allowCamera: true, allowScreenShare: true }
    });
    socket.join(roomId);
    socket.emit('zoom:room-created', { roomId, roomName, permissions: { allowMic: true, allowCamera: true, allowScreenShare: true } });
    broadcastRooms();
  });

  socket.on('zoom:request-join', ({ roomId, userName, userId }) => {
    const room = zoomRooms.get(roomId);
    if (!room) { socket.emit('zoom:error', { message: 'החדר לא נמצא' }); return; }
    if (room.whitelist.has(String(userId))) {
      admitUser(socket, room, roomId, userName, userId); return;
    }
    room.waitingRoom.set(socket.id, { socketId: socket.id, name: userName, userId });
    socket.emit('zoom:waiting', { roomName: room.name });
    notifyWaitingUpdate(room);
  });

  socket.on('zoom:approve-join', ({ roomId, targetSocketId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    const w = room.waitingRoom.get(targetSocketId); if (!w) return;
    room.waitingRoom.delete(targetSocketId);
    const tSocket = io.sockets.sockets.get(targetSocketId);
    if (tSocket) admitUser(tSocket, room, roomId, w.name, w.userId);
    notifyWaitingUpdate(room);
  });

  socket.on('zoom:deny-join', ({ roomId, targetSocketId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    room.waitingRoom.delete(targetSocketId);
    io.to(targetSocketId).emit('zoom:denied');
    notifyWaitingUpdate(room);
  });

  socket.on('zoom:kick', ({ roomId, targetSocketId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    if (targetSocketId === room.hostSocketId) return;
    io.to(targetSocketId).emit('zoom:kicked');
    const tSocket = io.sockets.sockets.get(targetSocketId);
    if (tSocket) handleUserLeave(tSocket, roomId);
  });

  socket.on('zoom:assign-cohost', ({ roomId, targetSocketId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || socket.id !== room.hostSocketId) return;
    const u = room.users.get(targetSocketId); if (!u) return;
    u.isCoHost = true;
    io.to(targetSocketId).emit('zoom:role-changed', { role: 'cohost' });
    io.to(roomId).emit('zoom:participants-update', { participants: getParticipants(room) });
  });

  socket.on('zoom:remove-cohost', ({ roomId, targetSocketId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || socket.id !== room.hostSocketId) return;
    const u = room.users.get(targetSocketId); if (!u) return;
    u.isCoHost = false;
    io.to(targetSocketId).emit('zoom:role-changed', { role: 'participant' });
    io.to(roomId).emit('zoom:participants-update', { participants: getParticipants(room) });
  });

  socket.on('zoom:update-whitelist', ({ roomId, userIds }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    room.whitelist = new Set(userIds.map(id => String(id)));
    socket.emit('zoom:whitelist-updated');
  });

  socket.on('zoom:update-room-permissions', ({ roomId, permissions }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    room.permissions = { ...room.permissions, ...permissions };
    io.to(roomId).emit('zoom:permissions-changed', { permissions: room.permissions });
  });

  socket.on('zoom:chat-message', ({ roomId, text }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    const user = room.users.get(socket.id); if (!user) return;
    if (room.chatMode === 'host-only' && !isHostOrCoHost(socket.id, room)) return;
    const msg = { from: user.name, text, ts: Date.now(), fromSocketId: socket.id };
    io.to(roomId).emit('zoom:chat-message', msg);
  });

  socket.on('zoom:set-chat-mode', ({ roomId, mode }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    room.chatMode = mode;
    io.to(roomId).emit('zoom:chat-mode-changed', { mode });
  });

  socket.on('zoom:mute-user', ({ roomId, targetSocketId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    io.to(targetSocketId).emit('zoom:muted-by-host');
  });

  socket.on('zoom:end-meeting', ({ roomId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || socket.id !== room.hostSocketId) return;
    io.to(roomId).emit('zoom:meeting-ended', { reason: 'host' });
    zoomRooms.delete(roomId); broadcastRooms();
  });

  socket.on('zoom:admin-close', ({ roomId }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    io.to(roomId).emit('zoom:meeting-ended', { reason: 'admin' });
    zoomRooms.delete(roomId); broadcastRooms();
  });

  socket.on('zoom:set-create-permission', ({ permission }) => {
    zoomCreatePermission = permission;
    io.emit('zoom:create-permission', { permission });
  });

  socket.on('zoom:get-rooms', () => {
    const list = [];
    zoomRooms.forEach((r, id) => list.push({ roomId: id, name: r.name, participants: r.users.size }));
    socket.emit('zoom:rooms-list', list);
  });

  socket.on('zoom:get-create-permission', () => {
    socket.emit('zoom:create-permission', { permission: zoomCreatePermission });
  });

  socket.on('zoom:screen-share-started', ({ roomId }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    room.screenShareSocketId = socket.id;
    socket.to(roomId).emit('zoom:screen-share-started', { socketId: socket.id });
  });

  socket.on('zoom:screen-share-stopped', ({ roomId }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    if (room.screenShareSocketId === socket.id) room.screenShareSocketId = null;
    socket.to(roomId).emit('zoom:screen-share-stopped', { socketId: socket.id });
  });

  // WebRTC Signaling
  socket.on('zoom:offer', ({ targetSocketId, offer, fromName }) => {
    io.to(targetSocketId).emit('zoom:offer', { fromSocketId: socket.id, fromName, offer });
  });
  socket.on('zoom:answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('zoom:answer', { fromSocketId: socket.id, answer });
  });
  socket.on('zoom:ice-candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('zoom:ice-candidate', { fromSocketId: socket.id, candidate });
  });

  socket.on('zoom:leave-room', ({ roomId }) => handleUserLeave(socket, roomId));
  socket.on('disconnect', () => {
    zoomRooms.forEach((_, roomId) => {
      const room = zoomRooms.get(roomId);
      if (room && (room.users.has(socket.id) || room.waitingRoom.has(socket.id)))
        handleUserLeave(socket, roomId);
    });
  });
});
// --- End Zoom ---

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
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

// הסרת ה-enum מ-type כדי לאפשר כל סוג קובץ
const mediaSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, required: true }, 
  url: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now }, 
  createdAt: { type: Date, default: Date.now }
});

// מודלים
const User = mongoose.model('User', userSchema);
const Class = mongoose.model('Class', classSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);
const Event = mongoose.model('Event', eventSchema);
const Media = mongoose.model('Media', mediaSchema);

// יצירת משתמש מנהל ברירת מחדל
async function createDefaultUsers() {
  try {
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
      console.log('✅ Default admin user created');
    }
  } catch (error) {
    console.error('❌ Error creating default users:', error);
  }
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    createDefaultUsers();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.error('⚠️ Server will continue running but database operations will fail');
  });

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(403).json({ error: 'User not found' });

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

// --- Routes ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields are required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    // ✅ ביטול שיוך אוטומטי לכיתה - משתמש חדש נוצר ללא כיתות
    const user = new User({ name, email, password: hashedPassword, role, classes: [] });
    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ message: 'User created', token, user: { id: user._id, name, email, role } });
  } catch (error) {
    res.status(500).json({ error: 'Error registering user' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    if (!user.password) return res.status(500).json({ error: 'User data corrupted' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ message: 'Login successful', token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });

  } catch (error) {
    console.error('🔥 Login Critical Error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

app.get('/api/validate-token', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/change-password', authenticateToken, async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword) return res.status(400).json({ error: 'New password is required' });
  
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await User.findByIdAndUpdate(req.user.userId, { password: hashedPassword });
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
});

// Users
app.get('/api/users', authenticateToken, async (req, res) => {
    // ✅ שינוי: מאפשר גם למורים לגשת (כדי לבחור תלמידים להוספה לכיתה)
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
        // ✅ ביטול שיוך אוטומטי לכיתה - משתמש חדש נוצר ללא כיתות
        const user = new User({ name, email, password: hashedPassword, role, classes: [] });
        await user.save();
        res.json({ message: 'User created' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const { name, email, role, password } = req.body;
        const updateData = { name, email, role };
        if (password) updateData.password = await bcrypt.hash(password, 10);
        
        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json({ message: 'User updated', user });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
});

// Classes
app.get('/api/classes', authenticateToken, async (req, res) => {
    try {
        // ✅ מורים ותלמידים רואים רק את הכיתות שלהם
        let query = {};
        
        if (req.user.role === 'student') {
            // תלמידים רואים רק כיתות שהם חברים בהן
            query = { students: req.user.userId };
        } else if (req.user.role === 'teacher') {
            // מורים רואים רק כיתות שהם מלמדים בהן
            query = { teachers: req.user.userId };
        }
        // אדמינים רואים את כל הכיתות (query ריק)
        
        const classes = await Class.find(query)
          .populate('teacher', 'name email')
          .populate('teachers', 'name email')
          .populate('students', 'name email');
        res.json(classes);
    } catch (error) {
        console.error('❌ Error fetching classes:', error);
        res.status(500).json({ error: 'Failed to fetch classes', message: error.message });
    }
});

app.post('/api/classes', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const { name, teachers } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Class name is required' });
        }
        
        // ✅ ביטול שיוך אוטומטי - כיתה חדשה נוצרת ללא תלמידים
        const newClass = new Class({
            name,
            teacher: req.user.userId,
            teachers: [req.user.userId, ...(teachers || [])],
            students: [] // רשימה ריקה, המורים יוכלו להוסיף תלמידים ידנית
        });
        
        await newClass.save();
        
        const populatedClass = await Class.findById(newClass._id)
            .populate('teacher', 'name email')
            .populate('teachers', 'name email')
            .populate('students', 'name email');
        
        res.json(populatedClass);
    } catch (error) {
        console.error('❌ Error creating class:', error);
        res.status(500).json({ error: 'Failed to create class', message: error.message });
    }
});

app.put('/api/classes/:id', authenticateToken, async (req, res) => {
    try {
        const classToUpdate = await Class.findById(req.params.id);
        if (!classToUpdate) return res.status(404).json({ error: 'Class not found' });

        // ✅ שינוי: מאפשר למורה של הכיתה לערוך אותה (להוסיף/להסיר תלמידים)
        const isClassTeacher = req.user.role === 'teacher' && (
            classToUpdate.teacher.toString() === req.user.userId || 
            classToUpdate.teachers.map(t => t.toString()).includes(req.user.userId)
        );

        if (req.user.role !== 'admin' && !isClassTeacher) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { name, teachers, students } = req.body;
        
        if (name) classToUpdate.name = name;
        if (teachers) classToUpdate.teachers = teachers;
        if (students) classToUpdate.students = students;

        await classToUpdate.save();
        
        const populatedClass = await Class.findById(req.params.id)
            .populate('teacher', 'name email')
            .populate('teachers', 'name email')
            .populate('students', 'name email');

        res.json(populatedClass);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    await Class.findByIdAndDelete(req.params.id);
    res.json({ message: 'Class deleted' });
});

// Class specific data
app.get('/api/classes/:id/assignments', authenticateToken, async (req, res) => {
    const assignments = await Assignment.find({ class: req.params.id }).populate('class teacher');
    res.json(assignments);
});

app.get('/api/classes/:id/announcements', authenticateToken, async (req, res) => {
    const announcements = await Announcement.find({ 
        $or: [{ class: req.params.id }, { isGlobal: true }]
    }).populate('author class').sort({ createdAt: -1 });
    res.json(announcements);
});

// Announcements
app.get('/api/announcements', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        let query = { isGlobal: true };

        // שליפת הודעות רלוונטיות למשתמש (כלליות + כיתות שלו)
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const userId = decoded.userId;
                const userClasses = await Class.find({
                    $or: [{ students: userId }, { teachers: userId }, { teacher: userId }]
                }).select('_id');
                const classIds = userClasses.map(c => c._id);
                query = { $or: [{ isGlobal: true }, { class: { $in: classIds } }] };
            } catch (e) {}
        }

        const announcements = await Announcement.find(query)
            .populate('author', 'name')
            .populate('class', 'name')
            .sort({ createdAt: -1 });
        res.json(announcements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/announcements', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    const { title, content, isGlobal, classId } = req.body;
    const announcement = new Announcement({
        title, content, author: req.user.userId, isGlobal: isGlobal || false, class: classId || null
    });
    await announcement.save();
    res.json(announcement);
});

app.delete('/api/announcements/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});

// Assignments
app.get('/api/assignments', authenticateToken, async (req, res) => {
    try {
        let assignments;
        if (req.user.role === 'student') {
            const studentClasses = await Class.find({ students: req.user.userId });
            const classIds = studentClasses.map(c => c._id);
            assignments = classIds.length === 0 ? [] : await Assignment.find({ class: { $in: classIds } }).populate('class', 'name').populate('teacher', 'name').sort({ dueDate: 1 });
        } else {
            assignments = await Assignment.find().populate('class', 'name').populate('teacher', 'name').sort({ dueDate: 1 });
        }
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/assignments', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    const { title, description, classId, dueDate } = req.body;
    const assignment = new Assignment({
        title, description, class: classId, teacher: req.user.userId, dueDate, submissions: []
    });
    await assignment.save();
    res.json(assignment);
});

app.post('/api/assignments/submit', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { assignmentId, submission } = req.body;
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

        let fileUrl = null;
        if (req.file) {
            fileUrl = `/uploads/${req.file.filename}`;
        }

        const existingSubIndex = assignment.submissions.findIndex(s => s.student.toString() === req.user.userId);
        
        const newSubmission = {
            student: req.user.userId,
            submission: submission || '',
            fileUrl: fileUrl, 
            submittedAt: new Date()
        };

        if (existingSubIndex > -1) {
            if (!fileUrl && assignment.submissions[existingSubIndex].fileUrl) {
                newSubmission.fileUrl = assignment.submissions[existingSubIndex].fileUrl;
            }
            assignment.submissions[existingSubIndex] = { ...assignment.submissions[existingSubIndex], ...newSubmission };
        } else {
            assignment.submissions.push(newSubmission);
        }

        await assignment.save();
        res.json({ message: 'Submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error submitting assignment' });
    }
});

app.put('/api/assignments/:id', authenticateToken, async (req, res) => {
    const { title, description, dueDate } = req.body;
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && assignment.teacher.toString() !== req.user.userId) return res.status(403).json({ error: 'Denied' });
    
    const updated = await Assignment.findByIdAndUpdate(req.params.id, { title, description, dueDate }, { new: true });
    res.json(updated);
});

app.delete('/api/assignments/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    await Assignment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});

app.get('/api/assignments/:id/submissions', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    const assignment = await Assignment.findById(req.params.id).populate('submissions.student', 'name email');
    res.json(assignment.submissions);
});

app.post('/api/assignments/grade', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    const { assignmentId, studentId, grade } = req.body;
    const assignment = await Assignment.findById(assignmentId);
    const sub = assignment.submissions.find(s => s.student.toString() === studentId);
    if (sub) {
        sub.grade = grade;
        await assignment.save();
        res.json({ message: 'Graded' });
    } else {
        res.status(404).json({ error: 'Submission not found' });
    }
});

// Events
app.get('/api/events', async (req, res) => {
    const events = await Event.find().populate('author', 'name').sort({ date: 1 });
    res.json(events);
});

app.post('/api/events', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    const { title, description, date } = req.body;
    const event = new Event({ title, description, date, author: req.user.userId });
    await event.save();
    res.json(event);
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});

// Media
app.get('/api/media', async (req, res) => {
    const media = await Media.find().populate('author', 'name').sort({ createdAt: -1 });
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('🔥 Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
