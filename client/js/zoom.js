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
        this.breakoutParticipants = [];
        this.inBreakout = false;
        this.polls = new Map();
        this.qaEnabled = false;
        this.qaQuestions = [];
        this.timerInterval = null;
        this.timerEndTime = null;

        // Raised hands
        this.raisedHands = new Map();  // socketId -> name
        this.myHandRaised = false;

        // Virtual background
        this.virtualBgType = 'none';   // 'none' | 'blur' | 'preset' | 'custom'
        this.virtualBgPreset = null;   // 'night' | 'forest' | 'galaxy' | 'sea' | 'coffee' | 'office'
        this.virtualBgCanvas = null;
        this.virtualBgCtx = null;
        this.virtualBgStream = null;
        this.selfieSegmentation = null;
        this._vbVideoEl = null;
        this._vbAnimId = null;
        this._customBgImg = null;
        this._customBgList = [];

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
        this.socket.on('zoom:settings-updated',      d => this.onMeetingSettingsUpdated(d));

        // Breakout
        this.socket.on('zoom:breakout-rooms-created', d => this.onBreakoutCreated(d));
        this.socket.on('zoom:breakout-rooms-updated', d => this.onBreakoutUpdated(d));
        this.socket.on('zoom:move-to-breakout',       d => this.onMoveToBreakout(d));
        this.socket.on('zoom:return-to-main',         () => this.onReturnToMain());
        this.socket.on('zoom:breakout-timer-started', d => this.onBreakoutTimerStarted(d));
        this.socket.on('zoom:breakout-closed',        () => this.onReturnToMain());
        this.socket.on('zoom:breakout-nav-response',  d => this.onBreakoutNavResponse(d));
        this.socket.on('zoom:help-requested',         d => this.onHelpRequested(d));
        this.socket.on('zoom:breakout-broadcast',     d => this.onBreakoutBroadcast(d));

        // Raise Hand
        this.socket.on('zoom:hand-raised',    d => this.onHandRaised(d));
        this.socket.on('zoom:hand-lowered',   d => this.onHandLowered(d));
        this.socket.on('zoom:all-hands-lowered', () => this.onAllHandsLowered());
        this.socket.on('zoom:hands-state',    d => d.hands.forEach(h => this.onHandRaised(h)));

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

    // ── Wait for socket connection ────────────────────────────────────────────
    _waitForConnection() {
        return new Promise((resolve, reject) => {
            if (this.socket && this.socket.connected) { resolve(); return; }
            if (!this.socket) { reject(new Error('אין חיבור')); return; }
            const timeout = setTimeout(() => reject(new Error('תם הזמן לחיבור')), 12000);
            this.socket.once('connect', () => { clearTimeout(timeout); resolve(); });
            this.socket.once('connect_error', e => { clearTimeout(timeout); reject(e); });
        });
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
        try { await this._waitForConnection(); } catch(e) { this._showToast('לא מחובר לשרת. נסה שוב.'); return; }
        await this.startLocalStream();
        this.isHost = !!isHost;
        if (isHost) {
            this.socket.emit('zoom:create-room', {
                roomId, roomName, userName: this.userName,
                userId: this.userId, userRole: this.userRole,
                meetingType: meetingType || 'instant'
            });
        } else {
            this.socket.emit('zoom:request-join', { roomId, userName: this.userName, userId: this.userId, userRole: this.userRole });
        }
    }

    async requestJoin(roomId) {
        try { await this._waitForConnection(); } catch(e) { this._showToast('לא מחובר לשרת. נסה שוב.'); return; }
        await this.startLocalStream();
        this.socket.emit('zoom:request-join', { roomId, userName: this.userName, userId: this.userId, userRole: this.userRole });
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
        if (this.userRole === 'guest') { this._showGuestEndedScreen(msg); return; }
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
        if (this.inBreakout) {
            document.querySelectorAll('.zoom-join-link-box').forEach(el => el.style.display = 'none');
            return;
        }
        document.querySelectorAll('.zoom-join-link-box').forEach(el => el.style.display = '');
        const linkEl = document.getElementById('zoom-room-link');
        if (linkEl) linkEl.value = window.location.origin + '/join/' + roomId;
    }

    renderParticipants(participants) {
        const panel = document.getElementById('zoom-participants-panel');
        if (!panel) return;
        const mySocketId = this.socket ? this.socket.id : '';
        const isManager = this.isHost || this.isCoHost;
        const hasHands = this.raisedHands.size > 0;
        let html = '';
        if (isManager && hasHands) {
            html += `<div style="margin-bottom:0.5rem;"><button class="btn btn-sm btn-outline" onclick="zoomManager.lowerAllHands()"><i class="fas fa-hand-paper"></i> הורד כל הידיים</button></div>`;
        }
        html += participants.map(p => {
            const badge = p.isHost ? '<span class="zoom-badge host">מארח</span>'
                : p.isCoHost ? '<span class="zoom-badge cohost">מנהל-שותף</span>' : '';
            const isMe = p.socketId === mySocketId;
            const canManage = isManager && !isMe && !p.isHost;
            const muteIcon = !p.audioOn ? ' <i class="fas fa-microphone-slash" style="color:#ef4444;font-size:0.75rem;" title="מושתק"></i>' : '';
            const handIcon = this.raisedHands.has(p.socketId) ? ' <span class="hand-raised-icon" title="יד מורמת">✋</span>' : '';
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
            return `<div class="zoom-participant-row ${isMe ? 'me' : ''}" data-participant-sid="${p.socketId}">
                <span class="zoom-participant-name"><i class="fas fa-user"></i> ${p.name}${muteIcon}${handIcon} ${badge}</span>
                ${actions ? `<div class="zoom-participant-actions">${actions}</div>` : ''}
            </div>`;
        }).join('');
        panel.innerHTML = html;
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
        const isManager = this.isHost || this.isCoHost;
        const btnManage = document.getElementById('zoom-btn-manage');
        if (btnManage) btnManage.style.display = (isManager || window.authManager?.isAdmin()) ? '' : 'none';
        const endBtn = document.getElementById('zoom-end-meeting-btn');
        if (endBtn) endBtn.style.display = this.isHost ? 'inline-flex' : 'none';
        const leaveBtn = document.getElementById('zoom-leave-btn');
        if (leaveBtn) leaveBtn.style.display = this.isHost ? 'none' : 'inline-flex';
        // Plugins button visible to everyone
        const pluginsBtn = document.getElementById('zoom-btn-plugins');
        if (pluginsBtn) pluginsBtn.style.display = '';
        // Breakout and timer tabs — host/cohost only
        const btTab = document.querySelector('.plugin-tab-btn[data-tab="breakout"]');
        const tmTab = document.querySelector('.plugin-tab-btn[data-tab="timer"]');
        if (btTab) btTab.style.display = isManager ? '' : 'none';
        if (tmTab) tmTab.style.display = isManager ? '' : 'none';
        // Hide poll creation area for non-managers
        const pollCreate = document.getElementById('poll-create-area');
        if (pollCreate) pollCreate.style.display = isManager ? '' : 'none';
        // Hide QA toggle/approval for non-managers
        const qaToggleRow = document.getElementById('qa-toggle-row');
        if (qaToggleRow) qaToggleRow.style.display = isManager ? '' : 'none';
        const qaApprovalRow = document.getElementById('qa-approval-row');
        if (qaApprovalRow) qaApprovalRow.style.display = isManager ? '' : 'none';
        // "Allow entry before host" only visible to system admins
        const entryRow = document.getElementById('zoom-setting-entry-before-row');
        if (entryRow) entryRow.style.display = window.authManager?.isAdmin() ? '' : 'none';
    }

    onMeetingSettingsUpdated({ settings }) {
        const approvalCb = document.getElementById('zoom-setting-approval');
        if (approvalCb) approvalCb.checked = settings.requireAdminApproval || false;
        const entryBeforeCb = document.getElementById('zoom-setting-entry-before');
        if (entryBeforeCb) entryBeforeCb.checked = settings.allowEntryBeforeHost || false;
    }

    updateMeetingSettings(key, value) {
        if (!this.socket || !this.currentRoomId) return;
        this.socket.emit('zoom:update-meeting-settings', {
            roomId: this.currentRoomId,
            settings: { [key]: value }
        });
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
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: true });
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
        const strip = document.getElementById('zoom-video-strip');
        if (!grid) return;

        if (dominant) {
            grid.classList.add('has-screen-share');
            if (strip) strip.style.display = 'flex';

            // Move all non-dominant tiles to strip
            const dominantTile = document.getElementById(tileId);
            document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('dominant'));
            if (dominantTile) { dominantTile.classList.add('dominant'); grid.appendChild(dominantTile); }

            document.querySelectorAll('.video-tile:not(.dominant)').forEach(t => {
                if (strip) strip.appendChild(t);
            });
        } else {
            grid.classList.remove('has-screen-share');
            document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('dominant'));

            // Move all tiles back from strip to grid
            if (strip) {
                Array.from(strip.querySelectorAll('.video-tile')).forEach(t => grid.appendChild(t));
                strip.style.display = 'none';
            }
        }
    }

    // Return the right container for new tiles (strip when screen sharing, grid otherwise)
    _getTileContainer() {
        const strip = document.getElementById('zoom-video-strip');
        if (strip && strip.style.display !== 'none') return strip;
        return document.getElementById('zoom-video-grid');
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
        const grid = this._getTileContainer();
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
        const grid = this._getTileContainer();
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
        if (!tile) { tile = this._makeTile('tile-' + socketId, '', name); this._getTileContainer()?.appendChild(tile); }
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
        this.breakoutRooms = []; this.breakoutParticipants = []; this.inBreakout = false;
        this.polls.clear(); this.qaEnabled = false; this.qaQuestions = [];
        if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
        this.timerEndTime = null;
        this.raisedHands.clear(); this.myHandRaised = false;
        const helpBtn = document.getElementById('zoom-btn-help');
        if (helpBtn) helpBtn.style.display = 'none';
        const raiseBtn = document.getElementById('zoom-btn-raise-hand');
        if (raiseBtn) raiseBtn.classList.remove('active');
        this._stopVBProcessing();
        const overlay = document.getElementById('breakout-timer-overlay');
        if (overlay) overlay.style.display = 'none';
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
        const pidMap = {};
        (participants || []).forEach(p => { pidMap[p.socketId] = p.name; });
        this.breakoutParticipants = (participants || []).filter(p => p.socketId !== this.socket?.id);
        this.breakoutRooms = rooms.map(r => ({
            id: r.id, name: r.name,
            members: (r.participants || []).map(sid => ({ socketId: sid, name: pidMap[sid] || sid }))
        }));
        this.renderBreakoutAssign(this.breakoutRooms);
    }

    onBreakoutUpdated({ rooms, participants }) {
        // If server sends updated participants, update our list
        if (participants && participants.length) {
            this.breakoutParticipants = participants.filter(p => p.socketId !== this.socket?.id);
        }
        const pidMap = {};
        this.breakoutParticipants.forEach(p => { pidMap[p.socketId] = p.name; });
        this.breakoutRooms = rooms.map(r => ({
            id: r.id, name: r.name,
            members: (r.participants || []).map(sid => ({ socketId: sid, name: pidMap[sid] || sid }))
        }));
        this.renderBreakoutAssign(this.breakoutRooms);
    }

    renderBreakoutAssign(rooms) {
        const container = document.getElementById('breakout-assign-area');
        if (!container) return;

        // Determine unassigned participants
        const assignedSids = new Set();
        rooms.forEach(r => (r.members || []).forEach(m => assignedSids.add(m.socketId)));
        const unassigned = (this.breakoutParticipants || []).filter(p => !assignedSids.has(p.socketId));

        const chip = (m, fromRoomId) => `
            <div class="breakout-member-chip" draggable="true" data-socketid="${m.socketId}"
                 ondragstart="event.dataTransfer.setData('socketId','${m.socketId}');event.dataTransfer.setData('name','${m.name}')">
                <i class="fas fa-user"></i> ${m.name}
            </div>`;

        container.innerHTML = `
            ${unassigned.length ? `
            <div style="margin-bottom:0.75rem;">
                <div style="font-size:0.78rem;color:var(--gray);margin-bottom:4px;">לא משויכים (${unassigned.length})</div>
                <div class="breakout-unassigned" id="br-col-unassigned"
                     ondragover="event.preventDefault()" ondrop="zoomManager.dropToBreakout(event,'unassigned')"
                     style="display:flex;flex-wrap:wrap;gap:4px;min-height:32px;background:var(--dark);border-radius:6px;padding:6px;border:1px dashed var(--dark3);">
                    ${unassigned.map(m => chip(m, null)).join('')}
                </div>
            </div>` : ''}
            <div class="breakout-rooms-grid">
                ${rooms.map(r => `
                    <div class="breakout-room-col" id="br-col-${r.id}" ondragover="event.preventDefault()" ondrop="zoomManager.dropToBreakout(event,'${r.id}')">
                        <div class="breakout-room-header" style="display:flex;align-items:center;justify-content:space-between;">
                            <span>${r.name} <small style="color:var(--gray)">(${(r.members||[]).length})</small></span>
                            <button class="btn btn-sm btn-outline" style="padding:2px 7px;font-size:0.75rem;" onclick="zoomManager.visitBreakout('${r.id}')"><i class="fas fa-door-open"></i> כנס</button>
                        </div>
                        <div class="breakout-room-members" id="br-members-${r.id}">
                            ${(r.members || []).map(m => chip(m, r.id)).join('')}
                        </div>
                    </div>`).join('')}
            </div>
            <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                <button class="btn btn-secondary btn-sm" onclick="zoomManager.randomAssignBreakout()"><i class="fas fa-random"></i> שיוך אקראי</button>
                <button class="btn btn-primary" onclick="zoomManager.launchBreakoutRooms()"><i class="fas fa-play"></i> פתח חדרים</button>
                <button class="btn btn-danger btn-sm" onclick="zoomManager.closeBreakoutRooms()"><i class="fas fa-times"></i> סגור הכל</button>
                <div style="display:flex;align-items:center;gap:0.4rem;margin-right:auto;">
                    <label style="font-size:0.85rem;">טיימר (0=ללא):</label>
                    <input type="number" id="breakout-timer-min" min="0" max="120" value="0" style="width:55px;" class="form-control">
                    <span style="font-size:0.85rem;">דק'</span>
                </div>
            </div>
            <div style="margin-top:0.75rem;border-top:1px solid var(--dark3);padding-top:0.75rem;">
                <div style="font-size:0.82rem;color:var(--gray);margin-bottom:0.35rem;"><i class="fas fa-broadcast-tower"></i> שידור לכל החדרים</div>
                <div style="display:flex;gap:0.4rem;">
                    <input type="text" id="breakout-broadcast-input" class="form-control" placeholder="הודעה לכל המשתתפים..." style="font-size:0.82rem;">
                    <button class="btn btn-primary btn-sm" onclick="zoomManager.broadcastToBreakout()"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>`;
    }

    dropToBreakout(event, roomId) {
        const socketId = event.dataTransfer.getData('socketId');
        if (!socketId) return;
        if (roomId === 'unassigned') {
            // Remove from all rooms (server side: assign to a virtual "unassigned" - just remove from rooms)
            this.socket.emit('zoom:assign-breakout', { roomId: this.currentRoomId, targetSocketId: socketId, brId: '' });
        } else {
            this.socket.emit('zoom:assign-breakout', { roomId: this.currentRoomId, targetSocketId: socketId, brId: roomId });
        }
    }

    randomAssignBreakout() {
        this.socket.emit('zoom:random-assign-breakout', { roomId: this.currentRoomId });
    }

    launchBreakoutRooms() {
        const timerMin = parseInt(document.getElementById('breakout-timer-min')?.value) || 0;
        this.socket.emit('zoom:launch-breakout-rooms', { roomId: this.currentRoomId });
        if (timerMin > 0) {
            setTimeout(() => {
                this.socket.emit('zoom:set-breakout-timer', { roomId: this.currentRoomId, seconds: timerMin * 60 });
            }, 600);
        }
        this._showToast('חדרי הפרצת הושקו!');
    }

    onMoveToBreakout({ brRoomId, brName, mainRoomId, peers }) {
        this._showToast('עוברים לחדר: ' + brName);
        this.mainRoomId = mainRoomId;
        this._resetForBreakout();
        this.inBreakout = true;
        this.currentRoomId = brRoomId;
        this.updateRoomLink(brRoomId);
        // Show help button for participants (not host)
        if (!this.isHost && !this.isCoHost) {
            const helpBtn = document.getElementById('zoom-btn-help');
            if (helpBtn) helpBtn.style.display = '';
        }
        this.startLocalStream().then(() => {
            this.addLocalTile();
            peers.forEach(p => {
                this.addRemoteTilePlaceholder(p.socketId, p.name);
                this.createOffer(p.socketId, p.name);
            });
        });
    }

    onReturnToMain() {
        const helpBtn = document.getElementById('zoom-btn-help');
        if (helpBtn) helpBtn.style.display = 'none';
        if (!this.inBreakout) {
            this._showToast('חדרי הפרצת נסגרו');
            return;
        }
        this._showToast('חוזרים לשיחה הראשית...');
        const mainRoom = this.mainRoomId;
        this._resetForBreakout();
        this.inBreakout = false;
        this.currentRoomId = mainRoom;
        this.updateRoomLink(mainRoom);
        this.startLocalStream().then(() => {
            this.socket.emit('zoom:request-join', { roomId: mainRoom, userName: this.userName, userId: this.userId });
        });
    }

    onBreakoutTimerStarted({ seconds, endsAt }) {
        const endAt = endsAt || (Date.now() + seconds * 1000);
        this._showBreakoutTimerOverlay();
        const tick = () => {
            const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            const timeStr = `${m}:${s.toString().padStart(2,'0')}`;

            // Update plugin panel display
            const el = document.getElementById('breakout-timer-display');
            if (el) el.textContent = `נותר: ${timeStr}`;

            // Update overlay (for participants in breakout rooms)
            const overlay = document.getElementById('breakout-timer-overlay');
            if (overlay) {
                overlay.innerHTML = `<i class="fas fa-clock"></i> חדר פרצת — נותר: ${timeStr}`;
                overlay.classList.toggle('urgent', remaining > 0 && remaining <= 30);
            }

            if (remaining > 0) setTimeout(tick, 1000);
            else {
                if (overlay) {
                    overlay.innerHTML = '<i class="fas fa-check-circle"></i> הזמן נגמר — חוזרים לשיחה הראשית';
                    setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 4000);
                }
            }
        };
        tick();
    }

    _showBreakoutTimerOverlay() {
        let overlay = document.getElementById('breakout-timer-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'breakout-timer-overlay';
            overlay.className = 'breakout-timer-overlay';
            const callContainer = document.getElementById('zoom-call-container');
            if (callContainer) callContainer.appendChild(overlay);
        }
        overlay.style.display = 'flex';
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

    // ── Virtual Background ────────────────────────────────────────────────────
    openBgPicker() {
        if (!this.localStream) { this._showToast('יש להיות בשיחה פעילה'); return; }
        document.querySelectorAll('.bg-option').forEach(el => el.classList.remove('selected'));
        const currentKey = this.virtualBgType === 'none' ? 'none'
            : this.virtualBgType === 'blur' ? 'blur' : this.virtualBgPreset;
        const sel = document.querySelector(`.bg-option[data-bg="${currentKey}"]`);
        if (sel) sel.classList.add('selected');
        this.loadCustomBackgrounds();
        if (typeof openModal === 'function') openModal('modal-bg-picker');
    }

    async setVirtualBackground(type, preset) {
        // Update UI
        document.querySelectorAll('.bg-option').forEach(el => el.classList.remove('selected'));
        const key = type === 'none' ? 'none' : type === 'blur' ? 'blur' : preset;
        const sel = document.querySelector(`.bg-option[data-bg="${key}"]`);
        if (sel) sel.classList.add('selected');

        const wasActive = this.virtualBgType !== 'none';
        this.virtualBgType = type;
        this.virtualBgPreset = preset || null;

        if (type === 'none') {
            if (wasActive) this._stopVBProcessing();
            return;
        }

        if (!this.localStream) { this._showToast('יש להפעיל מצלמה תחילה'); return; }

        if (wasActive && this.virtualBgCanvas) {
            // Already running — just change type/preset, no need to restart
            return;
        }

        this._showToast('מפעיל רקע וירטואלי...');
        await this._startVBProcessing();
    }

    async _startVBProcessing() {
        if (!this.localStream) return;

        // Create canvas
        this.virtualBgCanvas = document.createElement('canvas');
        this.virtualBgCanvas.width = 640;
        this.virtualBgCanvas.height = 360;
        this.virtualBgCtx = this.virtualBgCanvas.getContext('2d');

        // Create video element for MediaPipe input
        this._vbVideoEl = document.createElement('video');
        this._vbVideoEl.srcObject = this.localStream;
        this._vbVideoEl.autoplay = true;
        this._vbVideoEl.muted = true;
        this._vbVideoEl.playsInline = true;
        await this._vbVideoEl.play().catch(() => {});

        const startCapture = () => {
            // Create virtual stream from canvas
            this.virtualBgStream = this.virtualBgCanvas.captureStream(25);
            const virtualTrack = this.virtualBgStream.getVideoTracks()[0];

            // Replace video track in all peers
            if (virtualTrack) {
                this.peers.forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(virtualTrack);
                });
            }

            // Show virtual stream in local tile
            const lv = document.getElementById('local-video');
            if (lv) lv.srcObject = this.virtualBgStream;
        };

        // Try MediaPipe
        if (window.SelfieSegmentation) {
            try {
                this.selfieSegmentation = new SelfieSegmentation({
                    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`
                });
                this.selfieSegmentation.setOptions({ modelSelection: 1, selfieMode: false });
                this.selfieSegmentation.onResults(r => this._onSegmentResults(r));
                await this.selfieSegmentation.initialize();
                startCapture();

                const processFrame = async () => {
                    if (this.virtualBgType === 'none' || !this._vbVideoEl) return;
                    try { await this.selfieSegmentation.send({ image: this._vbVideoEl }); } catch(e) {}
                    this._vbAnimId = requestAnimationFrame(processFrame);
                };
                this._vbAnimId = requestAnimationFrame(processFrame);
                this._showToast('רקע וירטואלי פעיל');
                return;
            } catch(e) {
                console.warn('MediaPipe failed, using fallback:', e);
                if (this.selfieSegmentation) { try { await this.selfieSegmentation.close(); } catch(e2) {} this.selfieSegmentation = null; }
            }
        }

        // Fallback: simple canvas (no segmentation — full blur)
        startCapture();
        const renderFallback = () => {
            if (this.virtualBgType === 'none' || !this._vbVideoEl) return;
            const ctx = this.virtualBgCtx;
            const canvas = this.virtualBgCanvas;
            ctx.save();
            if (this.virtualBgType === 'blur') {
                ctx.filter = 'blur(10px)';
                ctx.drawImage(this._vbVideoEl, 0, 0, canvas.width, canvas.height);
            } else if (this.virtualBgType === 'custom' && this._customBgImg) {
                ctx.drawImage(this._customBgImg, 0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 0.85;
                ctx.drawImage(this._vbVideoEl, 0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 1;
            } else {
                this._drawPresetBg(ctx, canvas.width, canvas.height);
                ctx.globalAlpha = 0.85;
                ctx.drawImage(this._vbVideoEl, 0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 1;
            }
            ctx.restore();
            this._vbAnimId = requestAnimationFrame(renderFallback);
        };
        this._vbAnimId = requestAnimationFrame(renderFallback);
        this._showToast('רקע וירטואלי פעיל (מצב בסיסי)');
    }

    _onSegmentResults(results) {
        if (this.virtualBgType === 'none' || !this.virtualBgCtx) return;
        const canvas = this.virtualBgCanvas;
        const ctx = this.virtualBgCtx;
        const w = canvas.width, h = canvas.height;

        ctx.save();
        ctx.clearRect(0, 0, w, h);

        // Step 1: Draw the person from original image
        ctx.drawImage(results.image, 0, 0, w, h);

        // Step 2: Mask — keep only person pixels (white=person in segmentation mask)
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(results.segmentationMask, 0, 0, w, h);

        // Step 3: Draw background BEHIND person
        ctx.globalCompositeOperation = 'destination-over';
        if (this.virtualBgType === 'blur') {
            ctx.filter = 'blur(18px)';
            ctx.drawImage(results.image, -30, -30, w + 60, h + 60);
            ctx.filter = 'none';
        } else if (this.virtualBgType === 'preset') {
            this._drawPresetBg(ctx, w, h);
        } else if (this.virtualBgType === 'custom' && this._customBgImg) {
            ctx.drawImage(this._customBgImg, 0, 0, w, h);
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    _drawPresetBg(ctx, w, h) {
        const presets = {
            night:  () => { ctx.fillStyle = '#0a1628'; ctx.fillRect(0, 0, w, h); },
            forest: () => { ctx.fillStyle = '#0d2818'; ctx.fillRect(0, 0, w, h); },
            galaxy: () => {
                const g = ctx.createLinearGradient(0, 0, w, h);
                g.addColorStop(0, '#1a0533'); g.addColorStop(1, '#2d1b69');
                ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            },
            sea: () => {
                const g = ctx.createLinearGradient(0, 0, w, h);
                g.addColorStop(0, '#1a3a5c'); g.addColorStop(1, '#0a7575');
                ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            },
            coffee: () => {
                const g = ctx.createLinearGradient(0, 0, w, h);
                g.addColorStop(0, '#3a1a0a'); g.addColorStop(1, '#6b3a1f');
                ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            },
            office: () => {
                const g = ctx.createLinearGradient(0, 0, w, h);
                g.addColorStop(0, '#1e293b'); g.addColorStop(1, '#334155');
                ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            }
        };
        const draw = presets[this.virtualBgPreset];
        if (draw) draw();
        else { ctx.fillStyle = '#0a1628'; ctx.fillRect(0, 0, w, h); }
    }

    _stopVBProcessing() {
        if (this._vbAnimId) { cancelAnimationFrame(this._vbAnimId); this._vbAnimId = null; }
        if (this.selfieSegmentation) {
            try { this.selfieSegmentation.close(); } catch(e) {}
            this.selfieSegmentation = null;
        }
        if (this._vbVideoEl) { this._vbVideoEl.pause(); this._vbVideoEl = null; }
        if (this.virtualBgStream) { this.virtualBgStream.getTracks().forEach(t => t.stop()); this.virtualBgStream = null; }
        this.virtualBgCanvas = null; this.virtualBgCtx = null;
        this.virtualBgType = 'none'; this.virtualBgPreset = null;

        // Restore original camera track to peers
        if (this.localStream && !this.isScreenSharing) {
            const camTrack = this.localStream.getVideoTracks()[0];
            if (camTrack) {
                this.peers.forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(camTrack).catch(() => {});
                });
            }
            const lv = document.getElementById('local-video');
            if (lv && this.localStream) lv.srcObject = this.localStream;
        }
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

    // ── Raise Hand ────────────────────────────────────────────────────────────
    toggleRaiseHand() {
        if (!this.socket || !this.currentRoomId) return;
        this.myHandRaised = !this.myHandRaised;
        const btn = document.getElementById('zoom-btn-raise-hand');
        if (this.myHandRaised) {
            this.socket.emit('zoom:raise-hand', { roomId: this.currentRoomId });
            if (btn) { btn.classList.add('active'); btn.title = 'הורד יד'; }
            this._playHandRaisedSound();
        } else {
            this.socket.emit('zoom:lower-hand', { roomId: this.currentRoomId });
            if (btn) { btn.classList.remove('active'); btn.title = 'הרם יד'; }
        }
    }

    onHandRaised({ socketId, name }) {
        this.raisedHands.set(socketId, name);
        if (socketId !== this.socket?.id) this._playHandRaisedSound();
        const row = document.querySelector(`[data-participant-sid="${socketId}"]`);
        if (row) {
            const nameEl = row.querySelector('.zoom-participant-name');
            if (nameEl && !nameEl.querySelector('.hand-raised-icon')) {
                const span = document.createElement('span');
                span.className = 'hand-raised-icon'; span.title = 'יד מורמת'; span.textContent = ' ✋';
                nameEl.appendChild(span);
            }
        }
    }

    onHandLowered({ socketId }) {
        this.raisedHands.delete(socketId);
        if (socketId === this.socket?.id) {
            this.myHandRaised = false;
            const btn = document.getElementById('zoom-btn-raise-hand');
            if (btn) btn.classList.remove('active');
        }
        document.querySelectorAll(`[data-participant-sid="${socketId}"] .hand-raised-icon`).forEach(el => el.remove());
    }

    onAllHandsLowered() {
        this.raisedHands.clear();
        this.myHandRaised = false;
        const btn = document.getElementById('zoom-btn-raise-hand');
        if (btn) btn.classList.remove('active');
        document.querySelectorAll('.hand-raised-icon').forEach(el => el.remove());
    }

    lowerAllHands() {
        if (!this.isHost && !this.isCoHost) return;
        this.socket.emit('zoom:lower-all-hands', { roomId: this.currentRoomId });
    }

    _playHandRaisedSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 660; osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
            setTimeout(() => { try { ctx.close(); } catch(e) {} }, 1000);
        } catch(e) {}
    }

    // ── Help Request (from breakout room) ─────────────────────────────────────
    requestHelp() {
        if (!this.socket || !this.inBreakout) return;
        this.socket.emit('zoom:help-request', { roomId: this.mainRoomId, brRoomId: this.currentRoomId });
        this._showToast('בקשת עזרה נשלחה למארח');
    }

    onHelpRequested({ fromName, brRoomId }) {
        this._showHelpNotification(fromName, brRoomId);
    }

    _showHelpNotification(fromName, brRoomId) {
        const notif = document.createElement('div');
        notif.className = 'help-notification';
        const brId = brRoomId ? brRoomId.split('__')[1] || brRoomId : '';
        notif.innerHTML = `
            <div class="help-notif-content">
                <i class="fas fa-hand-paper" style="color:#f59e0b;font-size:1.2rem;"></i>
                <span>${fromName} מבקש עזרה בחדר ${brId}</span>
                <button class="btn btn-primary btn-sm" onclick="zoomManager.visitBreakout('${brId}');this.closest('.help-notification').remove()">
                    <i class="fas fa-door-open"></i> כנס
                </button>
                <button class="help-notif-close" onclick="this.closest('.help-notification').remove()">&times;</button>
            </div>`;
        document.body.appendChild(notif);
        setTimeout(() => { if (notif.parentNode) notif.remove(); }, 15000);
    }

    // ── Breakout Broadcast ────────────────────────────────────────────────────
    broadcastToBreakout() {
        const input = document.getElementById('breakout-broadcast-input');
        const msg = input?.value.trim();
        if (!msg) return;
        this.socket.emit('zoom:broadcast-to-breakout', { roomId: this.currentRoomId || this.mainRoomId, message: msg });
        if (input) input.value = '';
    }

    onBreakoutBroadcast({ from, message, ts }) {
        const time = new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const msgs = document.getElementById('zoom-chat-messages');
        if (msgs) {
            const div = document.createElement('div');
            div.className = 'zoom-chat-msg broadcast-msg';
            div.innerHTML = `<div class="zoom-chat-msg-from"><i class="fas fa-broadcast-tower"></i> שידור מ${from} · ${time}</div><div>${message}</div>`;
            msgs.appendChild(div);
            msgs.scrollTop = msgs.scrollHeight;
        }
        this._showToast('שידור: ' + message.substring(0, 60));
    }

    // ── Host Visit Breakout Room ──────────────────────────────────────────────
    visitBreakout(brId) {
        if (!this.socket) return;
        const roomId = this.inBreakout ? this.mainRoomId : this.currentRoomId;
        this.socket.emit('zoom:navigate-breakout', { roomId, brId });
    }

    onBreakoutNavResponse({ brRoomId, brName, mainRoomId, peers }) {
        this._showToast('נכנסת לחדר: ' + brName);
        if (!this.mainRoomId) this.mainRoomId = mainRoomId;
        this._resetForBreakout();
        this.inBreakout = true;
        this.currentRoomId = brRoomId;
        this.updateRoomLink(brRoomId);
        this.startLocalStream().then(() => {
            this.addLocalTile();
            peers.forEach(p => {
                this.addRemoteTilePlaceholder(p.socketId, p.name);
                this.createOffer(p.socketId, p.name);
            });
        });
    }

    // ── Switch Breakout Room (participant) ────────────────────────────────────
    switchBreakoutRoom(brId) {
        if (!this.socket || !this.inBreakout) return;
        this.socket.emit('zoom:switch-breakout-room', { roomId: this.mainRoomId, newBrId: brId });
    }

    // ── Guest Ended Screen ────────────────────────────────────────────────────
    _showGuestEndedScreen(msg) {
        this.fullReset();
        let overlay = document.getElementById('guest-ended-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'guest-ended-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;background:#0d1117;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;color:#fff;text-align:center;';
            document.body.appendChild(overlay);
        }
        let count = 5;
        overlay.innerHTML = `
            <i class="fas fa-video-slash" style="font-size:4rem;color:#ef4444;margin-bottom:1rem;"></i>
            <h2 style="margin-bottom:0.5rem;">השיחה הסתיימה</h2>
            <p style="color:#94a3b8;">${msg}</p>
            <p id="guest-redirect-count" style="color:#64748b;margin-top:1rem;">מועבר לדף הבית בעוד ${count}...</p>`;
        const interval = setInterval(() => {
            count--;
            const el = document.getElementById('guest-redirect-count');
            if (el) el.textContent = `מועבר לדף הבית בעוד ${count}...`;
            if (count <= 0) { clearInterval(interval); window.location.href = '/'; }
        }, 1000);
    }

    // ── Custom Backgrounds ────────────────────────────────────────────────────
    async uploadBackground(input) {
        const file = input.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const bgs = await apiFetch('/api/auth/backgrounds', { method: 'POST', body: { dataUrl: e.target.result } });
                this._renderCustomBackgrounds(bgs);
                this._showToast('הרקע נשמר!');
            } catch(err) { this._showToast('שגיאה בשמירת הרקע'); }
        };
        reader.readAsDataURL(file);
        input.value = '';
    }

    async loadCustomBackgrounds() {
        if (this.userRole === 'guest') return;
        try {
            const bgs = await apiFetch('/api/auth/backgrounds');
            this._customBgList = bgs || [];
            this._renderCustomBackgrounds(this._customBgList);
        } catch(e) {}
    }

    _renderCustomBackgrounds(backgrounds) {
        const container = document.getElementById('bg-custom-container');
        if (!container) return;
        this._customBgList = backgrounds || [];
        if (!this._customBgList.length) {
            container.innerHTML = '<p style="font-size:0.78rem;color:var(--gray);grid-column:1/-1;">לא הועלו רקעים מותאמים אישית</p>';
            return;
        }
        container.innerHTML = this._customBgList.map((bg, idx) => `
            <div class="bg-option" onclick="zoomManager.setCustomBackground(${idx})">
                <div class="bg-preview" style="background-image:url(${bg});background-size:cover;background-position:center;"></div>
                <span>רקע ${idx + 1} <button onclick="event.stopPropagation();zoomManager.deleteBackground(${idx})" style="background:none;color:#ef4444;font-size:0.7rem;padding:0;margin-right:2px;" title="מחק">✕</button></span>
            </div>`).join('');
    }

    async deleteBackground(idx) {
        try {
            const bgs = await apiFetch('/api/auth/backgrounds/' + idx, { method: 'DELETE' });
            this._renderCustomBackgrounds(bgs);
        } catch(e) { this._showToast('שגיאה במחיקה'); }
    }

    async setCustomBackground(idx) {
        if (!this._customBgList || !this._customBgList[idx]) return;
        const dataUrl = this._customBgList[idx];
        const img = new Image();
        img.onload = async () => {
            this._customBgImg = img;
            const wasActive = this.virtualBgType !== 'none';
            this.virtualBgType = 'custom';
            this.virtualBgPreset = null;
            if (wasActive && this.virtualBgCanvas) return; // already running
            await this._startVBProcessing();
        };
        img.src = dataUrl;
    }
}

window.zoomManager = new ZoomManager();
