// ── Valiant Integrations App ──
// API calls handled via /api/jetbuilt proxy

// ── State ──
// ── Current User Role (will be replaced by real login later) ──
let currentUserRole = localStorage.getItem(‘vi_role’) || ‘admin’; // admin, sales, design, install
let currentUserName = localStorage.getItem(‘vi_user’) || ‘Jacob’;

function setUserRole(role) {
currentUserRole = role;
localStorage.setItem(‘vi_role’, role);
const sel = document.getElementById(‘role-select’);
if (sel) sel.value = role;
renderCurrentPage();
}

function canSee(permission) {
const perms = {
financials:     [‘admin’,‘sales’,‘design’,‘project_manager’],
labor:          [‘admin’,‘sales’,‘design’,‘project_manager’],
equipment_total:[‘admin’,‘sales’,‘design’,‘project_manager’],
client_contact: [‘admin’,‘sales’,‘design’,‘project_manager’],
margins:        [‘admin’,‘sales’],
assign_team:    [‘admin’,‘project_manager’],
change_stage:   [‘admin’,‘sales’,‘project_manager’],
view_all_projects: [‘admin’,‘sales’,‘project_manager’]
};
return (perms[permission] || []).includes(currentUserRole);
}

const state = {
projects: [],
vendors: JSON.parse(localStorage.getItem(‘vi_vendors’) || ‘[]’),
shopwork: JSON.parse(localStorage.getItem(‘vi_shopwork’) || ‘[]’),
checklists: JSON.parse(localStorage.getItem(‘vi_checklists’) || ‘{}’),
assignments: JSON.parse(localStorage.getItem(‘vi_assignments’) || ‘{}’),
reviewed: JSON.parse(localStorage.getItem(‘vi_reviewed’) || ‘{}’),
designTrack: JSON.parse(localStorage.getItem(‘vi_design_track’) || ‘{}’),
installTrack: JSON.parse(localStorage.getItem(‘vi_install_track’) || ‘{}’),
gbbLinks: JSON.parse(localStorage.getItem(‘vi_gbb’) || ‘{}’),
fizzled: JSON.parse(localStorage.getItem(‘vi_fizzled’) || ‘[]’),
currentPage: ‘dashboard’,
currentProject: null,
calendarDate: new Date(),
calendarView: ‘month’,
syncing: false
};

// ── Design & Install Checklist Templates ──
const TEMPLATES = {
design: {
led_wall: {
name: ‘LED Wall Design’,
items: [
‘Mounting type determined (wall / ceiling / floor)’,
‘Total weight calculated and rigging safety verified’,
‘Panel layout drawn (number of panels, arrangement)’,
‘Pixel pitch calculated and verified per processor output channel’,
‘CAT5 routing per channel verified’,
‘Processor selected and location determined’,
‘Processor inputs defined’,
‘External control method specified (Stream Deck, network, etc.)’,
‘Cable routing designed (data + power through panels)’,
‘Connector types specified (Phoenix, NF4, NL2)’,
‘Front vs. rear serviceability and access planned’,
‘Cable schedule completed’,
‘Shop work identified (any pre-build at shop?)’
]
},
pa_install: {
name: ‘PA System Design’,
items: [
‘SPL map reviewed or created with reading points placed’,
‘Speaker placement and splay angles defined’,
‘Active vs. passive speakers specified’,
‘Power location and requirements confirmed’,
‘Electrical drawing specified if new power needed’,
‘Processor selected (internal or external)’,
‘Processor location determined’,
‘Zone configuration defined (client-furnished zones: lobby, balcony, green room)’,
‘Signal flow designed (analog routing, zones)’,
‘Inputs to processor defined (console, stage box, L/R or L/R/Sub/Fill)’,
‘Power control method specified (relay vs. network standby)’,
‘Connector types specified and termination standards documented’,
‘Patch panel or termination blocks determined’,
‘Network topology defined (if networked speakers/processor)’,
‘Network switch location and front-house access confirmed’,
‘Cable schedule completed’,
‘Shop work identified (rack pre-build, etc.)’
]
},
lighting: {
name: ‘Stage Lighting Design’,
items: [
‘Existing rigging reviewed or new rigging planned’,
‘Rigging layout and plot created’,
‘Rigging height calculated (45-degree angle from stage if applicable)’,
‘Fixture zone layout on stage planned’,
‘Rigging plot with fixture positions created’,
‘Power plot created (fixtures per circuit)’,
‘Electrical specifications defined (preexisting vs. new)’,
‘Electrical plot for electrician created if needed’,
‘DMX diagram created’,
‘Power diagram created (fixture linking, mounting)’,
‘Labeling convention established’,
‘DMX/Artnet protocol chosen’,
‘DMX distribution method specified (nodes, controllers, universes)’,
‘Scene controller type specified’,
‘House lighting integration considered’,
‘Control type specified (client console vs. our console)’,
‘Client-furnished equipment integration planned’,
‘Additional lighting noted (cyc, rim, etc.)’,
‘Cable schedule completed’,
‘Shop work identified (clamp installation, fixture addressing, console pre-build)’
]
}
},
install: {
led_wall: {
name: ‘LED Wall Install’,
items: [
‘Surface prep completed’,
‘Rigging/mounting layout verified on ground or wall’,
‘Height verified per drawing’,
‘Electrical verified before wall installation’,
‘Cable pulled to wall location’,
‘Cable path verified clean’,
‘Frame installed (back frame)’,
‘Panels mounted’,
‘Modules wired together’,
‘Modules installed’,
‘Control cables installed and terminated’,
‘LED wall mapped in NovaStar’,
‘Input configuration completed’,
‘Presets configured if needed’,
‘Backup receiving card file saved’,
‘Backup config file saved’
]
},
pa_install: {
name: ‘PA System Install’,
items: [
‘Wiring path reviewed and cleared’,
‘Rigging plot laid on ground (symmetrical, matches diagram)’,
‘Laser rigging points up to ceiling verified’,
‘Rigging points installed in ceiling’,
‘Safety/secondary rigging points installed’,
‘PA rigged’,
‘Wire pulled to PA’,
‘Amp rack built’,
‘Wires dressed into amp rack’,
‘Amps configured’,
‘Network cables installed for PA’,
‘Signal wires run (console/IO to processor or amps)’,
‘Functional testing on amps completed’,
‘PA tuned’,
‘Backup tune and config files saved (processor, amps)’
]
},
lighting: {
name: ‘Stage Lighting Install’,
items: [
‘Rigging plot laid on ground and obstructions checked’,
‘Clear wiring path confirmed’,
‘Rigging points installed in ceiling’,
‘Fixtures installed with safeties per rigging plot’,
‘DMX data cables wired between fixtures’,
‘Power cables wired’,
‘Network switch mounted and configured (if needed)’,
‘Wire routed back to control (computer or console)’,
‘Console file built / scene plot created’,
‘Console connected and all lights functional’,
‘Focus completed on stage — clean coverage across stage’,
‘Good overlap between zones with no dark or bright spots’,
‘Front stage steps cut with shutters or barn doors’,
‘Unintended areas shuttered’,
‘Scenes programmed and saved’,
‘Backup network configuration saved’,
‘Backup console configuration saved’,
‘Backup node configuration saved’
]
}
}
};

// ── Auto-detect systems from scope text ──
function detectSystems(text) {
if (!text) return [];
const t = text.toLowerCase();
const systems = [];
if (t.includes(‘led’) || t.includes(‘video wall’) || t.includes(‘led wall’) || t.includes(‘display wall’)) systems.push(‘led_wall’);
if (t.includes(’pa ’) || t.includes(‘audio’) || t.includes(‘speaker’) || t.includes(‘microphone’) || t.includes(‘sound system’) || t.includes(‘amp’) || t.includes(‘dsp’)) systems.push(‘pa_install’);
if (t.includes(‘light’) || t.includes(‘fixture’) || t.includes(‘dmx’) || t.includes(‘stage light’) || t.includes(‘key light’)) systems.push(‘lighting’);
if (t.includes(‘control’) || t.includes(‘qsys’) || t.includes(‘q-sys’) || t.includes(‘crestron’) || t.includes(‘extron’)) systems.push(‘control’);
if (t.includes(‘stream’) || t.includes(‘broadcast’) || t.includes(‘camera’) || t.includes(‘video produc’)) systems.push(‘streaming’);
return systems;
}

// ── Jetbuilt API ──
async function fetchJetbuilt(endpoint) {
try {
const res = await fetch(`/api/jetbuilt?endpoint=${encodeURIComponent(endpoint)}`);
if (!res.ok) throw new Error(`${res.status}`);
return await res.json();
} catch (e) {
console.error(‘Jetbuilt API error:’, e);
return null;
}
}

async function syncJetbuilt() {
if (state.syncing) return;
state.syncing = true;
const btn = document.getElementById(‘sync-btn’);
const content_el = document.getElementById(‘content’);

if (btn) {
btn.classList.add(‘syncing’);
btn.innerHTML = ‘<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M7 2l2-2M7 2l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Syncing…’;
}

// Show syncing indicator
if (content_el && state.projects.length === 0) {
content_el.innerHTML = ‘<div style="text-align:center;padding:60px 20px;color:#6E7681"><div class="spinner" style="margin:0 auto 12px"></div><div style="font-size:13px">Loading projects from Jetbuilt…</div></div>’;
}

try {
let allProjects = [];
let page = 1;
let hasMore = true;
let errorMsg = null;

```
while (hasMore && page <= 25) {
  try {
    const data = await fetchJetbuilt(`/projects?page=${page}`);
    if (data && Array.isArray(data) && data.length > 0) {
      allProjects = allProjects.concat(data);
      if (data.length < 25) hasMore = false;
      else page++;
    } else if (data && data.error) {
      errorMsg = data.error;
      hasMore = false;
    } else {
      hasMore = false;
    }
  } catch(pageErr) {
    errorMsg = pageErr.message;
    hasMore = false;
  }
}

if (allProjects.length > 0) {
  const projects = allProjects.filter(p => {
    const stage = (p.stage || '').toLowerCase();
    return stage !== 'template';
  });
  state.projects = projects.map(p => enrichProject(p));
  document.getElementById('proj-count').textContent = state.projects.length;
  renderCurrentPage();
  setTimeout(fetchClientNames, 500);
} else {
  // Show error on screen
  if (content_el) {
    content_el.innerHTML = `<div style="padding:20px;background:#1A0D0D;border:1px solid #DA3633;border-radius:8px;color:#F85149;font-size:13px;margin:20px">
      <div style="font-weight:500;margin-bottom:6px">Sync failed</div>
      <div style="font-size:12px;color:#8B949E">${errorMsg || 'No projects returned. Check API key and network connection.'}</div>
      <button onclick="syncJetbuilt()" class="btn-primary" style="margin-top:12px">Retry</button>
    </div>`;
  }
}
```

} catch(err) {
if (content_el) {
content_el.innerHTML = `<div style="padding:20px;background:#1A0D0D;border:1px solid #DA3633;border-radius:8px;color:#F85149;font-size:13px;margin:20px"> <div style="font-weight:500;margin-bottom:6px">Connection error</div> <div style="font-size:12px;color:#8B949E">${err.message}</div> <button onclick="syncJetbuilt()" class="btn-primary" style="margin-top:12px">Retry</button> </div>`;
}
} finally {
state.syncing = false;
if (btn) {
btn.classList.remove(‘syncing’);
btn.innerHTML = ‘<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M7 2l2-2M7 2l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Sync Jetbuilt’;
}
}
}

async function fetchClientNames() {
// Get unique client IDs from projects
const clientIds = […new Set(
state.projects
.filter(p => p.client?.id && !clientNameCache[p.client.id])
.map(p => p.client.id)
)].slice(0, 50); // Fetch up to 50 at a time to avoid rate limits

if (clientIds.length === 0) return;

// Fetch client names in small batches
for (let i = 0; i < clientIds.length; i += 5) {
const batch = clientIds.slice(i, i + 5);
await Promise.all(batch.map(async (id) => {
try {
const data = await fetchJetbuilt(`/clients/${id}`);
if (data && (data.company_name || data.name)) {
clientNameCache[id] = {
name: data.company_name || data.name,
email: data.primary_contact_email || ‘’,
phone: data.primary_contact_phone_number_1 || ‘’,
contact_name: [data.primary_contact_first_name, data.primary_contact_last_name].filter(Boolean).join(’ ’),
address: data.address || ‘’,
city: data.city || ‘’,
state: data.state || ‘’
};
}
} catch (e) {}
}));
// Small delay to avoid rate limiting
if (i + 5 < clientIds.length) await new Promise(r => setTimeout(r, 300));
}

// Update project client names
state.projects.forEach(p => {
if (p.client?.id && clientNameCache[p.client.id]) {
const c = clientNameCache[p.client.id];
p.client_name = c.name;
p.primary_contact_name = c.contact_name;
p.primary_contact_email = c.email;
p.primary_contact_phone = c.phone;
if (!p.address && c.address) p.address = c.address;
if (!p.city && c.city) p.city = c.city;
if (!p.state && c.state) p.state = c.state;
}
});

// Re-render to show updated names
renderCurrentPage();
}

// ── Full Project Detail Fetcher ──
const projectDetailCache = {};

async function fetchProjectDetail(projectId) {
if (projectDetailCache[projectId]) return projectDetailCache[projectId];
const project = state.projects.find(p => p.id === projectId);
if (!project || !project.jetbuilt_id) return null;
try {
const data = await fetchJetbuilt(`/projects/${project.jetbuilt_id}`);
if (data && data.id) {
projectDetailCache[projectId] = data;
return data;
}
} catch(e) { console.error(‘Failed to fetch project detail:’, e); }
return null;
}

// ── Init ──
async function init() {
// Show immediate loading state
const c = document.getElementById(‘content’);
if (c) c.innerHTML = ‘<div style="padding:24px;color:#8B949E;font-size:13px">Starting up…</div>’;

try {
renderCurrentPage();
} catch(e) {
if (c) c.innerHTML = ’<div style="padding:24px;color:#F85149;font-size:12px">Render error: ’ + e.message + ‘</div>’;
return;
}

// Manual sync with status updates
try {
const c2 = document.getElementById(‘content’);
if (c2 && state.projects.length === 0) {
c2.innerHTML = ‘<div style="padding:24px;text-align:center"><div style="color:#8B949E;font-size:13px;margin-bottom:12px">Connecting to Jetbuilt…</div><button onclick="syncJetbuilt()" class="btn-primary">Tap to Load Projects</button></div>’;
}
} catch(e2) {}
}

init();