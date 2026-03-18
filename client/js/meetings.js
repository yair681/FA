// Meeting management helpers
async function apiFetch(url, opts = {}) {
  const headers = authManager.authHeaders();
  if (opts.body && typeof opts.body === 'object') {
    opts.body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאת שרת');
  return data;
}

async function getMyMeetings() {
  return apiFetch('/api/meetings');
}

async function createMeeting(title, type, scheduledAt, settings) {
  return apiFetch('/api/meetings', { method: 'POST', body: { title, type, scheduledAt, settings } });
}

async function deleteMeeting(id) {
  return apiFetch('/api/meetings/' + id, { method: 'DELETE' });
}

async function getMeetingByRoom(roomId) {
  return apiFetch('/api/meetings/by-room/' + roomId);
}
