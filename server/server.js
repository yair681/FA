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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'zoom-app-secret-2024';

// ── MongoDB Schemas ──────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:             { type: String, required: true },
  email:            { type: String, required: true, unique: true },
  password:         { type: String, required: true },
  role:             { type: String, enum: ['admin', 'user'], default: 'user' },
  customBackgrounds:{ type: [String], default: [] },
  createdAt:        { type: Date, default: Date.now }
});

const meetingSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  hostId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hostName:    { type: String, required: true },
  type:        { type: String, enum: ['instant', 'scheduled', 'permanent'], required: true },
  scheduledAt: { type: Date },
  roomId:      { type: String, required: true, unique: true },
  status:      { type: String, enum: ['scheduled', 'ended'], default: 'scheduled' },
  settings: {
    requireAdminApproval: { type: Boolean, default: false },
    allowEntryBeforeHost: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now }
});

const systemSettingsSchema = new mongoose.Schema({
  key:                  { type: String, default: 'main', unique: true },
  lockMeetingCreation:  { type: Boolean, default: false },
  requireApproval:      { type: Boolean, default: false },
  allowEntryBeforeHost: { type: Boolean, default: false }
});

const User           = mongoose.model('User', userSchema);
const Meeting        = mongoose.model('Meeting', meetingSchema);
const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

// ── In-memory room store ─────────────────────────────────────────────────────
const zoomRooms = new Map();

function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }

function getParticipants(room) {
  const list = [];
  room.users.forEach((u, sid) => list.push({
    socketId: sid, name: u.name, userId: u.userId,
    isHost: sid === room.hostSocketId, isCoHost: u.isCoHost,
    audioOn: u.audioOn !== false, videoOn: u.videoOn !== false
  }));
  return list;
}

function isHostOrCoHost(socketId, room) {
  if (socketId === room.hostSocketId) return true;
  const u = room.users.get(socketId);
  return u && u.isCoHost;
}

function broadcastRooms() {
  const list = [];
  zoomRooms.forEach((r, id) => { if (!r._empty) list.push({ roomId: id, name: r.name, participants: r.users.size }); });
  io.emit('zoom:rooms-list', list);
}

function notifyWaitingUpdate(room) {
  const waitingList = Array.from(room.waitingRoom.values()).map(w => ({ socketId: w.socketId, name: w.name }));
  const targets = [room.hostSocketId, ...Array.from(room.users.entries()).filter(([, u]) => u.isCoHost).map(([s]) => s)];
  targets.forEach(sid => { if (sid) io.to(sid).emit('zoom:waiting-update', { waitingList }); });
}

function admitUser(targetSocket, room, roomId, userName, userId, userRole) {
  room.users.set(targetSocket.id, { name: userName, userId, userRole: userRole || 'user', isCoHost: false, audioOn: true, videoOn: true });
  targetSocket.join(roomId);
  const existingUsers = [];
  room.users.forEach((u, sid) => {
    if (sid !== targetSocket.id) existingUsers.push({ socketId: sid, name: u.name, isCoHost: u.isCoHost, isHost: sid === room.hostSocketId });
  });
  targetSocket.emit('zoom:room-joined', {
    roomId, roomName: room.name, existingUsers, isHost: targetSocket.id === room.hostSocketId,
    chatMode: room.chatMode || 'everyone',
    permissions: room.permissions || { allowMic: true, allowCamera: true, allowScreenShare: true },
    settings: room.settings || {}, emojisEnabled: room.emojisEnabled !== false
  });
  targetSocket.to(roomId).emit('zoom:user-joined', { socketId: targetSocket.id, name: userName });
  io.to(roomId).emit('zoom:participants-update', { participants: getParticipants(room) });
  broadcastRooms();
  if (room.polls && room.polls.size > 0) targetSocket.emit('zoom:polls-state', { polls: pollsToArray(room.polls) });
  if (room.qa && room.qa.enabled) targetSocket.emit('zoom:qa-state', { enabled: true, requireApproval: room.qa.requireApproval, questions: room.qa.questions.filter(q => q.approved) });
  if (room.timer && room.timer.active) targetSocket.emit('zoom:timer-state', { active: true, endTime: room.timer.endTime });
  if (room.raisedHands && room.raisedHands.size > 0) {
    const hands = [];
    room.raisedHands.forEach(sid => { const u = room.users.get(sid); if (u) hands.push({ socketId: sid, name: u.name }); });
    if (hands.length) targetSocket.emit('zoom:hands-state', { hands });
  }
}

function handleUserLeave(socket, roomId) {
  const room = zoomRooms.get(roomId); if (!room) return;
  room.users.delete(socket.id);
  room.waitingRoom.delete(socket.id);
  if (room.raisedHands) room.raisedHands.delete(socket.id);
  socket.leave(roomId);
  if (room.screenShareSocketId === socket.id) {
    room.screenShareSocketId = null;
    io.to(roomId).emit('zoom:screen-share-stopped', { socketId: socket.id });
  }
  socket.to(roomId).emit('zoom:user-left', { socketId: socket.id });
  if (socket.id === room.hostSocketId && room.users.size > 0) {
    let newHost = null;
    for (const [sid, u] of room.users.entries()) { if (u.isCoHost) { newHost = sid; break; } }
    if (!newHost) newHost = room.users.keys().next().value;
    room.hostSocketId = newHost;
    if (room.users.has(newHost)) room.users.get(newHost).isCoHost = false;
    io.to(newHost).emit('zoom:role-changed', { role: 'host' });
    io.to(roomId).emit('zoom:participants-update', { participants: getParticipants(room) });
  } else if (room.users.size === 0) {
    if (room.permanent) {
      room._empty = true;
      if (room.timer && room.timer.timeout) { clearTimeout(room.timer.timeout); room.timer.active = false; }
    } else {
      if (room.timer && room.timer.timeout) clearTimeout(room.timer.timeout);
      if (room.breakout && room.breakout.timer) clearTimeout(room.breakout.timer);
      zoomRooms.delete(roomId);
    }
  } else {
    io.to(roomId).emit('zoom:participants-update', { participants: getParticipants(room) });
  }
  broadcastRooms();
}

function pollsToArray(pollsMap) {
  const arr = [];
  pollsMap.forEach((p, id) => {
    const counts = new Array(p.options.length).fill(0);
    p.votes.forEach(idx => counts[idx]++);
    arr.push({ id, question: p.question, options: p.options, counts, totalVotes: p.votes.size, closed: p.closed });
  });
  return arr;
}

function breakoutToArray(roomsMap) {
  const arr = [];
  roomsMap.forEach((br, id) => arr.push({ id, name: br.name, participants: Array.from(br.participants) }));
  return arr;
}

function closeBreakoutRooms(room, roomId) {
  room.breakout.active = false;
  // Collect breakout participant sids BEFORE clearing the rooms
  const breakoutSids = new Set();
  room.breakout.rooms.forEach(br => {
    br.participants.forEach(sid => {
      breakoutSids.add(sid);
      io.to(sid).emit('zoom:return-to-main', { mainRoomId: roomId });
    });
  });
  room.breakout.rooms.clear();
  // Send zoom:breakout-closed ONLY to users physically in the main room socket.io room.
  // Checking room.users alone is not enough — a participant can be in room.users but
  // also in breakoutSids (they joined the main room first then moved to breakout).
  // Using s.rooms.has(roomId) ensures we only notify sockets that are truly in the
  // main Socket.IO room right now, preventing onReturnToMain from firing twice.
  room.users.forEach((u, sid) => {
    if (!breakoutSids.has(sid)) {
      const s = io.sockets.sockets.get(sid);
      if (s && s.rooms.has(roomId)) {
        io.to(sid).emit('zoom:breakout-closed');
      }
    }
  });
}

// ── Debug: wrap socket handlers with try/catch ────────────────────────────────
/**
 * Returns a wrapped version of `handler` that catches any thrown error,
 * logs it to the server console with full stack, and emits a
 * `debug:server-error` event back to the originating socket.
 */
function wrapHandler(socket, eventName, handler) {
  const isAsync = handler.constructor.name === 'AsyncFunction';
  if (isAsync) {
    return async function (...args) {
      try {
        await handler(...args);
      } catch (err) {
        console.error(`[debug] Socket event error [${eventName}]:`, err);
        socket.emit('debug:server-error', {
          event: eventName,
          error: err.message,
          stack: err.stack || null
        });
      }
    };
  }
  return function (...args) {
    try {
      handler(...args);
    } catch (err) {
      console.error(`[debug] Socket event error [${eventName}]:`, err);
      socket.emit('debug:server-error', {
        event: eventName,
        error: err.message,
        stack: err.stack || null
      });
    }
  };
}

// ── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  // Patch socket.on so every handler is automatically wrapped with try/catch.
  // We skip 'disconnect' (handled separately) and 'debug:*' events.
  const _origSocketOn = socket.on.bind(socket);
  socket.on = function (event, handler) {
    if (typeof handler === 'function' && event !== 'disconnect' && !event.startsWith('debug:')) {
      return _origSocketOn(event, wrapHandler(socket, event, handler));
    }
    return _origSocketOn(event, handler);
  };

  socket.on('zoom:get-rooms', () => {
    const list = [];
    zoomRooms.forEach((r, id) => { if (!r._empty) list.push({ roomId: id, name: r.name, participants: r.users.size }); });
    socket.emit('zoom:rooms-list', list);
  });

  socket.on('zoom:get-create-permission', async () => {
    try {
      const s = await SystemSettings.findOne({ key: 'main' });
      socket.emit('zoom:create-permission', { locked: s ? s.lockMeetingCreation : false });
    } catch { socket.emit('zoom:create-permission', { locked: false }); }
  });

  socket.on('zoom:create-room', async ({ roomId, roomName, userName, userId, userRole, meetingType, settings }) => {
    try {
      const s = await SystemSettings.findOne({ key: 'main' });
      if (s && s.lockMeetingCreation && userRole !== 'admin') {
        socket.emit('zoom:error', { message: 'יצירת פגישות נעולה על ידי מנהל המערכת' }); return;
      }
    } catch { }

    const existingRoom = zoomRooms.get(roomId);
    if (existingRoom && existingRoom.permanent && existingRoom._empty) {
      existingRoom._empty = false;
      existingRoom.hostSocketId = socket.id;
      existingRoom.users.set(socket.id, { name: userName, userId, userRole: userRole || 'user', isCoHost: false, audioOn: true, videoOn: true });
      socket.join(roomId);
      socket.emit('zoom:room-created', { roomId, roomName: existingRoom.name, permissions: existingRoom.permissions, settings: existingRoom.settings });
      existingRoom.waitingRoom.forEach((w, wsid) => {
        const ws = io.sockets.sockets.get(wsid);
        if (ws && !(existingRoom.settings && existingRoom.settings.requireAdminApproval)) {
          existingRoom.waitingRoom.delete(wsid);
          admitUser(ws, existingRoom, roomId, w.name, w.userId);
        }
      });
      if (existingRoom.settings && existingRoom.settings.requireAdminApproval) notifyWaitingUpdate(existingRoom);
      broadcastRooms(); return;
    }

    const room = {
      name: roomName, hostSocketId: socket.id, hostUserId: userId,
      users: new Map([[socket.id, { name: userName, userId, userRole: userRole || 'user', isCoHost: false, audioOn: true, videoOn: true }]]),
      waitingRoom: new Map(), whitelist: new Set(),
      screenShareSocketId: null, chatMode: 'everyone',
      permissions: { allowMic: true, allowCamera: true, allowScreenShare: true },
      meetingType: meetingType || 'instant', permanent: meetingType === 'permanent', _empty: false,
      settings: settings || { requireAdminApproval: false, allowEntryBeforeHost: false },
      breakout: { active: false, rooms: new Map(), timer: null },
      polls: new Map(), qa: { enabled: false, requireApproval: false, questions: [] },
      timer: { active: false, endTime: null, timeout: null },
      raisedHands: new Set(), emojisEnabled: true
    };
    zoomRooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('zoom:room-created', { roomId, roomName, permissions: room.permissions, settings: room.settings, emojisEnabled: true });
    broadcastRooms();
  });

  socket.on('zoom:request-join', async ({ roomId, userName, userId, userRole }) => {
    let room = zoomRooms.get(roomId);

    if (!room || room._empty) {
      try {
        const meeting = await Meeting.findOne({ roomId, type: 'permanent' });
        if (meeting) {
          const sysSettings = await SystemSettings.findOne({ key: 'main' });
          const allowBefore = meeting.settings.allowEntryBeforeHost || (sysSettings && sysSettings.allowEntryBeforeHost);
          if (allowBefore) {
            if (!room) {
              room = {
                name: meeting.title, hostSocketId: null, hostUserId: meeting.hostId.toString(),
                users: new Map(), waitingRoom: new Map(), whitelist: new Set(),
                screenShareSocketId: null, chatMode: 'everyone',
                permissions: { allowMic: true, allowCamera: true, allowScreenShare: true },
                meetingType: 'permanent', permanent: true, _empty: true,
                settings: meeting.settings,
                breakout: { active: false, rooms: new Map(), timer: null },
                polls: new Map(), qa: { enabled: false, requireApproval: false, questions: [] },
                timer: { active: false, endTime: null, timeout: null },
                raisedHands: new Set()
              };
              zoomRooms.set(roomId, room);
            }
            room.waitingRoom.set(socket.id, { socketId: socket.id, name: userName, userId });
            socket.emit('zoom:waiting', { roomName: room.name, waitingForHost: true });
            return;
          } else {
            socket.emit('zoom:error', { message: 'המארח טרם פתח את הפגישה' }); return;
          }
        }
      } catch { }
      socket.emit('zoom:error', { message: 'החדר לא נמצא' }); return;
    }

    // Original host reconnecting after crash — restore host status
    if (userId && room.hostUserId && String(userId) === String(room.hostUserId) && !room.users.has(socket.id)) {
      const prevHostSid = room.hostSocketId;
      room.hostSocketId = socket.id;
      // Demote the temporary host back to regular participant
      if (prevHostSid && prevHostSid !== socket.id && room.users.has(prevHostSid)) {
        room.users.get(prevHostSid).isCoHost = false;
        io.to(prevHostSid).emit('zoom:role-changed', { role: 'participant' });
      }
    }

    // User already in room (e.g. host/cohost returning from breakout) — resend room-joined with correct role
    if (room.users.has(socket.id)) {
      const isHostUser = socket.id === room.hostSocketId;
      const u = room.users.get(socket.id);
      // Exclude participants who are currently in breakout rooms so the returning
      // host only reconnects to people actually in the main room
      const breakoutSids = new Set();
      if (room.breakout && room.breakout.active) {
        room.breakout.rooms.forEach(br => br.participants.forEach(sid => breakoutSids.add(sid)));
      }
      const existingUsers = [];
      room.users.forEach((ru, sid) => {
        if (sid !== socket.id && !breakoutSids.has(sid)) existingUsers.push({ socketId: sid, name: ru.name, isCoHost: ru.isCoHost, isHost: sid === room.hostSocketId });
      });
      socket.join(roomId);
      socket.emit('zoom:room-joined', {
        roomId, roomName: room.name, existingUsers, isHost: isHostUser,
        chatMode: room.chatMode || 'everyone',
        permissions: room.permissions || { allowMic: true, allowCamera: true, allowScreenShare: true },
        settings: room.settings || {}, emojisEnabled: room.emojisEnabled !== false
      });
      io.to(roomId).emit('zoom:participants-update', { participants: getParticipants(room) });
      broadcastRooms(); return;
    }

    if (room.settings && room.settings.requireAdminApproval) {
      room.waitingRoom.set(socket.id, { socketId: socket.id, name: userName, userId, userRole: userRole || 'user' });
      socket.emit('zoom:waiting', { roomName: room.name });
      notifyWaitingUpdate(room); return;
    }
    admitUser(socket, room, roomId, userName, userId, userRole);
  });

  socket.on('zoom:approve-join', ({ roomId, targetSocketId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    const w = room.waitingRoom.get(targetSocketId); if (!w) return;
    room.waitingRoom.delete(targetSocketId);
    const ts = io.sockets.sockets.get(targetSocketId);
    if (ts) admitUser(ts, room, roomId, w.name, w.userId, w.userRole);
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
    const ts = io.sockets.sockets.get(targetSocketId);
    if (ts) handleUserLeave(ts, roomId);
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

  socket.on('zoom:update-meeting-settings', ({ roomId, settings }) => {
    const room = zoomRooms.get(roomId);
    if (!room) return;
    const user = room.users.get(socket.id);
    const isAdminUser = user && user.userRole === 'admin';
    if (!isHostOrCoHost(socket.id, room) && !isAdminUser) return;
    // Only system admins can change allowEntryBeforeHost
    const update = { ...settings };
    if (!isAdminUser && 'allowEntryBeforeHost' in update) delete update.allowEntryBeforeHost;
    room.settings = { ...room.settings, ...update };
    io.to(roomId).emit('zoom:settings-updated', { settings: room.settings });
    if (room.permanent) {
      Meeting.findOneAndUpdate({ roomId }, { settings: room.settings }).catch(() => {});
    }
  });

  socket.on('zoom:chat-message', ({ roomId, text }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    const user = room.users.get(socket.id); if (!user) return;
    if (room.chatMode === 'host-only' && !isHostOrCoHost(socket.id, room)) return;
    io.to(roomId).emit('zoom:chat-message', { from: user.name, text, ts: Date.now(), fromSocketId: socket.id });
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
    if (room.timer && room.timer.timeout) clearTimeout(room.timer.timeout);
    if (room.breakout && room.breakout.timer) clearTimeout(room.breakout.timer);
    if (room.permanent) {
      room._empty = true;
      room.users.clear();
      room.waitingRoom.clear();
    } else {
      zoomRooms.delete(roomId);
      Meeting.findOneAndUpdate({ roomId, type: { $ne: 'permanent' } }, { status: 'ended' }).catch(() => {});
    }
    broadcastRooms();
  });

  socket.on('zoom:admin-close', ({ roomId }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    io.to(roomId).emit('zoom:meeting-ended', { reason: 'admin' });
    if (room.timer && room.timer.timeout) clearTimeout(room.timer.timeout);
    zoomRooms.delete(roomId); broadcastRooms();
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

  socket.on('zoom:media-state', ({ roomId, audioOn, videoOn }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    const user = room.users.get(socket.id); if (!user) return;
    user.audioOn = audioOn; user.videoOn = videoOn;
    io.to(roomId).emit('zoom:participants-update', { participants: getParticipants(room) });
  });

  socket.on('zoom:offer',         ({ targetSocketId, offer, fromName }) => io.to(targetSocketId).emit('zoom:offer',         { fromSocketId: socket.id, fromName, offer }));
  socket.on('zoom:answer',        ({ targetSocketId, answer })          => io.to(targetSocketId).emit('zoom:answer',        { fromSocketId: socket.id, answer }));
  socket.on('zoom:ice-candidate', ({ targetSocketId, candidate })       => io.to(targetSocketId).emit('zoom:ice-candidate', { fromSocketId: socket.id, candidate }));

  socket.on('zoom:leave-room', ({ roomId }) => handleUserLeave(socket, roomId));
  socket.on('disconnect', () => {
    zoomRooms.forEach((room, roomId) => {
      if (room.users.has(socket.id) || room.waitingRoom.has(socket.id)) handleUserLeave(socket, roomId);
    });
  });

  // ── Breakout Rooms ───────────────────────────────────────────────────────
  socket.on('zoom:create-breakout-rooms', ({ roomId, count }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    if (room.breakout && room.breakout.timer) clearTimeout(room.breakout.timer);
    room.breakout = { active: false, rooms: new Map(), timer: null };
    for (let i = 1; i <= Math.min(count, 50); i++) room.breakout.rooms.set(`br-${i}`, { name: `חדר ${i}`, participants: new Set() });
    socket.emit('zoom:breakout-rooms-created', { rooms: breakoutToArray(room.breakout.rooms), participants: getParticipants(room) });
  });

  socket.on('zoom:assign-breakout', ({ roomId, targetSocketId, brId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    room.breakout.rooms.forEach(br => br.participants.delete(targetSocketId));
    if (brId) {
      const br = room.breakout.rooms.get(brId);
      if (br) br.participants.add(targetSocketId);
    }
    // Emit updated rooms + full participant list so client can show unassigned pool
    socket.emit('zoom:breakout-rooms-updated', { rooms: breakoutToArray(room.breakout.rooms), participants: getParticipants(room) });
  });

  socket.on('zoom:random-assign-breakout', ({ roomId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    const participants = Array.from(room.users.keys()).filter(sid => sid !== room.hostSocketId);
    for (let i = participants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [participants[i], participants[j]] = [participants[j], participants[i]];
    }
    const keys = Array.from(room.breakout.rooms.keys());
    room.breakout.rooms.forEach(br => br.participants.clear());
    participants.forEach((sid, idx) => room.breakout.rooms.get(keys[idx % keys.length]).participants.add(sid));
    socket.emit('zoom:breakout-rooms-updated', { rooms: breakoutToArray(room.breakout.rooms), participants: getParticipants(room) });
  });

  socket.on('zoom:launch-breakout-rooms', ({ roomId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    room.breakout.active = true;
    room.breakout.rooms.forEach((br, brId) => {
      const peers = Array.from(br.participants).map(s => ({ socketId: s, name: room.users.get(s)?.name || 'משתתף' }));
      br.participants.forEach(targetSid => {
        io.to(targetSid).emit('zoom:move-to-breakout', {
          brRoomId: `${roomId}__${brId}`, brName: br.name, mainRoomId: roomId,
          peers: peers.filter(p => p.socketId !== targetSid)
        });
      });
    });
    socket.emit('zoom:breakout-launched', { rooms: breakoutToArray(room.breakout.rooms) });
  });

  socket.on('zoom:close-breakout-rooms', ({ roomId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    if (room.breakout.timer) { clearTimeout(room.breakout.timer); room.breakout.timer = null; }
    closeBreakoutRooms(room, roomId);
  });

  socket.on('zoom:set-breakout-timer', ({ roomId, seconds }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    if (room.breakout.timer) clearTimeout(room.breakout.timer);
    io.to(roomId).emit('zoom:breakout-timer-started', { seconds, endsAt: Date.now() + seconds * 1000 });
    room.breakout.timer = setTimeout(() => closeBreakoutRooms(room, roomId), seconds * 1000);
  });

  socket.on('zoom:navigate-breakout', ({ roomId, brId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    const br = room.breakout.rooms.get(brId); if (!br) return;
    socket.emit('zoom:breakout-nav-response', {
      brRoomId: `${roomId}__${brId}`, brName: br.name, mainRoomId: roomId,
      peers: Array.from(br.participants).map(s => ({ socketId: s, name: room.users.get(s)?.name || 'משתתף' }))
    });
  });

  // ── Polls ────────────────────────────────────────────────────────────────
  socket.on('zoom:create-poll', ({ roomId, question, options }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    const pollId = genId();
    room.polls.set(pollId, { question, options, votes: new Map(), closed: false });
    io.to(roomId).emit('zoom:poll-created', { id: pollId, question, options, counts: new Array(options.length).fill(0), totalVotes: 0, closed: false });
  });

  socket.on('zoom:vote-poll', ({ roomId, pollId, optionIndex }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    const poll = room.polls.get(pollId); if (!poll || poll.closed) return;
    poll.votes.set(socket.id, optionIndex);
    const counts = new Array(poll.options.length).fill(0);
    poll.votes.forEach(idx => counts[idx]++);
    io.to(roomId).emit('zoom:poll-updated', { id: pollId, counts, totalVotes: poll.votes.size });
  });

  socket.on('zoom:close-poll', ({ roomId, pollId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    const poll = room.polls.get(pollId); if (!poll) return;
    poll.closed = true;
    const counts = new Array(poll.options.length).fill(0);
    poll.votes.forEach(idx => counts[idx]++);
    io.to(roomId).emit('zoom:poll-closed', { id: pollId, counts, totalVotes: poll.votes.size });
  });

  socket.on('zoom:delete-poll', ({ roomId, pollId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    room.polls.delete(pollId);
    io.to(roomId).emit('zoom:poll-deleted', { id: pollId });
  });

  // ── Q&A ─────────────────────────────────────────────────────────────────
  socket.on('zoom:set-qa', ({ roomId, enabled, requireApproval }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    room.qa.enabled = enabled;
    if (requireApproval !== undefined) room.qa.requireApproval = requireApproval;
    if (!enabled) room.qa.questions = [];
    io.to(roomId).emit('zoom:qa-state', { enabled, requireApproval: room.qa.requireApproval, questions: enabled ? room.qa.questions.filter(q => q.approved) : [] });
  });

  socket.on('zoom:submit-question', ({ roomId, question }) => {
    const room = zoomRooms.get(roomId); if (!room || !room.qa.enabled) return;
    const user = room.users.get(socket.id); if (!user) return;
    const q = { id: genId(), question, authorName: user.name, authorSocketId: socket.id, approved: !room.qa.requireApproval, submittedAt: Date.now() };
    room.qa.questions.push(q);
    if (room.qa.requireApproval) {
      const targets = [room.hostSocketId, ...Array.from(room.users.entries()).filter(([, u]) => u.isCoHost).map(([s]) => s)];
      targets.forEach(sid => io.to(sid).emit('zoom:question-pending', { question: q }));
      socket.emit('zoom:question-submitted', { pending: true });
    } else {
      io.to(roomId).emit('zoom:question-published', { question: q });
    }
  });

  socket.on('zoom:approve-question', ({ roomId, questionId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    const q = room.qa.questions.find(q => q.id === questionId); if (!q) return;
    q.approved = true;
    io.to(roomId).emit('zoom:question-published', { question: q });
  });

  socket.on('zoom:reject-question', ({ roomId, questionId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    room.qa.questions = room.qa.questions.filter(q => q.id !== questionId);
    socket.emit('zoom:question-rejected', { questionId });
  });

  // ── Countdown Timer ──────────────────────────────────────────────────────
  socket.on('zoom:start-timer', ({ roomId, seconds }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    if (room.timer.timeout) clearTimeout(room.timer.timeout);
    const endTime = Date.now() + seconds * 1000;
    room.timer = { active: true, endTime, timeout: null };
    io.to(roomId).emit('zoom:timer-started', { seconds, endTime });
    room.timer.timeout = setTimeout(() => {
      room.timer.active = false; room.timer.timeout = null;
      io.to(roomId).emit('zoom:timer-ended');
    }, seconds * 1000);
  });

  socket.on('zoom:cancel-timer', ({ roomId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    if (room.timer.timeout) { clearTimeout(room.timer.timeout); room.timer.timeout = null; }
    room.timer.active = false;
    io.to(roomId).emit('zoom:timer-cancelled');
  });

  // ── Raise Hand ───────────────────────────────────────────────────────
  socket.on('zoom:raise-hand', ({ roomId }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    const user = room.users.get(socket.id); if (!user) return;
    if (!room.raisedHands) room.raisedHands = new Set();
    room.raisedHands.add(socket.id);
    io.to(roomId).emit('zoom:hand-raised', { socketId: socket.id, name: user.name });
  });

  socket.on('zoom:lower-hand', ({ roomId }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    if (room.raisedHands) room.raisedHands.delete(socket.id);
    io.to(roomId).emit('zoom:hand-lowered', { socketId: socket.id });
  });

  socket.on('zoom:lower-all-hands', ({ roomId }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    if (room.raisedHands) room.raisedHands.clear();
    io.to(roomId).emit('zoom:all-hands-lowered');
  });

  // ── Help Request (from breakout) ─────────────────────────────────────
  socket.on('zoom:help-request', ({ roomId, brRoomId }) => {
    const room = zoomRooms.get(roomId); if (!room) return;
    const user = room.users.get(socket.id); if (!user) return;
    const targets = [room.hostSocketId, ...Array.from(room.users.entries()).filter(([, u]) => u.isCoHost).map(([s]) => s)];
    targets.forEach(sid => { if (sid) io.to(sid).emit('zoom:help-requested', { fromName: user.name, brRoomId, fromSocketId: socket.id }); });
  });

  // ── Toggle Emojis ────────────────────────────────────────────────────
  socket.on('zoom:toggle-emojis', ({ roomId, enabled }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    room.emojisEnabled = !!enabled;
    io.to(roomId).emit('zoom:emojis-toggled', { enabled: room.emojisEnabled });
  });

  // ── Broadcast to Breakout Rooms ──────────────────────────────────────
  socket.on('zoom:broadcast-to-breakout', ({ roomId, message }) => {
    const room = zoomRooms.get(roomId);
    if (!room || !isHostOrCoHost(socket.id, room)) return;
    const user = room.users.get(socket.id);
    const from = user ? user.name : 'מארח';
    const ts = Date.now();
    // Send directly to each participant socket ID (breakout rooms aren't socket.io rooms)
    room.breakout.rooms.forEach(br => {
      br.participants.forEach(sid => io.to(sid).emit('zoom:breakout-broadcast', { from, message, ts }));
    });
    socket.emit('zoom:breakout-broadcast', { from, message, ts });
  });

  // ── Switch Breakout Room (participant self-move) ──────────────────────
  socket.on('zoom:switch-breakout-room', ({ roomId, newBrId }) => {
    const room = zoomRooms.get(roomId); if (!room || !room.breakout.active) return;
    const newBr = room.breakout.rooms.get(newBrId); if (!newBr) return;
    room.breakout.rooms.forEach(br => br.participants.delete(socket.id));
    newBr.participants.add(socket.id);
    const peers = Array.from(newBr.participants)
      .filter(s => s !== socket.id)
      .map(s => ({ socketId: s, name: room.users.get(s)?.name || 'משתתף' }));
    socket.emit('zoom:move-to-breakout', {
      brRoomId: `${roomId}__${newBrId}`, brName: newBr.name, mainRoomId: roomId, peers
    });
  });

  // ── Debug: ping / room state summary ─────────────────────────────────
  _origSocketOn('debug:ping', () => {
    // Find which room this socket is in
    let roomSummary = null;
    zoomRooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        roomSummary = {
          roomId,
          roomName: room.name,
          usersCount: room.users.size,
          waitingCount: room.waitingRoom.size,
          hostSocketId: room.hostSocketId,
          isBreakoutActive: room.breakout ? room.breakout.active : false,
          breakoutRoomsCount: room.breakout ? room.breakout.rooms.size : 0,
          permanent: room.permanent || false,
          chatMode: room.chatMode,
          emojisEnabled: room.emojisEnabled !== false,
          timerActive: room.timer ? room.timer.active : false
        };
      }
    });
    socket.emit('debug:pong', {
      socketId: socket.id,
      totalRooms: zoomRooms.size,
      room: roomSummary,
      serverTime: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
});

// ── Middleware & Routes ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'client')));

const authenticateToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, email: decoded.email, role: decoded.role };
    next();
  } catch { return res.status(403).json({ error: 'Invalid token' }); }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'כל השדות נדרשים' });
    if (await User.findOne({ email })) return res.status(400).json({ error: 'האימייל כבר קיים במערכת' });
    const user = await new User({ name, email, password: await bcrypt.hash(password, 10) }).save();
    const token = jwt.sign({ userId: user._id, email, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user._id, name, email, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({ error: 'אימייל או סיסמה שגויים' });
    const token = jwt.sign({ userId: user._id, email, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/validate', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.userId).select('-password');
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (name) user.name = name;
    if (newPassword) {
      if (!currentPassword || !await bcrypt.compare(currentPassword, user.password))
        return res.status(400).json({ error: 'הסיסמה הנוכחית שגויה' });
      user.password = await bcrypt.hash(newPassword, 10);
    }
    await user.save();
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/auth/account', authenticateToken, async (req, res) => {
  await User.findByIdAndDelete(req.user.userId);
  await Meeting.deleteMany({ hostId: req.user.userId });
  res.json({ message: 'החשבון נמחק' });
});

app.get('/api/users/search', authenticateToken, async (req, res) => {
  const q = req.query.q || '';
  const users = await User.find({ name: { $regex: q, $options: 'i' } }).select('_id name').limit(10);
  res.json(users);
});

app.get('/api/meetings', authenticateToken, async (req, res) => {
  const meetings = await Meeting.find({ hostId: req.user.userId, status: { $ne: 'ended' } }).sort({ createdAt: -1 });
  res.json(meetings);
});

app.post('/api/meetings', authenticateToken, async (req, res) => {
  try {
    const { title, type, scheduledAt, settings } = req.body;
    const sysSettings = await SystemSettings.findOne({ key: 'main' });
    if (sysSettings && sysSettings.lockMeetingCreation && req.user.role !== 'admin')
      return res.status(403).json({ error: 'יצירת פגישות נעולה על ידי מנהל המערכת' });
    const hostUser = await User.findById(req.user.userId);
    const roomId = 'perm-' + genId();
    const meeting = await new Meeting({
      title, hostId: req.user.userId, hostName: hostUser.name,
      type, scheduledAt, roomId,
      settings: settings || { requireAdminApproval: false, allowEntryBeforeHost: false }
    }).save();
    res.json(meeting);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/meetings/:id', authenticateToken, async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Not found' });
  if (meeting.hostId.toString() !== req.user.userId && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Access denied' });
  await Meeting.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

app.get('/api/meetings/by-room/:roomId', async (req, res) => {
  const meeting = await Meeting.findOne({ roomId: req.params.roomId });
  if (!meeting) return res.json(null);
  res.json({ title: meeting.title, hostName: meeting.hostName, type: meeting.type });
});

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json(users);
});

app.put('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const { name, email, role, password } = req.body;
  const update = {};
  if (name) update.name = name;
  if (email) update.email = email;
  if (role) update.role = role;
  if (password) update.password = await bcrypt.hash(password, 10);
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
  res.json(user);
});

app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  if (req.params.id === req.user.userId) return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
  await User.findByIdAndDelete(req.params.id);
  await Meeting.deleteMany({ hostId: req.params.id });
  res.json({ message: 'Deleted' });
});

app.get('/api/admin/meetings/active', authenticateToken, isAdmin, async (req, res) => {
  const active = [];
  zoomRooms.forEach((r, id) => { if (!r._empty) active.push({ roomId: id, name: r.name, participants: r.users.size }); });
  res.json(active);
});

app.post('/api/admin/meetings/:roomId/close', authenticateToken, isAdmin, async (req, res) => {
  const room = zoomRooms.get(req.params.roomId);
  if (room) {
    io.to(req.params.roomId).emit('zoom:meeting-ended', { reason: 'admin' });
    if (room.timer && room.timer.timeout) clearTimeout(room.timer.timeout);
    zoomRooms.delete(req.params.roomId);
    broadcastRooms();
  }
  res.json({ message: 'Closed' });
});

app.get('/api/auth/backgrounds', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.userId).select('customBackgrounds');
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user.customBackgrounds || []);
});

app.post('/api/auth/backgrounds', authenticateToken, async (req, res) => {
  try {
    const { dataUrl } = req.body;
    if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });
    const user = await User.findById(req.user.userId);
    if (!user.customBackgrounds) user.customBackgrounds = [];
    if (user.customBackgrounds.length >= 10) user.customBackgrounds.shift();
    user.customBackgrounds.push(dataUrl);
    await user.save();
    res.json(user.customBackgrounds);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/auth/backgrounds/:idx', authenticateToken, async (req, res) => {
  try {
    const idx = parseInt(req.params.idx);
    const user = await User.findById(req.user.userId);
    if (!user.customBackgrounds || idx < 0 || idx >= user.customBackgrounds.length)
      return res.status(400).json({ error: 'Invalid index' });
    user.customBackgrounds.splice(idx, 1);
    await user.save();
    res.json(user.customBackgrounds);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/settings', authenticateToken, isAdmin, async (req, res) => {
  const settings = await SystemSettings.findOneAndUpdate({ key: 'main' }, {}, { upsert: true, new: true });
  res.json(settings);
});

app.put('/api/admin/settings', authenticateToken, isAdmin, async (req, res) => {
  const settings = await SystemSettings.findOneAndUpdate({ key: 'main' }, req.body, { new: true, upsert: true });
  res.json(settings);
});

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await createDefaultUsers();
    await SystemSettings.findOneAndUpdate({ key: 'main' }, {}, { upsert: true, new: true });
  })
  .catch(err => console.error('❌ MongoDB error:', err));

async function createDefaultUsers() {
  const admins = [
    { name: 'יאיר פריש', email: 'yairfrish2@gmail.com', password: 'yair12345' },
    { name: 'יאיר פרץ',  email: 'przyyryair@gmail.com',  password: 'yair2589'  }
  ];
  for (const a of admins) {
    if (!await User.findOne({ email: a.email })) {
      await new User({ name: a.name, email: a.email, password: await bcrypt.hash(a.password, 10), role: 'admin' }).save();
      console.log(`✅ Admin created: ${a.name}`);
    }
  }
}

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'client', 'index.html')));

httpServer.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on port ${PORT}`));
