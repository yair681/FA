// ===== Zoom / WebRTC Manager =====
class ZoomManager {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.screenStream = null;
        this.peers = new Map();        // socketId => RTCPeerConnection
        this.audioAnalyzers = new Map(); // socketId => { ctx, analyzer, raf }
        this.currentRoomId = null;
        this.userName = '';
        this.userId = '';
        this.userRole = '';
        this.isHost = false;
        this.isCoHost = false;
        this.isAudioOn = true;
        this.isVideoOn = true;
        this.isScreenSharing = false;
        this.screenShareSocketId = null;

        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    init(userName, userId, userRole) {
        this.userName = userName;
        this.userId   = userId;
        this.userRole = userRole || 'student';

        if (this.socket) { this.socket.disconnect(); this.socket = null; }

        this.setStatus('מתחבר...');

        const base = window.dbManager ? window.dbManager.API_BASE : window.location.origin + '/api';
        const serverUrl = base.replace('/api', '');
        console.log('🔌 Zoom connecting to:', serverUrl);

        this.socket = io(serverUrl, { transports: ['polling', 'websocket'], reconnectionAttempts: 5 });

        this.socket.on('connect', () => {
            console.log('✅ Zoom socket:', this.socket.id);
            this.setStatus('מחובר');
            this.socket.emit('zoom:get-create-permission');
            this.loadRoomsList();
        });
        this.socket.on('connect_error', e => this.setStatus('שגיאת חיבור: ' + e.message));
        this.socket.on('disconnect', () => this.setStatus('מנותק'));

        this.socket.on('zoom:rooms-list',        d => this.renderRoomsList(d));
        this.socket.on('zoom:create-permission', d => this.applyCreatePermission(d.permission));
        this.socket.on('zoom:room-created',      d => this.onRoomCreated(d));
        this.socket.on('zoom:room-joined',       d => this.onRoomJoined(d));
        this.socket.on('zoom:user-joined',       d => this.onUserJoined(d));
        this.socket.on('zoom:user-left',         d => this.onUserLeft(d));
        this.socket.on('zoom:waiting',           d => this.onWaiting(d));
        this.socket.on('zoom:waiting-update',    d => this.renderWaitingList(d.waitingList));
        this.socket.on('zoom:denied',            () => this.onDenied());
        this.socket.on('zoom:kicked',            () => this.onKicked());
        this.socket.on('zoom:meeting-ended',     d => this.onMeetingEnded(d));
        this.socket.on('zoom:participants-update', d => this.renderParticipants(d.participants));
        this.socket.on('zoom:role-changed',      d => this.onRoleChanged(d));
        this.socket.on('zoom:screen-share-started', d => this.onRemoteScreenShareStarted(d));
        this.socket.on('zoom:screen-share-stopped', d => this.onRemoteScreenShareStopped(d));
        this.socket.on('zoom:offer',             d => this.onOffer(d));
        this.socket.on('zoom:answer',            d => this.onAnswer(d));
        this.socket.on('zoom:ice-candidate',     d => this.onIceCandidate(d));
        this.socket.on('zoom:error',             d => { alert('שגיאה: ' + d.message); });
        this.socket.on('zoom:whitelist-updated', () => { alert('הרשימה הלבנה עודכנה'); });
    }

    // ── Status / Permission ───────────────────────────────────────────────────
    setStatus(msg) {
        const el = document.getElementById('zoom-connection-status');
        if (!el) return;
        el.textContent = msg;
        el.style.color = msg === 'מחובר' ? 'var(--secondary)' : msg.includes('שגיאה') ? 'var(--danger)' : 'var(--warning)';
    }

    applyCreatePermission(permission) {
        const btn = document.getElementById('zoom-create-btn');
        if (!btn) return;
        const canCreate = permission === 'all' || this.userRole === 'teacher' || this.userRole === 'admin';
        btn.style.display = canCreate ? 'inline-block' : 'none';
        const adminSection = document.getElementById('zoom-admin-permission-section');
        if (adminSection) adminSection.style.display = this.userRole === 'admin' ? 'block' : 'none';
        const permSelect = document.getElementById('zoom-permission-select');
        if (permSelect) permSelect.value = permission;
    }

    setCreatePermission(permission) {
        if (!this.socket) return;
        this.socket.emit('zoom:set-create-permission', { permission });
    }

    loadRoomsList() {
        if (this.socket && this.socket.connected) this.socket.emit('zoom:get-rooms');
    }

    renderRoomsList(rooms) {
        const el = document.getElementById('zoom-rooms-list');
        if (!el) return;
        if (!rooms.length) { el.innerHTML = '<p class="zoom-no-rooms">אין חדרי שיחה פעילים</p>'; return; }
        el.innerHTML = rooms.map(r => `
            <div class="zoom-room-card">
                <div class="zoom-room-info">
                    <i class="fas fa-video"></i>
                    <span class="zoom-room-name">${r.name}</span>
                    <span class="zoom-room-count"><i class="fas fa-users"></i> ${r.participants}</span>
                </div>
                <button class="btn btn-secondary zoom-join-btn" onclick="zoomManager.requestJoin('${r.roomId}')">הצטרף</button>
                ${this.userRole === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="zoomManager.adminClose('${r.roomId}')" style="margin-right:0.5rem;">סגור</button>` : ''}
            </div>`).join('');
    }

    // ── Create / Join ─────────────────────────────────────────────────────────
    async createRoom() {
        if (!this.socket || !this.socket.connected) { alert('לא מחובר. נסה שוב.'); return; }
        const input = document.getElementById('zoom-room-name-input');
        const roomName = input ? input.value.trim() : '';
        if (!roomName) { alert('יש להזין שם לחדר'); return; }
        const roomId = 'room-' + Date.now() + '-' + Math.random().toString(36).substr(2,6);
        await this.startLocalStream();
        this.isHost = true;
        this.socket.emit('zoom:create-room', { roomId, roomName, userName: this.userName, userId: this.userId, userRole: this.userRole });
    }

    async requestJoin(roomId) {
        if (!this.socket || !this.socket.connected) { alert('לא מחובר. נסה שוב.'); return; }
        await this.startLocalStream();
        this.socket.emit('zoom:request-join', { roomId, userName: this.userName, userId: this.userId });
    }

    adminClose(roomId) {
        if (!confirm('לסגור את הפגישה לכולם?')) return;
        this.socket.emit('zoom:admin-close', { roomId });
    }

    // ── Room Events ───────────────────────────────────────────────────────────
    async onRoomCreated({ roomId, roomName }) {
        this.currentRoomId = roomId;
        this.isHost = true;
        this.showCallUI(roomName);
        this.addLocalTile();
        this.updateHostControls();
    }

    async onRoomJoined({ roomId, roomName, existingUsers, isHost }) {
        this.currentRoomId = roomId;
        this.isHost = isHost;
        this.hideWaitingScreen();
        this.showCallUI(roomName);
        this.addLocalTile();
        this.updateHostControls();
        for (const u of existingUsers) {
            this.addRemoteTilePlaceholder(u.socketId, u.name);
            await this.createOffer(u.socketId, u.name);
        }
    }

    async onUserJoined({ socketId, name }) {
        this.addRemoteTilePlaceholder(socketId, name);
        // offer will come from the new user
    }

    onUserLeft({ socketId }) {
        this.closePeer(socketId);
        const tile = document.getElementById('tile-' + socketId);
        if (tile) tile.remove();
        if (this.screenShareSocketId === socketId) this.clearScreenShareDom(socketId);
        this.updateCount();
    }

    onWaiting({ roomName }) {
        document.getElementById('zoom-lobby').style.display = 'none';
        const ws = document.getElementById('zoom-waiting-screen');
        if (ws) {
            ws.style.display = 'flex';
            const t = ws.querySelector('.zoom-waiting-room-name');
            if (t) t.textContent = roomName;
        }
    }

    hideWaitingScreen() {
        const ws = document.getElementById('zoom-waiting-screen');
        if (ws) ws.style.display = 'none';
    }

    onDenied() {
        this.hideWaitingScreen();
        document.getElementById('zoom-lobby').style.display = 'block';
        if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
        alert('בקשתך להצטרף לשיחה נדחתה.');
    }

    onKicked() {
        alert('הוסרת מהשיחה.');
        this.fullReset();
    }

    onMeetingEnded({ reason }) {
        const msg = reason === 'admin' ? 'הפגישה נסגרה על ידי מנהל המערכת.' : 'המארח סיים את הפגישה.';
        if (!this.isHost) alert(msg);
        this.fullReset();
    }

    onRoleChanged({ role }) {
        if (role === 'host') { this.isHost = true; this.isCoHost = false; alert('אתה המארח החדש של הפגישה.'); }
        else if (role === 'cohost') { this.isCoHost = true; alert('הפכת למנהל-שותף של הפגישה.'); }
        else { this.isCoHost = false; }
        this.updateHostControls();
    }

    renderParticipants(participants) {
        const panel = document.getElementById('zoom-participants-panel');
        if (!panel) return;
        const mySocketId = this.socket ? this.socket.id : '';
        panel.innerHTML = participants.map(p => {
            const badge = p.isHost ? '<span class="zoom-badge host">מארח</span>'
                : p.isCoHost ? '<span class="zoom-badge cohost">מנהל-שותף</span>' : '';
            const isMe = p.socketId === mySocketId;
            const canManage = (this.isHost || this.isCoHost) && !isMe && !p.isHost;
            let actions = '';
            if (this.isHost && !isMe && !p.isHost) {
                actions += p.isCoHost
                    ? `<button class="zoom-action-btn" onclick="zoomManager.removeCohost('${p.socketId}')">הסר מנהל</button>`
                    : `<button class="zoom-action-btn" onclick="zoomManager.assignCohost('${p.socketId}')">מנה מנהל</button>`;
            }
            if (canManage) {
                actions += `<button class="zoom-action-btn danger" onclick="zoomManager.kick('${p.socketId}')">הסר משיחה</button>`;
            }
            return `<div class="zoom-participant-row ${isMe ? 'me' : ''}">
                <span class="zoom-participant-name"><i class="fas fa-user"></i> ${p.name} ${badge}</span>
                ${actions ? `<div class="zoom-participant-actions">${actions}</div>` : ''}
            </div>`;
        }).join('');
        this.updateCount(participants.length);
    }

    renderWaitingList(waitingList) {
        const el = document.getElementById('zoom-waiting-list');
        if (!el) return;
        const badge = document.getElementById('zoom-waiting-badge');
        if (badge) { badge.textContent = waitingList.length; badge.style.display = waitingList.length ? 'inline' : 'none'; }
        if (!waitingList.length) { el.innerHTML = '<p style="color:var(--gray);font-size:0.85rem;">אין ממתינים</p>'; return; }
        el.innerHTML = waitingList.map(w => `
            <div class="zoom-waiting-row">
                <span><i class="fas fa-user-clock"></i> ${w.name}</span>
                <div>
                    <button class="zoom-action-btn" onclick="zoomManager.approveJoin('${w.socketId}')">אשר</button>
                    <button class="zoom-action-btn danger" onclick="zoomManager.denyJoin('${w.socketId}')">דחה</button>
                </div>
            </div>`).join('');
    }

    // ── Host Actions ──────────────────────────────────────────────────────────
    approveJoin(targetSocketId) { this.socket.emit('zoom:approve-join', { roomId: this.currentRoomId, targetSocketId }); }
    denyJoin(targetSocketId)    { this.socket.emit('zoom:deny-join',    { roomId: this.currentRoomId, targetSocketId }); }
    kick(targetSocketId)        { if (confirm('להסיר משתתף זה מהשיחה?')) this.socket.emit('zoom:kick', { roomId: this.currentRoomId, targetSocketId }); }
    assignCohost(targetSocketId){ this.socket.emit('zoom:assign-cohost', { roomId: this.currentRoomId, targetSocketId }); }
    removeCohost(targetSocketId){ this.socket.emit('zoom:remove-cohost', { roomId: this.currentRoomId, targetSocketId }); }

    updateWhitelist() {
        const input = document.getElementById('zoom-whitelist-input');
        if (!input) return;
        const ids = input.value.split(',').map(s => s.trim()).filter(Boolean);
        this.socket.emit('zoom:update-whitelist', { roomId: this.currentRoomId, userIds: ids });
    }

    endMeeting() {
        if (!confirm('לסיים את הפגישה לכולם?')) return;
        this.socket.emit('zoom:end-meeting', { roomId: this.currentRoomId });
        this.fullReset();
    }

    updateHostControls() {
        const mgmt = document.getElementById('zoom-management-panel');
        if (mgmt) mgmt.style.display = (this.isHost || this.isCoHost) ? 'flex' : 'none';
        const endBtn = document.getElementById('zoom-end-meeting-btn');
        if (endBtn) endBtn.style.display = this.isHost ? 'inline-flex' : 'none';
        const leaveBtn = document.getElementById('zoom-leave-btn');
        if (leaveBtn) leaveBtn.style.display = this.isHost ? 'none' : 'inline-flex';
        const whitelist = document.getElementById('zoom-whitelist-section');
        if (whitelist) whitelist.style.display = this.isHost ? 'block' : 'none';
    }

    // ── Screen Share ──────────────────────────────────────────────────────────
    async toggleScreenShare() {
        if (this.isScreenSharing) { this.stopScreenShare(); return; }
        try {
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const track = this.screenStream.getVideoTracks()[0];
            this.peers.forEach(pc => {
                const s = pc.getSenders().find(s => s.track?.kind === 'video');
                if (s) s.replaceTrack(track);
            });
            const lv = document.getElementById('local-video');
            if (lv) lv.srcObject = this.screenStream;
            this.isScreenSharing = true;
            this.socket.emit('zoom:screen-share-started', { roomId: this.currentRoomId });
            const btn = document.getElementById('zoom-screen-btn');
            if (btn) { btn.classList.add('active'); btn.title = 'עצור שיתוף'; }
            // Make local tile dominant
            this.setDominantTile('tile-local', true);
            track.onended = () => this.stopScreenShare();
        } catch(e) { if (e.name !== 'NotAllowedError') alert('שגיאה בשיתוף מסך: ' + e.message); }
    }

    stopScreenShare() {
        if (!this.isScreenSharing) return;
        const camTrack = this.localStream?.getVideoTracks()[0];
        this.peers.forEach(pc => {
            const s = pc.getSenders().find(s => s.track?.kind === 'video');
            if (s && camTrack) s.replaceTrack(camTrack);
        });
        const lv = document.getElementById('local-video');
        if (lv && this.localStream) lv.srcObject = this.localStream;
        this.screenStream?.getTracks().forEach(t => t.stop());
        this.screenStream = null;
        this.isScreenSharing = false;
        this.socket.emit('zoom:screen-share-stopped', { roomId: this.currentRoomId });
        const btn = document.getElementById('zoom-screen-btn');
        if (btn) { btn.classList.remove('active'); btn.title = 'שתף מסך'; }
        this.setDominantTile('tile-local', false);
    }

    onRemoteScreenShareStarted({ socketId }) {
        this.screenShareSocketId = socketId;
        this.setDominantTile('tile-' + socketId, true);
    }

    onRemoteScreenShareStopped({ socketId }) {
        this.screenShareSocketId = null;
        this.setDominantTile('tile-' + socketId, false);
    }

    setDominantTile(tileId, dominant) {
        document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('dominant'));
        if (dominant) {
            const t = document.getElementById(tileId);
            if (t) t.classList.add('dominant');
        }
    }

    clearScreenShareDom(socketId) {
        this.screenShareSocketId = null;
        const tile = document.getElementById('tile-' + socketId);
        if (tile) tile.classList.remove('dominant');
    }

    // ── WebRTC ────────────────────────────────────────────────────────────────
    createPeerConnection(socketId, userName) {
        const pc = new RTCPeerConnection(this.iceServers);
        this.peers.set(socketId, pc);

        if (this.localStream) this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream));

        pc.onicecandidate = e => {
            if (e.candidate) this.socket.emit('zoom:ice-candidate', { targetSocketId: socketId, candidate: e.candidate });
        };
        pc.ontrack = e => {
            if (e.streams && e.streams[0]) this.attachRemoteStream(socketId, userName, e.streams[0]);
        };
        pc.onconnectionstatechange = () => {
            if (['failed','disconnected','closed'].includes(pc.connectionState)) this.onUserLeft({ socketId });
        };
        return pc;
    }

    async createOffer(targetSocketId, targetName) {
        const pc = this.createPeerConnection(targetSocketId, targetName);
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        this.socket.emit('zoom:offer', { targetSocketId, offer: pc.localDescription, fromName: this.userName });
    }

    async onOffer({ fromSocketId, fromName, offer }) {
        const pc = this.createPeerConnection(fromSocketId, fromName);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('zoom:answer', { targetSocketId: fromSocketId, answer: pc.localDescription });
    }

    async onAnswer({ fromSocketId, answer }) {
        const pc = this.peers.get(fromSocketId);
        if (pc && pc.signalingState !== 'stable') await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }

    async onIceCandidate({ fromSocketId, candidate }) {
        const pc = this.peers.get(fromSocketId);
        if (pc && candidate) try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
    }

    closePeer(socketId) {
        const pc = this.peers.get(socketId); if (pc) { pc.close(); this.peers.delete(socketId); }
        this.stopAudioAnalyzer(socketId);
    }

    // ── Local Stream ──────────────────────────────────────────────────────────
    async startLocalStream() {
        if (this.localStream) return;
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch(e) {
            try { this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); this.isVideoOn = false; }
            catch(e2) { alert('לא ניתן לגשת למצלמה/מיקרופון'); throw e2; }
        }
    }

    toggleAudio() {
        if (!this.localStream) return;
        this.isAudioOn = !this.isAudioOn;
        this.localStream.getAudioTracks().forEach(t => t.enabled = this.isAudioOn);
        const btn = document.getElementById('zoom-audio-btn');
        if (btn) { btn.innerHTML = `<i class="fas fa-microphone${this.isAudioOn ? '' : '-slash'}"></i>`; btn.classList.toggle('off', !this.isAudioOn); }
    }

    toggleVideo() {
        if (!this.localStream) return;
        this.isVideoOn = !this.isVideoOn;
        this.localStream.getVideoTracks().forEach(t => t.enabled = this.isVideoOn);
        const btn = document.getElementById('zoom-video-btn');
        if (btn) { btn.innerHTML = `<i class="fas fa-video${this.isVideoOn ? '' : '-slash'}"></i>`; btn.classList.toggle('off', !this.isVideoOn); }
        const lv = document.getElementById('local-video');
        if (lv) lv.style.visibility = this.isVideoOn ? 'visible' : 'hidden';
    }

    // ── Audio Analyzer (speaking indicator) ──────────────────────────────────
    startAudioAnalyzer(stream, tileId) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const src = ctx.createMediaStreamSource(stream);
            const analyzer = ctx.createAnalyser();
            analyzer.fftSize = 256;
            src.connect(analyzer);
            const data = new Uint8Array(analyzer.frequencyBinCount);
            const tick = () => {
                analyzer.getByteFrequencyData(data);
                const avg = data.reduce((a,b) => a+b,0) / data.length;
                const tile = document.getElementById(tileId);
                if (tile) tile.classList.toggle('speaking', avg > 12);
                const raf = requestAnimationFrame(tick);
                const entry = this.audioAnalyzers.get(tileId);
                if (entry) entry.raf = raf;
            };
            const raf = requestAnimationFrame(tick);
            this.audioAnalyzers.set(tileId, { ctx, raf });
        } catch(e) {}
    }

    stopAudioAnalyzer(tileIdOrSocketId) {
        const tileId = tileIdOrSocketId.startsWith('tile-') ? tileIdOrSocketId : 'tile-' + tileIdOrSocketId;
        const entry = this.audioAnalyzers.get(tileId);
        if (entry) { cancelAnimationFrame(entry.raf); try { entry.ctx.close(); } catch(e) {} this.audioAnalyzers.delete(tileId); }
    }

    // ── Video Tiles ───────────────────────────────────────────────────────────
    addLocalTile() {
        const grid = document.getElementById('zoom-video-grid');
        if (!grid || document.getElementById('tile-local')) return;
        const tile = this._makeTile('tile-local', 'local-tile', this.userName + ' (אתה)');
        const vid = document.createElement('video');
        vid.id = 'local-video'; vid.autoplay = true; vid.muted = true; vid.playsInline = true;
        tile.insertBefore(vid, tile.firstChild);
        grid.appendChild(tile);
        if (this.localStream) {
            vid.srcObject = this.localStream;
            this.startAudioAnalyzer(this.localStream, 'tile-local');
        }
        this.updateCount();
    }

    addRemoteTilePlaceholder(socketId, name) {
        const grid = document.getElementById('zoom-video-grid');
        if (!grid || document.getElementById('tile-' + socketId)) return;
        const tile = this._makeTile('tile-' + socketId, '', name);
        const avatar = document.createElement('div');
        avatar.className = 'video-avatar'; avatar.innerHTML = '<i class="fas fa-user"></i>';
        tile.insertBefore(avatar, tile.firstChild);
        grid.appendChild(tile);
        this.updateCount();
    }

    attachRemoteStream(socketId, name, stream) {
        let tile = document.getElementById('tile-' + socketId);
        if (!tile) {
            tile = this._makeTile('tile-' + socketId, '', name);
            document.getElementById('zoom-video-grid')?.appendChild(tile);
        }
        // Remove avatar placeholder if present
        const avatar = tile.querySelector('.video-avatar');
        if (avatar) avatar.remove();
        let vid = document.getElementById('video-' + socketId);
        if (!vid) {
            vid = document.createElement('video');
            vid.id = 'video-' + socketId; vid.autoplay = true; vid.playsInline = true;
            tile.insertBefore(vid, tile.firstChild);
        }
        vid.srcObject = stream;
        vid.play().catch(() => {});
        this.startAudioAnalyzer(stream, 'tile-' + socketId);
        this.updateCount();
    }

    _makeTile(id, extraClass, labelText) {
        const tile = document.createElement('div');
        tile.className = 'video-tile' + (extraClass ? ' ' + extraClass : '');
        tile.id = id;
        const label = document.createElement('div');
        label.className = 'video-tile-name';
        label.innerHTML = `<i class="fas fa-user"></i> ${labelText}`;
        tile.appendChild(label);
        return tile;
    }

    updateCount(n) {
        const count = n !== undefined ? n : document.querySelectorAll('.video-tile').length;
        const el = document.getElementById('zoom-participant-count');
        if (el) el.textContent = count + ' משתתפים';
    }

    // ── UI State ──────────────────────────────────────────────────────────────
    showCallUI(roomName) {
        document.getElementById('zoom-lobby').style.display = 'none';
        const c = document.getElementById('zoom-call-container');
        if (c) c.style.display = 'flex';
        const t = document.getElementById('zoom-call-title');
        if (t) t.textContent = roomName;
    }

    showLobbyUI() {
        const c = document.getElementById('zoom-call-container');
        if (c) c.style.display = 'none';
        document.getElementById('zoom-lobby').style.display = 'block';
        document.getElementById('zoom-waiting-screen').style.display = 'none';
        const grid = document.getElementById('zoom-video-grid');
        if (grid) grid.innerHTML = '';
        const pp = document.getElementById('zoom-participants-panel');
        if (pp) pp.innerHTML = '';
        const wl = document.getElementById('zoom-waiting-list');
        if (wl) wl.innerHTML = '';
    }

    leaveRoom() {
        if (this.currentRoomId) this.socket.emit('zoom:leave-room', { roomId: this.currentRoomId });
        this.fullReset();
    }

    fullReset() {
        this.peers.forEach((_, sid) => this.closePeer(sid));
        this.peers.clear();
        this.audioAnalyzers.forEach((_, id) => this.stopAudioAnalyzer(id));
        if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
        if (this.screenStream) { this.screenStream.getTracks().forEach(t => t.stop()); this.screenStream = null; }
        this.currentRoomId = null; this.isHost = false; this.isCoHost = false;
        this.isAudioOn = true; this.isVideoOn = true; this.isScreenSharing = false;
        this.screenShareSocketId = null;
        this.showLobbyUI();
        setTimeout(() => this.loadRoomsList(), 300);
    }
}

window.zoomManager = new ZoomManager();
