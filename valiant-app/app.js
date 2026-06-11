<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Valiant Integrations</title>
<link rel="icon" type="image/png" sizes="32x32" href="icon-32.png">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#0D1117">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Valiant">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
<style>
  /* Login + sync overlay (self-contained, doesn't touch styles.css) */
  .vi-overlay {
    position: fixed; inset: 0; z-index: 100000;
    background: #0D1117; display: flex; align-items: center; justify-content: center;
    font-family: 'DM Sans', sans-serif;
  }
  .vi-overlay .vi-card {
    width: 320px; max-width: 90vw; background: #161B22; border: 1px solid #30363D;
    border-radius: 14px; padding: 28px 26px; display: flex; flex-direction: column; gap: 14px;
  }
  .vi-overlay .vi-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .vi-overlay .vi-mark {
    width: 34px; height: 34px; border-radius: 9px; background: #1F6FEB; color: #fff;
    font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 18px;
  }
  .vi-overlay .vi-name { color: #E6EDF3; font-weight: 600; font-size: 15px; line-height: 1.1; }
  .vi-overlay .vi-sub { color: #6E7681; font-size: 11px; }
  .vi-overlay label { color: #8B949E; font-size: 12px; display: flex; flex-direction: column; gap: 5px; }
  .vi-overlay input {
    background: #0D1117; border: 1px solid #30363D; color: #E6EDF3;
    border-radius: 8px; padding: 9px 11px; font-size: 13px; font-family: inherit;
  }
  .vi-overlay input:focus { border-color: #58A6FF; outline: none; }
  .vi-overlay button {
    background: #1F6FEB; color: #fff; border: none; border-radius: 8px;
    padding: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 4px;
  }
  .vi-overlay button:hover { background: #388BFD; }
  .vi-overlay button:disabled { opacity: .6; cursor: default; }
  .vi-overlay .vi-err { color: #F85149; font-size: 12px; min-height: 14px; }
  .vi-overlay .vi-status { color: #8B949E; font-size: 12px; text-align: center; }
  #vi-refresh {
    position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 9500; display: none;
    background: #1F6FEB; color: #fff; border: none; font-family: 'DM Sans', sans-serif;
    font-size: 12px; padding: 8px 14px; border-radius: 999px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.4);
  }
  .vi-overlay button.vi-link { background: transparent; color: #58A6FF; padding: 2px; font-weight: 500; margin: 0; }
  .vi-overlay button.vi-link:hover { background: transparent; color: #388BFD; text-decoration: underline; }
  .logo-mark-img { height: 30px; width: auto; display: block; }
  .vi-mark-img { height: 30px; width: auto; display: block; }
</style>
</head>
<body>
<div id="app">
  <nav id="sidebar">
    <div class="sidebar-top">
      <div class="logo">
        <img src="mark.png" alt="Valiant" class="logo-mark-img">
        <div class="logo-text">
          <span class="logo-name">Valiant</span>
          <span class="logo-sub">Integrations</span>
        </div>
      </div>
      <div class="nav-section">
        <div class="nav-label">Operations</div>
        <a class="nav-item active" data-page="dashboard" onclick="navigate('dashboard')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>
          <span>Dashboard</span>
        </a>
        <a class="nav-item" data-page="calendar" onclick="navigate('calendar')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          <span>Calendar</span>
        </a>
        <a class="nav-item" data-page="projects" onclick="navigate('projects')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          <span>Projects</span>
          <span class="nav-badge" id="proj-count">0</span>
        </a>
        <a class="nav-item" data-page="shopwork" onclick="navigate('shopwork')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3h10l1 9H2L3 3z" stroke="currentColor" stroke-width="1.2"/><path d="M6 3V2a2 2 0 0 1 4 0v1" stroke="currentColor" stroke-width="1.2"/></svg>
          <span>Shop Work</span>
        </a>
      </div>
      <div class="nav-section">
        <div class="nav-label">Tools</div>
        <a class="nav-item" data-page="vendors" onclick="navigate('vendors')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.2"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          <span>Vendors</span>
        </a>
        <a class="nav-item" data-page="intake" onclick="navigate('intake')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          <span>New Intake</span>
        </a>
      </div>
    </div>
    <div class="sidebar-bottom">
      <div class="api-section">
        <div class="api-label">Jetbuilt API</div>
        <div class="api-status" id="api-status">
          <div class="status-dot connected"></div>
          <span>Connected</span>
        </div>
      </div>
      <div class="user-area">
        <div class="user-avatar">JA</div>
        <div class="user-info">
          <div class="user-name">Jacob</div>
          <div class="user-role">Admin</div>
        </div>
      </div>
    </div>
  </nav>

  <div id="main">
    <header id="topbar">
      <div class="topbar-left">
        <button class="mobile-menu-btn" onclick="toggleSidebar()">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <div class="page-title" id="page-title">Dashboard</div>
      </div>
      <div class="topbar-right">
        <select id="role-select" onchange="setUserRole(this.value)"
          style="display:none;padding:5px 10px;background:#161B22;border:1px solid #30363D;border-radius:6px;color:#8B949E;font-size:11px;font-family:'DM Sans',sans-serif;cursor:pointer">
          <option value="admin">Admin</option>
          <option value="sales">Sales</option>
          <option value="design">Design</option>
          <option value="project_manager">Project Management</option>
          <option value="installer">Install</option>
        </select>
        <button class="btn-sync" onclick="syncJetbuilt()" id="sync-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M7 2l2-2M7 2l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Sync Jetbuilt
        </button>
        <button class="btn-primary" onclick="navigate('intake')">+ New Intake</button>
      </div>
    </header>

    <div id="content">
      <!-- Pages injected here -->
    </div>
  </div>
</div>

<!-- Project Detail Modal -->
<div id="project-modal" class="modal-overlay" style="display:none">
  <div class="modal-container">
    <div class="modal-header">
      <div>
        <div class="modal-title" id="modal-title">Project</div>
        <div class="modal-sub" id="modal-sub"></div>
      </div>
      <button class="modal-close" onclick="closeModal()">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="modal-body" id="modal-body"></div>
  </div>
</div>

<!-- Login gate -->
<div id="vi-auth" class="vi-overlay">
  <div class="vi-card">
    <div class="vi-logo">
      <img src="mark.png" alt="Valiant" class="vi-mark-img">
      <div><div class="vi-name">Valiant Integrations</div><div class="vi-sub">Team sign-in</div></div>
    </div>
    <label>Email<input id="vi-email" type="email" autocomplete="username" placeholder="you@valiant.com"></label>
    <label>Password<input id="vi-pass" type="password" autocomplete="current-password" placeholder="••••••••"></label>
    <div class="vi-err" id="vi-err"></div>
    <button id="vi-btn">Sign in</button>
    <button type="button" id="vi-forgot" class="vi-link">Forgot password?</button>
    <div class="vi-status" id="vi-status"></div>
  </div>
</div>
<button id="vi-refresh">Updates available — refresh</button>
<div id="vi-setpw" class="vi-overlay" style="display:none">
  <div class="vi-card">
    <div class="vi-logo">
      <img src="mark.png" alt="Valiant" class="vi-mark-img">
      <div><div class="vi-name" id="vi-setpw-title">Set a new password</div><div class="vi-sub">Valiant Integrations</div></div>
    </div>
    <label>New password<input id="vi-newpw" type="password" autocomplete="new-password" placeholder="••••••••"></label>
    <label>Confirm new password<input id="vi-newpw2" type="password" autocomplete="new-password" placeholder="••••••••"></label>
    <div class="vi-err" id="vi-setpw-err"></div>
    <button id="vi-setpw-btn">Save password</button>
    <button type="button" id="vi-setpw-cancel" class="vi-link" style="display:none">Cancel</button>
    <div class="vi-status" id="vi-setpw-status"></div>
  </div>
</div>

<!-- Cloud sync + auth bootstrap. Loads BEFORE app.js so data is hydrated first. -->
<script type="module">
  const SB_URL = 'https://gjndbrboepbudpmeeeth.supabase.co';
  const SB_KEY = 'sb_publishable_DyNIu6h1YuJzKnxxPmNz6Q_ygeTgEZw';

  // Keys kept on this device only (not shared): the in-app identity picker.
  const LOCAL_ONLY = new Set(['vi_role', 'vi_user']);
  const isViKey = k => typeof k === 'string' && k.startsWith('vi_');
  const shouldSync = k => isViKey(k) && !LOCAL_ONLY.has(k);

  const rawSet = localStorage.setItem.bind(localStorage);
  const rawRemove = localStorage.removeItem.bind(localStorage);
  let hydrating = false;
  let suppressUntil = 0;      // ignore realtime echoes of our own writes
  let sb = null;
  const pendingWrites = new Map();  // key -> latest value not yet confirmed in the cloud
  let authToken = null;             // session access token, for the keepalive flush on unload

  const $ = id => document.getElementById(id);
  const setStatus = t => { const s = $('vi-status'); if (s) s.textContent = t || ''; };

  async function mirrorSet(key, raw) {
    if (!sb || !shouldSync(key)) return;
    let value; try { value = JSON.parse(raw); } catch { value = raw; }
    pendingWrites.set(key, value);            // unconfirmed until the upsert resolves
    suppressUntil = Date.now() + 4000;
    try {
      const { error } = await sb.from('app_data').upsert({ key, value }, { onConflict: 'key' });
      if (error) { console.warn('sync up failed', key, error); }
      else if (pendingWrites.get(key) === value) { pendingWrites.delete(key); }
    } catch (e) { console.warn('sync up failed', key, e); }
  }
  async function mirrorRemove(key) {
    if (!sb || !shouldSync(key)) return;
    suppressUntil = Date.now() + 4000;
    try { await sb.from('app_data').delete().eq('key', key); } catch (e) { console.warn('sync del failed', key, e); }
  }

  // Wrap writes so every change goes up to the cloud.
  localStorage.setItem = function (k, v) { rawSet(k, v); if (!hydrating) mirrorSet(k, v); };
  localStorage.removeItem = function (k) { rawRemove(k); if (!hydrating) mirrorRemove(k); };

  // A normal upsert is fire-and-forget; reloading the page a moment after a save can
  // cancel the request mid-flight, so the change never reaches the cloud and the next
  // load's hydrate wipes it locally. On page-hide, re-send any unconfirmed writes with
  // keepalive requests, which the browser is allowed to finish after the page unloads.
  function flushPendingWrites() {
    if (!sb || !pendingWrites.size) return;
    const token = authToken || SB_KEY;
    pendingWrites.forEach((value, key) => {
      try {
        const body = JSON.stringify([{ key, value }]);
        if (body.length > 60000) return;  // keepalive payload cap; large caches resync on next load
        fetch(`${SB_URL}/rest/v1/app_data?on_conflict=key`, {
          method: 'POST',
          keepalive: true,
          headers: {
            'apikey': SB_KEY,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body
        });
      } catch (e) { /* best effort */ }
    });
  }
  window.addEventListener('pagehide', flushPendingWrites);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingWrites();
  });

  function clearLocalViKeys() {
    const kill = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isViKey(k) && !LOCAL_ONLY.has(k)) kill.push(k);
    }
    kill.forEach(k => rawRemove(k));
  }

  async function hydrateFromCloud() {
    const { data, error } = await sb.from('app_data').select('key,value');
    if (error) throw error;
    hydrating = true;
    try {
      if (data && data.length) {
        // Cloud is source of truth — mirror it exactly onto this device.
        clearLocalViKeys();
        data.forEach(row => {
          const v = (typeof row.value === 'string') ? row.value : JSON.stringify(row.value);
          rawSet(row.key, v);
        });
        return 'pulled';
      }
      return 'empty';
    } finally {
      hydrating = false;  // never leave writes un-mirrored if a write above throws
    }
  }

  // First run only: push this device's existing data up to seed the cloud.
  async function seedCloudFromLocal() {
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!shouldSync(k)) continue;
      const raw = localStorage.getItem(k);
      let value; try { value = JSON.parse(raw); } catch { value = raw; }
      rows.push({ key: k, value });
    }
    if (rows.length) {
      suppressUntil = Date.now() + 6000;
      const { error } = await sb.from('app_data').upsert(rows, { onConflict: 'key' });
      if (error) console.warn('seed failed', error);
    }
    return rows.length;
  }

  function bootApp() {
    $('vi-auth').style.display = 'none';
    const s = document.createElement('script');
    s.src = 'app.js';
    document.body.appendChild(s);
  }

  function subscribeRealtime() {
    try {
      const LIVE_KEYS = new Set(['vi_messages']);  // applied instantly, no refresh banner
      sb.channel('app_data_rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data' }, (payload) => {
          const row = (payload && (payload.new || payload.old)) || {};
          const key = row.key;
          if (key && LIVE_KEYS.has(key)) {
            // Apply chat changes straight into local storage + notify the app — no reload.
            const applyVal = (raw) => {
              const v = (typeof raw === 'string') ? raw : JSON.stringify(raw);
              hydrating = true;
              try { rawSet(key, v); } finally { hydrating = false; }
              if (typeof window.viOnLiveKey === 'function') { try { window.viOnLiveKey(key); } catch (e) {} }
            };
            if (payload.new && payload.new.value !== undefined) {
              applyVal(payload.new.value);
            } else {
              sb.from('app_data').select('value').eq('key', key).single()
                .then(({ data }) => { if (data && data.value !== undefined) applyVal(data.value); })
                .catch(() => {});
            }
            return;
          }
          if (Date.now() < suppressUntil) return;          // our own change echoing back
          $('vi-refresh').style.display = 'block';          // let the user choose when to refresh
        })
        .subscribe();
    } catch (e) { console.warn('realtime off', e); }
  }

  async function startSession() {
    setStatus('Loading your data…');
    try { const { data: { user } } = await sb.auth.getUser(); window.VI_AUTH_EMAIL = (user && user.email) ? user.email : ''; } catch (e) {}
    const result = await hydrateFromCloud();
    if (result === 'empty') {
      setStatus('Setting up shared data…');
      await seedCloudFromLocal();
    }
    subscribeRealtime();
    bootApp();
  }

  $('vi-refresh').onclick = () => location.reload();
  window.viSignOut = async () => {
    try { await sb.auth.signOut(); } catch {}
    clearLocalViKeys();
    location.reload();
  };

  async function doLogin() {
    const email = $('vi-email').value.trim();
    const password = $('vi-pass').value;
    $('vi-err').textContent = '';
    $('vi-btn').disabled = true;
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { $('vi-err').textContent = error.message; $('vi-btn').disabled = false; return; }
    await startSession();
  }

  function showSetPw(mode) {
    window._viPwMode = mode;
    $('vi-setpw-title').textContent = mode === 'recovery' ? 'Set a new password'
      : mode === 'invite' ? 'Welcome — set your password'
      : 'Change your password';
    $('vi-setpw-cancel').style.display = mode === 'change' ? 'block' : 'none';
    $('vi-setpw-err').textContent = ''; $('vi-setpw-status').textContent = '';
    $('vi-newpw').value = ''; $('vi-newpw2').value = '';
    $('vi-setpw').style.display = 'flex';
    $('vi-newpw').focus();
  }
  async function doForgot() {
    const email = $('vi-email').value.trim();
    if (!email) { $('vi-err').textContent = 'Enter your email first, then tap Forgot password.'; $('vi-email').focus(); return; }
    $('vi-err').textContent = '';
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
      if (error) { $('vi-err').textContent = error.message; return; }
      setStatus('Reset link sent — check ' + email);
    } catch (e) { $('vi-err').textContent = 'Could not send reset email.'; }
  }
  async function doSetPassword() {
    const a = $('vi-newpw').value, b = $('vi-newpw2').value;
    $('vi-setpw-err').textContent = '';
    if (a.length < 6) { $('vi-setpw-err').textContent = 'Use at least 6 characters.'; return; }
    if (a !== b) { $('vi-setpw-err').textContent = 'Passwords do not match.'; return; }
    $('vi-setpw-btn').disabled = true;
    try {
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) { $('vi-setpw-err').textContent = error.message; $('vi-setpw-btn').disabled = false; return; }
    } catch (e) { $('vi-setpw-err').textContent = 'Could not update password.'; $('vi-setpw-btn').disabled = false; return; }
    $('vi-setpw-btn').disabled = false;
    if (window._viPwMode === 'recovery' || window._viPwMode === 'invite') {
      history.replaceState(null, '', window.location.pathname);
      location.reload();
    } else {
      $('vi-setpw').style.display = 'none';
      if (window.showToast) window.showToast('Password updated', 'success');
    }
  }

  async function init() {
    // Capture the auth link type from the URL hash BEFORE the Supabase client
    // loads — detectSessionInUrl consumes and clears the hash, so read it first.
    const hashType = (window.location.hash.match(/type=([a-z_]+)/i) || [])[1] || '';
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      sb = createClient(SB_URL, SB_KEY);
      window._sb = sb;
      $('vi-btn').onclick = doLogin;
      $('vi-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
      $('vi-forgot').onclick = doForgot;
      window.viOpenChangePassword = () => showSetPw('change');
      $('vi-setpw-btn').onclick = doSetPassword;
      $('vi-setpw-cancel').onclick = () => { $('vi-setpw').style.display = 'none'; };
      $('vi-newpw2').addEventListener('keydown', e => { if (e.key === 'Enter') doSetPassword(); });
      sb.auth.onAuthStateChange((event, session) => { authToken = (session && session.access_token) || authToken; if (event === 'PASSWORD_RECOVERY') showSetPw('recovery'); });
      const { data: { session } } = await sb.auth.getSession();
      authToken = (session && session.access_token) || authToken;
      if (hashType === 'recovery') { showSetPw('recovery'); }
      else if (hashType === 'invite') { showSetPw('invite'); }
      else if (session) { await startSession(); } else { $('vi-email').focus(); }
    } catch (e) {
      console.error('Sync init failed', e);
      $('vi-err').textContent = 'Could not reach the server. Check your connection and reload.';
    }
  }
  init();
</script>
</body>
</html>
