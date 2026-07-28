const Api = {
  showSpinner: () => { const s = document.getElementById('loadingSpinner'); if (s) s.style.display = 'flex'; },
  hideSpinner: () => { const s = document.getElementById('loadingSpinner'); if (s) s.style.display = 'none'; },

  token() {
    return localStorage.getItem('yp_token') || '';
  },

  setSession(token, name, username) {
    localStorage.setItem('yp_token', token);
    localStorage.setItem('yp_name', name);
    localStorage.setItem('yp_username', username);
  },

  clearSession() {
    localStorage.removeItem('yp_token');
    localStorage.removeItem('yp_name');
    localStorage.removeItem('yp_username');
  },

  isLoggedIn() {
    return !!this.token();
  },

  async get(action, params = {}) {
    if (!params.silent) this.showSpinner();
    try {
      const qs = new URLSearchParams({ action, token: this.token(), ...params });
      const res = await fetch(`${API_URL}?${qs.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Request failed');
      return json.data;
    } finally {
      if (!params.silent) this.hideSpinner();
    }
  },

  async post(action, payload = {}) {
    if (!payload.silent) this.showSpinner();
    try {
      // text/plain avoids a CORS preflight against the Apps Script endpoint
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token: this.token(), ...payload }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Request failed');
      return json.data;
    } finally {
      if (!payload.silent) this.hideSpinner();
    }
  }
};
