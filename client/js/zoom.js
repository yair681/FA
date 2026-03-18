// ===== Zoom / WebRTC Manager =====
class ZoomManager {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.screenStream = null;
        this.peers = new Map();
        this.audioAnalyzers = new Map();
        this.currentRoomId = null;
        this.mainRoomId = null;
        this.userName = '';
        this.userId = '';
        this.userRole = '';
        this.isHost = false;
        this.isCoHost = false;
        this.isAudioOn = true;
        this.isVideoOn = true;
        this.isScreenSharing = false;
        this.screenShareSocketId = null;
        this.unreadChat = 0;
        this.chatMode = 'everyone';
        this.whitelistItems = [];
        this.roomPermissions = { allowMic: true, allowCamera: true, allowScreenShare: true };
        // New state
        this.breakoutRooms = [];
        this.inBreakout = false;
        this.polls = new Map();  // pollId => {id, question, options:[], counts:[], totalVotes, closed}
        this.qaEnabled = false;
        this.qaQuestions = [];
        this.timerInterval = null;
        this.timerEndTime = null;

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
        this.userRole = userRole || 'user';

        if (this.socket) { this.socket.disconnect(); this.socket = null; }
        this.setStatus('מתחבר...');

        this.socket = io(window.location.origin, { transports: ['polling', 'websocket'], reconnectionAttempts: 5 });

        this.socket.on('connect', () => {
            this.setStatus('מחובר');
            this.loadRoomsList();
        });
        this.socket.on('connect_error', e => this.setStatus('שגיאת חיבור: ' + e.message));
        this.socket.on('disconnect', () => this.setStatus('מנותק'));

        // Core
        this.socket.on('zoom:rooms-list',            d => this.renderRoomsList(d));
        this.socket.on('zoom:create-permission',     d => this.applyCreatePermission(d));
        this.socket.on('zoom:room-created',          d => this.onRoomCreated(d));
        this.socket.on('zoom:room-joined',           d => this.onRoomJoined(d));
        this.socket.on('zoom:user-joined',           d => this.onUserJoined(d));
        this.socket.on('zoom:user-left',             d => this.onUserLeft(d));
        this.socket.on('zoom:waiting',               d => this.onWaiting(d));
        this.socket.on('zoom:waiting-update',        d => this.renderWaitingList(d.waitingList));
        this.socket.on('zoom:denied',                () => this.onDenied());
        this.socket.on('zoom:kicked',                () => this.onKicked());
        this.socket.on('zoom:meeting-ended',         d => this.onMeetingEnded(d));
        this.socket.on('zoom:participants-update',   d => this.renderParticipants(d.participants));
        this.socket.on('zoom:role-changed',          d => this.onRoleChanged(d));
        this.socket.on('zoom:screen-share-started',  d => this.onRemoteScreenShareStarted(d));
        this.socket.on('zoom:screen-share-stopped',  d => this.onRemoteScreenShareStopped(d));
        this.socket.on('zoom:offer',                 d => this.onOffer(d));
        this.socket.on('zoom:answer',                d => this.onAnswer(d));
        this.socket.on('zoom:ice-candidate',         d => this.onIceCandidate(d));
        this.socket.on('zoom:error',                 d => this._showToast('שגיאה: ' + d.message));
        this.socket.on('zoom:whitelist-updated',     () => this._showToast('הרשימה הלבנה עודכנה'));
        this.socket.on('zoom:chat-message',          d => this.appendChatMessage(d));
        this.socket.on('zoom:chat-mode-changed',     d => this.onChatModeChanged(d));
        this.socket.on('zoom:muted-by-host',         () => this.onMutedByHost());
        this.socket.on('zoom:permissions-changed',   d => this.onPermissionsChanged(d));

        // Breakout
        this.socket.on('zoom:breakout-rooms-created', d => this.onBreakoutCreated(d));
        this.socket.on('zoom:breakout-rooms-updated', d => this.onBreakoutUpdated(d));
        this.socket.on('zoom:move-to-breakout',       d => this.onMoveToBreakout(d));
        this.socket.on('zoom:return-to-main',         () => this.onReturnToMain());
        this.socket.on('zoom:breakout-timer-started', d => this.onBreakoutTimerStarted(d));
        this.socket.on('zoom:breakout-closed',        () => this.onReturnToMain());

        // Polls
        this.socket.on('zoom:poll-created',  d => this.onPollReceived(d));
        this.socket.on('zoom:poll-updated',  d => this.onPollUpdated(d));
        this.socket.on('zoom:poll-closed',   d => this.onPollClosed(d));
        this.socket.on('zoom:poll-deleted',  d => this.onPollDeleted(d));
        this.socket.on('zoom:polls-state',   d => d.polls.forEach(p => this.onPollReceived(p)));

        // Q&A
        this.socket.on('zoom:qa-state',           d => this.onQAState(d));
        this.socket.on('zoom:question-pending',   d => this.onQuestionPending(d));
        this.socket.on('zoom:question-published', d => this.onQuestionPublished(d));
        this.socket.on('zoom:question-rejected',  d => this.onQuestionRejected(d));
        this.socket.on('zoom:question-submitted', d => { if (d.pending) this._showToast('שאלתך ממתינה לאישור'); });

        // Timer
        this.socket.on('zoom:timer-started',   d => this.onTimerStarted(d));
        this.socket.on('zoom:timer-cancelled', () => this.onTimerCancelled());
        this.socket.on('zoom:timer-ended',     () => this.onTimerEnded());
        this.socket.on('zoom:timer-state',     d => { if (d.active) this.onTimerStarted({ endTime: d.endTime, seconds: Math.round((d.endTime - Date.now()) / 1000) }); });
    }

    // ── Status / Permission ───────────────────────────────────────────────────
    setStatus(msg) {
        const el = document.getElementById('zoom-connection-status');
        if (!el) return;
        el.textContent = msg;
        el.style.color = msg === 'מחובר' ? '#22c55e' : msg.includes('שגיאה') ? '#ef4444' : '#f59e0b';
    }

    applyCreatePermission({ locked }) {
        const btns = document.querySelectorAll('.create-meeting-card');
        btns.forEach(b => {
            const isAdmin = window.authManager?.isAdmin();
            b.style.opacity = (locked && !isAdmin) ? '0.5' : '';
            b.style.pointerEvents = (locked && !isAdmin) ? 'none' : '';
            b.title = (locked && !isAdmin) ? 'יצירת שיחות נעולה על ידי מנהל המערכת' : '';
        });
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
                ${window.authManager?.isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="zoomManager.adminClose('${r.roomId}')" style="margin-right:0.5rem;">סגור</button>` : ''}
            </div>`).join('');
    }

    // ── Create / Join ─────────────────────────────────────────────────────────
    // Used when you own the room (host = true) or want to join existing
    async joinRoom(roomId, roomName, isHost, meetingType) {
        if (!this.socket || !this.socket.connected) { this._showToast('לא מחובר. נסה שוב.'); return; }
        await this.startLocalStream();
        this.isHost = !!isHost;
        if (isHost) {
            this.socket.emit('zoom:create-room', {
                roomId, roomName, userName: this.userName,
                userId: this.userId, userRole: this.userRole,
                meetingType: meetingType || 'instant'
            });
        } else {
            this.socket.emit('zoom:request-join', { roomId, userName: this.userName, userId: this.userId });
        }
    }

    async requestJoin(roomId) {
        if (!this.socket || !this.socket.connected) { this._showToast('לא מחובר. נסה שוב.'); return; }
        await this.startLocalStream();
        this.socket.emit('zoom:request-join', { roomId, userName: this.userName, userId: this.userId });
    }

    adminClose(roomId) {
        if (!confirm('לסגור את הפגישה לכולם?')) return;
        this.socket.emit('zoom:admin-close', { roomId });
    }

    // ── Room Events ───────────────────────────────────────────────────────────
    onRoomCreated({ roomId, roomName, permissions }) {
        this.currentRoomId = roomId;
        this.mainRoomId = roomId;
        this.isHost = true;
        this.chatMode = 'everyone';
        this.roomPermissions = permissions || { allowMic: true, allowCamera: true, allowScreenShare: true };
        this.showCallUI(roomName);
        this.addLocalTile();
        this.updateHostControls();
        this.updatePermissionUI();
        this.updateRoomLink(roomId);
    }

    async onRoomJoined({ roomId, roomName, existingUsers, isHost, chatMode, permissions }) {
        this.currentRoomId = roomId;
        if (!this.mainRoomId) this.mainRoomId = roomId;
        this.isHost = isHost;
        this.chatMode = chatMode || 'everyone';
        this.roomPermissions = permissions || { allowMic: true, allowCamera: true, allowScreenShare: true };
        this.hideWaitingScreen();
        this.showCallUI(roomName);
        this.addLocalTile();
        this.updateHostControls();
        this.updateChatUI();
        this.enforcePermissions();
        this.updateRoomLink(this.mainRoomId || roomId);
        for (const u of existingUsers) {
            this.addRemoteTilePlaceholder(u.socketId, u.name);
            await this.createOffer(u.socketId, u.name);
        }
    }

    onUserJoined({ socketId, name }) {
        this.addRemoteTilePlaceholder(socketId, name);
    }

    onUserLeft({ socketId }) {
        this.closePeer(socketId);
        const tile = document.getElementById('tile-' + socketId);
        if (tile) tile.remove();
        if (this.screenShareSocketId === socketId) this.clearScreenShareDom(socketId);
        this.updateCount();
    }

    onWaiting({ roomName }) {
        const lobby = document.getElementById('zoom-lobby');
        if (lobby) lobby.style.display = 'none';
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
        const lobby = document.getElementById('zoom-lobby');
        if (lobby) lobby.style.display = 'block';
        if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
        this._showToast('בקשתך להצטרף לשיחה נדחתה.');
    }

    onKicked() {
        this._showToast('הוסרת מהשיחה.');
        this.fullReset();
    }

    onMeetingEnded({ reason }) {
        const msg = reason === 'admin' ? 'הפגישה נסגרה על ידי מנהל המערכת.' : 'המארח סיים את הפגישה.';
        if (!this.isHost) this._showToast(msg);
        this.fullReset();
    }

    onRoleChanged({ role }) {
        if (role === 'host') { this.isHost = true; this.isCoHost = false; this._showToast('אתה המארח החדש של הפגישה.'); }
        else if (role === 'cohost') { this.isCoHost = true; this._showToast('הפכת למנהל-שותף של הפגישה.'); }
        else { this.isCoHost = false; }
        this.updateHostControls();
    }

    updateRoomLink(roomId) {
        const linkEl = document.getElementById('zoom-room-link');
        if (linkEl) linkEl.value = window.location.origin + '/join/' + roomId;
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
            const muteIcon = !p.audioOn ? ' <i class="fas fa-microphone-slash" style="color:#ef4444;font-size:0.75rem;" title="מושתק"></i>' : '';
            let actions = '';
            if (this.isHost && !isMe && !p.isHost) {
                actions += p.isCoHost
                    ? `<button class="zoom-action-btn" onclick="zoomManager.removeCohost('${p.socketId}')">הסר מנהל</button>`
                    : `<button class="zoom-action-btn" onclick="zoomManager.assignCohost('${p.socketId}')">מנה מנהל</button>`;
            }
            if (canManage) {
                actions += `<button class="zoom-action-btn" onclick="zoomManager.muteUser('${p.socketId}')">השתק</button>`;
                actions += `<button class="zoom-action-btn danger" onclick="zoomManager.kick('${p.socketId}')">הסר משיחה</button>`;
            }
            // Update video tile camera-off overlay
            const tile = document.getElementById('tile-' + p.socketId);
            if (tile) {
                let camOff = tile.querySelector('.video-camera-off');
                if (!p.videoOn) {
                    if (!camOff) {
                        camOff = document.createElement('div');
                        camOff.className = 'video-camera-off';
                        camOff.innerHTML = '<i class="fas fa-video-slash"></i>';
                        tile.appendChild(camOff);
                    }
                } else {
                    if (camOff) camOff.remove();
                }
            }
            return `<div class="zoom-participant-row ${isMe ? 'me' : ''}">
                <span class="zoom-participant-name"><i class="fas fa-user"></i> ${p.name}${muteIcon} ${badge}</span>
                ${actions ? `<div class="zoom-participant-actions">${actions}</div>` : ''}
            </div>`;
        }).join('');
        this.updateCount(participants.length);
    }

    renderWaitingList(waitingList) {
        const el = document.getElementById('zoom-waiting-list');
        if (!el) return;
        const badge = document.getElementById('zoom-waiting-badge');
        if (badge) { badge.textContent = waitingList.length; badge.style.display = waitingList.length ? 'inline-flex' : 'none'; }
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
    muteUser(targetSocketId)    { this.socket.emit('zoom:mute-user', { roomId: this.currentRoomId, targetSocketId }); }

    endMeeting() {
        if (!confirm('לסיים את הפגישה לכולם?')) return;
        this.socket.emit('zoom:end-meeting', { roomId: this.currentRoomId });
        this.fullReset();
    }

    updateHostControls() {
        const btnManage = document.getElementById('zoom-btn-manage');
        if (btnManage) btnManage.style.display = (this.isHost || this.isCoHost) ? '' : 'none';
        const whitelist = document.getElementById('zoom-whitelist-section');
        if (whitelist) whitelist.style.display = this.isHost ? 'block' : 'none';
        const endBtn = document.getElementById('zoom-end-meeting-btn');
        if (endBtn) endBtn.style.display = this.isHost ? 'inline-flex' : 'none';
        const leaveBtn = document.getElementById('zoom-leave-btn');
        if (leaveBtn) leaveBtn.style.display = this.isHost ? 'none' : 'inline-flex';
        const pluginsBtn = document.getElementById('zoom-btn-plugins');
        if (pluginsBtn) pluginsBtn.style.display = (this.isHost || this.isCoHost) ? '' : 'none';
    }

    // ── Panel toggling ────────────────────────────────────────────────────────
    togglePanel(panel) {
        const el = document.getElementById('zoom-panel-' + panel);
        const btn = document.getElementById('zoom-btn-' + panel);
        if (!el) return;
        const isOpen = el.style.display !== 'none';
        el.style.display = isOpen ? 'none' : 'flex';
        if (btn) btn.classList.toggle('active', !isOpen);
        if (!isOpen && panel === 'chat') {
            this.unreadChat = 0;
            const badge = document.getElementById('zoom-chat-badge');
            if (badge) badge.style.display = 'none';
        }
    }

    showPluginTab(tab) {
        document.querySelectorAll('.plugin-tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.plugin-tab-btn').forEach(el => el.classList.remove('active'));
        const content = document.getElementById('plugin-tab-' + tab);
        if (content) content.style.display = 'block';
        const btn = document.querySelector(`.plugin-tab-btn[data-tab="${tab}"]`);
        if (btn) btn.classList.add('active');
    }

    // ── Chat ──────────────────────────────────────────────────────────────────
    sendChat() {
        const input = document.getElementById('zoom-chat-input');
        const text = input?.value.trim();
        if (!text || !this.socket) return;
        this.socket.emit('zoom:chat-message', { roomId: this.currentRoomId, text });
        input.value = '';
    }

    appendChatMessage({ from, text, ts, fromSocketId }) {
        const msgs = document.getElementById('zoom-chat-messages');
        if (!msgs) return;
        const isMe = this.socket && fromSocketId === this.socket.id;
        const time = new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const div = document.createElement('div');
        div.className = 'zoom-chat-msg' + (isMe ? ' mine' : '');
        div.innerHTML = `<div class="zoom-chat-msg-from">${isMe ? 'אתה' : from} · ${time}</div><div>${text}</div>`;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
        const chatPanel = document.getElementById('zoom-panel-chat');
        if (!chatPanel || chatPanel.style.display === 'none') {
            this.unreadChat++;
            const badge = document.getElementById('zoom-chat-badge');
            if (badge) { badge.textContent = this.unreadChat; badge.style.display = 'inline-flex'; }
        }
    }

    onChatModeChanged({ mode }) {
        this.chatMode = mode;
        this.updateChatUI();
        const sel = document.getElementById('zoom-chat-mode-select');
        if (sel) sel.value = mode;
    }

    updateChatUI() {
        const input = document.getElementById('zoom-chat-input');
        if (!input) return;
        const canChat = this.chatMode === 'everyone' || this.isHost || this.isCoHost;
        input.disabled = !canChat;
        input.placeholder = canChat ? 'כתוב הודעה...' : 'רק המארח יכול לשלוח הודעות';
    }

    setChatMode(mode) {
        if (!this.socket || (!this.isHost && !this.isCoHost)) return;
        this.socket.emit('zoom:set-chat-mode', { roomId: this.currentRoomId, mode });
    }

    // ── Mute by host ──────────────────────────────────────────────────────────
    onMutedByHost() {
        if (this.isAudioOn) this.toggleAudio();
        this._showToast('הושתקת על ידי המארח');
    }

    _showToast(msg) {
        if (!msg) return;
        let toast = document.getElementById('zoom-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'zoom-toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // ── Room Permissions ──────────────────────────────────────────────────────
    onPermissionsChanged({ permissions }) {
        this.roomPermissions = permissions;
        this.updatePermissionUI();
        this.enforcePermissions();
    }

    updateRoomPermission(key, value) {
        if (!this.socket || (!this.isHost && !this.isCoHost)) return;
        const updated = { ...this.roomPermissions, [key]: value };
        this.socket.emit('zoom:update-room-permissions', { roomId: this.currentRoomId, permissions: updated });
    }

    enforcePermissions() {
        const isManager = this.isHost || this.isCoHost;
        const p = this.roomPermissions;
        const audioBtn  = document.getElementById('zoom-audio-btn');
        const videoBtn  = document.getElementById('zoom-video-btn');
        const screenBtn = document.getElementById('zoom-screen-btn');
        if (audioBtn)  { audioBtn.disabled  = !isManager && !p.allowMic;        audioBtn.title  = !isManager && !p.allowMic  ? 'המארח השבית מיקרופון' : 'מיקרופון'; }
        if (videoBtn)  { videoBtn.disabled  = !isManager && !p.allowCamera;      videoBtn.title  = !isManager && !p.allowCamera ? 'המארח השבית מצלמה' : 'מצלמה'; }
        if (screenBtn) { screenBtn.disabled = !isManager && !p.allowScreenShare; screenBtn.title = !isManager && !p.allowScreenShare ? 'המארח השבית שיתוף מסך' : 'שתף מסך'; }
        if (!isManager) {
            if (!p.allowMic && this.isAudioOn) {
                this.localStream?.getAudioTracks().forEach(t => t.enabled = false);
                this.isAudioOn = false;
                if (audioBtn) { audioBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>'; audioBtn.classList.add('off'); }
            }
            if (!p.allowCamera && this.isVideoOn) {
                this.localStream?.getVideoTracks().forEach(t => t.enabled = false);
                this.isVideoOn = false;
                if (videoBtn) { videoBtn.innerHTML = '<i class="fas fa-video-slash"></i>'; videoBtn.classList.add('off'); }
            }
            if (!p.allowScreenShare && this.isScreenSharing) this.stopScreenShare();
        }
        this._showToast(this._buildPermissionToast(p, isManager));
    }

    _buildPermissionToast(p, isManager) {
        if (isManager) return null;
        const blocked = [];
        if (!p.allowMic) blocked.push('מיקרופון');
        if (!p.allowCamera) blocked.push('מצלמה');
        if (!p.allowScreenShare) blocked.push('שיתוף מסך');
        return blocked.length ? 'המארח חסם: ' + blocked.join(', ') : null;
    }

    updatePermissionUI() {
        const micCb    = document.getElementById('zoom-perm-mic');
        const camCb    = document.getElementById('zoom-perm-camera');
        const screenCb = document.getElementById('zoom-perm-screen');
        if (micCb)    micCb.checked    = this.roomPermissions.allowMic;
        if (camCb)    camCb.checked    = this.roomPermissions.allowCamera;
        if (screenCb) screenCb.checked = this.roomPermissions.allowScreenShare;
    }

    // ── Whitelist ─────────────────────────────────────────────────────────────
    async searchWhitelist(query) {
        const sugEl = document.getElementById('zoom-whitelist-suggestions');
        if (!sugEl) return;
        if (!query || query.length < 1) { sugEl.style.display = 'none'; return; }
        try {
            const data = await apiFetch('/api/users/search?q=' + encodeURIComponent(query));
            if (!data.length) { sugEl.style.display = 'none'; return; }
            sugEl.innerHTML = data.map(u => `
                <div class="zoom-whitelist-suggestion" onclick='zoomManager.addWhitelistItem(${JSON.stringify({type:"user",id:u._id,name:u.name})})'>
                    <i class="fas fa-user"></i> ${u.name}
                </div>`).join('');
            sugEl.style.display = 'block';
        } catch(e) { sugEl.style.display = 'none'; }
    }

    addWhitelistItem(item) {
        if (this.whitelistItems.find(i => i.id === item.id)) return;
        this.whitelistItems.push(item);
        this.renderWhitelistTags();
        const input = document.getElementById('zoom-whitelist-input');
        if (input) input.value = '';
        const sug = document.getElementById('zoom-whitelist-suggestions');
        if (sug) sug.style.display = 'none';
    }

    renderWhitelistTags() {
        const el = document.getElementById('zoom-whitelist-tags');
        if (!el) return;
        el.innerHTML = this.whitelistItems.map(item => `
            <span class="zoom-whitelist-tag">
                <i class="fas fa-user"></i> ${item.name}
                <button onclick="zoomManager.removeWhitelistItem('${item.id}')">&times;</button>
            </span>`).join('');
    }

    removeWhitelistItem(id) {
        this.whitelistItems = this.whitelistItems.filter(i => i.id !== id);
        this.renderWhitelistTags();
    }

    submitWhitelist() {
        const userIds = this.whitelistItems.map(i => String(i.id));
        this.socket.emit('zoom:update-whitelist', { roomId: this.currentRoomId, userIds });
        this._showToast('הרשימה נשמרה — ' + userIds.length + ' משתמשים');
    }

    // ── Screen Share ──────────────────────────────────────────────────────────
    async toggleScreenShare() {
        if (this.isScreenSharing) { this.stopScreenShare(); return; }
        if (!this.isHost && !this.isCoHost && !this.roomPermissions.allowScreenShare) {
            this._showToast('המארח חסם את שיתוף המסך'); return;
        }
        try {
            const includeAudio = document.getElementById('zoom-screen-audio')?.checked ?? false;
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: includeAudio });
            const videoTrack = this.screenStream.getVideoTracks()[0];
            const audioTrack = this.screenStream.getAudioTracks()[0] || null;
            const replacePromises = [];
            this.peers.forEach(pc => {
                const vs = pc.getSenders().find(s => s.track?.kind === 'video');
                if (vs && videoTrack) replacePromises.push(vs.replaceTrack(videoTrack));
                if (audioTrack) { const as = pc.getSenders().find(s => s.track?.kind === 'audio'); if (as) replacePromises.push(as.replaceTrack(audioTrack)); }
            });
            await Promise.all(replacePromises);
            const lv = document.getElementById('local-video');
            if (lv) { lv.srcObject = this.screenStream; lv.style.objectFit = 'contain'; }
            this.isScreenSharing = true;
            this.socket.emit('zoom:screen-share-started', { roomId: this.currentRoomId });
            const btn = document.getElementById('zoom-screen-btn');
            if (btn) { btn.classList.add('active'); btn.title = 'עצור שיתוף'; }
            this.setDominantTile('tile-local', true);
            videoTrack.onended = () => this.stopScreenShare();
        } catch(e) { if (e.name !== 'NotAllowedError') this._showToast('שגיאה בשיתוף מסך: ' + e.message); }
    }

    stopScreenShare() {
        if (!this.isScreenSharing) return;
        const camTrack = this.localStream?.getVideoTracks()[0];
        const micTrack = this.localStream?.getAudioTracks()[0];
        const hadScreenAudio = this.screenStream?.getAudioTracks().length > 0;
        this.peers.forEach(pc => {
            const vs = pc.getSenders().find(s => s.track?.kind === 'video');
            if (vs && camTrack) vs.replaceTrack(camTrack);
            if (hadScreenAudio && micTrack) { const as = pc.getSenders().find(s => s.track?.kind === 'audio'); if (as) as.replaceTrack(micTrack); }
        });
        const lv = document.getElementById('local-video');
        if (lv && this.localStream) { lv.srcObject = this.localStream; lv.style.objectFit = ''; }
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
        const grid = document.getElementById('zoom-video-grid');
        document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('dominant'));
        if (dominant) {
            if (grid) grid.classList.add('has-screen-share');
            const t = document.getElementById(tileId);
            if (t) t.classList.add('dominant');
        } else {
            if (grid) grid.classList.remove('has-screen-share');
        }
    }

    clearScreenShareDom(socketId) {
        this.screenShareSocketId = null;
        const tile = document.getElementById('tile-' + socketId);
        if (tile) tile.classList.remove('dominant');
        const grid = document.getElementById('zoom-video-grid');
        if (grid) grid.classList.remove('has-screen-share');
    }

    // ── WebRTC ────────────────────────────────────────────────────────────────
    createPeerConnection(socketId, userName) {
        const pc = new RTCPeerConnection(this.iceServers);
        this.peers.set(socketId, pc);
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => {
                if (t.kind === 'video' && this.isScreenSharing && this.screenStream) {
                    const screenVideo = this.screenStream.getVideoTracks()[0];
                    pc.addTrack(screenVideo || t, this.localStream);
                } else {
                    pc.addTrack(t, this.localStream);
                }
            });
        }
        pc.onicecandidate = e => { if (e.candidate) this.socket.emit('zoom:ice-candidate', { targetSocketId: socketId, candidate: e.candidate }); };
        pc.ontrack = e => { if (e.streams && e.streams[0]) this.attachRemoteStream(socketId, userName, e.streams[0]); };
        pc.onconnectionstatechange = () => { if (['failed','disconnected','closed'].includes(pc.connectionState)) this.onUserLeft({ socketId }); };
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
        const pc = this.peers.get(socketId);
        if (pc) { pc.close(); this.peers.delete(socketId); }
        this.stopAudioAnalyzer(socketId);
    }

    // ── Local Stream ──────────────────────────────────────────────────────────
    async startLocalStream() {
        if (this.localStream) return;
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch(e) {
            try { this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); this.isVideoOn = false; }
            catch(e2) { this._showToast('לא ניתן לגשת למצלמה/מיקרופון'); throw e2; }
        }
    }

    toggleAudio() {
        if (!this.localStream) return;
        this.isAudioOn = !this.isAudioOn;
        this.localStream.getAudioTracks().forEach(t => t.enabled = this.isAudioOn);
        const btn = document.getElementById('zoom-audio-btn');
        if (btn) { btn.innerHTML = `<i class="fas fa-microphone${this.isAudioOn ? '' : '-slash'}"></i>`; btn.classList.toggle('off', !this.isAudioOn); }
        this.broadcastMediaState();
    }

    toggleVideo() {
        if (!this.localStream) return;
        this.isVideoOn = !this.isVideoOn;
        this.localStream.getVideoTracks().forEach(t => t.enabled = this.isVideoOn);
        const btn = document.getElementById('zoom-video-btn');
        if (btn) { btn.innerHTML = `<i class="fas fa-video${this.isVideoOn ? '' : '-slash'}"></i>`; btn.classList.toggle('off', !this.isVideoOn); }
        const localTile = document.getElementById('tile-local');
        if (localTile) {
            let camOff = localTile.querySelector('.video-camera-off');
            if (!this.isVideoOn) {
                if (!camOff) { camOff = document.createElement('div'); camOff.className = 'video-camera-off'; camOff.innerHTML = '<i class="fas fa-video-slash"></i>'; localTile.appendChild(camOff); }
            } else { if (camOff) camOff.remove(); }
        }
        this.broadcastMediaState();
    }

    broadcastMediaState() {
        if (!this.socket || !this.currentRoomId) return;
        this.socket.emit('zoom:media-state', { roomId: this.currentRoomId, audioOn: this.isAudioOn, videoOn: this.isVideoOn });
    }

    // ── Audio Analyzer ────────────────────────────────────────────────────────
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
        if (this.localStream) { vid.srcObject = this.localStream; this.startAudioAnalyzer(this.localStream, 'tile-local'); }
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
        if (!tile) { tile = this._makeTile('tile-' + socketId, '', name); document.getElementById('zoom-video-grid')?.appendChild(tile); }
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
        const lobby = document.getElementById('zoom-lobby');
        if (lobby) lobby.style.display = 'none';
        const c = document.getElementById('zoom-call-container');
        if (c) c.style.display = 'flex';
        const t = document.getElementById('zoom-call-title');
        if (t) t.textContent = roomName;
        ['participants', 'chat', 'manage', 'plugins'].forEach(p => {
            const el = document.getElementById('zoom-panel-' + p);
            if (el) el.style.display = 'none';
            const btn = document.getElementById('zoom-btn-' + p);
            if (btn) btn.classList.remove('active');
        });
    }

    showLobbyUI() {
        const c = document.getElementById('zoom-call-container');
        if (c) c.style.display = 'none';
        const lobby = document.getElementById('zoom-lobby');
        if (lobby) lobby.style.display = 'block';
        const ws = document.getElementById('zoom-waiting-screen');
        if (ws) ws.style.display = 'none';
        const grid = document.getElementById('zoom-video-grid');
        if (grid) grid.innerHTML = '';
        const pp = document.getElementById('zoom-participants-panel');
        if (pp) pp.innerHTML = '';
        const wl = document.getElementById('zoom-waiting-list');
        if (wl) wl.innerHTML = '';
        const msgs = document.getElementById('zoom-chat-messages');
        if (msgs) msgs.innerHTML = '';
        this._clearTimerDisplay();
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
        this.currentRoomId = null; this.mainRoomId = null;
        this.isHost = false; this.isCoHost = false;
        this.isAudioOn = true; this.isVideoOn = true; this.isScreenSharing = false;
        this.screenShareSocketId = null;
        this.unreadChat = 0; this.chatMode = 'everyone'; this.whitelistItems = [];
        this.roomPermissions = { allowMic: true, allowCamera: true, allowScreenShare: true };
        this.breakoutRooms = []; this.inBreakout = false;
        this.polls.clear(); this.qaEnabled = false; this.qaQuestions = [];
        if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
        this.timerEndTime = null;
        ['zoom-audio-btn','zoom-video-btn','zoom-screen-btn'].forEach(id => {
            const btn = document.getElementById(id); if (btn) btn.disabled = false;
        });
        this.showLobbyUI();
        setTimeout(() => this.loadRoomsList(), 300);
    }

    // ── Breakout Rooms ────────────────────────────────────────────────────────
    createBreakoutRooms() {
        const countEl = document.getElementById('breakout-count');
        const count = parseInt(countEl?.value) || 2;
        if (count < 2 || count > 20) { this._showToast('מספר חדרים חייב להיות בין 2 ל-20'); return; }
        this.socket.emit('zoom:create-breakout-rooms', { roomId: this.currentRoomId, count });
    }

    onBreakoutCreated({ rooms, participants }) {
        // rooms = [{id, name, participants:[socketIds]}]
        // enrich rooms with member name info from participants list
        const pidMap = {};
        (participants || []).forEach(p => { pidMap[p.socketId] = p.name; });
        this.breakoutRooms = rooms.map(r => ({
            id: r.id, name: r.name,
            members: (r.participants || []).map(sid => ({ socketId: sid, name: pidMap[sid] || sid }))
        }));
        this.renderBreakoutAssign(this.breakoutRooms);
    }

    onBreakoutUpdated({ rooms }) {
        const pidMap = {};
        document.querySelectorAll('.breakout-member-chip').forEach(el => {
            if (el.dataset.socketid) pidMap[el.dataset.socketid] = el.textContent.trim();
        });
        this.breakoutRooms = rooms.map(r => ({
            id: r.id, name: r.name,
            members: (r.participants || []).map(sid => ({ socketId: sid, name: pidMap[sid] || sid }))
        }));
        this.renderBreakoutAssign(this.breakoutRooms);
    }

    renderBreakoutAssign(rooms) {
        const container = document.getElementById('breakout-assign-area');
        if (!container) return;
        container.innerHTML = `
            <div class="breakout-rooms-grid">
                ${rooms.map(r => `
                    <div class="breakout-room-col" id="br-col-${r.id}" ondragover="event.preventDefault()" ondrop="zoomManager.dropToBreakout(event,'${r.id}')">
                        <div class="breakout-room-header">${r.name}</div>
                        <div class="breakout-room-members" id="br-members-${r.id}">
                            ${(r.members || []).map(m => `
                                <div class="breakout-member-chip" draggable="true" data-socketid="${m.socketId}"
                                     ondragstart="event.dataTransfer.setData('socketId','${m.socketId}');event.dataTransfer.setData('name','${m.name}')">
                                    <i class="fas fa-user"></i> ${m.name}
                                </div>`).join('')}
                        </div>
                    </div>`).join('')}
            </div>
            <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                <button class="btn btn-secondary btn-sm" onclick="zoomManager.randomAssignBreakout()"><i class="fas fa-random"></i> שיוך אקראי</button>
                <button class="btn btn-primary" onclick="zoomManager.launchBreakoutRooms()"><i class="fas fa-play"></i> פתח חדרים</button>
                <button class="btn btn-danger btn-sm" onclick="zoomManager.closeBreakoutRooms()"><i class="fas fa-times"></i> סגור הכל</button>
                <div style="display:flex;align-items:center;gap:0.4rem;margin-right:auto;">
                    <label style="font-size:0.85rem;">טיימר:</label>
                    <input type="number" id="breakout-timer-sec" min="60" max="7200" value="900" style="width:70px;" class="form-control">
                    <span style="font-size:0.85rem;">שניות</span>
                </div>
            </div>`;
    }

    dropToBreakout(event, roomId) {
        const socketId = event.dataTransfer.getData('socketId');
        const name = event.dataTransfer.getData('name');
        if (!socketId) return;
        // Tell server to reassign
        this.socket.emit('zoom:assign-breakout', { roomId: this.currentRoomId, targetSocketId: socketId, brId: roomId });
    }

    randomAssignBreakout() {
        this.socket.emit('zoom:random-assign-breakout', { roomId: this.currentRoomId });
    }

    launchBreakoutRooms() {
        const timerSec = parseInt(document.getElementById('breakout-timer-sec')?.value) || 0;
        this.socket.emit('zoom:launch-breakout-rooms', { roomId: this.currentRoomId });
        if (timerSec > 0) {
            setTimeout(() => {
                this.socket.emit('zoom:set-breakout-timer', { roomId: this.currentRoomId, seconds: timerSec });
            }, 500);
        }
        this._showToast('חדרי הפרצת הושקו!');
    }

    onMoveToBreakout({ brRoomId, brName, mainRoomId, peers }) {
        this._showToast('עוברים לחדר: ' + brName);
        this.mainRoomId = mainRoomId;
        this._resetForBreakout();
        this.inBreakout = true;
        this.currentRoomId = brRoomId;
        this.startLocalStream().then(() => {
            this.addLocalTile();
            // Connect to peers already in breakout room
            peers.forEach(p => {
                this.addRemoteTilePlaceholder(p.socketId, p.name);
                this.createOffer(p.socketId, p.name);
            });
        });
    }

    onReturnToMain() {
        if (!this.inBreakout) {
            // Just close breakout UI for host
            this._showToast('חדרי הפרצת נסגרו');
            return;
        }
        this._showToast('חוזרים לשיחה הראשית...');
        const mainRoom = this.mainRoomId;
        this._resetForBreakout();
        this.inBreakout = false;
        this.currentRoomId = mainRoom;
        this.startLocalStream().then(() => {
            this.socket.emit('zoom:request-join', { roomId: mainRoom, userName: this.userName, userId: this.userId });
        });
    }

    onBreakoutTimerStarted({ seconds, endsAt }) {
        let remaining = seconds;
        const tick = () => {
            const el = document.getElementById('breakout-timer-display');
            if (el) {
                const m = Math.floor(remaining / 60);
                const s = remaining % 60;
                el.textContent = `נותר זמן: ${m}:${s.toString().padStart(2,'0')}`;
            }
            if (remaining <= 0) return;
            remaining--;
            setTimeout(tick, 1000);
        };
        tick();
    }

    _resetForBreakout() {
        this.peers.forEach((_, sid) => this.closePeer(sid));
        this.peers.clear();
        this.audioAnalyzers.forEach((_, id) => this.stopAudioAnalyzer(id));
        if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
        const grid = document.getElementById('zoom-video-grid');
        if (grid) grid.innerHTML = '';
    }

    closeBreakoutRooms() {
        if (!this.isHost) return;
        this.socket.emit('zoom:close-breakout-rooms', { roomId: this.currentRoomId });
    }

    // ── Polls ─────────────────────────────────────────────────────────────────
    createPoll() {
        const questionEl = document.getElementById('poll-question');
        const question = questionEl?.value.trim();
        if (!question) { this._showToast('יש להזין שאלה'); return; }
        const options = Array.from(document.querySelectorAll('.poll-option-input'))
            .map(el => el.value.trim()).filter(Boolean);
        if (options.length < 2) { this._showToast('יש להוסיף לפחות 2 אפשרויות'); return; }
        this.socket.emit('zoom:create-poll', { roomId: this.currentRoomId, question, options });
        if (questionEl) questionEl.value = '';
        document.querySelectorAll('.poll-option-input').forEach(el => el.value = '');
    }

    addPollOption() {
        const container = document.getElementById('poll-options-container');
        if (!container) return;
        const input = document.createElement('input');
        input.type = 'text'; input.className = 'form-control poll-option-input';
        input.placeholder = 'אפשרות...'; input.style.marginTop = '0.5rem';
        container.appendChild(input);
    }

    // Server sends: {id, question, options:[strings], counts:[nums], totalVotes, closed}
    onPollReceived(poll) {
        this.polls.set(poll.id, poll);
        this._renderPollFromServer(poll);
    }

    onPollUpdated({ id, counts, totalVotes }) {
        const poll = this.polls.get(id);
        if (!poll) return;
        poll.counts = counts; poll.totalVotes = totalVotes;
        this._renderPollFromServer(poll);
    }

    onPollClosed({ id, counts, totalVotes }) {
        const poll = this.polls.get(id);
        if (!poll) return;
        poll.counts = counts; poll.totalVotes = totalVotes; poll.closed = true;
        this._renderPollFromServer(poll);
    }

    onPollDeleted({ id }) {
        this.polls.delete(id);
        const el = document.getElementById('poll-item-' + id);
        if (el) el.remove();
    }

    _renderPollFromServer(poll) {
        const list = document.getElementById('polls-list');
        if (!list) return;
        const isManager = this.isHost || this.isCoHost;
        const myVoteIdx = poll.myVote !== undefined ? poll.myVote : null;
        let html = `<div class="poll-item" id="poll-item-${poll.id}">
            <div class="poll-question">${poll.question}</div>
            <div class="poll-options">`;
        (poll.options || []).forEach((opt, i) => {
            const votes = poll.counts ? (poll.counts[i] || 0) : 0;
            const total = poll.totalVotes || 0;
            const pct = total ? Math.round(votes / total * 100) : 0;
            const voted = myVoteIdx === i;
            const clickable = !poll.closed && myVoteIdx === null;
            html += `<div class="poll-option${voted ? ' voted' : ''}" ${clickable ? `onclick="zoomManager.votePoll('${poll.id}',${i})"` : ''} style="${clickable?'cursor:pointer;':''}">
                <div class="poll-option-label">${opt}</div>
                <div class="poll-option-bar">
                    <div class="poll-bar-fill" style="width:${pct}%"></div>
                    <span class="poll-pct">${pct}% (${votes})</span>
                </div>
            </div>`;
        });
        html += `</div><div class="poll-footer">
            <span style="font-size:0.8rem;color:var(--gray)">${poll.totalVotes || 0} הצבעות${poll.closed ? ' · סגור' : ''}</span>`;
        if (isManager) {
            if (!poll.closed) html += `<button class="btn btn-sm btn-secondary" onclick="zoomManager.closePoll('${poll.id}')">סגור סקר</button>`;
            html += `<button class="btn btn-sm btn-danger" onclick="zoomManager.deletePoll('${poll.id}')">מחק</button>`;
        }
        html += `</div></div>`;
        const existing = document.getElementById('poll-item-' + poll.id);
        if (existing) existing.outerHTML = html;
        else list.insertAdjacentHTML('beforeend', html);
    }

    votePoll(pollId, optionIndex) {
        this.socket.emit('zoom:vote-poll', { roomId: this.currentRoomId, pollId, optionIndex });
        // Optimistic local tracking
        const poll = this.polls.get(pollId);
        if (poll) poll.myVote = optionIndex;
    }

    closePoll(pollId) { this.socket.emit('zoom:close-poll', { roomId: this.currentRoomId, pollId }); }
    deletePoll(pollId) { this.socket.emit('zoom:delete-poll', { roomId: this.currentRoomId, pollId }); }

    // ── Q&A ───────────────────────────────────────────────────────────────────
    toggleQA() {
        if (!this.isHost && !this.isCoHost) return;
        const requireApproval = document.getElementById('qa-require-approval')?.checked || false;
        this.socket.emit('zoom:set-qa', { roomId: this.currentRoomId, enabled: !this.qaEnabled, requireApproval });
    }

    onQAState({ enabled, requireApproval, questions }) {
        this.qaEnabled = enabled;
        const toggle = document.getElementById('qa-toggle');
        if (toggle) toggle.checked = enabled;
        const section = document.getElementById('qa-section');
        if (section) section.style.display = enabled ? 'block' : 'none';
        const submitArea = document.getElementById('qa-submit-area');
        if (submitArea) submitArea.style.display = enabled ? 'block' : 'none';
        if (enabled && questions) {
            this.qaQuestions = questions;
            const list = document.getElementById('qa-list');
            if (list) { list.innerHTML = ''; questions.forEach(q => this._renderQAQuestion(q)); }
        } else {
            this.qaQuestions = [];
            const list = document.getElementById('qa-list');
            if (list) list.innerHTML = '';
        }
    }

    submitQuestion() {
        const input = document.getElementById('qa-question-input');
        const text = input?.value.trim();
        if (!text) { this._showToast('יש להזין שאלה'); return; }
        this.socket.emit('zoom:submit-question', { roomId: this.currentRoomId, question: text });
        if (input) input.value = '';
    }

    // Received by host/cohost only (requires approval)
    onQuestionPending({ question }) {
        this.qaQuestions.push(question);
        this._renderQAQuestion(question, true);
    }

    // Received by all (approved or auto-published)
    onQuestionPublished({ question }) {
        const existing = this.qaQuestions.find(q => q.id === question.id);
        if (existing) { existing.approved = true; }
        else { this.qaQuestions.push(question); }
        this._renderQAQuestion(question, false);
    }

    onQuestionRejected({ questionId }) {
        const el = document.getElementById('qa-q-' + questionId);
        if (el) el.remove();
        this.qaQuestions = this.qaQuestions.filter(q => q.id !== questionId);
    }

    _renderQAQuestion(question, isPending) {
        const list = document.getElementById('qa-list');
        if (!list) return;
        const isManager = this.isHost || this.isCoHost;
        const pending = isPending || !question.approved;
        const existingEl = document.getElementById('qa-q-' + question.id);
        const html = `<div class="qa-item ${pending ? 'pending' : 'approved'}" id="qa-q-${question.id}">
            <div class="qa-text">${question.question}</div>
            <div class="qa-meta">
                <span class="qa-from"><i class="fas fa-user"></i> ${question.authorName || question.userName || ''}</span>
                ${pending ? '<span class="qa-pending-badge">ממתין לאישור</span>' : ''}
                ${isManager && pending ? `
                    <button class="btn btn-sm btn-primary" onclick="zoomManager.approveQuestion('${question.id}')">אשר</button>
                    <button class="btn btn-sm btn-danger" onclick="zoomManager.rejectQuestion('${question.id}')">דחה</button>` : ''}
            </div>
        </div>`;
        if (existingEl) existingEl.outerHTML = html;
        else list.insertAdjacentHTML('beforeend', html);
    }

    approveQuestion(questionId) { this.socket.emit('zoom:approve-question', { roomId: this.currentRoomId, questionId }); }
    rejectQuestion(questionId)  { this.socket.emit('zoom:reject-question',  { roomId: this.currentRoomId, questionId }); }

    // ── Countdown Timer ───────────────────────────────────────────────────────
    startTimer() {
        const minutesEl = document.getElementById('timer-minutes');
        const minutes = parseInt(minutesEl?.value) || 5;
        if (minutes < 1 || minutes > 180) { this._showToast('זמן חייב להיות בין 1 ל-180 דקות'); return; }
        this.socket.emit('zoom:start-timer', { roomId: this.currentRoomId, seconds: minutes * 60 });
    }

    cancelTimer() { this.socket.emit('zoom:cancel-timer', { roomId: this.currentRoomId }); }

    onTimerStarted({ seconds, endTime }) {
        this.timerEndTime = endTime || (Date.now() + seconds * 1000);
        if (this.timerInterval) clearInterval(this.timerInterval);
        this._showTimerDisplay();
        const tick = () => {
            const now = Date.now();
            const secondsLeft = Math.max(0, Math.round((this.timerEndTime - now) / 1000));
            this._updateTimerDisplay(secondsLeft);
            if (secondsLeft <= 0) { clearInterval(this.timerInterval); this.timerInterval = null; }
        };
        tick();
        this.timerInterval = setInterval(tick, 1000);
        this._showToast('טיימר התחיל: ' + Math.round(seconds / 60) + ' דקות');
    }

    onTimerCancelled() {
        if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
        this._clearTimerDisplay();
        this._showToast('הטיימר בוטל');
    }

    onTimerEnded() {
        if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
        this._updateTimerDisplay(0);
        this._playAlarm();
        setTimeout(() => this._clearTimerDisplay(), 6000);
    }

    _showTimerDisplay() {
        let bar = document.getElementById('zoom-timer-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'zoom-timer-bar';
            bar.className = 'zoom-timer-bar';
            bar.innerHTML = `<i class="fas fa-clock"></i> <span id="zoom-timer-text">--:--</span>
                <button class="btn btn-sm" onclick="zoomManager.cancelTimer()" style="margin-right:0.5rem;padding:0.1rem 0.4rem;font-size:0.75rem;">ביטול</button>`;
            const callContainer = document.getElementById('zoom-call-container');
            if (callContainer) callContainer.insertBefore(bar, callContainer.firstChild);
        }
        bar.style.display = 'flex';
    }

    _updateTimerDisplay(secondsLeft) {
        const el = document.getElementById('zoom-timer-text');
        if (!el) return;
        const m = Math.floor(secondsLeft / 60);
        const s = secondsLeft % 60;
        el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
        const bar = document.getElementById('zoom-timer-bar');
        if (bar) bar.classList.toggle('urgent', secondsLeft > 0 && secondsLeft <= 60);
    }

    _clearTimerDisplay() {
        const bar = document.getElementById('zoom-timer-bar');
        if (bar) bar.style.display = 'none';
    }

    _playAlarm() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const beep = (freq, start, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = freq; osc.type = 'sine';
                gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + duration);
            };
            beep(880, 0, 0.3); beep(880, 0.4, 0.3); beep(880, 0.8, 0.3); beep(1100, 1.2, 0.8);
            setTimeout(() => { try { ctx.close(); } catch(e) {} }, 6000);
        } catch(e) {}
    }
}

window.zoomManager = new ZoomManager();
