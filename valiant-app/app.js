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
if (btn) { btn.classList.add(‘syncing’); btn.innerHTML = ‘<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M7 2l2-2M7 2l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Syncing…’; }

try {
// Fetch all pages of projects
let allProjects = [];
let page = 1;
let hasMore = true;

```
while (hasMore) {
  const data = await fetchJetbuilt(`/projects?page=${page}`);
  if (data && Array.isArray(data) && data.length > 0) {
    allProjects = allProjects.concat(data);
    if (data.length < 25) { hasMore = false; }
    else { page++; }
  } else {
    hasMore = false;
  }
}

if (allProjects.length > 0) {
  // Keep ALL projects except template - let the UI sort them into the right buckets
  const projects = allProjects.filter(p => {
    const stage = (p.stage || '').toLowerCase();
    return stage !== 'template';
  });
  state.projects = projects.map(p => enrichProject(p));
} else {
  console.log('No projects returned from API');
}

document.getElementById('proj-count').textContent = state.projects.length;
renderCurrentPage();
// Fetch client names in background
setTimeout(fetchClientNames, 500);
```

} finally {
state.syncing = false;
if (btn) { btn.classList.remove(‘syncing’); btn.innerHTML = ‘<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M7 2l2-2M7 2l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Sync Jetbuilt’; }
}
}

function enrichProject(p) {
const desc = ((p.discussion_body || p.short_description || p.name || ‘’)).toLowerCase();
const systems = detectSystems(desc);
// Real // Map Jetbuilt stage names to internal stages
const stageMap = {
‘lead’: ‘lead’,
‘opportunity’: ‘opportunity’,
‘estimate’: ‘proposal’,
‘proposal’: ‘proposal’,
‘revisions’: ‘revisions’,
‘contract’: ‘contract’,
‘install’: ‘install’,
‘review’: ‘review’,
‘completed’: ‘completed’,
‘icebox’: ‘icebox’,
‘lost’: ‘lost’,
‘template’: ‘template’,
‘trash’: ‘trash’,
‘prospect’: ‘lead’,
‘in-build’: ‘contract’,
‘in_build’: ‘contract’,
‘complete’: ‘completed’
};
const stage = p.stage ? (stageMap[p.stage.toLowerCase()] || p.stage.toLowerCase()) : ‘lead’;
return {
…p,
id: p.custom_id || (‘P-’ + p.id),
jetbuilt_id: p.id,
name: p.name || ‘Unnamed Project’,
client_name: p.client_name || ‘’,
client_id: p.client?.id || null,
description: p.discussion_body || p.short_description || ‘’,
short_desc: p.short_description || ‘’,
estimated_amount: p.total ? parseFloat(p.total) : 0,
equipment_total: p.equipment_total ? parseFloat(p.equipment_total) : 0,
labor_total: p.labor_total ? parseFloat(p.labor_total) : 0,
shipping_total: p.shipping_total ? parseFloat(p.shipping_total) : 0,
total_margin: p.total_margin || 0,
budget: p.budget ? parseFloat(p.budget) : 0,
status: stage,
install_start: p.estimated_install_on || null,
close_date: p.close_date || null,
address: p.address || ‘’,
city: p.city || ‘’,
state: p.state || ‘’,
zipcode: p.zipcode || ‘’,
full_address: [p.address, p.city, p.state, p.zipcode].filter(Boolean).join(’, ’),
designer: p.engineer?.full_name || ‘’,
install_manager: p.project_manager?.full_name || ‘’,
salesperson: p.owner?.full_name || ‘’,
systems,
readiness: getProjectReadiness(p.custom_id || (‘P-’ + p.id)),
timeline_type: ‘soft’,
image_url: p.image_url || null,
active: p.active,
// Client contact (populated by fetchClientNames)
primary_contact_name: ‘’,
primary_contact_email: ‘’,
primary_contact_phone: ‘’
};
}

function getProjectReadiness(id) {
const cl = state.checklists[id] || {};
const total = Object.values(cl).reduce((a, c) => a + c.total, 0);
const done = Object.values(cl).reduce((a, c) => a + c.done, 0);
if (total === 0) return ‘new’;
const pct = done / total;
if (pct === 1) return ‘green’;
if (pct >= 0.6) return ‘blue’;
return ‘red’;
}

function getDemoProjects() {
return [
{
id: ‘P-560’,
name: ‘Grace Community Church — Sanctuary AVL’,
client_name: ‘Grace Community Church’,
description: ‘Full PA system upgrade with line array, LED wall 16x9 on stage, and stage lighting refresh with key lighting and house dimming.’,
status: ‘contract’,
estimated_amount: 185000,
install_start: ‘2025-05-12’,
install_end: ‘2025-05-19’,
timeline_type: ‘hard’,
systems: [‘pa_install’, ‘led_wall’, ‘lighting’],
readiness: ‘blue’,
designer: ‘Kris’,
install_manager: ‘Clint’,
salesperson: ‘Jacob’
},
{
id: ‘P-554’,
name: ‘Riverside Event Center — AV Package’,
client_name: ‘Riverside Event Center’,
description: ‘Distributed audio system, LED display wall, and streaming package with camera system for event broadcasts.’,
status: ‘contract’,
estimated_amount: 92000,
install_start: ‘2025-04-28’,
install_end: ‘2025-05-02’,
timeline_type: ‘soft’,
systems: [‘pa_install’, ‘led_wall’, ‘streaming’],
readiness: ‘red’,
designer: ‘Kris’,
install_manager: ‘Clint’,
salesperson: ‘Jacob’
},
{
id: ‘P-541’,
name: ‘Cornerstone Academy — Auditorium Upgrade’,
client_name: ‘Cornerstone Academy’,
description: ‘PA system, stage lighting upgrade with key lights and wash fixtures, basic video display.’,
status: ‘contract’,
estimated_amount: 64000,
install_start: ‘2025-05-27’,
install_end: ‘2025-05-30’,
timeline_type: ‘soft’,
systems: [‘pa_install’, ‘lighting’],
readiness: ‘new’,
designer: ‘Kris’,
install_manager: ‘Clint’,
salesperson: ‘Jacob’
}
];
}

// ── Navigation ──
const PAGE_TITLES = {
dashboard: ‘Dashboard’,
calendar: ‘Calendar’,
projects: ‘Projects’,
shopwork: ‘Shop Work’,
vendors: ‘Vendors’,
intake: ‘New Intake’,
project: ‘Project Dashboard’
};

function navigate(page, data) {
state.currentPage = page;
if (data !== undefined) state.currentProject = data;
document.querySelectorAll(’.nav-item’).forEach(el => {
el.classList.toggle(‘active’, el.dataset.page === page);
});
document.getElementById(‘page-title’).textContent = PAGE_TITLES[page] || page;
renderCurrentPage();
if (window.innerWidth <= 768) {
document.getElementById(‘sidebar’).classList.remove(‘open’);
}
}

function toggleSidebar() {
document.getElementById(‘sidebar’).classList.toggle(‘open’);
}

function renderCurrentPage() {
const content = document.getElementById(‘content’);
switch (state.currentPage) {
case ‘dashboard’: content.innerHTML = renderDashboard(); break;
case ‘calendar’: content.innerHTML = renderCalendar(); break;
case ‘projects’: content.innerHTML = renderProjects(); break;
case ‘shopwork’: content.innerHTML = renderShopWork(); break;
case ‘vendors’: content.innerHTML = renderVendors(); break;
case ‘intake’: content.innerHTML = renderIntake(); break;
case ‘project’: content.innerHTML = renderProjectDashboard(state.currentProject); attachEventListeners(); break;
default: content.innerHTML = renderDashboard();
}
attachEventListeners();
}

// ── Dashboard ──
let dashboardTab = ‘sales’;
let selectedUser = ‘all’;

const TEAM = [‘Jacob’,‘Kris’,‘Clint’,‘Daniel’,‘Deiton’,‘Caden’];
const ROLES = [‘Sales’,‘Designer’,‘Project Manager’,‘Install Manager’,‘Installer’,‘Purchaser’,‘Commissioner’];

function getProjectsForTab(tab) {
const stageMap = {
sales: [‘lead’,‘opportunity’,‘estimate’,‘proposal’,‘revisions’,‘contract’],
design: [‘contract’,‘install’,‘review’],
install: [‘contract’,‘install’,‘review’,‘completed’]
};
const stages = stageMap[tab] || [];
let projects = state.projects.filter(p => stages.includes(p.status));

// Filter by assigned user if not admin view
if (selectedUser !== ‘all’) {
projects = projects.filter(p => {
const assignments = state.assignments[p.id] || [];
return assignments.some(a => a.name === selectedUser);
});
}
return projects;
}

function renderDashboard() {
if (dashboardTab === ‘sales’) return renderSalesDashboard();

const tabProjects = getProjectsForTab(dashboardTab);
const allAssigned = Object.values(state.assignments).flat();
const salesCount = state.projects.filter(p => [‘lead’,‘estimate’,‘contract’].includes(p.status)).length;
const designCount = state.projects.filter(p => [‘contract’,‘install’].includes(p.status)).length;
const installCount = state.projects.filter(p => [‘contract’,‘install’,‘complete’].includes(p.status)).length;
const needsAttention = state.projects.filter(p => p.readiness === ‘red’).length;

return `

<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
  <div style="display:flex;gap:4px;background:#0D1117;border:1px solid #1C2333;border-radius:8px;padding:3px">
    ${['sales','design','install'].map(tab => `
      <button onclick="dashboardTab='${tab}';renderCurrentPage()"
        style="padding:6px 16px;font-size:12px;font-weight:500;border-radius:6px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.12s;
          background:${dashboardTab===tab?'#1565C0':'transparent'};
          color:${dashboardTab===tab?'#fff':'#6E7681'}">
        ${tab.charAt(0).toUpperCase()+tab.slice(1)}
        <span style="opacity:0.7;margin-left:4px;font-size:11px">${tab==='sales'?salesCount:tab==='design'?designCount:installCount}</span>
      </button>
    `).join('')}
  </div>
  <div style="display:flex;align-items:center;gap:8px">
    <div style="font-size:11px;color:#6E7681">View as:</div>
    <select onchange="selectedUser=this.value;renderCurrentPage()"
      style="padding:5px 10px;background:#161B22;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer">
      <option value="all" ${selectedUser==='all'?'selected':''}>All team</option>
      ${TEAM.map(u => `<option value="${u}" ${selectedUser===u?'selected':''}>${u}</option>`).join('')}
    </select>
  </div>
</div>

<div class="metrics-grid" style="margin-bottom:20px">
  <div class="metric-card">
    <div class="metric-label">${dashboardTab === 'design' ? 'Design Projects' : 'Install Projects'}</div>
    <div class="metric-value">${tabProjects.length}</div>
    <div class="metric-sub">${dashboardTab === 'design' ? 'contract → install' : 'contract → complete'}</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Needs Attention</div>
    <div class="metric-value" style="color:${needsAttention>0?'#F85149':'#3FB950'}">${needsAttention}</div>
    <div class="metric-sub">${needsAttention > 0 ? 'projects blocked' : 'all clear'}</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Team Assigned</div>
    <div class="metric-value">${Object.keys(state.assignments).length}</div>
    <div class="metric-sub">projects with assignments</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Vendors</div>
    <div class="metric-value">${state.vendors.length}</div>
    <div class="metric-sub">in directory</div>
  </div>
</div>

<div class="section-header" style="margin-bottom:12px">
  <div class="section-title">${dashboardTab.charAt(0).toUpperCase()+dashboardTab.slice(1)} Projects ${selectedUser !== 'all' ? '— ' + selectedUser : ''}</div>
  <button class="section-action" onclick="navigate('projects')">View all →</button>
</div>

${tabProjects.length === 0 ? `

  <div class="card"><div class="empty-state"><span class="empty-icon">○</span>${state.projects.length === 0 ? 'Sync Jetbuilt to load projects' : 'No projects in this view'}</div></div>
` : `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
    ${tabProjects.slice(0,12).map(p => {
      const assignments = state.assignments[p.id] || [];
      return `
      <div class="card card-sm" style="cursor:pointer;transition:border-color 0.12s" onmouseenter="this.style.borderColor='#58A6FF'" onmouseleave="this.style.borderColor=''">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div style="flex:1;min-width:0" onclick="navigate('project','${p.id}')">
            <div style="font-size:13px;font-weight:500;color:#E6EDF3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
            <div style="font-size:11px;color:#6E7681;margin-top:1px">${p.id} · ${p.city || ''}</div>
          </div>
          <span class="status-pill ${p.status==='complete'?'status-green':p.status==='contract'||p.status==='install'?'status-blue':'status-gray'}" style="margin-left:8px;flex-shrink:0">${p.status}</span>
        </div>
        ${assignments.length > 0 ? `
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
            ${assignments.map(a => `<div style="display:flex;align-items:center;gap:4px;background:#0D1117;border:1px solid #1C2333;border-radius:12px;padding:2px 8px"><div style="width:16px;height:16px;border-radius:50%;background:#1565C0;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff">${a.name.charAt(0)}</div><span style="font-size:11px;color:#8B949E">${a.name} · ${a.role}</span></div>`).join('')}
          </div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:12px;font-weight:500;color:#58A6FF">${p.estimated_amount ? '$' + Math.round(p.estimated_amount).toLocaleString() : 'TBD'}</div>
          <button class="btn btn-sm" onclick="openAssignModal('${p.id}','${p.name.replace(/'/g,"\'")}')">+ Assign</button>
        </div>
      </div>`;
    }).join('')}
  </div>
  ${tabProjects.length > 12 ? `<div style="text-align:center;margin-top:12px"><button class="btn" onclick="navigate('projects')">View all ${tabProjects.length} →</button></div>` : ''}
`}

<div id="assign-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;align-items:center;justify-content:center">
  <div style="background:#161B22;border:1px solid #30363D;border-radius:12px;padding:24px;width:90%;max-width:380px">
    <div style="font-size:15px;font-weight:600;color:#E6EDF3;margin-bottom:4px">Assign Team Member</div>
    <div style="font-size:12px;color:#6E7681;margin-bottom:16px" id="assign-project-name"></div>
    <div style="margin-bottom:12px"><div class="form-label">Team Member</div><select id="assign-name" class="form-select">${TEAM.map(u => `<option value="${u}">${u}</option>`).join('')}</select></div>
    <div style="margin-bottom:16px"><div class="form-label">Role on this project</div><select id="assign-role" class="form-select">${ROLES.map(r => `<option value="${r}">${r}</option>`).join('')}</select></div>
    <div id="current-assignments" style="margin-bottom:16px"></div>
    <div style="display:flex;gap:8px">
      <button class="btn-primary" onclick="saveAssignment()">Assign</button>
      <button class="btn" onclick="closeAssignModal()">Cancel</button>
    </div>
  </div>
</div>
`;}

// ── Sales Dashboard (Kanban CRM) ──
function getSalesPipelineValue(projects, period) {
const now = new Date();
return projects.filter(p => {
const d = new Date(p.close_date || p.updated_at || p.created_at);
if (period === ‘month’) return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
if (period === ‘quarter’) return Math.floor(d.getMonth()/3) === Math.floor(now.getMonth()/3) && d.getFullYear() === now.getFullYear();
if (period === ‘year’) return d.getFullYear() === now.getFullYear();
return true;
}).reduce((s,p) => s + (p.estimated_amount||0), 0);
}

function getGBBGroups(projects) {
const groups = {};
const used = new Set();
projects.forEach(p => {
const name = p.name || ‘’;
const lc = name.toLowerCase();
const isGood = lc.endsWith(’- good’) || lc.endsWith(’-good’) || lc.endsWith(’ good’);
const isBetter = lc.endsWith(’- better’) || lc.endsWith(’-better’) || lc.endsWith(’ better’);
const isBest = lc.endsWith(’- best’) || lc.endsWith(’-best’) || lc.endsWith(’ best’);
if (isGood || isBetter || isBest) {
const baseName = name.replace(/[-\s]*(good|better|best)\s*$/i, ‘’).trim();
if (!groups[baseName]) groups[baseName] = { good: null, better: null, best: null, projects: [] };
if (isGood) groups[baseName].good = p;
if (isBetter) groups[baseName].better = p;
if (isBest) groups[baseName].best = p;
groups[baseName].projects.push(p);
used.add(p.id);
}
});
Object.entries(state.gbbLinks).forEach(([groupId, ids]) => {
const linked = projects.filter(p => ids.includes(p.id));
if (linked.length > 0 && !groups[‘manual_’+groupId]) {
groups[‘manual_’+groupId] = { projects: linked, manual: true };
linked.forEach(p => used.add(p.id));
}
});
return { groups, used };
}

function renderSalesDashboard() {
const fmt = n => ‘$’ + Math.round(n).toLocaleString();

const allSales = state.projects.filter(p =>
!state.fizzled.includes(p.id) &&
![‘icebox’,‘template’,‘trash’,‘lost’,‘completed’,‘review’,‘install’].includes(p.status)
);
const leads = allSales.filter(p => [‘lead’,‘opportunity’].includes(p.status));
const estimates = allSales.filter(p => [‘estimate’,‘proposal’,‘revisions’].includes(p.status));
const negotiation = allSales.filter(p => [‘contract’].includes(p.status));
const closed = state.projects.filter(p => p.status === ‘completed’);
const fizzledProjects = state.projects.filter(p => state.fizzled.includes(p.id) || [‘icebox’,‘trash’,‘lost’,‘template’].includes(p.status));

const salesCount = state.projects.filter(p => [‘lead’,‘opportunity’,‘proposal’,‘revisions’,‘contract’].includes(p.status)).length;
const designCount = state.projects.filter(p => [‘contract’,‘install’,‘review’].includes(p.status)).length;
const installCount = state.projects.filter(p => [‘contract’,‘install’,‘review’,‘completed’].includes(p.status)).length;

const leadsValue = leads.reduce((s,p) => s + (p.estimated_amount||0), 0);
const allActiveValue = allSales.reduce((s,p) => s + (p.estimated_amount||0), 0);
const closedThisMonth = getSalesPipelineValue(closed, ‘month’);
const closedThisQuarter = getSalesPipelineValue(closed, ‘quarter’);
const closedThisYear = getSalesPipelineValue(closed, ‘year’);
const winRate = (allSales.length + closed.length) > 0
? Math.round(closed.length / (allSales.length + closed.length) * 100) : 0;

function kanbanCard(p) {
return ` <div class="project-card" draggable="true" ondragstart="event.dataTransfer.setData('projectId','${p.id}')" onclick="navigate('project','${p.id}')"> <div class="project-card-name">${p.name}</div> <div style="display:flex;align-items:center;gap:6px;margin:3px 0 6px;flex-wrap:wrap"> <span style="font-size:10px;font-family:'DM Mono',monospace;color:#58A6FF;background:#0D1626;padding:1px 6px;border-radius:3px;border:1px solid #1565C0">${p.id}</span> <span style="font-size:11px;color:#6E7681">${p.client_name || (p.city ? p.city + (p.state ? ', ' + p.state : '') : '')}</span> </div> <div class="project-card-footer"> <div class="project-card-value">${p.estimated_amount ? fmt(p.estimated_amount) : 'TBD'}</div> </div> </div>`;
}

function kanbanCol(title, projects, stage, color) {
const total = projects.reduce((s,p) => s+(p.estimated_amount||0), 0);
return ` <div style="flex:1;min-width:200px"> <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"> <div style="font-size:11px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.06em">${title}</div> <div style="display:flex;align-items:center;gap:6px"> <span style="font-size:11px;color:#6E7681">${fmt(total)}</span> <span style="font-size:10px;background:#161B22;border:1px solid #1C2333;border-radius:10px;padding:1px 7px;color:#6E7681">${projects.length}</span> </div> </div> <div style="background:#0D1117;border:1px solid #1C2333;border-radius:10px;padding:10px;min-height:200px" ondragover="event.preventDefault()" ondrop="moveProjectToStage(event,'${stage}')"> ${projects.map(p => kanbanCard(p)).join('') || '<div style="color:#30363D;font-size:12px;text-align:center;padding:20px 0">Drop here</div>'} </div> </div>`;
}

return `

<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <div style="display:flex;gap:4px;background:#0D1117;border:1px solid #1C2333;border-radius:8px;padding:3px">
      ${['sales','design','install'].map(tab => `
        <button onclick="dashboardTab='${tab}';renderCurrentPage()"
          style="padding:6px 16px;font-size:12px;font-weight:500;border-radius:6px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.12s;background:${dashboardTab===tab?'#1565C0':'transparent'};color:${dashboardTab===tab?'#fff':'#6E7681'}">
          ${tab.charAt(0).toUpperCase()+tab.slice(1)}
          <span style="opacity:0.7;margin-left:4px;font-size:11px">${tab==='sales'?salesCount:tab==='design'?designCount:installCount}</span>
        </button>
      `).join('')}
    </div>
    <div id="drop-lost"
      ondragover="event.preventDefault();this.style.borderColor='#F85149';this.style.background='#1A0D0D'"
      ondragleave="this.style.borderColor='#DA3633';this.style.background='transparent'"
      ondrop="dropToArchive(event,'lost',this)"
      style="border:1.5px dashed #DA3633;border-radius:8px;padding:5px 12px;display:flex;align-items:center;gap:5px;cursor:pointer;transition:all 0.15s;background:transparent">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3a2 2 0 0 1 4 0v1M3 4l.7 7.3A1 1 0 0 0 4.7 12h4.6a1 1 0 0 0 1-.7L11 4" stroke="#F85149" stroke-width="1.3" stroke-linecap="round"/></svg>
      <span style="font-size:11px;font-weight:500;color:#F85149">Lost</span>
    </div>
    <div id="drop-icebox"
      ondragover="event.preventDefault();this.style.borderColor='#58A6FF';this.style.background='#0D1626'"
      ondragleave="this.style.borderColor='#1565C0';this.style.background='transparent'"
      ondrop="dropToArchive(event,'icebox',this)"
      style="border:1.5px dashed #1565C0;border-radius:8px;padding:5px 12px;display:flex;align-items:center;gap:5px;cursor:pointer;transition:all 0.15s;background:transparent">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2" y="4" width="10" height="8" rx="1" stroke="#58A6FF" stroke-width="1.3"/><path d="M5 4V3a2 2 0 0 1 4 0v1" stroke="#58A6FF" stroke-width="1.3"/><path d="M7 7v2" stroke="#58A6FF" stroke-width="1.3" stroke-linecap="round"/></svg>
      <span style="font-size:11px;font-weight:500;color:#58A6FF">Icebox</span>
    </div>
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <button class="btn btn-sm" onclick="showArchivedDeals()" style="font-size:11px">Archived (${fizzledProjects.length})</button>
    <select onchange="selectedUser=this.value;renderCurrentPage()"
      style="padding:5px 10px;background:#161B22;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer">
      <option value="all">All team</option>
      ${TEAM.map(u => `<option value="${u}" ${selectedUser===u?'selected':''}>${u}</option>`).join('')}
    </select>
  </div>
</div>

<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:24px">
  <div class="metric-card">
    <div class="metric-label">Leads value</div>
    <div class="metric-value" style="font-size:18px">${fmt(leadsValue)}</div>
    <div class="metric-sub">${leads.length} active lead${leads.length!==1?'s':''}</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Pipeline value</div>
    <div class="metric-value" style="font-size:18px">${fmt(allActiveValue)}</div>
    <div class="metric-sub">${allSales.length} active opportunities</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Closed this month</div>
    <div class="metric-value" style="font-size:18px;color:#3FB950">${fmt(closedThisMonth)}</div>
    <div class="metric-sub">Q: ${fmt(closedThisQuarter)} · Y: ${fmt(closedThisYear)}</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Win rate</div>
    <div class="metric-value" style="font-size:18px">${winRate}%</div>
    <div class="metric-sub">${closed.length} closed total</div>
  </div>
</div>

<div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:16px">
  ${kanbanCol('Leads', leads, 'opportunity', '#6E7681')}
  ${kanbanCol('Estimates', estimates, 'proposal', '#D29922')}
  ${kanbanCol('Negotiation', negotiation, 'contract', '#58A6FF')}
</div>

<div id="archived-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;align-items:center;justify-content:center">
  <div style="background:#161B22;border:1px solid #30363D;border-radius:12px;padding:24px;width:90%;max-width:600px;max-height:80vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:15px;font-weight:600;color:#E6EDF3">Archived / Fizzled Deals</div>
      <button onclick="document.getElementById('archived-modal').style.display='none'" style="background:none;border:none;color:#6E7681;cursor:pointer;font-size:18px">×</button>
    </div>
    ${fizzledProjects.length === 0
      ? '<div style="color:#6E7681;font-size:13px;text-align:center;padding:20px">No archived deals yet</div>'
      : fizzledProjects.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #0D1117">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;color:#6E7681;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
            <div style="font-size:11px;margin-top:2px;color:#30363D">${p.id} · ${p.estimated_amount ? fmt(p.estimated_amount) : 'TBD'} · <span style="color:${p.status==='lost'?'#F85149':'#58A6FF'}">${p.status}</span></div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;margin-left:10px">
            <button class="btn btn-sm" onclick="restoreProject('${p.id}')">Restore</button>
            <button class="btn btn-sm" onclick="navigate('project','${p.id}')">View</button>
          </div>
        </div>
      `).join('')}
  </div>
</div>
`;}

function moveProjectToStage(event, stage) {
const projectId = event.dataTransfer.getData(‘projectId’);
const project = state.projects.find(p => p.id === projectId);
if (project) {
project.status = stage;
saveState();
renderCurrentPage();
}
}

function dropToArchive(event, stage, el) {
el.style.borderColor = stage === ‘lost’ ? ‘#DA3633’ : ‘#1565C0’;
el.style.background = ‘transparent’;
const projectId = event.dataTransfer.getData(‘projectId’);
const project = state.projects.find(p => p.id === projectId);
if (project) {
project.status = stage;
if (!state.fizzled.includes(projectId)) state.fizzled.push(projectId);
saveState();
renderCurrentPage();
}
}

function fizzleProject(projectId) {
if (!state.fizzled.includes(projectId)) {
state.fizzled.push(projectId);
saveState();
renderCurrentPage();
}
}

function restoreProject(projectId) {
state.fizzled = state.fizzled.filter(id => id !== projectId);
saveState();
document.getElementById(‘archived-modal’).style.display = ‘none’;
renderCurrentPage();
}

function showArchivedDeals() {
renderCurrentPage();
setTimeout(() => {
const modal = document.getElementById(‘archived-modal’);
if (modal) modal.style.display = ‘flex’;
}, 100);
}
let assigningProjectId = null;

function openAssignModal(projectId, projectName) {
assigningProjectId = projectId;
document.getElementById(‘assign-project-name’).textContent = projectName;
const modal = document.getElementById(‘assign-modal’);
if (modal) { modal.style.display = ‘flex’; }

const current = state.assignments[projectId] || [];
const currentDiv = document.getElementById(‘current-assignments’);
if (currentDiv && current.length > 0) {
currentDiv.innerHTML = `<div class="form-label" style="margin-bottom:6px">Current assignments</div> ${current.map((a,i) =>`
<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #0D1117">
<span style="font-size:12px;color:#C9D1D9">${a.name} <span style="color:#6E7681">· ${a.role}</span></span>
<button class="btn btn-sm btn-danger" onclick="removeAssignment('${projectId}',${i})">×</button>
</div>
`).join('')} `;
} else if (currentDiv) {
currentDiv.innerHTML = ‘’;
}
}

function closeAssignModal() {
const modal = document.getElementById(‘assign-modal’);
if (modal) modal.style.display = ‘none’;
assigningProjectId = null;
}

function saveAssignment() {
if (!assigningProjectId) return;
const name = document.getElementById(‘assign-name’).value;
const role = document.getElementById(‘assign-role’).value;
if (!state.assignments[assigningProjectId]) state.assignments[assigningProjectId] = [];
// Avoid duplicate role assignments
const existing = state.assignments[assigningProjectId].findIndex(a => a.name === name && a.role === role);
if (existing === -1) {
state.assignments[assigningProjectId].push({ name, role });
saveState();
}
closeAssignModal();
renderCurrentPage();
}

function removeAssignment(projectId, index) {
if (state.assignments[projectId]) {
state.assignments[projectId].splice(index, 1);
saveState();
renderCurrentPage();
}
}
// ── Projects Page ──
let projectSort = { field: ‘name’, dir: ‘asc’ };
let projectSearch = ‘’;
let projectStageFilter = ‘all’;

function getFilteredProjects() {
let projects = […state.projects];
if (projectSearch) {
const q = projectSearch.toLowerCase();
projects = projects.filter(p =>
(p.name || ‘’).toLowerCase().includes(q) ||
(p.id || ‘’).toLowerCase().includes(q) ||
(p.client_name || ‘’).toLowerCase().includes(q) ||
(p.address || ‘’).toLowerCase().includes(q) ||
(p.city || ‘’).toLowerCase().includes(q)
);
}
if (projectStageFilter !== ‘all’) {
projects = projects.filter(p => p.status === projectStageFilter);
}
projects.sort((a, b) => {
let av, bv;
switch (projectSort.field) {
case ‘name’: av = a.name || ‘’; bv = b.name || ‘’; break;
case ‘client’: av = a.client_name || a.city || ‘’; bv = b.client_name || b.city || ‘’; break;
case ‘stage’: av = a.status || ‘’; bv = b.status || ‘’; break;
case ‘date’: av = a.install_start ? new Date(a.install_start).getTime() : 0; bv = b.install_start ? new Date(b.install_start).getTime() : 0; break;
case ‘value’: av = a.estimated_amount || 0; bv = b.estimated_amount || 0; break;
default: av = a.name || ‘’; bv = b.name || ‘’;
}
if (typeof av === ‘string’) { av = av.toLowerCase(); bv = bv.toLowerCase(); }
if (av < bv) return projectSort.dir === ‘asc’ ? -1 : 1;
if (av > bv) return projectSort.dir === ‘asc’ ? 1 : -1;
return 0;
});
return projects;
}

function setSortField(field) {
if (projectSort.field === field) { projectSort.dir = projectSort.dir === ‘asc’ ? ‘desc’ : ‘asc’; }
else { projectSort.field = field; projectSort.dir = ‘asc’; }
renderCurrentPage();
}

function sortArrow(field) {
if (projectSort.field !== field) return ‘<span style="color:#30363D;margin-left:3px">↕</span>’;
return projectSort.dir === ‘asc’ ? ‘<span style="color:#58A6FF;margin-left:3px">↑</span>’ : ‘<span style="color:#58A6FF;margin-left:3px">↓</span>’;
}

function renderProjects() {
const filtered = getFilteredProjects();
const stages = [‘all’,‘lead’,‘opportunity’,‘estimate’,‘proposal’,‘revisions’,‘contract’,‘install’,‘review’,‘completed’,‘icebox’,‘lost’];
const stageLabels = { all:‘All’, lead:‘Lead’, opportunity:‘Opportunity’, estimate:‘Estimate’, proposal:‘Proposal’, revisions:‘Revisions’, contract:‘Contract’, install:‘Install’, review:‘Review’, completed:‘Completed’, icebox:‘Icebox’, lost:‘Lost’ };
const stageCounts = {};
stages.forEach(s => { stageCounts[s] = s === ‘all’ ? state.projects.length : state.projects.filter(p => p.status === s).length; });

return `

<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px;flex-wrap:wrap">
  <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:200px">
    <div style="position:relative;flex:1;max-width:320px">
      <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#6E7681" width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 10l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <input style="width:100%;padding:7px 10px 7px 32px;background:#161B22;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;font-size:13px;font-family:'DM Sans',sans-serif" placeholder="Search projects, clients, IDs..." value="${projectSearch}" oninput="projectSearch=this.value;renderCurrentPage()">
    </div>
    <button class="btn btn-sm" onclick="syncJetbuilt()">Sync</button>
  </div>
  <div style="font-size:12px;color:#6E7681">${filtered.length} of ${state.projects.length} projects</div>
</div>
<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
  ${stages.map(s => `<button onclick="projectStageFilter='${s}';renderCurrentPage()" style="padding:5px 12px;font-size:12px;border-radius:20px;border:1px solid ${projectStageFilter===s?'#1565C0':'#30363D'};background:${projectStageFilter===s?'#1565C0':'#161B22'};color:${projectStageFilter===s?'#fff':'#8B949E'};cursor:pointer;font-family:'DM Sans',sans-serif">${stageLabels[s]} <span style="opacity:0.7">${stageCounts[s]}</span></button>`).join('')}
</div>
<div class="card" style="padding:0;overflow:hidden">
  <table class="projects-table">
    <thead>
      <tr>
        <th style="cursor:pointer;user-select:none" onclick="setSortField('name')">Project ${sortArrow('name')}</th>
        <th style="cursor:pointer;user-select:none" onclick="setSortField('client')">Client ${sortArrow('client')}</th>
        <th>Systems</th>
        <th style="cursor:pointer;user-select:none" onclick="setSortField('date')">Install Date ${sortArrow('date')}</th>
        <th style="cursor:pointer;user-select:none" onclick="setSortField('stage')">Stage ${sortArrow('stage')}</th>
        <th style="cursor:pointer;user-select:none" onclick="setSortField('value')">Value ${sortArrow('value')}</th>
      </tr>
    </thead>
    <tbody>
      ${filtered.map(p => `
        <tr onclick="navigate('project', '${p.id}')">
          <td><div class="proj-name">${p.name}</div><div class="proj-id">${p.id}</div></td>
          <td style="color:#8B949E;font-size:12px">${p.client_name || p.city || '—'}</td>
          <td>${(p.systems||[]).map(s=>`<span class="tag tag-${s==='led_wall'?'led':s==='pa_install'?'audio':s==='lighting'?'lighting':s==='streaming'?'streaming':'control'}">${s.replace('_install','').replace('_',' ')}</span>`).join('')||'<span style="color:#30363D;font-size:11px">—</span>'}</td>
          <td style="color:#8B949E;font-size:12px">${p.install_start?new Date(p.install_start).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'}):'—'}</td>
          <td><span class="status-pill ${p.status==='completed'?'status-green':p.status==='contract'||p.status==='install'||p.status==='review'?'status-blue':p.status==='lead'||p.status==='opportunity'?'status-gray':p.status==='icebox'||p.status==='trash'||p.status==='lost'?'status-red':'status-amber'}">${p.status||'—'}</span></td>
          <td style="color:#58A6FF;font-weight:500;font-size:12px">${p.estimated_amount?'$'+Math.round(p.estimated_amount).toLocaleString():'—'}</td>
        </tr>
      `).join('')||'<tr><td colspan="6" style="text-align:center;padding:40px;color:#6E7681">No projects match your search</td></tr>'}
    </tbody>
  </table>
</div>`;}
// ── Project Dashboard ──
async function loadAndRenderProject(projectId) {
  const detail = await fetchProjectDetail(projectId);
  if (detail) {
    // Merge rich data into project
    const project = state.projects.find(p => p.id === projectId);
    if (project) {
      project._detail = detail;
      project.rooms = detail.rooms || [];
      project.systems_jb = detail.systems || [];
      project.phases = detail.phases || [];
      project.labor_detail = detail.labor || [];
      project.versions = detail.versions || [];
      project.tags = detail.tags || [];
      project.contract_number = detail.contract_number || '';
      project.probability = detail.probability || '';
      project.paid_to_date = detail.paid_to_date || '0';
      project.discussion_title = detail.discussion_title || '';
      if (!project.description && detail.discussion_body) project.description = detail.discussion_body;
    }
  }
  renderCurrentPage();
}

function renderProjectDashboard(projectId) {
const project = state.projects.find(p => p.id === projectId);
if (!project) return ‘<div class="empty-state">Project not found</div>’;

// Trigger background detail fetch if not loaded
if (!project._detail) {
setTimeout(() => loadAndRenderProject(projectId), 100);
}

const cl = state.checklists[projectId] || {};
const designItems = (project.systems || []).flatMap(s => TEMPLATES.design[s]?.items || []);
const installItems = (project.systems || []).flatMap(s => TEMPLATES.install[s]?.items || []);
const designChecked = cl.design || {};
const installChecked = cl.install || {};
const staffChecked = cl.staff || {};
const designDone = designItems.filter((*, i) => designChecked[i]).length;
const installDone = installItems.filter((*, i) => installChecked[i]).length;

const systemTags = (project.systems || []).map(s => {
const map = { led_wall: ‘led’, pa_install: ‘audio’, lighting: ‘lighting’, streaming: ‘streaming’, control: ‘control’ };
const names = { led_wall: ‘LED Wall’, pa_install: ‘PA System’, lighting: ‘Stage Lighting’, streaming: ‘Streaming’, control: ‘Control’ };
return `<span class="tag tag-${map[s]||'audio'}">${names[s]||s}</span>`;
}).join(’’);

// Jetbuilt systems tags
const jbSystemTags = (project.systems_jb || []).map(s =>
`<span class="tag tag-control">${s.name}</span>`
).join(’’);

return `

<div style="margin-bottom:16px">
  <button class="btn btn-sm" onclick="navigate('projects')" style="margin-bottom:12px">← Back to Projects</button>
  <div class="project-dashboard-header">
    <div style="display:flex;align-items:flex-start;gap:14px">
      ${project.image_url ? `<img src="${project.image_url}" style="width:48px;height:48px;border-radius:8px;object-fit:contain;background:#161B22;border:1px solid #1C2333;flex-shrink:0" onerror="this.style.display='none'">` : ''}
      <div>
        <div class="project-name">${project.name}</div>
        <div class="project-meta">${project.client_name || ''} ${project.full_address ? '· ' + project.full_address : ''}</div>
        <div class="project-id">${project.id}${project.contract_number ? ' · Contract #' + project.contract_number : ''}</div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${systemTags}${jbSystemTags}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
      <span class="status-pill ${project.readiness === 'green' ? 'status-green' : project.readiness === 'red' ? 'status-red' : 'status-blue'}" style="font-size:12px;padding:5px 12px">
        ${project.readiness === 'green' ? '✓ Ready to Install' : project.readiness === 'red' ? '⚠ Needs Attention' : project.readiness === 'new' ? '● New Project' : '◑ In Progress'}
      </span>
      <span class="status-pill ${project.timeline_type === 'hard' ? 'status-red' : 'status-blue'}">
        ${project.timeline_type === 'hard' ? '🔒 Hard Date' : '📅 Soft Date'}
      </span>
      <select onchange="changeProjectStage('${project.id}', this.value)"
        style="padding:5px 10px;background:#161B22;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer">
        ${['lead','opportunity','proposal','revisions','contract','install','review','completed','icebox','lost','template','trash'].map(s =>
          `<option value="${s}" ${project.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
        ).join('')}
      </select>
    </div>
  </div>
</div>

<div class="tabs" id="proj-tabs">
  <div class="tab active" onclick="switchTab('overview')">Overview</div>
  <div class="tab" onclick="switchTab('scope')">Scope of Work</div>
  <div class="tab" onclick="switchTab('design')">Design (${designDone}/${designItems.length})</div>
  <div class="tab" onclick="switchTab('install')">Install (${installDone}/${installItems.length})</div>
  <div class="tab" onclick="switchTab('scheduling')">Scheduling</div>
  <div class="tab" onclick="switchTab('financials')" ${!canSee('financials') ? 'style="display:none"' : ''}>Financials</div>
  <div class="tab" onclick="switchTab('assets')">Assets</div>
</div>

<div id="tab-overview">
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <div class="dashboard-card-title">Project Info</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        <div><div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Stage</div><div style="color:#E6EDF3">${project.status || '—'}</div></div>
        <div><div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Owner</div><div style="color:#E6EDF3">${project.salesperson || '—'}</div></div>
        <div><div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Designer</div><div style="color:#E6EDF3">${project.designer || 'Unassigned'}</div></div>
        <div><div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Install Mgr</div><div style="color:#E6EDF3">${project.install_manager || 'Unassigned'}</div></div>
        ${project.install_start ? `<div><div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Install Date</div><div style="color:#E6EDF3">${new Date(project.install_start).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}</div></div>` : ''}
        ${project.close_date ? `<div><div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Close Date</div><div style="color:#E6EDF3">${new Date(project.close_date).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}</div></div>` : ''}
        ${project.install_duration ? `<div><div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Est. Duration</div><div style="color:#E6EDF3">${project.install_duration}</div></div>` : ''}
        ${project.crew_size ? `<div><div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Crew Size</div><div style="color:#E6EDF3">${project.crew_size}</div></div>` : ''}
        ${project.rooms && project.rooms.length > 0 ? `<div style="grid-column:1/-1"><div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Rooms</div><div style="color:#E6EDF3">${project.rooms.map(r=>r.name).join(', ')}</div></div>` : ''}
        ${project.phases && project.phases.length > 0 ? `<div style="grid-column:1/-1"><div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Phases</div><div style="color:#E6EDF3">${project.phases.map(p=>p.name).join(', ')}</div></div>` : ''}
      </div>
      ${canSee('client_contact') ? `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #0D1117">
        <div style="color:#6E7681;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Client Contact</div>
        ${project.client_name ? `<div style="font-size:13px;font-weight:500;color:#E6EDF3">${project.client_name}</div>` : ''}
        ${project.primary_contact_name ? `<div style="font-size:12px;color:#8B949E;margin-top:1px">${project.primary_contact_name}</div>` : ''}
        ${project.primary_contact_email ? `<a href="mailto:${project.primary_contact_email}" style="font-size:12px;color:#58A6FF;display:block;margin-top:2px">${project.primary_contact_email}</a>` : ''}
        ${project.primary_contact_phone ? `<div style="font-size:12px;color:#8B949E;margin-top:2px">${project.primary_contact_phone}</div>` : ''}
        <div style="font-size:12px;color:#6E7681;margin-top:4px">${project.full_address || ''}</div>
      </div>` : ''}
      <div style="margin-top:12px;border-top:1px solid #0D1117;padding-top:12px">
        <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">System Tags</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${['pa_install','led_wall','lighting','control','streaming','camera','network','infrastructure'].map(sys => {
            const labels = {pa_install:'PA System',led_wall:'LED Wall',lighting:'Lighting',control:'Control',streaming:'Streaming',camera:'Camera',network:'Network',infrastructure:'Infrastructure'};
            const active = (project.systems||[]).includes(sys);
            return `<button onclick="toggleProjectSystem('${project.id}','${sys}')"
              style="padding:4px 10px;font-size:11px;border-radius:12px;border:1px solid ${active?'#1565C0':'#30363D'};background:${active?'#0D1626':'transparent'};color:${active?'#58A6FF':'#6E7681'};cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.12s">
              ${labels[sys]}
            </button>`;
          }).join('')}
        </div>
        ${project.status === 'contract' && !(state.reviewed||{})[project.id] ? `
          <div style="margin-top:10px">
            <button class="btn-primary" onclick="openContractReview('${project.id}')" style="font-size:12px">
              Review Contract & Confirm Tags →
            </button>
          </div>` : ''}
      </div>
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-title">Readiness Checklist</div>
      ${renderReadinessChecklist(project, staffChecked, {})}
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;margin-bottom:14px">
    <div class="dashboard-card">
      <div class="dashboard-card-title">Design Track</div>
      ${renderTrackStatus('design', project.id)}
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-title">Install Track</div>
      ${renderTrackStatus('install', project.id)}
    </div>
  </div>
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <div class="dashboard-card-title">Design Progress <span style="font-weight:400;color:#6E7681">${designDone}/${designItems.length}</span></div>
      <div class="timeline-bar">${designItems.map((_,i) => `<div class="timeline-segment ${designChecked[i] ? 'done' : ''}"></div>`).join('')}</div>
      <div style="font-size:12px;color:#6E7681">${designItems.length === 0 ? 'No design templates — set system tags above' : Math.round(designDone/Math.max(designItems.length,1)*100) + '% complete'}</div>
      <button class="btn btn-sm" style="margin-top:10px" onclick="switchTab('design')">View design checklist →</button>
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-title">Install Progress <span style="font-weight:400;color:#6E7681">${installDone}/${installItems.length}</span></div>
      <div class="timeline-bar">${installItems.map((_,i) => `<div class="timeline-segment ${installChecked[i] ? 'done' : ''}"></div>`).join('')}</div>
      <div style="font-size:12px;color:#6E7681">${installItems.length === 0 ? 'No install templates — set system tags above' : Math.round(installDone/Math.max(installItems.length,1)*100) + '% complete'}</div>
      <button class="btn btn-sm" style="margin-top:10px" onclick="switchTab('install')">View install checklist →</button>
    </div>
  </div>
</div>

<div id="tab-scope" style="display:none">
  <div class="dashboard-card">
    <div class="dashboard-card-title">${project.discussion_title || 'Scope of Work'}</div>
    <div style="font-size:13px;color:#C9D1D9;line-height:1.8;white-space:pre-wrap">${project.description || 'No scope of work available. Add description in Jetbuilt.'}</div>
  </div>
  ${project.short_desc ? `
  <div class="dashboard-card" style="margin-top:14px">
    <div class="dashboard-card-title">Short Description</div>
    <div style="font-size:13px;color:#C9D1D9;line-height:1.6">${project.short_desc}</div>
  </div>` : ''}
</div>

<div id="tab-design" style="display:none">
  ${designItems.length === 0 ? '<div class="alert alert-info">No design templates detected. Set system tags in the Overview tab to auto-populate checklists.</div>' : ''}
  ${(project.systems || []).map(sys => TEMPLATES.design[sys] ? `
    <div class="dashboard-card" style="margin-bottom:14px">
      <div class="dashboard-card-title">${TEMPLATES.design[sys].name}</div>
      ${TEMPLATES.design[sys].items.map((item, i) => `
        <div class="checklist-item ${designChecked[sys+'_'+i] ? 'checked' : ''}" onclick="toggleCheck('design','${projectId}','${sys}_${i}',this)">
          <div class="checklist-box"><svg class="checklist-check" width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7 8,3" stroke="white" stroke-width="1.5" fill="none"/></svg></div>
          <div class="checklist-label">${item}</div>
        </div>`).join('')}
    </div>` : '').join('')}
</div>

<div id="tab-install" style="display:none">
  ${installItems.length === 0 ? '<div class="alert alert-info">No install templates detected. Set system tags in the Overview tab to auto-populate checklists.</div>' : ''}
  ${(project.systems || []).map(sys => TEMPLATES.install[sys] ? `
    <div class="dashboard-card" style="margin-bottom:14px">
      <div class="dashboard-card-title">${TEMPLATES.install[sys].name}</div>
      ${TEMPLATES.install[sys].items.map((item, i) => `
        <div class="checklist-item ${installChecked[sys+'_'+i] ? 'checked' : ''}" onclick="toggleCheck('install','${projectId}','${sys}_${i}',this)">
          <div class="checklist-box"><svg class="checklist-check" width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7 8,3" stroke="white" stroke-width="1.5" fill="none"/></svg></div>
          <div class="checklist-label">${item}</div>
        </div>`).join('')}
    </div>` : '').join('')}
</div>

<div id="tab-scheduling" style="display:none">
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <div class="dashboard-card-title">Install Schedule</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div><div class="form-label">Install Start</div><input class="form-input" type="date" value="${project.install_start || ''}" onchange="updateProjectField('${projectId}','install_start',this.value)"></div>
        <div><div class="form-label">Install End</div><input class="form-input" type="date" value="${project.install_end || ''}" onchange="updateProjectField('${projectId}','install_end',this.value)"></div>
      </div>
      <div class="form-group">
        <div class="form-label">Timeline Type</div>
        <select class="form-select" onchange="updateProjectField('${projectId}','timeline_type',this.value)">
          <option value="soft" ${project.timeline_type !== 'hard' ? 'selected' : ''}>Soft — can be moved</option>
          <option value="hard" ${project.timeline_type === 'hard' ? 'selected' : ''}>Hard — cannot move</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <div style="flex:1;background:#0D1117;border:1px solid #1C2333;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Prep Day</div>
          <div style="font-size:12px;color:#E6EDF3">${project.install_start ? new Date(new Date(project.install_start).getTime()-86400000).toLocaleDateString('en',{month:'short',day:'numeric'}) : 'TBD'}</div>
        </div>
        <div style="flex:1;background:#0D1117;border:1px solid #1C2333;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Install</div>
          <div style="font-size:12px;color:#E6EDF3">${project.install_start ? new Date(project.install_start).toLocaleDateString('en',{month:'short',day:'numeric'}) : 'TBD'}</div>
        </div>
        <div style="flex:1;background:#0D1117;border:1px solid #1C2333;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Deprep Day</div>
          <div style="font-size:12px;color:#E6EDF3">${project.install_end ? new Date(new Date(project.install_end).getTime()+86400000).toLocaleDateString('en',{month:'short',day:'numeric'}) : 'TBD'}</div>
        </div>
      </div>
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-title">Team Assignment</div>
      ${(state.assignments[projectId] || []).map((a,i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #0D1117">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:#1565C0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff">${a.name.charAt(0)}</div>
            <div><div style="font-size:12px;font-weight:500;color:#E6EDF3">${a.name}</div><div style="font-size:11px;color:#6E7681">${a.role}</div></div>
          </div>
          <button class="btn btn-sm btn-danger" onclick="removeAssignment('${projectId}',${i})">×</button>
        </div>`).join('') || '<div style="color:#6E7681;font-size:12px;padding:10px 0">No team assigned yet</div>'}
      <button class="btn btn-sm" style="margin-top:10px" onclick="openAssignModal('${projectId}','${project.name.replace(/'/g,"\'")}')">+ Assign team member</button>
    </div>
  </div>
</div>

<div id="tab-financials" style="display:${canSee('financials') ? 'block' : 'none'}">
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <div class="dashboard-card-title">Financial Summary</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${[
          ['Contract Value', '$' + Math.round(project.estimated_amount||0).toLocaleString()],
          ['Budget', project.budget ? '$' + Math.round(project.budget).toLocaleString() : '—'],
          ['Equipment', '$' + Math.round(project.equipment_total||0).toLocaleString()],
          ['Labor', '$' + Math.round(project.labor_total||0).toLocaleString()],
          ['Shipping', '$' + Math.round(project.shipping_total||0).toLocaleString()],
          ['Paid to Date', '$' + Math.round(parseFloat(project.paid_to_date||0)).toLocaleString()],
          ['Margin', Math.round(project.total_margin||0) + '%'],
          ['Equipment Margin', Math.round(project.equipment_margin||0) + '%']
        ].map(([label, val]) => `
          <div style="background:#0D1117;border-radius:8px;padding:10px">
            <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">${label}</div>
            <div style="font-size:14px;font-weight:500;color:${label.includes('Margin') ? (parseInt(val)>30?'#3FB950':'#D29922') : label==='Contract Value'?'#58A6FF':'#E6EDF3'}">${val}</div>
          </div>`).join('')}
      </div>
    </div>
    ${project.labor_detail && project.labor_detail.length > 0 ? `
    <div class="dashboard-card">
      <div class="dashboard-card-title">Labor Breakdown</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="color:#6E7681;border-bottom:1px solid #0D1117">
          <th style="text-align:left;padding:6px 0;font-weight:500">Category</th>
          <th style="text-align:right;padding:6px 0;font-weight:500">Hours</th>
          <th style="text-align:right;padding:6px 0;font-weight:500">Rate</th>
          <th style="text-align:right;padding:6px 0;font-weight:500">Total</th>
        </tr>
        ${project.labor_detail.map(l => `
          <tr style="border-bottom:1px solid #0D1117">
            <td style="padding:7px 0;color:#C9D1D9">${l.name}</td>
            <td style="padding:7px 0;text-align:right;color:#8B949E">${parseFloat(l.total_hours||0).toFixed(1)}</td>
            <td style="padding:7px 0;text-align:right;color:#8B949E">$${parseFloat(l.price||0).toFixed(0)}/hr</td>
            <td style="padding:7px 0;text-align:right;color:#E6EDF3">$${Math.round(parseFloat(l.total_hours||0)*parseFloat(l.price||0)).toLocaleString()}</td>
          </tr>`).join('')}
      </table>
    </div>` : ''}
  </div>
  ${project.versions && project.versions.length > 1 ? `
  <div class="dashboard-card" style="margin-top:14px">
    <div class="dashboard-card-title">Versions / Revisions</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${project.versions.map(v => `<span class="tag tag-control">${v.name}${v.locked ? ' 🔒' : ''}</span>`).join('')}
    </div>
  </div>` : ''}
</div>

<div id="tab-assets" style="display:none">
  <div class="dashboard-card">
    <div class="dashboard-card-title">Project Assets</div>
    <div style="color:#6E7681;font-size:12px;margin-bottom:12px">Upload drawings, specs, as-builts, and other project documents here.</div>
    <div class="alert alert-info">Asset management (drawings, specs, as-builts, photos from field) coming in Phase 2.</div>
  </div>
  ${project.image_url ? `
  <div class="dashboard-card" style="margin-top:14px">
    <div class="dashboard-card-title">Client Logo</div>
    <img src="${project.image_url}" style="max-height:80px;max-width:200px;object-fit:contain;border-radius:6px" onerror="this.style.display='none'">
  </div>` : ''}
</div>
`;}

// ── Calendar ──
function renderCalendar() {
const year = state.calendarDate.getFullYear();
const month = state.calendarDate.getMonth();
const monthName = state.calendarDate.toLocaleDateString(‘en’, { month: ‘long’, year: ‘numeric’ });

const firstDay = new Date(year, month, 1).getDay();
const daysInMonth = new Date(year, month + 1, 0).getDate();
const today = new Date();

let cells = [];
for (let i = 0; i < firstDay; i++) {
const d = new Date(year, month, -firstDay + i + 1);
cells.push({ date: d, otherMonth: true });
}
for (let d = 1; d <= daysInMonth; d++) {
cells.push({ date: new Date(year, month, d), otherMonth: false });
}
while (cells.length % 7 !== 0) {
const last = cells[cells.length - 1].date;
cells.push({ date: new Date(last.getTime() + 86400000), otherMonth: true });
}

function getEventsForDate(date) {
const events = [];
state.projects.forEach(p => {
if (!p.install_start) return;
const start = new Date(p.install_start + ‘T00:00:00’);
const end = p.install_end ? new Date(p.install_end + ‘T00:00:00’) : start;
const prepDay = new Date(start.getTime() - 86400000);
const deprepDay = new Date(end.getTime() + 86400000);

```
  const ds = date.toDateString();
  const color = p.readiness === 'green' ? 'green' : p.readiness === 'red' ? 'red' : p.readiness === 'new' ? 'gray' : 'blue';
  const shortName = p.name.split('—')[0].split(' ').slice(0,3).join(' ');

  if (prepDay.toDateString() === ds) events.push({ label: '📦 Prep: ' + shortName, color: 'amber', project: p.id });
  if (date >= start && date <= end) events.push({ label: shortName, color, project: p.id });
  if (deprepDay.toDateString() === ds) events.push({ label: '🔄 Deprep: ' + shortName, color: 'gray', project: p.id });
});
return events;
```

}

const weeks = [];
for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

return `

<div class="calendar-controls">
  <div class="calendar-nav">
    <button class="cal-btn" onclick="changeMonth(-1)">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7 2L3 6l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
    <div class="cal-month">${monthName}</div>
    <button class="cal-btn" onclick="changeMonth(1)">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M5 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
  </div>
  <div style="display:flex;align-items:center;gap:8px">
    <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6E7681">
      <span style="width:10px;height:10px;border-radius:2px;background:#3FB950;display:inline-block"></span>Ready
      <span style="width:10px;height:10px;border-radius:2px;background:#58A6FF;display:inline-block;margin-left:4px"></span>Active
      <span style="width:10px;height:10px;border-radius:2px;background:#F85149;display:inline-block;margin-left:4px"></span>Blocked
      <span style="width:10px;height:10px;border-radius:2px;background:#D29922;display:inline-block;margin-left:4px"></span>Prep/Deprep
    </div>
    <button class="cal-btn" onclick="navigate('calendar')" title="Today">Today</button>
  </div>
</div>

<div style="background:#161B22;border:1px solid #1C2333;border-radius:10px;overflow:hidden">
  <table class="calendar-grid" style="table-layout:fixed">
    <thead>
      <tr>
        ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<th>${d}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${weeks.map(week => `
        <tr>
          ${week.map(cell => {
            const isToday = cell.date.toDateString() === today.toDateString();
            const events = getEventsForDate(cell.date);
            return `
              <td class="${isToday ? 'today' : ''}${cell.otherMonth ? ' other-month' : ''}">
                <span class="cal-day-num">${cell.date.getDate()}</span>
                ${events.map(e => `
                  <div class="cal-event ${e.color}" onclick="navigate('project','${e.project}')" title="${e.label}">${e.label}</div>
                `).join('')}
              </td>
            `;
          }).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>

<div style="margin-top:16px">
  <div class="section-title" style="margin-bottom:10px">This Month's Projects</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
    ${state.projects.filter(p => {
      if (!p.install_start) return false;
      const d = new Date(p.install_start);
      return d.getMonth() === month && d.getFullYear() === year;
    }).map(p => `
      <div class="card card-sm" style="cursor:pointer" onclick="navigate('project','${p.id}')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-size:13px;font-weight:500;color:#E6EDF3">${p.name.split('—')[0].trim()}</div>
          <span class="status-pill ${p.readiness === 'green' ? 'status-green' : p.readiness === 'red' ? 'status-red' : 'status-blue'}">
            ${p.readiness === 'green' ? 'Ready' : p.readiness === 'red' ? 'Blocked' : 'Active'}
          </span>
        </div>
        <div style="font-size:11px;color:#6E7681">${p.install_start ? new Date(p.install_start).toLocaleDateString('en',{month:'short',day:'numeric'}) : ''} – ${p.install_end ? new Date(p.install_end).toLocaleDateString('en',{month:'short',day:'numeric'}) : ''}</div>
      </div>
    `).join('') || '<div style="color:#6E7681;font-size:13px;grid-column:1/-1">No installs scheduled this month</div>'}
  </div>
</div>
`;
}

function changeMonth(dir) {
state.calendarDate.setMonth(state.calendarDate.getMonth() + dir);
renderCurrentPage();
}

// ── Shop Work ──
function renderShopWork() {
const projectWork = state.shopwork.filter(t => t.type === ‘project’);
const generalWork = state.shopwork.filter(t => t.type === ‘general’);

return `

<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <div></div>
  <button class="btn-primary" onclick="showAddShopWork()">+ Add Task</button>
</div>

<div class="shopwork-grid">
  <div>
    <div class="section-header"><div class="section-title">Project Shop Work</div></div>
    <div class="card">
      ${projectWork.length === 0 ? '<div class="empty-state" style="padding:24px"><span class="empty-icon">🔧</span>No project shop work yet</div>' :
        projectWork.map((t, i) => `
          <div class="shopwork-item">
            <div class="shopwork-priority priority-${t.priority || 'med'}"></div>
            <div style="flex:1">
              <div class="shopwork-text">${t.text}</div>
              <div class="shopwork-assignee">${t.project ? '📁 ' + t.project : ''} ${t.assignee ? '· ' + t.assignee : ''}</div>
            </div>
            <button class="btn btn-sm btn-danger" onclick="removeShopWork(${i})">×</button>
          </div>
        `).join('')}
    </div>
  </div>
  <div>
    <div class="section-header"><div class="section-title">General Shop Work</div></div>
    <div class="card">
      ${generalWork.length === 0 ? '<div class="empty-state" style="padding:24px"><span class="empty-icon">🧹</span>No general shop work yet</div>' :
        generalWork.map((t, i) => `
          <div class="shopwork-item">
            <div class="shopwork-priority priority-${t.priority || 'med'}"></div>
            <div style="flex:1">
              <div class="shopwork-text">${t.text}</div>
              <div class="shopwork-assignee">${t.assignee ? '👤 ' + t.assignee : 'Unassigned'}</div>
            </div>
            <button class="btn btn-sm btn-danger" onclick="removeShopWork(${state.shopwork.indexOf(t)})">×</button>
          </div>
        `).join('')}
    </div>
  </div>
</div>

<div id="add-shopwork-form" style="display:none;margin-top:16px">
  <div class="card">
    <div class="section-title" style="margin-bottom:12px">Add Shop Work Task</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Task</label>
        <input class="form-input" id="sw-text" placeholder="Describe the task...">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="sw-type">
          <option value="general">General shop work</option>
          <option value="project">Project-specific</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Assign to</label>
        <select class="form-select" id="sw-assignee">
          <option value="">Unassigned</option>
          <option>Jacob</option><option>Kris</option><option>Clint</option>
          <option>Daniel</option><option>Deiton</option><option>Caden</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Priority</label>
        <select class="form-select" id="sw-priority">
          <option value="med">Medium</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn-primary" onclick="saveShopWork()">Add Task</button>
      <button class="btn" onclick="document.getElementById('add-shopwork-form').style.display='none'">Cancel</button>
    </div>
  </div>
</div>
`;
}

function showAddShopWork() {
const f = document.getElementById(‘add-shopwork-form’);
if (f) f.style.display = f.style.display === ‘none’ ? ‘block’ : ‘none’;
}

function saveShopWork() {
const task = {
text: document.getElementById(‘sw-text’).value,
type: document.getElementById(‘sw-type’).value,
assignee: document.getElementById(‘sw-assignee’).value,
priority: document.getElementById(‘sw-priority’).value,
created: new Date().toISOString()
};
if (!task.text) return;
state.shopwork.push(task);
saveState();
renderCurrentPage();
}

function removeShopWork(i) {
state.shopwork.splice(i, 1);
saveState();
renderCurrentPage();
}

// ── Vendors ──
function renderVendors() {
return `

<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <div></div>
  <button class="btn-primary" onclick="showVendorForm()">+ Add Vendor</button>
</div>

<div class="vendors-grid" id="vendor-grid">
  ${state.vendors.length === 0 ? '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">👥</span>No vendors yet — add your first one or import the vendor directory spreadsheet</div>' :
    state.vendors.map((v, i) => `
      <div class="vendor-card">
        <div class="vendor-name">${v.name}</div>
        <div class="vendor-rep">${v.rep || ''}</div>
        <div class="vendor-email">${v.email || 'No email'}</div>
        <div class="vendor-tags">
          ${(v.categories || []).map(c => `<span class="tag tag-${c === 'audio' ? 'audio' : c === 'video' ? 'video' : c === 'lighting' ? 'lighting' : c === 'led' ? 'led' : 'control'}">${c}</span>`).join('')}
          ${v.reg ? '<span class="reg-badge">Reg Discount</span>' : ''}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="font-size:11px;color:#6E7681">${v.phone || ''}</span>
          <button class="btn btn-sm btn-danger" onclick="removeVendor(${i})">Remove</button>
        </div>
      </div>
    `).join('')}
</div>

<div id="vendor-form" style="display:none;margin-top:16px">
  <div class="card">
    <div class="section-title" style="margin-bottom:12px">Add Vendor / Rep</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Company Name</label><input class="form-input" id="v-name" placeholder="e.g. L-Acoustics"></div>
      <div class="form-group"><label class="form-label">Rep Name</label><input class="form-input" id="v-rep" placeholder="Contact name"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="v-email" type="email" placeholder="rep@company.com"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="v-phone" type="tel" placeholder="(555) 000-0000"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Categories</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        ${['audio','video','lighting','led','control','infrastructure'].map(c => `
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#C9D1D9;cursor:pointer">
            <input type="checkbox" value="${c}" name="v-cat"> ${c}
          </label>
        `).join('')}
      </div>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#C9D1D9;cursor:pointer">
        <input type="checkbox" id="v-reg"> Offers registration discount
      </label>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn-primary" onclick="saveVendor()">Save Vendor</button>
      <button class="btn" onclick="document.getElementById('vendor-form').style.display='none'">Cancel</button>
    </div>
  </div>
</div>
`;
}

function showVendorForm() {
const f = document.getElementById(‘vendor-form’);
if (f) f.style.display = f.style.display === ‘none’ ? ‘block’ : ‘none’;
}

function saveVendor() {
const cats = […document.querySelectorAll(‘input[name=“v-cat”]:checked’)].map(el => el.value);
const v = {
name: document.getElementById(‘v-name’).value || ‘Unnamed’,
rep: document.getElementById(‘v-rep’).value,
email: document.getElementById(‘v-email’).value,
phone: document.getElementById(‘v-phone’).value,
categories: cats,
reg: document.getElementById(‘v-reg’).checked
};
state.vendors.push(v);
saveState();
renderCurrentPage();
}

function removeVendor(i) {
state.vendors.splice(i, 1);
saveState();
renderCurrentPage();
}

// ── Intake ──
function renderIntake() {
return `

<div style="max-width:600px">
  <div class="card">
    <div class="section-title" style="margin-bottom:14px">Sales Intake — New Project</div>
    <div class="alert alert-info" style="margin-bottom:16px">This creates a project in your app and can push to Jetbuilt once write access is enabled.</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Client / Org Name</label><input class="form-input" id="i-client" placeholder="e.g. Grace Community Church"></div>
      <div class="form-group"><label class="form-label">Contact Name</label><input class="form-input" id="i-contact" placeholder="First and last name"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="i-email" type="email"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="i-phone" type="tel"></div>
    </div>
    <div class="form-group"><label class="form-label">Project Address</label><input class="form-input" id="i-address" placeholder="Street address, city, state"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Estimated Budget</label><input class="form-input" id="i-budget" placeholder="e.g. $85,000 or TBD"></div>
      <div class="form-group"><label class="form-label">Venue Type</label>
        <select class="form-select" id="i-venue">
          <option value="">Select...</option>
          <option>Church / Worship</option><option>Event Center</option>
          <option>School / Education</option><option>Theater</option>
          <option>Office / Conference</option><option>Studio / Broadcast</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Scope of Work / Project Description</label>
      <textarea class="form-textarea" id="i-scope" placeholder="Describe the systems being installed, use case, client goals..."></textarea>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Est. Install Date</label><input class="form-input" id="i-date" type="date"></div>
      <div class="form-group"><label class="form-label">Timeline Type</label>
        <select class="form-select" id="i-timeline">
          <option value="soft">Soft — can be adjusted</option>
          <option value="hard">Hard — cannot move</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Quote Structure</label>
      <select class="form-select" id="i-quote">
        <option value="single">Single option</option>
        <option value="gbb">Good / Better / Best (3 projects in Jetbuilt)</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Shop Work Notes (optional)</label>
      <input class="form-input" id="i-shopwork" placeholder="e.g. Rack can be pre-built, fixtures can be pre-addressed">
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn-primary" onclick="submitIntake()">Create Project + Generate SOW</button>
      <button class="btn" onclick="navigate('dashboard')">Cancel</button>
    </div>
    <div id="intake-result" style="margin-top:14px"></div>
  </div>
</div>
`;
}

function submitIntake() {
const scope = document.getElementById(‘i-scope’).value;
const systems = detectSystems(scope);
const client = document.getElementById(‘i-client’).value || ‘New Client’;
const date = document.getElementById(‘i-date’).value;

const project = {
id: ‘P-’ + (Math.floor(Math.random() * 900) + 100),
name: client + ’ — ’ + document.getElementById(‘i-venue’).value,
client_name: client,
description: scope,
status: ‘lead’,
estimated_amount: parseInt((document.getElementById(‘i-budget’).value || ‘0’).replace(/\D/g,’’)),
install_start: date,
timeline_type: document.getElementById(‘i-timeline’).value,
systems,
readiness: ‘new’,
designer: ‘Kris’,
install_manager: ‘Clint’,
salesperson: ‘Jacob’
};

state.projects.push(project);
document.getElementById(‘proj-count’).textContent = state.projects.length;
saveState();

const systemNames = { led_wall: ‘LED Wall’, pa_install: ‘PA System’, lighting: ‘Stage Lighting’, streaming: ‘Streaming’, control: ‘Control System’ };
document.getElementById(‘intake-result’).innerHTML = `<div class="alert alert-success"> <div> <strong>Project created: ${project.id}</strong><br> Systems detected: ${systems.map(s => systemNames[s] || s).join(', ') || 'None detected — check scope text'}<br> Design templates auto-selected: ${systems.length} template(s)<br> <button class="btn btn-sm btn-success" style="margin-top:8px" onclick="navigate('project','${project.id}')">Open Project Dashboard →</button> </div> </div>`;
}

// ── Modal ──
function openModal(title, sub, body) {
document.getElementById(‘modal-title’).textContent = title;
document.getElementById(‘modal-sub’).textContent = sub || ‘’;
document.getElementById(‘modal-body’).innerHTML = body;
document.getElementById(‘project-modal’).style.display = ‘flex’;
}
function closeModal() { document.getElementById(‘project-modal’).style.display = ‘none’; }

// ── Persistence ──
function saveState() {
localStorage.setItem(‘vi_vendors’, JSON.stringify(state.vendors));
localStorage.setItem(‘vi_shopwork’, JSON.stringify(state.shopwork));
localStorage.setItem(‘vi_checklists’, JSON.stringify(state.checklists));
localStorage.setItem(‘vi_assignments’, JSON.stringify(state.assignments));
localStorage.setItem(‘vi_gbb’, JSON.stringify(state.gbbLinks));
localStorage.setItem(‘vi_fizzled’, JSON.stringify(state.fizzled));
localStorage.setItem(‘vi_design_track’, JSON.stringify(state.designTrack));
localStorage.setItem(‘vi_install_track’, JSON.stringify(state.installTrack));
}

function attachEventListeners() {
document.addEventListener(‘click’, e => {
if (e.target === document.getElementById(‘project-modal’)) closeModal();
});
}

// ── Tab Switcher ──
function switchTab(tab) {
const tabNames = [‘overview’,‘scope’,‘design’,‘install’,‘scheduling’,‘financials’,‘assets’];
document.querySelectorAll(’#proj-tabs .tab’).forEach((t, i) => {
t.classList.toggle(‘active’, tabNames[i] === tab);
});
tabNames.forEach(name => {
const el = document.getElementById(‘tab-’ + name);
if (el) el.style.display = name === tab ? ‘block’ : ‘none’;
});
}

// ── Track Status ──
const DESIGN_STAGES = [‘ready_for_design’,‘designing’,‘ready_for_purchase’,‘purchasing’,‘purchased’,‘design_complete’];
const INSTALL_STAGES = [‘install_planning’,‘ready_for_install’,‘installing’,‘review’,‘completed’];
const DESIGN_LABELS = {
ready_for_design: ‘Ready for Design’,
designing: ‘Designing’,
ready_for_purchase: ‘Ready for Purchase’,
purchasing: ‘Purchasing’,
purchased: ‘Purchased’,
design_complete: ‘Design Complete’
};
const INSTALL_LABELS = {
install_planning: ‘Install Planning’,
ready_for_install: ‘Ready for Install’,
installing: ‘Installing’,
review: ‘Review’,
completed: ‘Completed’
};

function renderTrackStatus(type, projectId) {
const stages = type === ‘design’ ? DESIGN_STAGES : INSTALL_STAGES;
const labels = type === ‘design’ ? DESIGN_LABELS : INSTALL_LABELS;
const track = type === ‘design’ ? state.designTrack : state.installTrack;
const current = track[projectId] || null;
const currentIdx = stages.indexOf(current);

if (!current) {
return `<div style="color:#6E7681;font-size:12px;font-style:italic">Not started — complete Contract Review to begin</div>`;
}

return `<div style="margin-bottom:10px"> <span style="font-size:12px;font-weight:500;color:#E6EDF3">${labels[current] || current}</span> <span style="font-size:11px;color:#6E7681;margin-left:6px">${currentIdx+1}/${stages.length}</span> </div> <div style="display:flex;gap:3px;margin-bottom:10px"> ${stages.map((s,i) =>`<div style="flex:1;height:4px;border-radius:2px;background:${i <= currentIdx ? (type==='design'?'#1565C0':'#3FB950') : '#1C2333'}"></div>`).join('')} </div> <select onchange="updateTrack('${type}','${projectId}',this.value)" style="width:100%;padding:6px 10px;background:#0D1117;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;font-size:12px;font-family:'DM Sans',sans-serif"> ${stages.map(s => `<option value=”${s}” ${current===s?‘selected’:’’}>${labels[s]}</option>`).join('')} </select> `;
}

function updateTrack(type, projectId, stage) {
if (type === ‘design’) state.designTrack[projectId] = stage;
else state.installTrack[projectId] = stage;
saveState();
renderCurrentPage();
}

// ── Stage Changer ──
function changeProjectStage(projectId, newStage) {
const project = state.projects.find(p => p.id === projectId);
if (!project) return;
project.status = newStage;
saveState();
// Show contract review if moving to contract
if (newStage === ‘contract’ && !(state.reviewed||{})[projectId]) {
setTimeout(() => openContractReview(projectId), 300);
}
renderCurrentPage();
}

function toggleProjectSystem(projectId, sys) {
const project = state.projects.find(p => p.id === projectId);
if (!project) return;
if (!project.systems) project.systems = [];
const idx = project.systems.indexOf(sys);
if (idx === -1) project.systems.push(sys);
else project.systems.splice(idx, 1);
saveState();
renderCurrentPage();
}

// ── Contract Review ──
function openContractReview(projectId) {
const project = state.projects.find(p => p.id === projectId);
if (!project) return;

// AI-style auto detection from scope text
const scope = (project.description || project.short_description || project.name || ‘’).toLowerCase();
const detected = [];
if (scope.includes(‘pa’) || scope.includes(‘audio’) || scope.includes(‘speaker’) || scope.includes(‘sound’) || scope.includes(‘microphone’) || scope.includes(‘mix’) || scope.includes(‘amp’) || scope.includes(‘dsp’) || scope.includes(‘subwoofer’)) detected.push(‘pa_install’);
if (scope.includes(‘led’) || scope.includes(‘video wall’) || scope.includes(‘display wall’) || scope.includes(‘panel’)) detected.push(‘led_wall’);
if (scope.includes(‘light’) || scope.includes(‘fixture’) || scope.includes(‘dmx’) || scope.includes(‘stage light’) || scope.includes(‘key light’) || scope.includes(‘wash’) || scope.includes(‘luminaire’)) detected.push(‘lighting’);
if (scope.includes(‘control’) || scope.includes(‘qsys’) || scope.includes(‘q-sys’) || scope.includes(‘crestron’) || scope.includes(‘extron’) || scope.includes(‘touch panel’) || scope.includes(‘automation’)) detected.push(‘control’);
if (scope.includes(‘stream’) || scope.includes(‘broadcast’) || scope.includes(‘encoding’) || scope.includes(‘youtube’) || scope.includes(‘facebook live’)) detected.push(‘streaming’);
if (scope.includes(‘camera’) || scope.includes(‘ptz’) || scope.includes(‘video produc’) || scope.includes(‘recording’)) detected.push(‘camera’);
if (scope.includes(‘network’) || scope.includes(‘switch’) || scope.includes(‘router’) || scope.includes(‘wifi’) || scope.includes(‘dante’) || scope.includes(‘avb’)) detected.push(‘network’);
if (scope.includes(‘conduit’) || scope.includes(‘infrastructure’) || scope.includes(‘cable’) || scope.includes(‘wire’) || scope.includes(‘rack’)) detected.push(‘infrastructure’);

// Merge with existing tags
const current = project.systems || [];
const merged = […new Set([…current, …detected])];

document.body.insertAdjacentHTML(‘beforeend’, `
<div id="cr-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px">
<div style="background:#161B22;border:1px solid #30363D;border-radius:12px;width:100%;max-width:560px;max-height:85vh;overflow-y:auto">
<div style="padding:20px 24px 16px;border-bottom:1px solid #1C2333">
<div style="font-size:17px;font-weight:600;color:#E6EDF3;margin-bottom:2px">Contract Review</div>
<div style="font-size:12px;color:#6E7681">${project.name} · ${project.id}</div>
</div>
<div style="padding:20px 24px">

```
      <div style="background:#0D1A26;border:1px solid #1565C0;border-radius:8px;padding:12px 14px;margin-bottom:18px">
        <div style="font-size:11px;font-weight:600;color:#58A6FF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">AI detected ${detected.length} system type${detected.length !== 1 ? 's' : ''} from scope</div>
        <div style="font-size:12px;color:#8B949E;line-height:1.6">${project.description ? project.description.slice(0,200) + (project.description.length > 200 ? '...' : '') : 'No scope text available'}</div>
      </div>

      <div style="margin-bottom:18px">
        <div style="font-size:11px;font-weight:600;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Confirm systems on this project</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="cr-systems">
          ${[
            {key:'pa_install',label:'PA / Audio System',icon:'🔊'},
            {key:'led_wall',label:'LED Wall / Display',icon:'📺'},
            {key:'lighting',label:'Stage / House Lighting',icon:'💡'},
            {key:'control',label:'Control System (Q-SYS etc)',icon:'🎛'},
            {key:'streaming',label:'Streaming / Broadcast',icon:'📡'},
            {key:'camera',label:'Camera System',icon:'📷'},
            {key:'network',label:'Network / IT',icon:'🌐'},
            {key:'infrastructure',label:'Infrastructure / Conduit',icon:'🔧'}
          ].map(sys => {
            const checked = merged.includes(sys.key);
            return `<label style="display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid ${checked?'#1565C0':'#30363D'};border-radius:8px;cursor:pointer;background:${checked?'#0D1626':'transparent'};transition:all 0.12s" onclick="toggleCRSystem(this,'${sys.key}')">
              <div style="width:16px;height:16px;border-radius:4px;border:1.5px solid ${checked?'#1565C0':'#30363D'};background:${checked?'#1565C0':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.12s" id="cr-box-${sys.key}">
                ${checked ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7 8,3" stroke="white" stroke-width="1.5" fill="none"/></svg>' : ''}
              </div>
              <span style="font-size:12px;color:${checked?'#C9D1D9':'#6E7681'}">${sys.icon} ${sys.label}</span>
            </label>`;
          }).join('')}
        </div>
      </div>

      <div style="margin-bottom:18px">
        <div style="font-size:11px;font-weight:600;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Timeline & Crew</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <div style="font-size:11px;color:#6E7681;margin-bottom:3px">Est. install date</div>
            <input type="date" id="cr-install-date" value="${project.install_start||''}" style="width:100%;padding:7px 10px;background:#0D1117;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;font-size:12px;font-family:'DM Sans',sans-serif">
          </div>
          <div>
            <div style="font-size:11px;color:#6E7681;margin-bottom:3px">Timeline type</div>
            <select id="cr-timeline" style="width:100%;padding:7px 10px;background:#0D1117;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;font-size:12px;font-family:'DM Sans',sans-serif">
              <option value="soft" ${project.timeline_type !== 'hard' ? 'selected' : ''}>Soft — can be moved</option>
              <option value="hard" ${project.timeline_type === 'hard' ? 'selected' : ''}>Hard — cannot move</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div style="font-size:11px;color:#6E7681;margin-bottom:3px">Est. install duration</div>
            <select id="cr-duration" style="width:100%;padding:7px 10px;background:#0D1117;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;font-size:12px;font-family:'DM Sans',sans-serif">
              <option value="">Select...</option>
              <option>1 day</option><option>2 days</option><option>3 days</option>
              <option>1 week</option><option>2 weeks</option><option>3 weeks</option>
              <option>1 month</option><option>2+ months</option>
            </select>
          </div>
          <div>
            <div style="font-size:11px;color:#6E7681;margin-bottom:3px">Est. crew size</div>
            <select id="cr-crew" style="width:100%;padding:7px 10px;background:#0D1117;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;font-size:12px;font-family:'DM Sans',sans-serif">
              <option value="">Select...</option>
              <option>1 person</option><option>2 people</option><option>3 people</option>
              <option>4 people</option><option>5+ people</option>
            </select>
          </div>
        </div>
      </div>

      <div style="margin-bottom:18px">
        <div style="font-size:11px;font-weight:600;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Shop work potential</div>
        <input type="text" id="cr-shopwork" placeholder="e.g. rack can be pre-built, fixtures can be pre-addressed..." style="width:100%;padding:7px 10px;background:#0D1117;border:1px solid #30363D;border-radius:6px;color:#E6EDF3;font-size:12px;font-family:'DM Sans',sans-serif">
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="confirmContractReview('${projectId}')"
          style="flex:1;padding:9px;font-size:13px;font-weight:500;border:none;border-radius:6px;background:#1565C0;color:#fff;cursor:pointer;font-family:'DM Sans',sans-serif">
          Confirm & Kick Off Design →
        </button>
        <button onclick="document.getElementById('cr-modal').remove()"
          style="padding:9px 16px;font-size:13px;border:1px solid #30363D;border-radius:6px;background:transparent;color:#8B949E;cursor:pointer;font-family:'DM Sans',sans-serif">
          Close
        </button>
      </div>
    </div>
  </div>
</div>
```

`);

// Store detected systems temporarily
window._crSystems = […merged];
window._crProjectId = projectId;
}

function toggleCRSystem(label, key) {
const idx = window._crSystems.indexOf(key);
if (idx === -1) {
window._crSystems.push(key);
label.style.borderColor = ‘#1565C0’;
label.style.background = ‘#0D1626’;
const box = document.getElementById(‘cr-box-’ + key);
if (box) { box.style.borderColor = ‘#1565C0’; box.style.background = ‘#1565C0’; box.innerHTML = ‘<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7 8,3" stroke="white" stroke-width="1.5" fill="none"/></svg>’; }
label.querySelector(‘span’).style.color = ‘#C9D1D9’;
} else {
window._crSystems.splice(idx, 1);
label.style.borderColor = ‘#30363D’;
label.style.background = ‘transparent’;
const box = document.getElementById(‘cr-box-’ + key);
if (box) { box.style.borderColor = ‘#30363D’; box.style.background = ‘transparent’; box.innerHTML = ‘’; }
label.querySelector(‘span’).style.color = ‘#6E7681’;
}
}

function confirmContractReview(projectId) {
const project = state.projects.find(p => p.id === projectId);
if (!project) return;

// Apply confirmed systems
project.systems = […window._crSystems];

// Apply dates
const installDate = document.getElementById(‘cr-install-date’)?.value;
const timeline = document.getElementById(‘cr-timeline’)?.value;
const shopwork = document.getElementById(‘cr-shopwork’)?.value;

if (installDate) project.install_start = installDate;
if (timeline) project.timeline_type = timeline;

// Add shop work note
if (shopwork) {
state.shopwork.push({ text: shopwork, type: ‘project’, project: project.name, priority: ‘med’, created: new Date().toISOString() });
}

// Mark as reviewed
if (!state.reviewed) state.reviewed = {};
state.reviewed[projectId] = { date: new Date().toISOString(), systems: project.systems };
localStorage.setItem(‘vi_reviewed’, JSON.stringify(state.reviewed));

// Set dual tracks
if (!state.designTrack) state.designTrack = {};
if (!state.installTrack) state.installTrack = {};
state.designTrack[projectId] = ‘ready_for_design’;
state.installTrack[projectId] = ‘install_planning’;

// Add crew size and install duration to project
const crewSize = document.getElementById(‘cr-crew’)?.value;
const installDuration = document.getElementById(‘cr-duration’)?.value;
if (crewSize) project.crew_size = crewSize;
if (installDuration) project.install_duration = installDuration;

saveState();
document.getElementById(‘cr-modal’)?.remove();
renderCurrentPage();

setTimeout(() => {
alert(‘✓ Contract reviewed for ’ + project.name + ‘\n\nDesign track: Ready for Design → Kris notified\nInstall track: Install Planning → Clint notified\n\nSystems: ’ + project.systems.map(s => s.replace(’*install’,’’).replace(’*’,’ ‘)).join(’, ’));
}, 100);
}

// ── Client Name Fetcher ──
const clientNameCache = {};

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
renderCurrentPage();
// Auto sync from Jetbuilt on load
setTimeout(syncJetbuilt, 500);
}

init();