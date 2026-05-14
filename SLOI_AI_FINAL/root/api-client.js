/**
 * SLOI AI — API Client v1.0
 * Shared across all portals: Admin, Buyer, Broker, Agent Console
 * 
 * Usage: <script src="/api-client.js"></script>
 * Then: const api = new SloiAPI();
 * 
 * Deploy: sloiai.com/api-client.js (Vercel root)
 */

const SLOI_API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/v1'
  : 'https://api.sloiai.com/v1';

class SloiAPI {

  constructor() {
    this.base = SLOI_API_BASE;
    this.token = localStorage.getItem('sloi_jwt') || null;
    this.apiKey = localStorage.getItem('sloi_api_key') || null;
    this.role = localStorage.getItem('sloi_role') || null;
    this.agui = null; // AG-UI stream instance
  }

  // ── HEADERS ──────────────────────────────────────────────────────────────────

  headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (this.apiKey) h['x-api-key'] = this.apiKey;
    else if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  // ── REQUEST HELPER ────────────────────────────────────────────────────────────

  async req(method, path, body = null) {
    const opts = { method, headers: this.headers() };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(this.base + path, opts);
      const data = await res.json();
      if (!res.ok) throw { status: res.status, ...data };
      return data;
    } catch (err) {
      this._handleError(err);
      throw err;
    }
  }

  _handleError(err) {
    if (err.status === 401) {
      this.logout();
      window.location.href = '/login.html';
    }
    if (err.status === 402) {
      this._showToast('⚡ Insufficient credits — top up to continue', 'gold');
    }
    if (err.status === 451) {
      this._showToast('🛡️ Blocked — compliance check failed', 'red');
    }
  }

  _showToast(msg, color = 'indigo') {
    const colors = { indigo: '#5b5fef', gold: '#e8a94a', red: '#ef4444', green: '#22c55e' };
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:9999;background:#0e0e1a;border:1px solid ${colors[color]||colors.indigo};border-radius:6px;padding:12px 16px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:${colors[color]||colors.indigo};max-width:320px;animation:slideIn .2s ease`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ── AUTH ──────────────────────────────────────────────────────────────────────

  async register({ email, role, org_name, country }) {
    const data = await this.req('POST', '/auth/register', { email, role, org_name, country });
    this.token = data.token;
    this.role = data.role;
    localStorage.setItem('sloi_jwt', data.token);
    localStorage.setItem('sloi_role', data.role);
    localStorage.setItem('sloi_user', JSON.stringify(data.user));
    return data;
  }

  async login({ email, password }) {
    const data = await this.req('POST', '/auth/login', { email, password });
    this.token = data.token;
    this.role = data.role;
    localStorage.setItem('sloi_jwt', data.token);
    localStorage.setItem('sloi_role', data.role);
    localStorage.setItem('sloi_user', JSON.stringify(data.user));
    return data;
  }

  async registerAgent({ name, email, framework, wallet_address }) {
    const data = await this.req('POST', '/agents/register', { name, email, framework, wallet_address });
    this.apiKey = data.api_key;
    localStorage.setItem('sloi_api_key', data.api_key);
    return data;
  }

  logout() {
    localStorage.removeItem('sloi_jwt');
    localStorage.removeItem('sloi_api_key');
    localStorage.removeItem('sloi_role');
    localStorage.removeItem('sloi_user');
    this.token = null;
    this.apiKey = null;
    this.role = null;
    if (this.agui) this.agui.disconnect();
  }

  isLoggedIn() {
    return !!(this.token || this.apiKey);
  }

  getUser() {
    try { return JSON.parse(localStorage.getItem('sloi_user')); } catch { return null; }
  }

  requireAuth() {
    if (!this.isLoggedIn()) window.location.href = '/login.html';
  }

  requireRole(...roles) {
    this.requireAuth();
    if (!roles.includes(this.role)) window.location.href = '/login.html';
  }

  // ── PRODUCTS ──────────────────────────────────────────────────────────────────

  async getProducts(sector = '') {
    const q = sector ? `?sector=${sector}` : '';
    return this.req('GET', `/products${q}`);
  }

  async getProductPrice(ref) {
    return this.req('GET', `/products/${ref}/price`);
  }

  async updateProductPrice(ref, { cost, market, floor }) {
    return this.req('POST', `/products/${ref}/price`, { cost, market, floor });
  }

  async bulkUpdatePrices(products) {
    return this.req('POST', '/products/bulk-update', { products });
  }

  // ── CREDITS ───────────────────────────────────────────────────────────────────

  async getBalance() {
    return this.req('GET', '/credits/balance');
  }

  async purchaseCredits(pack) {
    const data = await this.req('POST', '/credits/purchase', { pack });
    // Human → redirect to Stripe
    if (data.method === 'stripe') window.location.href = data.url;
    // Agent → return USDC instructions
    return data;
  }

  // ── NEGOTIATIONS ──────────────────────────────────────────────────────────────

  async getNegotiations(filters = {}) {
    const q = new URLSearchParams(filters).toString();
    return this.req('GET', `/negotiations${q ? '?' + q : ''}`);
  }

  async getNegotiation(id) {
    return this.req('GET', `/negotiations/${id}`);
  }

  async approveDeal(id, { action, override_price } = {}) {
    return this.req('POST', `/negotiations/${id}/approve`, { action, override_price });
  }

  async pauseNegotiation(id) {
    return this.req('POST', `/negotiations/${id}/pause`);
  }

  async resumeNegotiation(id) {
    return this.req('POST', `/negotiations/${id}/resume`);
  }

  // ── MANDATES (AUTONOMOUS) ─────────────────────────────────────────────────────

  async createMandate({ product_ref, qty, unit, target_price, max_price, strategy, auto_approve, max_orders_per_day, max_daily_value, expires_in_days }) {
    return this.req('POST', '/mandates', { product_ref, qty, unit, target_price, max_price, strategy, auto_approve, max_orders_per_day, max_daily_value, expires_in_days });
  }

  async getMandates() {
    return this.req('GET', '/mandates');
  }

  async cancelMandate(id) {
    return this.req('DELETE', `/mandates/${id}`);
  }

  async pauseMandate(id) {
    return this.req('POST', `/mandates/${id}/pause`);
  }

  // ── LOIs ─────────────────────────────────────────────────────────────────────

  async getLOIs() {
    return this.req('GET', '/lois');
  }

  async getLOIPdfUrl(ref) {
    return `${this.base}/lois/${ref}/pdf`;
  }

  // ── PIPELINE ──────────────────────────────────────────────────────────────────

  async getPipeline() {
    return this.req('GET', '/pipeline');
  }

  async addToPipeline({ name, product, country, value, sector }) {
    return this.req('POST', '/pipeline', { name, product, country, value, sector });
  }

  // ── COMPLIANCE ────────────────────────────────────────────────────────────────

  async checkCompliance({ entity, country, product_category }) {
    return this.req('POST', '/compliance/check', { entity, country, product_category });
  }

  async getComplianceLog() {
    return this.req('GET', '/compliance/log');
  }

  // ── REPUTATION ────────────────────────────────────────────────────────────────

  async getReputation(agentId = 'me') {
    return this.req('GET', `/agents/${agentId}/reputation`);
  }

  // ── REVENUE / BRIEF ───────────────────────────────────────────────────────────

  async getRevenue() {
    return this.req('GET', '/revenue');
  }

  async getBrief() {
    return this.req('GET', '/brief');
  }

  // ── PRICE WATCHES ─────────────────────────────────────────────────────────────

  async addPriceWatch({ product_ref, target_price, direction = 'below' }) {
    return this.req('POST', '/price-watches', { product_ref, target_price, direction });
  }

  async getPriceWatches() {
    return this.req('GET', '/price-watches');
  }

  // ── OUTREACH ─────────────────────────────────────────────────────────────────

  async getOutreachQueue() {
    return this.req('GET', '/outreach/queue');
  }

  async sendOutreach(leadId) {
    return this.req('POST', '/outreach/send', { lead_id: leadId });
  }

  // ── AGENTS (OPEN NETWORK) ─────────────────────────────────────────────────────

  async runLeadFinder({ keywords } = {}) {
    return this.req('POST', '/agents/leadfinder/run', { keywords });
  }

  async runPriceScout({ product_ref } = {}) {
    return this.req('POST', '/agents/pricescout/run', { product_ref });
  }

  async resumeOutreachBot() {
    return this.req('POST', '/agents/outreachbot/resume');
  }

  async pauseOutreachBot() {
    return this.req('POST', '/agents/outreachbot/pause');
  }

  // ── AG-UI STREAM ─────────────────────────────────────────────────────────────

  /**
   * Connect to global AG-UI SSE stream.
   * Returns SloiAGUI instance with .on() handler registration.
   * 
   * Usage:
   *   const stream = api.stream()
   *     .on('AWAIT_HUMAN', (data) => showApprovalBox(data))
   *     .on('LOI_GENERATED', (data) => refreshLOIs())
   *     .on('PRICE_UPDATE', (data) => updatePriceBoard(data))
   *     .connect();
   */
  stream() {
    this.agui = new SloiAGUI(this.token || this.apiKey, this.base);
    return this.agui;
  }

  /**
   * Start a negotiation and return SSE stream.
   * 
   * Usage:
   *   api.negotiate({ product_ref, qty, unit, target_price, max_price, strategy })
   *     .on('TEXT_CHUNK', ({text, role, round}) => appendToChat(text, role))
   *     .on('ROUND_COMPLETE', ({round, agent_price, broker_price}) => updateRoundsBar())
   *     .on('AWAIT_HUMAN', (data) => showApprovalBox(data))
   *     .on('LOI_GENERATED', (data) => showLOI(data))
   *     .start();
   */
  negotiate(params) {
    return new SloiNegotiation(params, this.headers(), this.base);
  }
}

// ── AG-UI CLIENT ──────────────────────────────────────────────────────────────

class SloiAGUI {
  constructor(authToken, base = SLOI_API_BASE) {
    this.token = authToken;
    this.base = base;
    this.handlers = {};
    this.es = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
  }

  on(eventType, handler) {
    if (!this.handlers[eventType]) this.handlers[eventType] = [];
    this.handlers[eventType].push(handler);
    return this; // chainable
  }

  off(eventType) {
    delete this.handlers[eventType];
    return this;
  }

  connect() {
    const url = `${this.base}/stream?token=${encodeURIComponent(this.token)}`;
    this.es = new EventSource(url);

    this.es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        const handlers = this.handlers[event.type] || [];
        handlers.forEach(h => h(event.data, event));
        // Also fire wildcard handlers
        (this.handlers['*'] || []).forEach(h => h(event.data, event));
      } catch (err) {
        console.error('[SLOI AG-UI] Parse error:', err);
      }
    };

    this.es.onerror = () => {
      this.es.close();
      console.warn(`[SLOI AG-UI] Disconnected. Reconnecting in ${this.reconnectDelay}ms...`);
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.connect();
      }, this.reconnectDelay);
    };

    this.es.onopen = () => {
      this.reconnectDelay = 1000; // reset backoff
      console.log('[SLOI AG-UI] Connected');
      (this.handlers['connected'] || []).forEach(h => h());
    };

    return this;
  }

  disconnect() {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }
}

// ── NEGOTIATION STREAM ────────────────────────────────────────────────────────

class SloiNegotiation {
  constructor(params, headers, base = SLOI_API_BASE) {
    this.params = params;
    this.headers = headers;
    this.base = base;
    this.handlers = {};
    this.es = null;
  }

  on(eventType, handler) {
    if (!this.handlers[eventType]) this.handlers[eventType] = [];
    this.handlers[eventType].push(handler);
    return this;
  }

  async start() {
    try {
      const res = await fetch(`${this.base}/negotiate`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(this.params),
      });

      if (!res.ok) {
        const err = await res.json();
        (this.handlers['error'] || []).forEach(h => h(err));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // keep incomplete last chunk

        for (const chunk of lines) {
          const dataLine = chunk.split('\n').find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine.slice(6));
            const handlers = this.handlers[event.type] || [];
            handlers.forEach(h => h(event.data, event));
          } catch {}
        }
      }
    } catch (err) {
      (this.handlers['error'] || []).forEach(h => h(err));
    }
  }

  stop() {
    if (this.es) this.es.close();
  }
}

// ── PORTAL INIT HELPERS ───────────────────────────────────────────────────────

/**
 * Call at top of each portal page.
 * Checks auth, sets up stream, populates user info.
 */
function initPortal(requiredRole) {
  const api = new SloiAPI();

  // Auth check
  if (!api.isLoggedIn()) {
    window.location.href = '/login.html';
    return api;
  }
  if (requiredRole && api.role !== requiredRole && api.role !== 'boss') {
    window.location.href = '/login.html';
    return api;
  }

  // Populate user info in UI
  const user = api.getUser();
  if (user) {
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user.name || user.email);
    document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = user.role);
    document.querySelectorAll('[data-user-org]').forEach(el => el.textContent = user.org_name || '');
  }

  // Load credit balance
  api.getBalance().then(({ balance }) => {
    document.querySelectorAll('[data-credits]').forEach(el => el.textContent = balance + ' credits');
  }).catch(() => {});

  // Connect global AG-UI stream
  api.stream()
    .on('AWAIT_HUMAN', (data, ev) => {
      if (api.role === 'boss') {
        showApprovalNotification(data, ev.session_id, api);
        if (typeof loadNegotiations === 'function') loadNegotiations();
      }
    })
    .on('LOI_GENERATED', (data) => {
      showToast('✅ LOI generated: ' + data.loi_ref, 'green');
      if (typeof renderLOIs === 'function') renderLOIs();
      if (typeof loadNegotiations === 'function') loadNegotiations();
    })
    .on('PRICE_UPDATE', (data) => {
      // Update Exchange if open
      if (typeof exUpdatePrice === 'function') exUpdatePrice(data.sku, data.price, data.change_pct);
    })
    .on('PRICE_ALERT', (data) => {
      showToast('📡 Price alert: ' + data.product + ' hit $' + data.current_price, 'gold');
    })
    .on('LEAD_FOUND', (data) => {
      if (data.relevance === 'very-high' || data.relevance === 'high') {
        showToast('🔥 New lead: ' + data.name + ' · ' + data.country, 'indigo');
      }
    })
    .on('AUTO_APPROVED', (data) => {
      showToast('🤖 Auto-approved: ' + data.loi_ref + ' · $' + data.deal_price.toLocaleString(), 'green');
    })
    .on('COMPLIANCE_BLOCKED', (data) => {
      showToast('🛡️ Blocked: ' + data.entity + ' · ' + data.country, 'red');
    })
    .on('STATE_PATCH', (data) => {
      // Apply JSON Patch to local state if needed
      applyStatePatch(data.ops);
    })
    .connect();

  return api;
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────

function showToast(msg, color = 'indigo') {
  const colors = { indigo: '#5b5fef', gold: '#e8a94a', red: '#ef4444', green: '#22c55e' };
  const t = document.createElement('div');
  t.style.cssText = [
    'position:fixed;bottom:20px;right:20px;z-index:9999',
    'background:#0e0e1a',
    `border:1px solid ${colors[color] || colors.indigo}`,
    'border-radius:6px;padding:12px 16px',
    "font-family:'IBM Plex Mono',monospace;font-size:12px",
    `color:${colors[color] || colors.indigo}`,
    'max-width:340px;box-shadow:0 4px 20px rgba(0,0,0,.5)',
    'transition:opacity .3s',
  ].join(';');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4000);
}

function showApprovalNotification(data, negId, api) {
  // Remove existing notification
  document.getElementById('approval-notification')?.remove();

  const n = document.createElement('div');
  n.id = 'approval-notification';
  n.style.cssText = [
    'position:fixed;top:60px;right:20px;z-index:9999;width:320px',
    'background:#0e0e1a;border:1px solid rgba(232,169,74,.4)',
    'border-radius:8px;padding:16px',
    "font-family:'IBM Plex Mono',monospace;font-size:12px",
    'box-shadow:0 8px 32px rgba(0,0,0,.6)',
  ].join(';');

  n.innerHTML = `
    <div style="font-size:10px;color:#e8a94a;font-weight:700;margin-bottom:8px;letter-spacing:.06em">⚡ APPROVAL NEEDED · ${negId}</div>
    <div style="font-size:13px;font-weight:700;color:#f0eff8;font-family:'Fraunces',serif;margin-bottom:4px">$${data.deal_price?.toLocaleString()}/unit</div>
    <div style="font-size:11px;color:#52526e;margin-bottom:12px">Total: $${data.total_value?.toLocaleString()} · LOI fee: $${data.loi_fee || 500}</div>
    <div style="display:flex;gap:6px">
      <button onclick="window._sloiAPI.approveDeal('${negId}',{action:'approve'}).then(()=>{document.getElementById('approval-notification')?.remove();showToast('✅ LOI generated','green')})"
        style="flex:1;background:#22c55e;color:#fff;border:none;border-radius:4px;padding:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:'IBM Plex Mono',monospace">
        ✅ Approve
      </button>
      <button onclick="window._sloiAPI.approveDeal('${negId}',{action:'reject'}).then(()=>{document.getElementById('approval-notification')?.remove();showToast('✗ Deal rejected','red')})"
        style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#ef4444;border-radius:4px;padding:8px 12px;font-size:11px;cursor:pointer;font-family:'IBM Plex Mono',monospace">
        ✗
      </button>
      <button onclick="document.getElementById('approval-notification')?.remove()"
        style="background:var(--surface2,#12121e);border:1px solid #252538;color:#52526e;border-radius:4px;padding:8px 12px;font-size:11px;cursor:pointer;font-family:'IBM Plex Mono',monospace">
        Later
      </button>
    </div>`;

  document.body.appendChild(n);

  // Store api reference for approval buttons
  window._sloiAPI = api;
}

function applyStatePatch(ops) {
  // Basic JSON Patch implementation (RFC 6902)
  // Portals can override window.sloiState
  if (!window.sloiState || !ops) return;
  ops.forEach(op => {
    const path = op.path.split('/').filter(Boolean);
    if (op.op === 'replace' || op.op === 'add') {
      let obj = window.sloiState;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = op.value;
    }
  });
  // Trigger re-render if available
  if (typeof renderAll === 'function') renderAll();
}

// ── LOGIN PAGE HELPER ─────────────────────────────────────────────────────────

function initLogin() {
  const api = new SloiAPI();

  // If already logged in, redirect to correct portal
  if (api.isLoggedIn() && api.role) {
    redirectByRole(api.role);
    return;
  }

  return api;
}

function redirectByRole(role) {
  const routes = {
    boss:     'CommodEx_Admin.html',
    buyer:    'CommodEx_Platform.html',
    broker:   'CommodEx_Broker.html',
    supplier: 'CommodEx_Supplier.html',
  };
  const dest = routes[role] || 'CommodEx_Platform.html';
  window.location.href = dest;
}

async function handleLogin(api, email, password, role) {
  try {
    const data = await api.login({ email, password });
    redirectByRole(data.role || role);
  } catch (err) {
    return err.error || 'Login failed';
  }
}

// ── EXPORT ────────────────────────────────────────────────────────────────────

window.SloiAPI = SloiAPI;
window.SloiAGUI = SloiAGUI;
window.SloiNegotiation = SloiNegotiation;
window.initPortal = initPortal;
window.initLogin = initLogin;
window.redirectByRole = redirectByRole;
window.handleLogin = handleLogin;
window.showToast = showToast;

console.log('[SLOI AI] api-client.js loaded · v1.0 · sloiai.com');
