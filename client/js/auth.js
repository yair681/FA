class AuthManager {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem('token');
  }

  async init() {
    if (!this.token) return;
    try {
      const res = await fetch('/api/auth/validate', { headers: this.authHeaders() });
      if (res.ok) {
        this.currentUser = await res.json();
      } else {
        this.token = null;
        localStorage.removeItem('token');
      }
    } catch { this.token = null; }
  }

  isLoggedIn() { return !!this.currentUser; }
  isAdmin() { return this.currentUser && this.currentUser.role === 'admin'; }

  authHeaders() {
    return this.token ? { 'Authorization': 'Bearer ' + this.token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  async login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    if (!email || !password) { errEl.textContent = 'יש למלא את כל השדות'; return; }
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { errEl.textContent = data.error || 'שגיאה בכניסה'; return; }
      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('token', data.token);
      onAuthSuccess();
    } catch { errEl.textContent = 'שגיאת רשת'; }
  }

  async register() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    if (!name || !email || !password) { errEl.textContent = 'יש למלא את כל השדות'; return; }
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
      const data = await res.json();
      if (!res.ok) { errEl.textContent = data.error || 'שגיאה בהרשמה'; return; }
      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('token', data.token);
      onAuthSuccess();
    } catch { errEl.textContent = 'שגיאת רשת'; }
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('token');
    if (window.zoomManager) window.zoomManager.fullReset();
    document.getElementById('app').style.display = 'none';
    document.getElementById('page-auth').style.display = 'flex';
  }

  async updateProfile(data) {
    const res = await fetch('/api/auth/profile', { method: 'PUT', headers: this.authHeaders(), body: JSON.stringify(data) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    this.currentUser = result;
    document.getElementById('header-username').textContent = result.name;
    return result;
  }

  async deleteAccount() {
    const res = await fetch('/api/auth/account', { method: 'DELETE', headers: this.authHeaders() });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    this.logout();
  }
}

window.authManager = new AuthManager();
