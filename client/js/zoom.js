// ===== Zoom / WebRTC Manager =====
class ZoomManager {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.screenStream = null;
        this.peers = new Map(); // socketId => RTCPeerConnection
        this.currentRoomId = null;
        this.userName = '';
        this.userId = '';
        this.isAudioOn = true;
        this.isVideoOn = true;
        this.isScreenSharing = false;

        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }

    init(userName, userId) {
        this.userName = userName;
        this.userId = userId;

        // אם יש כבר socket פעיל, נתק אותו קודם
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.setConnectionStatus('מתחבר...');

        // השתמש בכתובת השרת כפי שמוגדרת ב-database.js, או מ-origin
        const dbBase = window.dbManager ? window.dbManager.API_BASE : null;
        const serverUrl = dbBase
            ? dbBase.replace('/api', '')
            : window.location.origin;

        console.log('🔌 Connecting Zoom socket to:', serverUrl);

        this.socket = io(serverUrl, {
            transports: ['polling', 'websocket'],
            reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
            console.log('✅ Zoom socket connected:', this.socket.id);
            this.setConnectionStatus('מחובר');
            this.loadRoomsList();
        });

        this.socket.on('connect_error', (err) => {
            console.error('❌ Zoom socket error:', err.message);
            this.setConnectionStatus('שגיאת חיבור: ' + err.message);
        });

        this.socket.on('disconnect', () => {
            console.warn('⚠️ Zoom socket disconnected');
            this.setConnectionStatus('מנותק');
        });

        this.socket.on('zoom:rooms-list', (rooms) => this.renderRoomsList(rooms));
        this.socket.on('zoom:room-created', (data) => this.onRoomCreated(data));
        this.socket.on('zoom:room-joined', (data) => this.onRoomJoined(data));
        this.socket.on('zoom:user-joined', (data) => this.onUserJoined(data));
        this.socket.on('zoom:user-left', (data) => this.onUserLeft(data));
        this.socket.on('zoom:offer', (data) => this.onOffer(data));
        this.socket.on('zoom:answer', (data) => this.onAnswer(data));
        this.socket.on('zoom:ice-candidate', (data) => this.onIceCandidate(data));
        this.socket.on('zoom:error', (data) => alert('שגיאה: ' + data.message));
    }

    setConnectionStatus(msg) {
        const el = document.getElementById('zoom-connection-status');
        if (el) {
            el.textContent = msg;
            el.style.color = msg === 'מחובר' ? 'var(--secondary)' : msg.includes('שגיאה') ? 'var(--danger)' : 'var(--warning)';
        }
    }

    loadRoomsList() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('zoom:get-rooms');
        }
    }

    renderRoomsList(rooms) {
        const container = document.getElementById('zoom-rooms-list');
        if (!container) return;
        if (rooms.length === 0) {
            container.innerHTML = '<p class="zoom-no-rooms">אין חדרי שיחה פעילים כרגע</p>';
            return;
        }
        container.innerHTML = rooms.map(r => `
            <div class="zoom-room-card">
                <div class="zoom-room-info">
                    <i class="fas fa-video"></i>
                    <span class="zoom-room-name">${r.name}</span>
                    <span class="zoom-room-count"><i class="fas fa-users"></i> ${r.participants}</span>
                </div>
                <button class="btn btn-secondary zoom-join-btn" onclick="zoomManager.joinRoom('${r.roomId}')">הצטרף</button>
            </div>
        `).join('');
    }

    async createRoom() {
        if (!this.socket || !this.socket.connected) {
            alert('לא מחובר לשרת. נסה לרענן את העמוד.');
            return;
        }
        const nameInput = document.getElementById('zoom-room-name-input');
        const roomName = nameInput ? nameInput.value.trim() : '';
        if (!roomName) { alert('יש להזין שם לחדר'); return; }

        const roomId = 'room-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        await this.startLocalStream();
        this.socket.emit('zoom:create-room', {
            roomId,
            roomName,
            userName: this.userName,
            userId: this.userId
        });
    }

    async joinRoom(roomId) {
        if (!this.socket || !this.socket.connected) {
            alert('לא מחובר לשרת. נסה לרענן את העמוד.');
            return;
        }
        await this.startLocalStream();
        this.socket.emit('zoom:join-room', {
            roomId,
            userName: this.userName,
            userId: this.userId
        });
    }

    async onRoomCreated({ roomId, roomName }) {
        this.currentRoomId = roomId;
        this.showCallUI(roomName);
        this.addLocalVideoTile(this.userName);
    }

    async onRoomJoined({ roomId, roomName, existingUsers }) {
        this.currentRoomId = roomId;
        this.showCallUI(roomName);
        this.addLocalVideoTile(this.userName);

        // יצירת חיבור WebRTC לכל משתתף קיים
        for (const user of existingUsers) {
            await this.createOffer(user.socketId, user.name);
        }
    }

    async onUserJoined({ socketId, name }) {
        this.addVideoTilePlaceholder(socketId, name);
        // המצטרף ישלח offer – לא אנחנו
    }

    onUserLeft({ socketId }) {
        const peer = this.peers.get(socketId);
        if (peer) { peer.close(); this.peers.delete(socketId); }
        const tile = document.getElementById('tile-' + socketId);
        if (tile) tile.remove();
        this.updateParticipantCount();
    }

    async createOffer(targetSocketId, targetName) {
        const pc = this.createPeerConnection(targetSocketId, targetName);

        this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.socket.emit('zoom:offer', {
            targetSocketId,
            offer: pc.localDescription,
            fromName: this.userName
        });
    }

    async onOffer({ fromSocketId, fromName, offer }) {
        const pc = this.createPeerConnection(fromSocketId, fromName);

        this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.emit('zoom:answer', {
            targetSocketId: fromSocketId,
            answer: pc.localDescription
        });
    }

    async onAnswer({ fromSocketId, answer }) {
        const pc = this.peers.get(fromSocketId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }

    async onIceCandidate({ fromSocketId, candidate }) {
        const pc = this.peers.get(fromSocketId);
        if (pc && candidate) {
            try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
        }
    }

    createPeerConnection(socketId, userName) {
        const pc = new RTCPeerConnection(this.iceServers);
        this.peers.set(socketId, pc);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('zoom:ice-candidate', {
                    targetSocketId: socketId,
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            this.addRemoteStream(socketId, userName, event.streams[0]);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                this.onUserLeft({ socketId });
            }
        };

        return pc;
    }

    async startLocalStream() {
        if (this.localStream) return;
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (e) {
            // נסה רק אודיו אם וידאו נכשל
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                this.isVideoOn = false;
            } catch (err) {
                alert('לא ניתן לגשת למצלמה/מיקרופון');
                throw err;
            }
        }
    }

    addLocalVideoTile(name) {
        const grid = document.getElementById('zoom-video-grid');
        if (!grid) return;
        const tile = document.createElement('div');
        tile.className = 'video-tile local-tile';
        tile.id = 'tile-local';
        tile.innerHTML = `
            <video id="local-video" autoplay muted playsinline></video>
            <div class="video-tile-name"><i class="fas fa-user"></i> ${name} (אתה)</div>
        `;
        grid.appendChild(tile);
        const video = document.getElementById('local-video');
        if (video && this.localStream) video.srcObject = this.localStream;
        this.updateParticipantCount();
    }

    addRemoteStream(socketId, name, stream) {
        let tile = document.getElementById('tile-' + socketId);
        if (!tile) {
            tile = document.createElement('div');
            tile.className = 'video-tile';
            tile.id = 'tile-' + socketId;
            tile.innerHTML = `
                <video id="video-${socketId}" autoplay playsinline></video>
                <div class="video-tile-name"><i class="fas fa-user"></i> ${name}</div>
            `;
            document.getElementById('zoom-video-grid')?.appendChild(tile);
        }
        const video = document.getElementById('video-' + socketId);
        if (video) video.srcObject = stream;
        this.updateParticipantCount();
    }

    addVideoTilePlaceholder(socketId, name) {
        const grid = document.getElementById('zoom-video-grid');
        if (!grid || document.getElementById('tile-' + socketId)) return;
        const tile = document.createElement('div');
        tile.className = 'video-tile';
        tile.id = 'tile-' + socketId;
        tile.innerHTML = `
            <div class="video-avatar"><i class="fas fa-user"></i></div>
            <div class="video-tile-name"><i class="fas fa-user"></i> ${name}</div>
        `;
        grid.appendChild(tile);
        this.updateParticipantCount();
    }

    updateParticipantCount() {
        const count = document.querySelectorAll('.video-tile').length;
        const el = document.getElementById('zoom-participant-count');
        if (el) el.textContent = count + ' משתתפים';
    }

    showCallUI(roomName) {
        document.getElementById('zoom-lobby').style.display = 'none';
        document.getElementById('zoom-call-container').style.display = 'flex';
        const title = document.getElementById('zoom-call-title');
        if (title) title.textContent = roomName;
    }

    showLobbyUI() {
        document.getElementById('zoom-lobby').style.display = 'block';
        document.getElementById('zoom-call-container').style.display = 'none';
    }

    toggleAudio() {
        if (!this.localStream) return;
        this.isAudioOn = !this.isAudioOn;
        this.localStream.getAudioTracks().forEach(t => t.enabled = this.isAudioOn);
        const btn = document.getElementById('zoom-toggle-audio');
        if (btn) {
            btn.innerHTML = this.isAudioOn
                ? '<i class="fas fa-microphone"></i>'
                : '<i class="fas fa-microphone-slash"></i>';
            btn.classList.toggle('btn-danger', !this.isAudioOn);
        }
    }

    toggleVideo() {
        if (!this.localStream) return;
        this.isVideoOn = !this.isVideoOn;
        this.localStream.getVideoTracks().forEach(t => t.enabled = this.isVideoOn);
        const btn = document.getElementById('zoom-toggle-video');
        if (btn) {
            btn.innerHTML = this.isVideoOn
                ? '<i class="fas fa-video"></i>'
                : '<i class="fas fa-video-slash"></i>';
            btn.classList.toggle('btn-danger', !this.isVideoOn);
        }
    }

    async toggleScreenShare() {
        if (this.isScreenSharing) {
            this.stopScreenShare();
            return;
        }
        try {
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = this.screenStream.getVideoTracks()[0];

            this.peers.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            });

            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = this.screenStream;

            this.isScreenSharing = true;
            const btn = document.getElementById('zoom-screen-share');
            if (btn) { btn.classList.add('btn-warning'); btn.title = 'עצור שיתוף מסך'; }

            screenTrack.onended = () => this.stopScreenShare();
        } catch (e) {
            if (e.name !== 'NotAllowedError') alert('שגיאה בשיתוף מסך: ' + e.message);
        }
    }

    stopScreenShare() {
        if (!this.isScreenSharing) return;
        const cameraTrack = this.localStream.getVideoTracks()[0];
        this.peers.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
        });
        const localVideo = document.getElementById('local-video');
        if (localVideo) localVideo.srcObject = this.localStream;
        if (this.screenStream) { this.screenStream.getTracks().forEach(t => t.stop()); this.screenStream = null; }
        this.isScreenSharing = false;
        const btn = document.getElementById('zoom-screen-share');
        if (btn) { btn.classList.remove('btn-warning'); btn.title = 'שתף מסך'; }
    }

    leaveRoom() {
        if (this.currentRoomId) {
            this.socket.emit('zoom:leave-room', { roomId: this.currentRoomId });
        }
        this.peers.forEach(pc => pc.close());
        this.peers.clear();
        if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
        if (this.screenStream) { this.screenStream.getTracks().forEach(t => t.stop()); this.screenStream = null; }
        this.currentRoomId = null;
        this.isAudioOn = true;
        this.isVideoOn = true;
        this.isScreenSharing = false;

        const grid = document.getElementById('zoom-video-grid');
        if (grid) grid.innerHTML = '';

        this.showLobbyUI();
        this.loadRoomsList();
    }

    disconnect() {
        if (this.socket) { this.socket.disconnect(); this.socket = null; }
    }
}

window.zoomManager = new ZoomManager();
