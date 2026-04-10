// ── Valiant Integrations App ──
const JETBUILT_API = 'https://app.jetbuilt.com/api';
const API_KEY = '256e1837483dedcf3e993dbef92b9846';
const HEADERS = {
  'Authorization': `Token token=${API_KEY}`,
  'Accept': 'application/vnd.jetbuilt.v1',
  'Content-Type': 'application/json'
};

// ── State ──
const state = {
  projects: [],
  vendors: JSON.parse(localStorage.getItem('vi_vendors') || '[]'),
  shopwork: JSON.parse(localStorage.getItem('vi_shopwork') || '[]'),
  checklists: JSON.parse(localStorage.getItem('vi_checklists') || '{}'),
  currentPage: 'dashboard',
  currentProject: null,
  calendarDate: new Date(),
  calendarView: 'month',
  syncing: false
};

// ── Design & Install Checklist Templates ──
const TEMPLATES = {
  design: {
    led_wall: {
      name: 'LED Wall Design',
      items: [
        'Mounting type determined (wall / ceiling / floor)',
        'Total weight calculated and rigging safety verified',
        'Panel layout drawn (number of panels, arrangement)',
        'Pixel pitch calculated and verified per processor output channel',
        'CAT5 routing per channel verified',
        'Processor selected and location determined',
        'Processor inputs defined',
        'External control method specified (Stream Deck, network, etc.)',
        'Cable routing designed (data + power through panels)',
        'Connector types specified (Phoenix, NF4, NL2)',
        'Front vs. rear serviceability and access planned',
        'Cable schedule completed',
        'Shop work identified (any pre-build at shop?)'
      ]
    },
    pa_install: {
      name: 'PA System Design',
      items: [
        'SPL map reviewed or created with reading points placed',
        'Speaker placement and splay angles defined',
        'Active vs. passive speakers specified',
        'Power location and requirements confirmed',
        'Electrical drawing specified if new power needed',
        'Processor selected (internal or external)',
        'Processor location determined',
        'Zone configuration defined (client-furnished zones: lobby, balcony, green room)',
        'Signal flow designed (analog routing, zones)',
        'Inputs to processor defined (console, stage box, L/R or L/R/Sub/Fill)',
        'Power control method specified (relay vs. network standby)',
        'Connector types specified and termination standards documented',
        'Patch panel or termination blocks determined',
        'Network topology defined (if networked speakers/processor)',
        'Network switch location and front-house access confirmed',
        'Cable schedule completed',
        'Shop work identified (rack pre-build, etc.)'
      ]
    },
    lighting: {
      name: 'Stage Lighting Design',
      items: [
        'Existing rigging reviewed or new rigging planned',
        'Rigging layout and plot created',
        'Rigging height calculated (45-degree angle from stage if applicable)',
        'Fixture zone layout on stage planned',
        'Rigging plot with fixture positions created',
        'Power plot created (fixtures per circuit)',
        'Electrical specifications defined (preexisting vs. new)',
        'Electrical plot for electrician created if needed',
        'DMX diagram created',
        'Power diagram created (fixture linking, mounting)',
        'Labeling convention established',
        'DMX/Artnet protocol chosen',
        'DMX distribution method specified (nodes, controllers, universes)',
        'Scene controller type specified',
        'House lighting integration considered',
        'Control type specified (client console vs. our console)',
        'Client-furnished equipment integration planned',
        'Additional lighting noted (cyc, rim, etc.)',
        'Cable schedule completed',
        'Shop work identified (clamp installation, fixture addressing, console pre-build)'
      ]
    }
  },
  install: {
    led_wall: {
      name: 'LED Wall Install',
      items: [
        'Surface prep completed',
        'Rigging/mounting layout verified on ground or wall',
        'Height verified per drawing',
        'Electrical verified before wall installation',
        'Cable pulled to wall location',
        'Cable path verified clean',
        'Frame installed (back frame)',
        'Panels mounted',
        'Modules wired together',
        'Modules installed',
        'Control cables installed and terminated',
        'LED wall mapped in NovaStar',
        'Input configuration completed',
        'Presets configured if needed',
        'Backup receiving card file saved',
        'Backup config file saved'
      ]
    },
    pa_install: {
      name: 'PA System Install',
      items: [
        'Wiring path reviewed and cleared',
        'Rigging plot laid on ground (symmetrical, matches diagram)',
        'Laser rigging points up to ceiling verified',
        'Rigging points installed in ceiling',
        'Safety/secondary rigging points installed',
        'PA rigged',
        'Wire pulled to PA',
        'Amp rack built',
        'Wires dressed into amp rack',
        'Amps configured',
        'Network cables installed for PA',
        'Signal wires run (console/IO to processor or amps)',
        'Functional testing on amps completed',
        'PA tuned',
        'Backup tune and config files saved (processor, amps)'
      ]
    },
    lighting: {
      name: 'Stage Lighting Install',
      items: [
        'Rigging plot laid on ground and obstructions checked',
        'Clear wiring path confirmed',
        'Rigging points installed in ceiling',
        'Fixtures installed with safeties per rigging plot',
        'DMX data cables wired between fixtures',
        'Power cables wired',
        'Network switch mounted and configured (if needed)',
        'Wire routed back to control (computer or console)',
        'Console file built / scene plot created',
        'Console connected and all lights functional',
        'Focus completed on stage — clean coverage across stage',
        'Good overlap between zones with no dark or bright spots',
        'Front stage steps cut with shutters or barn doors',
        'Unintended areas shuttered',
        'Scenes programmed and saved',
        'Backup network configuration saved',
        'Backup console configuration saved',
        'Backup node configuration saved'
      ]
    }
  }
};

// ── Auto-detect systems from scope text ──
function detectSystems(text) {
  if (!text) return [];
  const t = text.toLowerCase();
  const systems = [];
  if (t.includes('led') || t.includes('video wall') || t.includes('led wall') || t.includes('display wall')) systems.push('led_wall');
  if (t.includes('pa ') || t.includes('audio') || t.includes('speaker') || t.includes('microphone') || t.includes('sound system') || t.includes('amp') || t.includes('dsp')) systems.push('pa_install');
  if (t.includes('light') || t.includes('fixture') || t.includes('dmx') || t.includes('stage light') || t.includes('key light')) systems.push('lighting');
  if (t.includes('control') || t.includes('qsys') || t.includes('q-sys') || t.includes('crestron') || t.includes('extron')) systems.push('control');
  if (t.includes('stream') || t.includes('broadcast') || t.includes('camera') || t.includes('video produc')) systems.push('streaming');
  return systems;
}

// ── Jetbuilt API ──
async function fetchJetbuilt(endpoint) {
  try {
    const res = await fetch(`${JETBUILT_API}${endpoint}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('Jetbuilt API error:', e);
    return null;
  }
}

async function syncJetbuilt() {
  if (state.syncing) return;
  state.syncing = true;
  const btn = document.getElementById('sync-btn');
  if (btn) { btn.classList.add('syncing'); btn.textContent = ' Syncing...'; }

  try {
    const data = await fetchJetbuilt('/projects?status=contract');
    if (data && Array.isArray(data)) {
      state.projects = data.map(p => enrichProject(p));
    } else {
      // Load demo projects with Jetbuilt IDs you specified
      state.projects = getDemoProjects();
    }
    document.getElementById('proj-count').textContent = state.projects.length;
    renderCurrentPage();
  } finally {
    state.syncing = false;
    if (btn) { btn.classList.remove('syncing'); btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M7 2l2-2M7 2l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Sync Jetbuilt'; }
  }
}

function enrichProject(p) {
  const desc = (p.description || p.name || '').toLowerCase();
  const systems = detectSystems(desc + ' ' + (p.scope || ''));
  return {
    ...p,
    systems,
    status: p.status || 'contract',
    readiness: getProjectReadiness(p.id)
  };
}

function getProjectReadiness(id) {
  const cl = state.checklists[id] || {};
  const total = Object.values(cl).reduce((a, c) => a + c.total, 0);
  const done = Object.values(cl).reduce((a, c) => a + c.done, 0);
  if (total === 0) return 'new';
  const pct = done / total;
  if (pct === 1) return 'green';
  if (pct >= 0.6) return 'blue';
  return 'red';
}

function getDemoProjects() {
  return [
    {
      id: 'P-560',
      name: 'Grace Community Church — Sanctuary AVL',
      client_name: 'Grace Community Church',
      description: 'Full PA system upgrade with line array, LED wall 16x9 on stage, and stage lighting refresh with key lighting and house dimming.',
      status: 'contract',
      estimated_amount: 185000,
      install_start: '2025-05-12',
      install_end: '2025-05-19',
      timeline_type: 'hard',
      systems: ['pa_install', 'led_wall', 'lighting'],
      readiness: 'blue',
      designer: 'Kris',
      install_manager: 'Clint',
      salesperson: 'Jacob'
    },
    {
      id: 'P-554',
      name: 'Riverside Event Center — AV Package',
      client_name: 'Riverside Event Center',
      description: 'Distributed audio system, LED display wall, and streaming package with camera system for event broadcasts.',
      status: 'contract',
      estimated_amount: 92000,
      install_start: '2025-04-28',
      install_end: '2025-05-02',
      timeline_type: 'soft',
      systems: ['pa_install', 'led_wall', 'streaming'],
      readiness: 'red',
      designer: 'Kris',
      install_manager: 'Clint',
      salesperson: 'Jacob'
    },
    {
      id: 'P-541',
      name: 'Cornerstone Academy — Auditorium Upgrade',
      client_name: 'Cornerstone Academy',
      description: 'PA system, stage lighting upgrade with key lights and wash fixtures, basic video display.',
      status: 'contract',
      estimated_amount: 64000,
      install_start: '2025-05-27',
      install_end: '2025-05-30',
      timeline_type: 'soft',
      systems: ['pa_install', 'lighting'],
      readiness: 'new',
      designer: 'Kris',
      install_manager: 'Clint',
      salesperson: 'Jacob'
    }
  ];
}

// ── Navigation ──
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  calendar: 'Calendar',
  projects: 'Projects',
  shopwork: 'Shop Work',
  vendors: 'Vendors',
  intake: 'New Intake',
  project: 'Project Dashboard'
};

function navigate(page, data) {
  state.currentPage = page;
  if (data) state.currentProject = data;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  renderCurrentPage();
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function renderCurrentPage() {
  const content = document.getElementById('content');
  switch (state.currentPage) {
    case 'dashboard': content.innerHTML = renderDashboard(); break;
    case 'calendar': content.innerHTML = renderCalendar(); break;
    case 'projects': content.innerHTML = renderProjects(); break;
    case 'shopwork': content.innerHTML = renderShopWork(); break;
    case 'vendors': content.innerHTML = renderVendors(); break;
    case 'intake': content.innerHTML = renderIntake(); break;
    case 'project': content.innerHTML = renderProjectDashboard(state.currentProject); break;
    default: content.innerHTML = renderDashboard();
  }
  attachEventListeners();
}

// ── Dashboard ──
function renderDashboard() {
  const total = state.projects.length;
  const green = state.projects.filter(p => p.readiness === 'green').length;
  const red = state.projects.filter(p => p.readiness === 'red').length;

  const stageMap = {
    lead: state.projects.filter(p => p.status === 'lead'),
    estimate: state.projects.filter(p => p.status === 'estimate'),
    contract: state.projects.filter(p => p.status === 'contract'),
    install: state.projects.filter(p => p.status === 'install'),
    complete: state.projects.filter(p => p.status === 'complete')
  };

  return `
<div class="metrics-grid">
  <div class="metric-card">
    <div class="metric-label">Active Projects</div>
    <div class="metric-value">${total}</div>
    <div class="metric-sub">in contract</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Ready to Install</div>
    <div class="metric-value">${green}</div>
    <div class="metric-trend up">${green > 0 ? '✓ All checklists complete' : 'Complete checklists to go green'}</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Needs Attention</div>
    <div class="metric-value">${red}</div>
    <div class="metric-trend warn">${red > 0 ? red + ' project' + (red > 1 ? 's' : '') + ' blocked' : 'All clear'}</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Vendors</div>
    <div class="metric-value">${state.vendors.length}</div>
    <div class="metric-sub">in directory</div>
  </div>
</div>

<div class="section-header">
  <div class="section-title">Sales Pipeline</div>
  <button class="section-action" onclick="navigate('projects')">View all →</button>
</div>
<div class="pipeline-grid">
  ${renderPipelineCol('Lead', 'lead', stageMap.lead)}
  ${renderPipelineCol('Estimate', 'estimate', stageMap.estimate)}
  ${renderPipelineCol('Contract', 'contract', stageMap.contract)}
  ${renderPipelineCol('Install', 'install', stageMap.install)}
  ${renderPipelineCol('Complete', 'complete', stageMap.complete)}
</div>

<div class="section-header">
  <div class="section-title">Upcoming Installs</div>
  <button class="section-action" onclick="navigate('calendar')">View calendar →</button>
</div>
<div class="card">
  ${state.projects.filter(p => p.install_start).sort((a,b) => new Date(a.install_start)-new Date(b.install_start)).slice(0,5).map(p => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #0D1117;cursor:pointer" onclick="navigate('project', '${p.id}')">
      <div style="width:42px;height:42px;border-radius:8px;background:#0D1626;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;font-weight:600;color:#58A6FF;text-align:center;line-height:1.2">
        ${p.install_start ? new Date(p.install_start).toLocaleDateString('en',{month:'short',day:'numeric'}) : 'TBD'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;color:#E6EDF3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:11px;color:#6E7681">${p.client_name || ''} · ${p.timeline_type === 'hard' ? '🔒 Hard date' : '📅 Soft date'}</div>
      </div>
      <div>
        <span class="status-pill ${p.readiness === 'green' ? 'status-green' : p.readiness === 'red' ? 'status-red' : 'status-blue'}">
          ${p.readiness === 'green' ? 'Ready' : p.readiness === 'red' ? 'Blocked' : p.readiness === 'new' ? 'New' : 'In Progress'}
        </span>
      </div>
    </div>
  `).join('') || '<div class="empty-state"><span class="empty-icon">📅</span>Sync Jetbuilt to load projects</div>'}
</div>
`;
}

function renderPipelineCol(label, key, projects) {
  return `
<div class="pipeline-col">
  <div class="pipeline-col-header">
    <div class="pipeline-col-name">${label}</div>
    <div class="pipeline-col-count">${projects.length}</div>
  </div>
  ${projects.map(p => `
    <div class="project-card" onclick="navigate('project', '${p.id}')">
      <div class="project-card-name">${p.name.split('—')[0].trim()}</div>
      <div class="project-card-client">${p.client_name || ''}</div>
      <div class="project-card-footer">
        <div class="project-card-value">${p.estimated_amount ? '$' + (p.estimated_amount/1000).toFixed(0) + 'k' : 'TBD'}</div>
        <span class="status-pill ${p.readiness === 'green' ? 'status-green' : p.readiness === 'red' ? 'status-red' : 'status-blue'}">
          ${p.readiness === 'green' ? 'Ready' : p.readiness === 'red' ? 'Blocked' : 'Active'}
        </span>
      </div>
    </div>
  `).join('') || ''}
</div>`;
}

// ── Projects Page ──
function renderProjects() {
  return `
<div class="section-header">
  <div class="section-title">All Projects</div>
  <button class="btn btn-sm" onclick="syncJetbuilt()">Sync from Jetbuilt</button>
</div>
<div class="card" style="padding:0;overflow:hidden">
  <table class="projects-table">
    <thead>
      <tr>
        <th>Project</th>
        <th>Client</th>
        <th>Systems</th>
        <th>Install Date</th>
        <th>Timeline</th>
        <th>Status</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      ${state.projects.map(p => `
        <tr onclick="navigate('project', '${p.id}')">
          <td>
            <div class="proj-name">${p.name}</div>
            <div class="proj-id">${p.id}</div>
          </td>
          <td style="color:#8B949E">${p.client_name || '—'}</td>
          <td>${(p.systems || []).map(s => `<span class="tag tag-${s === 'led_wall' ? 'led' : s === 'pa_install' ? 'audio' : s === 'lighting' ? 'lighting' : s === 'streaming' ? 'streaming' : 'control'}">${s.replace('_install','').replace('_',' ')}</span>`).join('')}</td>
          <td style="color:#8B949E;font-size:12px">${p.install_start ? new Date(p.install_start).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
          <td>${p.timeline_type === 'hard' ? '<span class="status-pill status-red">Hard</span>' : '<span class="status-pill status-blue">Soft</span>'}</td>
          <td>
            <span class="status-pill ${p.readiness === 'green' ? 'status-green' : p.readiness === 'red' ? 'status-red' : p.readiness === 'new' ? 'status-gray' : 'status-blue'}">
              ${p.readiness === 'green' ? 'Ready' : p.readiness === 'red' ? 'Blocked' : p.readiness === 'new' ? 'New' : 'In Progress'}
            </span>
          </td>
          <td style="color:#58A6FF;font-weight:500">${p.estimated_amount ? '$' + p.estimated_amount.toLocaleString() : '—'}</td>
        </tr>
      `).join('') || '<tr><td colspan="7" style="text-align:center;padding:40px;color:#6E7681">Sync Jetbuilt to load projects</td></tr>'}
    </tbody>
  </table>
</div>`;
}

// ── Project Dashboard ──
function renderProjectDashboard(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return '<div class="empty-state">Project not found</div>';

  const cl = state.checklists[projectId] || {};

  const designItems = (project.systems || []).flatMap(s => TEMPLATES.design[s]?.items || []);
  const installItems = (project.systems || []).flatMap(s => TEMPLATES.install[s]?.items || []);

  const designChecked = cl.design || {};
  const installChecked = cl.install || {};
  const staffChecked = cl.staff || {};
  const equipChecked = cl.equipment || {};

  const designDone = designItems.filter((_, i) => designChecked[i]).length;
  const installDone = installItems.filter((_, i) => installChecked[i]).length;

  const systemTags = (project.systems || []).map(s => {
    const map = { led_wall: 'led', pa_install: 'audio', lighting: 'lighting', streaming: 'streaming', control: 'control' };
    const names = { led_wall: 'LED Wall', pa_install: 'PA System', lighting: 'Stage Lighting', streaming: 'Streaming', control: 'Control' };
    return `<span class="tag tag-${map[s]||'audio'}">${names[s]||s}</span>`;
  }).join('');

  return `
<div style="margin-bottom:16px">
  <button class="btn btn-sm" onclick="navigate('projects')" style="margin-bottom:12px">← Back to Projects</button>
  <div class="project-dashboard-header">
    <div>
      <div class="project-name">${project.name}</div>
      <div class="project-meta">${project.client_name || ''} · ${project.install_start ? new Date(project.install_start).toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'}) : 'Install date TBD'}</div>
      <div class="project-id">${project.id}</div>
      <div style="margin-top:8px">${systemTags}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
      <span class="status-pill ${project.readiness === 'green' ? 'status-green' : project.readiness === 'red' ? 'status-red' : 'status-blue'}" style="font-size:12px;padding:5px 12px">
        ${project.readiness === 'green' ? '✓ Ready to Install' : project.readiness === 'red' ? '⚠ Needs Attention' : project.readiness === 'new' ? '● New Project' : '◑ In Progress'}
      </span>
      <span class="status-pill ${project.timeline_type === 'hard' ? 'status-red' : 'status-blue'}">
        ${project.timeline_type === 'hard' ? '🔒 Hard Date' : '📅 Soft Date'}
      </span>
    </div>
  </div>
</div>

<div class="tabs" id="proj-tabs">
  <div class="tab active" onclick="switchTab('overview')">Overview</div>
  <div class="tab" onclick="switchTab('design')">Design (${designDone}/${designItems.length})</div>
  <div class="tab" onclick="switchTab('install')">Install (${installDone}/${installItems.length})</div>
  <div class="tab" onclick="switchTab('scheduling')">Scheduling</div>
  <div class="tab" onclick="switchTab('assets')">Assets</div>
</div>

<div id="tab-overview">
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <div class="dashboard-card-title">
        Project Info
        <span style="font-size:11px;color:#6E7681;font-weight:400">from Jetbuilt</span>
      </div>
      <div style="font-size:12px;color:#8B949E;line-height:1.7">${project.description || 'No description available.'}</div>
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Designer</div><div style="font-size:12px;color:#E6EDF3">${project.designer || 'Unassigned'}</div></div>
        <div><div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Install Mgr</div><div style="font-size:12px;color:#E6EDF3">${project.install_manager || 'Unassigned'}</div></div>
        <div><div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Sales</div><div style="font-size:12px;color:#E6EDF3">${project.salesperson || 'Unassigned'}</div></div>
        <div><div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Value</div><div style="font-size:12px;color:#58A6FF;font-weight:500">${project.estimated_amount ? '$' + project.estimated_amount.toLocaleString() : 'TBD'}</div></div>
      </div>
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-title">Readiness Checklist</div>
      ${renderReadinessChecklist(project, staffChecked, equipChecked)}
    </div>
  </div>
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <div class="dashboard-card-title">Design Progress <span style="font-weight:400;color:#6E7681">${designDone}/${designItems.length}</span></div>
      <div class="timeline-bar">
        ${designItems.map((_,i) => `<div class="timeline-segment ${designChecked[i] ? 'done' : ''}"></div>`).join('')}
      </div>
      <div style="font-size:12px;color:#6E7681">${designItems.length === 0 ? 'No design templates detected' : `${Math.round(designDone/designItems.length*100)}% complete`}</div>
      <button class="btn btn-sm" style="margin-top:10px" onclick="switchTab('design')">View design checklist →</button>
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-title">Install Progress <span style="font-weight:400;color:#6E7681">${installDone}/${installItems.length}</span></div>
      <div class="timeline-bar">
        ${installItems.map((_,i) => `<div class="timeline-segment ${installChecked[i] ? 'done' : ''}"></div>`).join('')}
      </div>
      <div style="font-size:12px;color:#6E7681">${installItems.length === 0 ? 'No install templates detected' : `${Math.round(installDone/installItems.length*100)}% complete`}</div>
      <button class="btn btn-sm" style="margin-top:10px" onclick="switchTab('install')">View install checklist →</button>
    </div>
  </div>
</div>

<div id="tab-design" style="display:none">
  ${designItems.length === 0 ? '<div class="alert alert-info">No design templates detected for this project. Systems detected: ' + (project.systems || []).join(', ') + '</div>' : ''}
  ${(project.systems || []).map(sys => TEMPLATES.design[sys] ? `
    <div class="dashboard-card" style="margin-bottom:14px">
      <div class="dashboard-card-title">${TEMPLATES.design[sys].name}</div>
      ${TEMPLATES.design[sys].items.map((item, i) => `
        <div class="checklist-item ${designChecked[sys+'_'+i] ? 'checked' : ''}" onclick="toggleCheck('design','${projectId}','${sys}_${i}',this)">
          <div class="checklist-box">
            <svg class="checklist-check" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <polyline points="2,5 4,7 8,3" stroke="white" stroke-width="1.5" fill="none"/>
            </svg>
          </div>
          <div class="checklist-label">${item}</div>
        </div>
      `).join('')}
    </div>
  ` : '').join('')}
</div>

<div id="tab-install" style="display:none">
  ${installItems.length === 0 ? '<div class="alert alert-info">No install templates detected for this project.</div>' : ''}
  ${(project.systems || []).map(sys => TEMPLATES.install[sys] ? `
    <div class="dashboard-card" style="margin-bottom:14px">
      <div class="dashboard-card-title">${TEMPLATES.install[sys].name}</div>
      ${TEMPLATES.install[sys].items.map((item, i) => `
        <div class="checklist-item ${installChecked[sys+'_'+i] ? 'checked' : ''}" onclick="toggleCheck('install','${projectId}','${sys}_${i}',this)">
          <div class="checklist-box">
            <svg class="checklist-check" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <polyline points="2,5 4,7 8,3" stroke="white" stroke-width="1.5" fill="none"/>
            </svg>
          </div>
          <div class="checklist-label">${item}</div>
        </div>
      `).join('')}
    </div>
  ` : '').join('')}
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
          <option value="soft" ${project.timeline_type === 'soft' ? 'selected' : ''}>Soft — can be moved</option>
          <option value="hard" ${project.timeline_type === 'hard' ? 'selected' : ''}>Hard — cannot move</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <div style="flex:1;background:#0D1117;border:1px solid #1C2333;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Prep Day</div>
          <div style="font-size:12px;color:#E6EDF3">${project.install_start ? new Date(new Date(project.install_start).getTime() - 86400000).toLocaleDateString('en',{month:'short',day:'numeric'}) : 'TBD'}</div>
        </div>
        <div style="flex:1;background:#0D1117;border:1px solid #1C2333;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Install</div>
          <div style="font-size:12px;color:#E6EDF3">${project.install_start && project.install_end ? new Date(project.install_start).toLocaleDateString('en',{month:'short',day:'numeric'}) + ' – ' + new Date(project.install_end).toLocaleDateString('en',{month:'short',day:'numeric'}) : 'TBD'}</div>
        </div>
        <div style="flex:1;background:#0D1117;border:1px solid #1C2333;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Deprep Day</div>
          <div style="font-size:12px;color:#E6EDF3">${project.install_end ? new Date(new Date(project.install_end).getTime() + 86400000).toLocaleDateString('en',{month:'short',day:'numeric'}) : 'TBD'}</div>
        </div>
      </div>
    </div>
    <div class="dashboard-card">
      <div class="dashboard-card-title">Crew Assignment</div>
      <div style="color:#6E7681;font-size:12px;margin-bottom:10px">Crew management coming in Phase 2. Track crew assignments, availability, and Google Calendar sync.</div>
      <div class="alert alert-info">Crew scheduling, drag-and-drop task assignment, and Google Calendar integration will be available in the next build.</div>
    </div>
  </div>
</div>

<div id="tab-assets" style="display:none">
  <div class="dashboard-card">
    <div class="dashboard-card-title">Project Assets</div>
    <div style="color:#6E7681;font-size:12px;margin-bottom:12px">Upload drawings, specs, as-builts, and other project documents here.</div>
    <div class="alert alert-info">Asset management (drawings, specs, as-builts) coming in Phase 2. Will integrate with Vectorworks and allow photo upload from field.</div>
  </div>
</div>
`;
}

function renderReadinessChecklist(project, staffChecked, equipChecked) {
  const readinessItems = [
    { key: 'design_handoff', label: 'Design handoff meeting completed' },
    { key: 'install_handoff', label: 'Install handoff meeting completed' },
    { key: 'crew_assigned', label: 'Crew assigned and confirmed' },
    { key: 'contractors_booked', label: 'Contractors booked (electricians, rigging)' },
    { key: 'vehicles_assigned', label: 'Vehicles assigned (trailer, van)' },
    { key: 'inventory_confirmed', label: 'Equipment inventory confirmed' },
    { key: 'prep_day_scheduled', label: 'Prep day scheduled' },
    { key: 'deprep_day_scheduled', label: 'Deprep day scheduled' },
    { key: 'client_approved', label: 'Client approved install schedule' },
    { key: 'commissioning_scheduled', label: 'Commissioning scheduled with client' }
  ];
  const all = readinessItems.every(item => staffChecked[item.key]);
  return readinessItems.map(item => `
    <div class="checklist-item ${staffChecked[item.key] ? 'checked' : ''}" onclick="toggleReadiness('${project.id}','${item.key}',this)">
      <div class="checklist-box">
        <svg class="checklist-check" width="10" height="10" viewBox="0 0 10 10" fill="none">
          <polyline points="2,5 4,7 8,3" stroke="white" stroke-width="1.5" fill="none"/>
        </svg>
      </div>
      <div class="checklist-label">${item.label}</div>
    </div>
  `).join('');
}

function switchTab(tab) {
  const tabs = document.querySelectorAll('#proj-tabs .tab');
  const tabNames = ['overview','design','install','scheduling','assets'];
  tabs.forEach((t, i) => t.classList.toggle('active', tabNames[i] === tab));
  tabNames.forEach(name => {
    const el = document.getElementById('tab-' + name);
    if (el) el.style.display = name === tab ? 'block' : 'none';
  });
}

function toggleCheck(type, projectId, key, el) {
  if (!state.checklists[projectId]) state.checklists[projectId] = {};
  if (!state.checklists[projectId][type]) state.checklists[projectId][type] = {};
  state.checklists[projectId][type][key] = !state.checklists[projectId][type][key];
  el.classList.toggle('checked');
  saveState();
  updateProjectReadiness(projectId);
}

function toggleReadiness(projectId, key, el) {
  if (!state.checklists[projectId]) state.checklists[projectId] = {};
  if (!state.checklists[projectId].staff) state.checklists[projectId].staff = {};
  state.checklists[projectId].staff[key] = !state.checklists[projectId].staff[key];
  el.classList.toggle('checked');
  saveState();
  updateProjectReadiness(projectId);
}

function updateProjectReadiness(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (project) project.readiness = getProjectReadiness(projectId);
  document.getElementById('proj-count').textContent = state.projects.length;
}

function updateProjectField(projectId, field, value) {
  const project = state.projects.find(p => p.id === projectId);
  if (project) { project[field] = value; saveState(); }
}

// ── Calendar ──
function renderCalendar() {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  const monthName = state.calendarDate.toLocaleDateString('en', { month: 'long', year: 'numeric' });

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
      const start = new Date(p.install_start + 'T00:00:00');
      const end = p.install_end ? new Date(p.install_end + 'T00:00:00') : start;
      const prepDay = new Date(start.getTime() - 86400000);
      const deprepDay = new Date(end.getTime() + 86400000);

      const ds = date.toDateString();
      const color = p.readiness === 'green' ? 'green' : p.readiness === 'red' ? 'red' : p.readiness === 'new' ? 'gray' : 'blue';
      const shortName = p.name.split('—')[0].split(' ').slice(0,3).join(' ');

      if (prepDay.toDateString() === ds) events.push({ label: '📦 Prep: ' + shortName, color: 'amber', project: p.id });
      if (date >= start && date <= end) events.push({ label: shortName, color, project: p.id });
      if (deprepDay.toDateString() === ds) events.push({ label: '🔄 Deprep: ' + shortName, color: 'gray', project: p.id });
    });
    return events;
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
  const projectWork = state.shopwork.filter(t => t.type === 'project');
  const generalWork = state.shopwork.filter(t => t.type === 'general');

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
  const f = document.getElementById('add-shopwork-form');
  if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function saveShopWork() {
  const task = {
    text: document.getElementById('sw-text').value,
    type: document.getElementById('sw-type').value,
    assignee: document.getElementById('sw-assignee').value,
    priority: document.getElementById('sw-priority').value,
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
  const f = document.getElementById('vendor-form');
  if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function saveVendor() {
  const cats = [...document.querySelectorAll('input[name="v-cat"]:checked')].map(el => el.value);
  const v = {
    name: document.getElementById('v-name').value || 'Unnamed',
    rep: document.getElementById('v-rep').value,
    email: document.getElementById('v-email').value,
    phone: document.getElementById('v-phone').value,
    categories: cats,
    reg: document.getElementById('v-reg').checked
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
  const scope = document.getElementById('i-scope').value;
  const systems = detectSystems(scope);
  const client = document.getElementById('i-client').value || 'New Client';
  const date = document.getElementById('i-date').value;

  const project = {
    id: 'P-' + (Math.floor(Math.random() * 900) + 100),
    name: client + ' — ' + document.getElementById('i-venue').value,
    client_name: client,
    description: scope,
    status: 'lead',
    estimated_amount: parseInt((document.getElementById('i-budget').value || '0').replace(/\D/g,'')),
    install_start: date,
    timeline_type: document.getElementById('i-timeline').value,
    systems,
    readiness: 'new',
    designer: 'Kris',
    install_manager: 'Clint',
    salesperson: 'Jacob'
  };

  state.projects.push(project);
  document.getElementById('proj-count').textContent = state.projects.length;
  saveState();

  const systemNames = { led_wall: 'LED Wall', pa_install: 'PA System', lighting: 'Stage Lighting', streaming: 'Streaming', control: 'Control System' };
  document.getElementById('intake-result').innerHTML = `
    <div class="alert alert-success">
      <div>
        <strong>Project created: ${project.id}</strong><br>
        Systems detected: ${systems.map(s => systemNames[s] || s).join(', ') || 'None detected — check scope text'}<br>
        Design templates auto-selected: ${systems.length} template(s)<br>
        <button class="btn btn-sm btn-success" style="margin-top:8px" onclick="navigate('project','${project.id}')">Open Project Dashboard →</button>
      </div>
    </div>
  `;
}

// ── Modal ──
function openModal(title, sub, body) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-sub').textContent = sub || '';
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('project-modal').style.display = 'flex';
}
function closeModal() { document.getElementById('project-modal').style.display = 'none'; }

// ── Persistence ──
function saveState() {
  localStorage.setItem('vi_vendors', JSON.stringify(state.vendors));
  localStorage.setItem('vi_shopwork', JSON.stringify(state.shopwork));
  localStorage.setItem('vi_checklists', JSON.stringify(state.checklists));
}

function attachEventListeners() {
  document.addEventListener('click', e => {
    if (e.target === document.getElementById('project-modal')) closeModal();
  });
}

// ── Init ──
async function init() {
  // Load demo projects immediately
  state.projects = getDemoProjects();
  document.getElementById('proj-count').textContent = state.projects.length;
  renderCurrentPage();

  // Try to sync from Jetbuilt
  setTimeout(syncJetbuilt, 800);
}

init();
