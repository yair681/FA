/**
 * DebugPanel — Real-time debug panel for FA video call application.
 * Works independently of zoom.js. Safe to load before all other scripts.
 * RTL-compatible (app is in Hebrew).
 */
(function () {
  'use strict';

  // ── Constants ───────────────────────────────────────────────────────────────
  var MAX_ENTRIES    = 200;
  var PANEL_ID       = 'debug-panel';
  var TOGGLE_BTN_ID  = 'debug-toggle-btn';
  var LIST_ID        = 'debug-log-list';
  var BADGE_ID       = 'debug-badge';

  var SEVERITY = {
    error:   { icon: '🔴', label: 'error',   color: '#ef4444' },
    warn:    { icon: '🟡', label: 'warn',    color: '#f59e0b' },
    info:    { icon: '🟢', label: 'info',    color: '#22c55e' },
    debug:   { icon: '🔵', label: 'debug',   color: '#60a5fa' },
    webrtc:  { icon: '🔵', label: 'webrtc',  color: '#a78bfa' },
    socket:  { icon: '🟡', label: 'socket',  color: '#fb923c' },
    server:  { icon: '🔴', label: 'server',  color: '#f87171' }
  };

  // ── CSS injected once ────────────────────────────────────────────────────────
  var CSS = [
    /* Toggle button — sits on left side (LTR=right, but app is RTL so physical left) */
    '#debug-toggle-btn {',
    '  position: fixed;',
    '  left: 0;',
    '  top: 50%;',
    '  transform: translateY(-50%);',
    '  z-index: 99999;',
    '  width: 36px;',
    '  height: 36px;',
    '  border-radius: 0 8px 8px 0;',
    '  background: #1e293b;',
    '  border: 1px solid #334155;',
    '  border-left: none;',
    '  color: #fff;',
    '  font-size: 18px;',
    '  cursor: pointer;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  box-shadow: 2px 0 8px rgba(0,0,0,0.4);',
    '  transition: background 0.2s;',
    '  padding: 0;',
    '  line-height: 1;',
    '}',
    '#debug-toggle-btn:hover { background: #334155; }',

    /* Badge on toggle button */
    '#debug-badge {',
    '  position: absolute;',
    '  top: 2px;',
    '  right: 2px;',
    '  min-width: 16px;',
    '  height: 16px;',
    '  background: #ef4444;',
    '  color: #fff;',
    '  border-radius: 8px;',
    '  font-size: 10px;',
    '  font-weight: 700;',
    '  display: none;',
    '  align-items: center;',
    '  justify-content: center;',
    '  padding: 0 3px;',
    '  line-height: 1;',
    '  pointer-events: none;',
    '}',

    /* Panel */
    '#debug-panel {',
    '  position: fixed;',
    '  left: 0;',
    '  top: 0;',
    '  height: 100%;',
    '  width: 360px;',
    '  max-width: 90vw;',
    '  z-index: 99998;',
    '  background: #0f172a;',
    '  border-right: 1px solid #334155;',
    '  display: flex;',
    '  flex-direction: column;',
    '  font-family: "Fira Mono", "Consolas", "Courier New", monospace;',
    '  font-size: 11.5px;',
    '  color: #e2e8f0;',
    '  transform: translateX(-100%);',
    '  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);',
    '  box-shadow: 4px 0 24px rgba(0,0,0,0.5);',
    '  direction: ltr;',   /* always LTR inside the panel regardless of page RTL */
    '}',
    '#debug-panel.open { transform: translateX(0); }',

    /* Header */
    '#debug-header {',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: space-between;',
    '  padding: 8px 10px;',
    '  background: #1e293b;',
    '  border-bottom: 1px solid #334155;',
    '  flex-shrink: 0;',
    '}',
    '#debug-header-title {',
    '  font-size: 12px;',
    '  font-weight: 700;',
    '  color: #94a3b8;',
    '  letter-spacing: 0.05em;',
    '  text-transform: uppercase;',
    '}',
    '#debug-header-actions { display: flex; gap: 6px; }',
    '.debug-action-btn {',
    '  background: #334155;',
    '  border: none;',
    '  color: #94a3b8;',
    '  font-size: 10px;',
    '  padding: 3px 8px;',
    '  border-radius: 4px;',
    '  cursor: pointer;',
    '  font-family: inherit;',
    '  transition: background 0.15s, color 0.15s;',
    '}',
    '.debug-action-btn:hover { background: #475569; color: #e2e8f0; }',

    /* Filter bar */
    '#debug-filter-bar {',
    '  display: flex;',
    '  gap: 4px;',
    '  padding: 6px 8px;',
    '  background: #0f172a;',
    '  border-bottom: 1px solid #1e293b;',
    '  flex-wrap: wrap;',
    '  flex-shrink: 0;',
    '}',
    '.debug-filter-btn {',
    '  background: #1e293b;',
    '  border: 1px solid #334155;',
    '  color: #64748b;',
    '  font-size: 9.5px;',
    '  padding: 2px 7px;',
    '  border-radius: 3px;',
    '  cursor: pointer;',
    '  font-family: inherit;',
    '  transition: all 0.15s;',
    '}',
    '.debug-filter-btn.active { background: #334155; color: #e2e8f0; border-color: #475569; }',

    /* Log list */
    '#debug-log-list {',
    '  flex: 1;',
    '  overflow-y: auto;',
    '  overflow-x: hidden;',
    '  padding: 4px 0;',
    '}',
    '#debug-log-list::-webkit-scrollbar { width: 5px; }',
    '#debug-log-list::-webkit-scrollbar-track { background: #0f172a; }',
    '#debug-log-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }',

    /* Log entry */
    '.debug-entry {',
    '  padding: 4px 10px;',
    '  border-bottom: 1px solid #1a2540;',
    '  cursor: pointer;',
    '  transition: background 0.1s;',
    '  word-break: break-word;',
    '}',
    '.debug-entry:hover { background: #1e293b; }',
    '.debug-entry-header {',
    '  display: flex;',
    '  align-items: baseline;',
    '  gap: 6px;',
    '  flex-wrap: nowrap;',
    '}',
    '.debug-entry-icon { flex-shrink: 0; font-size: 10px; line-height: 1.6; }',
    '.debug-entry-time { color: #475569; font-size: 10px; flex-shrink: 0; }',
    '.debug-entry-type {',
    '  font-size: 9px;',
    '  font-weight: 700;',
    '  letter-spacing: 0.06em;',
    '  text-transform: uppercase;',
    '  flex-shrink: 0;',
    '  min-width: 44px;',
    '}',
    '.debug-entry-msg {',
    '  font-size: 11px;',
    '  color: #cbd5e1;',
    '  white-space: nowrap;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  flex: 1;',
    '  min-width: 0;',
    '}',
    '.debug-entry-details {',
    '  display: none;',
    '  margin-top: 4px;',
    '  padding: 5px 7px;',
    '  background: #0a1628;',
    '  border-radius: 4px;',
    '  font-size: 10.5px;',
    '  color: #94a3b8;',
    '  white-space: pre-wrap;',
    '  word-break: break-all;',
    '  max-height: 180px;',
    '  overflow-y: auto;',
    '  border: 1px solid #1e293b;',
    '}',
    '.debug-entry.expanded .debug-entry-details { display: block; }',
    '.debug-entry.expanded .debug-entry-msg { white-space: normal; overflow: visible; text-overflow: unset; }',

    /* Empty state */
    '#debug-empty {',
    '  text-align: center;',
    '  color: #475569;',
    '  font-size: 12px;',
    '  padding: 32px 16px;',
    '}',

    /* Footer / status */
    '#debug-footer {',
    '  padding: 5px 10px;',
    '  background: #1e293b;',
    '  border-top: 1px solid #334155;',
    '  font-size: 10px;',
    '  color: #475569;',
    '  flex-shrink: 0;',
    '  display: flex;',
    '  justify-content: space-between;',
    '}'
  ].join('\n');

  // ── State ────────────────────────────────────────────────────────────────────
  var entries        = [];
  var unreadErrors   = 0;
  var isOpen         = false;
  var activeFilter   = 'all';
  var domReady       = false;
  var pendingEntries = [];  // entries logged before DOM ready

  // ── DOM helpers ──────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function injectStyles() {
    if (document.getElementById('debug-panel-styles')) return;
    var style = document.createElement('style');
    style.id  = 'debug-panel-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildDOM() {
    injectStyles();

    // Toggle button
    var btn = document.createElement('button');
    btn.id    = TOGGLE_BTN_ID;
    btn.title = 'Debug Panel';
    btn.innerHTML = '<span style="font-size:16px;line-height:1;">🐛</span><span id="' + BADGE_ID + '"></span>';
    btn.addEventListener('click', togglePanel);
    document.body.appendChild(btn);

    // Panel
    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = [
      '<div id="debug-header">',
      '  <span id="debug-header-title">🐛 Debug Panel</span>',
      '  <div id="debug-header-actions">',
      '    <button class="debug-action-btn" id="debug-ping-btn" title="Ping server for room state">Ping</button>',
      '    <button class="debug-action-btn" id="debug-copy-btn">Copy All</button>',
      '    <button class="debug-action-btn" id="debug-clear-btn">Clear</button>',
      '    <button class="debug-action-btn" id="debug-close-btn">✕</button>',
      '  </div>',
      '</div>',
      '<div id="debug-filter-bar">',
      '  <button class="debug-filter-btn active" data-filter="all">All</button>',
      '  <button class="debug-filter-btn" data-filter="error">Error</button>',
      '  <button class="debug-filter-btn" data-filter="warn">Warn</button>',
      '  <button class="debug-filter-btn" data-filter="webrtc">WebRTC</button>',
      '  <button class="debug-filter-btn" data-filter="socket">Socket</button>',
      '  <button class="debug-filter-btn" data-filter="server">Server</button>',
      '  <button class="debug-filter-btn" data-filter="info">Info</button>',
      '</div>',
      '<div id="' + LIST_ID + '"><div id="debug-empty">No log entries yet.</div></div>',
      '<div id="debug-footer">',
      '  <span id="debug-count">0 entries</span>',
      '  <span id="debug-session">Session: ' + new Date().toLocaleTimeString() + '</span>',
      '</div>'
    ].join('');
    document.body.appendChild(panel);

    // Wire up buttons
    $('debug-close-btn').addEventListener('click', togglePanel);
    $('debug-clear-btn').addEventListener('click', clearLog);
    $('debug-copy-btn').addEventListener('click', copyAll);
    $('debug-ping-btn').addEventListener('click', pingServer);

    // Filter buttons
    panel.querySelectorAll('.debug-filter-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        activeFilter = b.dataset.filter;
        panel.querySelectorAll('.debug-filter-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        renderAll();
      });
    });

    domReady = true;

    // Flush pending entries that arrived before DOM was ready
    if (pendingEntries.length) {
      pendingEntries.forEach(function (e) { _appendToDOM(e); });
      pendingEntries = [];
      updateFooter();
    }
  }

  // ── Panel visibility ─────────────────────────────────────────────────────────
  function togglePanel() {
    isOpen = !isOpen;
    var panel = $(PANEL_ID);
    if (panel) panel.classList.toggle('open', isOpen);
    if (isOpen) {
      unreadErrors = 0;
      updateBadge();
      scrollToBottom();
    }
  }

  function openPanel() {
    if (!isOpen) togglePanel();
  }

  // ── Log entry creation ───────────────────────────────────────────────────────
  function createEntry(type, message, details) {
    var sev   = SEVERITY[type] || SEVERITY.debug;
    var entry = {
      id:      'de-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      type:    type,
      sev:     sev,
      message: String(message || ''),
      details: details !== undefined && details !== null ? _formatDetails(details) : null,
      time:    new Date()
    };
    return entry;
  }

  function _formatDetails(d) {
    if (typeof d === 'string') return d;
    try { return JSON.stringify(d, null, 2); } catch (e) { return String(d); }
  }

  // ── Core log method ──────────────────────────────────────────────────────────
  function addEntry(type, message, details) {
    var entry = createEntry(type, message, details);
    entries.push(entry);

    // Enforce max — remove oldest
    if (entries.length > MAX_ENTRIES) {
      var removed = entries.splice(0, entries.length - MAX_ENTRIES);
      if (domReady) {
        removed.forEach(function (e) {
          var el = document.getElementById(e.id);
          if (el) el.remove();
        });
      }
    }

    // Track unread errors
    if (type === 'error' || type === 'server') {
      if (!isOpen) {
        unreadErrors++;
        updateBadge();
      }
      // Auto-open panel on first error
      openPanel();
    }

    if (domReady) {
      _appendToDOM(entry);
      updateFooter();
    } else {
      pendingEntries.push(entry);
    }

    return entry;
  }

  // ── DOM rendering ────────────────────────────────────────────────────────────
  function _appendToDOM(entry) {
    var list = $(LIST_ID);
    if (!list) return;

    // Remove empty state placeholder
    var empty = $('debug-empty');
    if (empty) empty.remove();

    // Filter check — if filter active and this type doesn't match, still insert but maybe hide
    var visible = (activeFilter === 'all' || activeFilter === entry.type);

    var div = document.createElement('div');
    div.id        = entry.id;
    div.className = 'debug-entry' + (visible ? '' : ' debug-hidden');
    div.style.display = visible ? '' : 'none';

    var timeStr = entry.time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var msStr   = ('00' + entry.time.getMilliseconds()).slice(-3);

    div.innerHTML = [
      '<div class="debug-entry-header">',
      '  <span class="debug-entry-icon">' + entry.sev.icon + '</span>',
      '  <span class="debug-entry-time">' + timeStr + '.' + msStr + '</span>',
      '  <span class="debug-entry-type" style="color:' + entry.sev.color + '">' + entry.sev.label + '</span>',
      '  <span class="debug-entry-msg">' + _escapeHtml(entry.message) + '</span>',
      '</div>',
      entry.details
        ? '<div class="debug-entry-details">' + _escapeHtml(entry.details) + '</div>'
        : ''
    ].join('');

    if (entry.details) {
      div.addEventListener('click', function () {
        div.classList.toggle('expanded');
      });
    }

    list.appendChild(div);
    scrollToBottom();
  }

  function renderAll() {
    var list = $(LIST_ID);
    if (!list) return;
    // Toggle visibility of each entry based on active filter
    var nodes = list.querySelectorAll('.debug-entry');
    nodes.forEach(function (node) {
      var id    = node.id;
      var entry = entries.find(function (e) { return e.id === id; });
      if (!entry) return;
      var visible = (activeFilter === 'all' || activeFilter === entry.type);
      node.style.display = visible ? '' : 'none';
    });

    if (!list.querySelector('.debug-entry')) {
      if (!$('debug-empty')) {
        var empty = document.createElement('div');
        empty.id = 'debug-empty';
        empty.textContent = 'No log entries yet.';
        list.appendChild(empty);
      }
    }
  }

  function clearLog() {
    entries = [];
    pendingEntries = [];
    unreadErrors = 0;
    updateBadge();
    var list = $(LIST_ID);
    if (list) {
      list.innerHTML = '<div id="debug-empty">No log entries yet.</div>';
    }
    updateFooter();
  }

  function updateFooter() {
    var count = $('debug-count');
    if (count) count.textContent = entries.length + ' entr' + (entries.length === 1 ? 'y' : 'ies');
  }

  function updateBadge() {
    var badge = $(BADGE_ID);
    if (!badge) return;
    if (unreadErrors > 0) {
      badge.textContent = unreadErrors > 99 ? '99+' : String(unreadErrors);
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function scrollToBottom() {
    if (!isOpen) return;
    var list = $(LIST_ID);
    if (list) list.scrollTop = list.scrollHeight;
  }

  function _escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Copy all to clipboard ────────────────────────────────────────────────────
  function copyAll() {
    var text = entries.map(function (e) {
      var ts = e.time.toISOString();
      var line = '[' + ts + '] [' + e.sev.label.toUpperCase() + '] ' + e.message;
      if (e.details) line += '\n  ' + e.details.replace(/\n/g, '\n  ');
      return line;
    }).join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        _flashBtn('debug-copy-btn', 'Copied!');
      }).catch(function () {
        _fallbackCopy(text);
      });
    } else {
      _fallbackCopy(text);
    }
  }

  function _fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); _flashBtn('debug-copy-btn', 'Copied!'); } catch (e) {}
    document.body.removeChild(ta);
  }

  function _flashBtn(id, label) {
    var btn = $(id);
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = label;
    setTimeout(function () { btn.textContent = orig; }, 1500);
  }

  // ── Ping server ──────────────────────────────────────────────────────────────
  function pingServer() {
    // Try to reach zoomManager's socket if available
    var zm = window.zoomManager;
    if (zm && zm.socket && zm.socket.connected) {
      zm.socket.emit('debug:ping');
      addEntry('info', 'Sent debug:ping to server', null);
    } else {
      addEntry('warn', 'debug:ping — socket not connected', null);
    }
  }

  // ── Console override ─────────────────────────────────────────────────────────
  var _origError = console.error.bind(console);
  var _origWarn  = console.warn.bind(console);

  console.error = function () {
    _origError.apply(console, arguments);
    var msg = Array.prototype.slice.call(arguments).map(function (a) {
      return typeof a === 'object' ? JSON.stringify(a) : String(a);
    }).join(' ');
    addEntry('error', msg, null);
  };

  console.warn = function () {
    _origWarn.apply(console, arguments);
    var msg = Array.prototype.slice.call(arguments).map(function (a) {
      return typeof a === 'object' ? JSON.stringify(a) : String(a);
    }).join(' ');
    addEntry('warn', msg, null);
  };

  // ── Global error handlers ────────────────────────────────────────────────────
  window.addEventListener('error', function (ev) {
    var msg = ev.message || 'Unknown error';
    var loc = (ev.filename ? ev.filename.split('/').pop() : '') + (ev.lineno ? ':' + ev.lineno : '');
    addEntry('error', msg + (loc ? '  [' + loc + ']' : ''), ev.error ? ev.error.stack : null);
  });

  window.addEventListener('unhandledrejection', function (ev) {
    var reason = ev.reason;
    var msg    = reason instanceof Error ? reason.message : String(reason);
    addEntry('error', 'Unhandled Promise rejection: ' + msg, reason instanceof Error ? reason.stack : null);
  });

  // ── Public static API ────────────────────────────────────────────────────────
  var DebugPanel = {
    /**
     * Log a message to the debug panel.
     * @param {string} type  - 'error' | 'warn' | 'info' | 'debug' | 'webrtc' | 'socket' | 'server'
     * @param {string} message
     * @param {*}      [details] - object / string / Error shown as expandable detail
     */
    log: function (type, message, details) {
      if (details instanceof Error) {
        details = { message: details.message, stack: details.stack };
      }
      return addEntry(type, message, details);
    },

    open:   openPanel,
    toggle: togglePanel,
    clear:  clearLog,

    /** Attach WebRTC listeners to a peer connection */
    attachPeerConnection: function (pc, label) {
      if (!pc) return;
      var pfx = label ? '[' + label + '] ' : '';

      pc.addEventListener('connectionstatechange', function () {
        var state = pc.connectionState;
        var type  = (state === 'failed' || state === 'closed') ? 'error' : 'webrtc';
        addEntry(type, pfx + 'connectionState → ' + state, null);
      });

      pc.addEventListener('iceconnectionstatechange', function () {
        var state = pc.iceConnectionState;
        var type  = (state === 'failed' || state === 'disconnected') ? 'warn' : 'webrtc';
        addEntry(type, pfx + 'iceConnectionState → ' + state, null);
      });

      pc.addEventListener('signalingstatechange', function () {
        addEntry('webrtc', pfx + 'signalingState → ' + pc.signalingState, null);
      });

      pc.addEventListener('icecandidateerror', function (e) {
        addEntry('warn', pfx + 'ICE candidate error ' + e.errorCode + ': ' + e.errorText, {
          url: e.url, errorCode: e.errorCode, errorText: e.errorText
        });
      });
    },

    /** Attach Socket.IO listeners for debug logging */
    attachSocket: function (socket) {
      if (!socket) return;

      socket.on('connect', function () {
        addEntry('socket', 'Socket.IO connected  id=' + socket.id, null);
      });

      socket.on('disconnect', function (reason) {
        addEntry('socket', 'Socket.IO disconnected  reason=' + reason, null);
      });

      socket.on('connect_error', function (err) {
        addEntry('error', 'Socket.IO connect_error: ' + err.message, err.stack || null);
      });

      socket.on('reconnect_attempt', function (n) {
        addEntry('socket', 'Socket.IO reconnect attempt #' + n, null);
      });

      socket.on('reconnect', function (n) {
        addEntry('socket', 'Socket.IO reconnected after ' + n + ' attempt(s)', null);
      });

      socket.on('reconnect_failed', function () {
        addEntry('error', 'Socket.IO reconnection failed — giving up', null);
      });

      // Server-side error relay
      socket.on('debug:server-error', function (data) {
        addEntry('server', 'Server error in event [' + data.event + ']: ' + data.error, data.stack || null);
      });

      // Server ping response
      socket.on('debug:pong', function (data) {
        addEntry('info', 'debug:pong received', data);
      });
    }
  };

  // ── Expose globally ──────────────────────────────────────────────────────────
  window.DebugPanel = DebugPanel;

  // ── Boot ─────────────────────────────────────────────────────────────────────
  function boot() {
    buildDOM();
    addEntry('info', 'DebugPanel initialized', {
      userAgent: navigator.userAgent.slice(0, 120),
      url: window.location.href
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    // DOM already ready (e.g. script placed at end of body)
    boot();
  }

}());
