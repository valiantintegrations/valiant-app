// ── Valiant Integrations App ──
// API calls handled via /api/jetbuilt proxy

// ── State ──
let currentUserRole = localStorage.getItem('vi_role') || 'admin';
let currentUserName = localStorage.getItem('vi_user') || 'Jacob';
const clientNameCache = {};

function setUserRole(role) {
  currentUserRole = role;
  localStorage.setItem('vi_role', role);
  const sel = document.getElementById('role-select');
  if (sel) sel.value = role;
  renderCurrentPage();
}

function canSee(permission) {
  const perms = {
    financials:     ['admin','sales','design','project_manager'],
    labor:          ['admin','sales','design','project_manager'],
    equipment_total:['admin','sales','design','project_manager'],
    client_contact: ['admin','sales','design','project_manager'],
    margins:        ['admin','sales'],
    assign_team:    ['admin','project_manager'],
    change_stage:   ['admin','sales','project_manager'],
    view_all_projects: ['admin','sales','project_manager']
  };
  return (perms[permission] || []).includes(currentUserRole);
}

const state = {
  projects: [],
  vendors: JSON.parse(localStorage.getItem('vi_vendors') || '[]'),
  shopwork: JSON.parse(localStorage.getItem('vi_shopwork') || '[]'),
  checklists: JSON.parse(localStorage.getItem('vi_checklists') || '{}'),
  assignments: JSON.parse(localStorage.getItem('vi_assignments') || '{}'),
  reviewed: JSON.parse(localStorage.getItem('vi_reviewed') || '{}'),
  designTrack: JSON.parse(localStorage.getItem('vi_design_track') || '{}'),
  installTrack: JSON.parse(localStorage.getItem('vi_install_track') || '{}'),
  gbbLinks: JSON.parse(localStorage.getItem('vi_gbb') || '{}'),
  archived: JSON.parse(localStorage.getItem('vi_archived') || '{}'),
  currentPage: 'dashboard',
  currentProject: null,
  calendarDate: new Date(),
  calendarView: 'month',
  syncing: false
};

// ── Pipeline Stage Config ──
const STAGES = [
  { key: 'lead', label: 'Lead', color: 'gray' },
  { key: 'proposal', label: 'Proposal', color: 'blue' },
  { key: 'sent', label: 'Sent', color: 'amber' },
  { key: 'contract', label: 'Contract', color: 'green' }
];

function mapStage(raw) {
  if (!raw) return 'lead';
  const s = raw.toLowerCase();
  if (s.includes('lead') || s.includes('prospect')) return 'lead';
  if (s.includes('propos') || s.includes('design') || s.includes('bid') || s.includes('estimat')) return 'proposal';
  if (s.includes('sent') || s.includes('present') || s.includes('pending') || s.includes('review')) return 'sent';
  if (s.includes('approv') || s.includes('contract') || s.includes('accept') || s.includes('won') || s.includes('sold') || s.includes('awarded')) return 'contract';
  if (s.includes('install') || s.includes('progress') || s.includes('active') || s.includes('current') || s.includes('in progress') || s.includes('construction')) return 'contract';
  if (s.includes('complete') || s.includes('close') || s.includes('done') || s.includes('finish') || s.includes('final')) return 'contract';
  if (s.includes('lost') || s.includes('dead') || s.includes('cancel')) return 'lead';
  return 'lead';
}

// ── Contract Review Tracking ──
// Projects in "contract" stage need review before handoff to design & install
const contractReviewed = JSON.parse(localStorage.getItem('vi_contract_reviewed') || '{}');

function isContractNeedsReview(project) {
  return project.stage === 'contract' && !contractReviewed[project.id];
}

function markContractReviewed(projectId) {
  contractReviewed[projectId] = new Date().toISOString();
  localStorage.setItem('vi_contract_reviewed', JSON.stringify(contractReviewed));
  renderCurrentPage();
  // Also re-render modal if open
  if (state.currentProject && state.currentProject.id === projectId) {
    openProject(projectId);
  }
}

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

// ── Helpers ──
function fmt(n) {
  if (n == null || isNaN(n)) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function systemTagHTML(sys) {
  const map = {
    led_wall: ['LED Wall', 'tag-led'],
    pa_install: ['Audio/PA', 'tag-audio'],
    lighting: ['Lighting', 'tag-lighting'],
    control: ['Control', 'tag-control'],
    streaming: ['Streaming', 'tag-streaming'],
    video: ['Video', 'tag-video'],
    camera: ['Camera', 'tag-streaming']
  };
  const [label, cls] = map[sys] || [sys, 'tag-audio'];
  return `<span class="tag ${cls}">${label}</span>`;
}

function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── Enrich Project ──
function enrichProject(p) {
  const name = p.name || p.title || 'Untitled';
  const scope = [name, p.description || '', p.notes || ''].join(' ');
  const systems = detectSystems(scope);
  const total = parseFloat(p.total) || parseFloat(p.equipment_total) || 0;
  const labor = parseFloat(p.labor_total) || 0;
  const equipment = parseFloat(p.equipment_total) || total - labor;
  const stage = mapStage(p.stage || p.status);
  const archiveStatus = state.archived[p.id] || null;

  return {
    id: p.id,
    jetbuilt_id: p.id,
    name,
    client: p.client || {},
    client_name: p.client?.company_name || p.client?.name || '',
    stage,
    raw_stage: p.stage || p.status || '',
    total,
    labor,
    equipment,
    systems,
    description: p.description || '',
    notes: p.notes || '',
    address: p.address || '',
    city: p.city || '',
    state_abbr: p.state || '',
    created_at: p.created_at || '',
    updated_at: p.updated_at || '',
    start_date: p.start_date || p.install_date || '',
    end_date: p.end_date || '',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    archived: archiveStatus
  };
}

// ── Archive System (Icebox / Lost / Trash) ──
const ARCHIVE_BINS = [
  { key: 'icebox', label: 'Icebox', icon: '❄️', color: '#58A6FF' },
  { key: 'lost', label: 'Lost', icon: '✕', color: '#F85149' },
  { key: 'trash', label: 'Trash', icon: '🗑', color: '#6E7681' }
];

function archiveProject(projectId, bin) {
  state.archived[projectId] = bin;
  save('vi_archived', state.archived);
  const p = state.projects.find(x => x.id === projectId);
  if (p) p.archived = bin;
  renderCurrentPage();
}

function unarchiveProject(projectId) {
  delete state.archived[projectId];
  save('vi_archived', state.archived);
  const p = state.projects.find(x => x.id === projectId);
  if (p) p.archived = null;
  renderCurrentPage();
}

function getArchivedProjects(bin) {
  return state.projects.filter(p => p.archived === bin);
}

// ── GBB (Good/Better/Best) Linking ──
// Structure: { groupId: { good: projectId, better: projectId, best: projectId } }
function getGBBGroup(projectId) {
  for (const [gid, group] of Object.entries(state.gbbLinks)) {
    if (group.good === projectId || group.better === projectId || group.best === projectId) {
      return { groupId: gid, ...group };
    }
  }
  return null;
}

function getGBBTier(projectId) {
  const group = getGBBGroup(projectId);
  if (!group) return null;
  if (group.good === projectId) return 'good';
  if (group.better === projectId) return 'better';
  if (group.best === projectId) return 'best';
  return null;
}

function linkGBB(goodId, betterId, bestId) {
  const groupId = 'gbb_' + Date.now();
  state.gbbLinks[groupId] = { good: goodId, better: betterId, best: bestId };
  save('vi_gbb', state.gbbLinks);
}

function unlinkGBB(projectId) {
  const group = getGBBGroup(projectId);
  if (group) {
    delete state.gbbLinks[group.groupId];
    save('vi_gbb', state.gbbLinks);
  }
}

function showGBBLinkDialog(projectId) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  const existing = getGBBGroup(projectId);
  const others = state.projects.filter(x => x.id !== projectId && !x.archived && !getGBBGroup(x.id));

  const modal = document.createElement('div');
  modal.id = 'gbb-dialog';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:110;display:flex;align-items:center;justify-content:center;padding:20px';

  if (existing) {
    const goodP = state.projects.find(x => x.id === existing.good);
    const betterP = state.projects.find(x => x.id === existing.better);
    const bestP = state.projects.find(x => x.id === existing.best);
    modal.innerHTML = `<div style="background:#161B22;border:1px solid #30363D;border-radius:12px;padding:20px;max-width:400px;width:100%">
      <div style="font-size:15px;font-weight:600;color:#E6EDF3;margin-bottom:14px">Good / Better / Best Group</div>
      <div style="font-size:13px;color:#C9D1D9;line-height:2">
        <div>🥉 <strong>Good:</strong> ${esc(goodP?.name || 'Unknown')}</div>
        <div>🥈 <strong>Better:</strong> ${esc(betterP?.name || 'Unknown')} <span style="color:#58A6FF;font-size:11px">(counts in pipeline)</span></div>
        <div>🥇 <strong>Best:</strong> ${esc(bestP?.name || 'Unknown')}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-danger" onclick="unlinkGBB(${projectId});document.getElementById('gbb-dialog')?.remove();openProject(${projectId})">Unlink Group</button>
        <button class="btn" onclick="document.getElementById('gbb-dialog')?.remove()">Close</button>
      </div>
    </div>`;
  } else {
    const opts = others.map(o => `<option value="${o.id}">${esc(o.name)}${o.client_name ? ' — ' + esc(o.client_name) : ''}</option>`).join('');
    modal.innerHTML = `<div style="background:#161B22;border:1px solid #30363D;border-radius:12px;padding:20px;max-width:400px;width:100%">
      <div style="font-size:15px;font-weight:600;color:#E6EDF3;margin-bottom:4px">Link Good / Better / Best</div>
      <div style="font-size:12px;color:#6E7681;margin-bottom:14px">This project: <strong style="color:#E6EDF3">${esc(p.name)}</strong></div>
      <div class="form-group">
        <label class="form-label">This project is the…</label>
        <select class="form-select" id="gbb-tier">
          <option value="good">Good (lowest tier)</option>
          <option value="better" selected>Better (middle tier)</option>
          <option value="best">Best (highest tier)</option>
        </select>
      </div>
      <div class="form-group" id="gbb-good-group">
        <label class="form-label">Good project</label>
        <select class="form-select" id="gbb-good"><option value="">Select…</option>${opts}</select>
      </div>
      <div class="form-group" id="gbb-better-group">
        <label class="form-label">Better project</label>
        <select class="form-select" id="gbb-better"><option value="">Select…</option>${opts}</select>
      </div>
      <div class="form-group" id="gbb-best-group">
        <label class="form-label">Best project</label>
        <select class="form-select" id="gbb-best"><option value="">Select…</option>${opts}</select>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn-primary" onclick="submitGBBLink(${projectId})">Link Projects</button>
        <button class="btn" onclick="document.getElementById('gbb-dialog')?.remove()">Cancel</button>
      </div>
    </div>`;
  }
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Auto-hide the field for the current project's tier
  if (!existing) {
    const tierSel = document.getElementById('gbb-tier');
    function updateGBBFields() {
      const tier = tierSel.value;
      document.getElementById('gbb-good-group').style.display = tier === 'good' ? 'none' : '';
      document.getElementById('gbb-better-group').style.display = tier === 'better' ? 'none' : '';
      document.getElementById('gbb-best-group').style.display = tier === 'best' ? 'none' : '';
    }
    tierSel.addEventListener('change', updateGBBFields);
    updateGBBFields();
  }
}

function submitGBBLink(projectId) {
  const tier = document.getElementById('gbb-tier')?.value;
  const goodId = tier === 'good' ? projectId : parseInt(document.getElementById('gbb-good')?.value);
  const betterId = tier === 'better' ? projectId : parseInt(document.getElementById('gbb-better')?.value);
  const bestId = tier === 'best' ? projectId : parseInt(document.getElementById('gbb-best')?.value);
  if (!goodId || !betterId || !bestId) { alert('Please select all three projects.'); return; }
  if (new Set([goodId, betterId, bestId]).size !== 3) { alert('Each project must be different.'); return; }
  linkGBB(goodId, betterId, bestId);
  document.getElementById('gbb-dialog')?.remove();
  openProject(projectId);
}

// ── Pipeline Value (GBB-aware) ──
function getPipelineValue(projects) {
  let total = 0;
  const counted = new Set();
  projects.forEach(p => {
    if (counted.has(p.id)) return;
    const group = getGBBGroup(p.id);
    if (group) {
      // Only count the "better" tier for GBB groups
      if (!counted.has(group.good) && !counted.has(group.better) && !counted.has(group.best)) {
        const betterProject = state.projects.find(x => x.id === group.better);
        if (betterProject) total += betterProject.total;
        counted.add(group.good);
        counted.add(group.better);
        counted.add(group.best);
      }
    } else {
      total += p.total;
      counted.add(p.id);
    }
  });
  return total;
}

// ── Dashboard Title ──
function getDashboardTitle() {
  const roleLabels = {
    admin: 'Admin Dashboard',
    sales: 'Sales Dashboard',
    design: 'Design Dashboard',
    project_manager: 'Project Management Dashboard',
    installer: 'Install Dashboard'
  };
  return `${currentUserName}\u2019s ${roleLabels[currentUserRole] || 'Dashboard'}`;
}

// ── Drag & Drop (pipeline) ──
function onDragStart(e, projectId) {
  e.dataTransfer.setData('text/plain', projectId);
  e.dataTransfer.effectAllowed = 'move';
  e.target.style.opacity = '0.5';
}

function onDragEnd(e) {
  e.target.style.opacity = '1';
  document.querySelectorAll('.pipeline-col, .archive-bin').forEach(el => el.classList.remove('drag-over'));
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDropStage(e, stage) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const projectId = parseInt(e.dataTransfer.getData('text/plain'));
  if (!projectId) return;
  moveProjectToStage(projectId, stage);
}

function onDropArchive(e, bin) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const projectId = parseInt(e.dataTransfer.getData('text/plain'));
  if (!projectId) return;
  archiveProject(projectId, bin);
}

function moveProjectToStage(projectId, newStage) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  // If coming from archive, unarchive first
  if (p.archived) {
    delete state.archived[projectId];
    save('vi_archived', state.archived);
    p.archived = null;
  }
  p.stage = newStage;
  // Update cache
  try { localStorage.setItem('vi_projects_cache', JSON.stringify(state.projects)); } catch(e) {}
  // If moved to contract, it needs review
  if (newStage === 'contract' && !contractReviewed[projectId]) {
    // Already handled by isContractNeedsReview
  }
  renderCurrentPage();
}

// ── Mobile Move-To (for projects on mobile) ──
function showMoveMenu(projectId, event) {
  event.stopPropagation();
  const existing = document.getElementById('move-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'move-menu';
  menu.style.cssText = 'position:fixed;bottom:70px;left:12px;right:12px;background:#161B22;border:1px solid #30363D;border-radius:12px;z-index:70;padding:8px 0;box-shadow:0 8px 32px rgba(0,0,0,0.5)';

  const stageItems = STAGES.map(s =>
    `<div onclick="moveProjectToStage(${projectId},'${s.key}');document.getElementById('move-menu')?.remove()" style="padding:14px 20px;color:#C9D1D9;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;-webkit-tap-highlight-color:transparent">
      <span class="status-pill status-${s.color}" style="font-size:11px">${s.label}</span>
    </div>`
  ).join('');

  const archiveItems = ARCHIVE_BINS.map(b =>
    `<div onclick="archiveProject(${projectId},'${b.key}');document.getElementById('move-menu')?.remove()" style="padding:14px 20px;color:${b.color};font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px">
      ${b.icon} ${b.label}
    </div>`
  ).join('');

  menu.innerHTML = `
    <div style="padding:8px 20px 4px;font-size:11px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em">Move to Stage</div>
    ${stageItems}
    <div style="border-top:1px solid #30363D;margin:4px 0"></div>
    <div style="padding:8px 20px 4px;font-size:11px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em">Archive</div>
    ${archiveItems}
    <div style="border-top:1px solid #30363D;margin:4px 0"></div>
    <div onclick="document.getElementById('move-menu')?.remove()" style="padding:12px 20px;color:#6E7681;font-size:13px;cursor:pointer;text-align:center">Cancel</div>
  `;
  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', function closer(e) {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closer); }
    });
  }, 10);
}

// ── Bottom Nav (injected for mobile) ──
function injectBottomNav() {
  if (document.getElementById('bottom-nav')) return;
  const nav = document.createElement('div');
  nav.id = 'bottom-nav';
  nav.innerHTML = `<div class="bnav-inner">
    <div class="bnav-item active" data-page="dashboard" onclick="navigate('dashboard')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
      <span>Home</span>
    </div>
    <div class="bnav-item" data-page="projects" onclick="navigate('projects')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h12M4 18h14"/></svg>
      <span>Projects</span>
    </div>
    <div class="bnav-item bnav-intake" data-page="intake" onclick="navigate('intake')">
      <div class="bnav-fab">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </div>
      <span style="font-size:9px;margin-top:4px;color:#8B949E">Intake</span>
    </div>
    <div class="bnav-item" data-page="calendar" onclick="navigate('calendar')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>
      <span>Calendar</span>
    </div>
    <div class="bnav-item" data-page="more" onclick="toggleMoreMenu()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      <span>More</span>
    </div>
  </div>`;
  document.body.appendChild(nav);
}

// ── More Menu (mobile) ──
function toggleMoreMenu() {
  let menu = document.getElementById('more-menu');
  if (menu) { menu.remove(); return; }
  menu = document.createElement('div');
  menu.id = 'more-menu';
  menu.style.cssText = 'position:fixed;bottom:64px;right:12px;background:#161B22;border:1px solid #30363D;border-radius:12px;z-index:70;padding:8px 0;min-width:180px;box-shadow:0 8px 32px rgba(0,0,0,0.5)';
  menu.innerHTML = `
    <div onclick="navigate('vendors');document.getElementById('more-menu')?.remove()" style="padding:14px 20px;color:#C9D1D9;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;-webkit-tap-highlight-color:transparent">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7"/></svg>
      Vendors
    </div>
    <div onclick="navigate('shopwork');document.getElementById('more-menu')?.remove()" style="padding:14px 20px;color:#C9D1D9;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;-webkit-tap-highlight-color:transparent">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5h14l1.5 12H3.5L5 5z"/><path d="M9 5V4a3 3 0 0 1 6 0v1"/></svg>
      Shop Work
    </div>
    <div style="border-top:1px solid #30363D;margin:4px 0"></div>
    <div onclick="syncJetbuilt();document.getElementById('more-menu')?.remove()" style="padding:14px 20px;color:#58A6FF;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;-webkit-tap-highlight-color:transparent">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12A8 8 0 1 1 12 4"/><path d="M12 4l3-3M12 4l3 3"/></svg>
      Sync Jetbuilt
    </div>
  `;
  document.body.appendChild(menu);
  // Close on tap outside
  setTimeout(() => {
    document.addEventListener('click', function closer(e) {
      if (!menu.contains(e.target) && !e.target.closest('[data-page="more"]')) {
        menu.remove();
        document.removeEventListener('click', closer);
      }
    });
  }, 10);
}

// ── Navigation ──
function navigate(page) {
  state.currentPage = page;
  // Close more menu if open
  document.getElementById('more-menu')?.remove();
  // Update sidebar nav (desktop)
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  // Update bottom nav (mobile)
  document.querySelectorAll('#bottom-nav .bnav-item').forEach(el => {
    const p = el.dataset.page;
    el.classList.toggle('active', p === page || (page === 'dashboard' && p === 'dashboard'));
  });
  const titles = {
    dashboard: 'Dashboard', calendar: 'Calendar', projects: 'Projects',
    shopwork: 'Shop Work', vendors: 'Vendors', intake: 'New Intake'
  };
  document.getElementById('page-title').textContent = titles[page] || 'Dashboard';
  renderCurrentPage();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function renderCurrentPage() {
  const c = document.getElementById('content');
  if (!c) return;
  try {
    switch (state.currentPage) {
      case 'dashboard': renderDashboard(c); break;
      case 'calendar': renderCalendar(c); break;
      case 'projects': renderProjects(c); break;
      case 'shopwork': renderShopWork(c); break;
      case 'vendors': renderVendors(c); break;
      case 'intake': renderIntake(c); break;
      default: renderDashboard(c);
    }
  } catch (e) {
    c.innerHTML = `<div class="alert alert-error">Render error: ${e.message}</div>`;
    console.error(e);
  }
}

// ── Dashboard ──
function renderDashboard(c) {
  const projects = state.projects.filter(p => !p.archived);
  const byStage = {};
  STAGES.forEach(s => byStage[s.key] = []);
  projects.forEach(p => {
    if (byStage[p.stage]) byStage[p.stage].push(p);
    else byStage.lead.push(p);
  });

  const totalValue = getPipelineValue(projects);
  const activeCount = projects.filter(p => p.stage === 'contract').length;
  const reviewCount = projects.filter(p => isContractNeedsReview(p)).length;
  const proposalCount = byStage.proposal.length + byStage.sent.length;
  const archivedCount = state.projects.filter(p => p.archived).length;

  // Update page title for role
  document.getElementById('page-title').textContent = getDashboardTitle();

  c.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total Projects</div>
        <div class="metric-value">${projects.length}</div>
        <div class="metric-sub">${archivedCount > 0 ? archivedCount + ' archived' : 'All active'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Pipeline Value</div>
        <div class="metric-value">${fmt(totalValue)}</div>
        <div class="metric-sub">GBB counts Better only</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Contracted</div>
        <div class="metric-value">${activeCount}</div>
        <div class="metric-sub">${reviewCount > 0 ? `<span style="color:#F85149;font-weight:500">${reviewCount} needs review</span>` : 'All reviewed'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Open Proposals</div>
        <div class="metric-value">${proposalCount}</div>
        <div class="metric-sub">Proposal + Sent</div>
      </div>
    </div>

    <div class="section-header">
      <div class="section-title">Pipeline</div>
      <button class="section-action" onclick="navigate('projects')">View All</button>
    </div>
    <div class="pipeline-grid">
      ${STAGES.map(s => `
        <div class="pipeline-col" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDropStage(event, '${s.key}')">
          <div class="pipeline-col-header">
            <span class="pipeline-col-name">${s.label}</span>
            <span class="pipeline-col-count">${(byStage[s.key] || []).length}</span>
          </div>
          ${(byStage[s.key] || []).slice(0, 8).map(p => {
            const gbbTier = getGBBTier(p.id);
            const gbbBadge = gbbTier ? `<span style="font-size:9px;font-weight:600;padding:1px 5px;border-radius:3px;background:${gbbTier === 'better' ? '#0D1626;color:#58A6FF;border:1px solid #1565C0' : gbbTier === 'best' ? '#0D1A0E;color:#3FB950;border:1px solid #238636' : '#161B22;color:#6E7681;border:1px solid #30363D'}">${gbbTier.toUpperCase()}</span>` : '';
            return `
            <div class="project-card" draggable="true" ondragstart="onDragStart(event, ${p.id})" ondragend="onDragEnd(event)" onclick="openProject(${p.id})" style="${isContractNeedsReview(p) ? 'border-color:#DA3633' : ''}">
              ${isContractNeedsReview(p) ? '<div style="background:#DA3633;color:#fff;font-size:10px;font-weight:600;padding:4px 8px;border-radius:4px;margin-bottom:8px;text-align:center;letter-spacing:0.03em">REVIEW — SEND TO DESIGN & INSTALL</div>' : ''}
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div class="project-card-name">${esc(p.name)}</div>
                ${gbbBadge}
              </div>
              <div class="project-card-client">${esc(p.client_name || 'No client')}</div>
              <div class="project-card-footer">
                ${canSee('financials') ? `<span class="project-card-value">${fmt(p.total)}</span>` : '<span></span>'}
                <div style="display:flex;align-items:center;gap:4px">
                  <span class="status-pill status-${s.color}">${s.label}</span>
                  <button class="move-btn" onclick="event.stopPropagation();showMoveMenu(${p.id}, event)" title="Move">⋮</button>
                </div>
              </div>
              ${p.systems.length ? `<div style="margin-top:6px">${p.systems.map(systemTagHTML).join('')}</div>` : ''}
            </div>`;
          }).join('')}
          ${(byStage[s.key] || []).length === 0 ? '<div class="empty-state" style="padding:20px 10px;font-size:12px">No projects</div>' : ''}
          ${(byStage[s.key] || []).length > 8 ? `<div style="text-align:center;padding:6px;font-size:11px;color:#6E7681">+${(byStage[s.key]).length - 8} more</div>` : ''}
        </div>
      `).join('')}
    </div>

    <div class="archive-row">
      ${ARCHIVE_BINS.map(b => {
        const count = getArchivedProjects(b.key).length;
        return `
        <div class="archive-bin" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDropArchive(event, '${b.key}')">
          <span class="archive-icon">${b.icon}</span>
          <span class="archive-label">${b.label}</span>
          ${count > 0 ? `<span class="archive-count" onclick="toggleArchiveExpand('${b.key}')">${count}</span>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div id="archive-expanded"></div>

    ${renderRecentActivity()}
  `;
}

function toggleArchiveExpand(bin) {
  const el = document.getElementById('archive-expanded');
  if (!el) return;
  const b = ARCHIVE_BINS.find(x => x.key === bin);
  const projects = getArchivedProjects(bin);
  if (el.dataset.bin === bin) { el.innerHTML = ''; el.dataset.bin = ''; return; }
  el.dataset.bin = bin;
  el.innerHTML = `
    <div class="card" style="margin-top:8px;margin-bottom:16px">
      <div class="dashboard-card-title">${b?.icon || ''} ${b?.label || bin} <span style="font-weight:400;color:#6E7681">(${projects.length})</span></div>
      ${projects.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #0D1117">
          <div>
            <div style="font-size:13px;color:#E6EDF3">${esc(p.name)}</div>
            <div style="font-size:11px;color:#6E7681">${esc(p.client_name || '')}</div>
          </div>
          <button class="btn btn-sm" onclick="unarchiveProject(${p.id})">Restore</button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRecentActivity() {
  const recent = [...state.projects]
    .filter(p => p.updated_at)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 6);

  if (recent.length === 0) return '';

  return `
    <div class="section-header">
      <div class="section-title">Recently Updated</div>
    </div>
    <div class="card">
      ${recent.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #0D1117;cursor:pointer" onclick="openProject(${p.id})">
          <div>
            <div style="font-size:13px;font-weight:500;color:#E6EDF3">${esc(p.name)}</div>
            <div style="font-size:11px;color:#6E7681">${esc(p.client_name || '')}</div>
          </div>
          <div style="text-align:right">
            <span class="status-pill status-${STAGES.find(s => s.key === p.stage)?.color || 'gray'}">${p.raw_stage || p.stage}</span>
            <div style="font-size:10px;color:#6E7681;margin-top:2px">${shortDate(p.updated_at)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Projects Table ──
function renderProjects(c) {
  const projects = state.projects.filter(p => !p.archived);
  const sorted = [...projects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  c.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap">
      <input type="text" class="form-input" placeholder="Search projects…" id="proj-search"
        oninput="filterProjects()" style="max-width:300px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm ${!window._projFilter ? 'btn-primary' : ''}" onclick="setProjectFilter(null)" style="${!window._projFilter ? 'background:#1565C0;border-color:#1565C0;color:#fff' : ''}">All (${projects.length})</button>
        ${STAGES.map(s => {
          const cnt = projects.filter(p => p.stage === s.key).length;
          return `<button class="btn btn-sm" onclick="setProjectFilter('${s.key}')">${s.label} (${cnt})</button>`;
        }).join('')}
      </div>
    </div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="projects-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Client</th>
            <th>Stage</th>
            ${canSee('financials') ? '<th>Value</th>' : ''}
            <th>Systems</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody id="proj-tbody">
          ${sorted.map(p => projectRow(p)).join('')}
        </tbody>
      </table>
    </div>
    <div class="mobile-project-list" id="proj-mobile">
      ${sorted.map(p => {
        const stg = STAGES.find(s => s.key === p.stage) || STAGES[0];
        return `
          <div class="mobile-project-item" onclick="openProject(${p.id})" data-stage="${p.stage}" data-name="${esc(p.name).toLowerCase()}" style="${isContractNeedsReview(p) ? 'border-color:#DA3633' : ''}">
            ${isContractNeedsReview(p) ? '<div style="background:#DA3633;color:#fff;font-size:10px;font-weight:600;padding:4px 8px;border-radius:4px;margin-bottom:8px;text-align:center;letter-spacing:0.03em">REVIEW — SEND TO DESIGN & INSTALL</div>' : ''}
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
              <div>
                <div style="font-size:14px;font-weight:500;color:#E6EDF3">${esc(p.name)}</div>
                <div style="font-size:12px;color:#6E7681;margin-top:2px">${esc(p.client_name || 'No client')}</div>
              </div>
              <span class="status-pill status-${stg.color}">${stg.label}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>${p.systems.map(systemTagHTML).join('') || '<span style="color:#6E7681;font-size:11px">No tags</span>'}</div>
              ${canSee('financials') ? `<span style="font-size:13px;font-weight:500;color:#58A6FF">${fmt(p.total)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ${sorted.length === 0 ? '<div class="empty-state"><span class="empty-icon">📋</span>No projects yet. Sync with Jetbuilt or create a new intake.</div>' : ''}
  `;
}

function projectRow(p) {
  const stg = STAGES.find(s => s.key === p.stage) || STAGES[0];
  return `
    <tr onclick="openProject(${p.id})" data-stage="${p.stage}" data-name="${esc(p.name).toLowerCase()}">
      <td>
        <div class="proj-name">${esc(p.name)}</div>
        <div class="proj-id">#${p.id}</div>
      </td>
      <td>${esc(p.client_name || '—')}</td>
      <td><span class="status-pill status-${stg.color}">${stg.label}</span></td>
      ${canSee('financials') ? `<td>${fmt(p.total)}</td>` : ''}
      <td>${p.systems.map(systemTagHTML).join('') || '<span style="color:#6E7681">—</span>'}</td>
      <td style="font-size:12px;color:#6E7681">${shortDate(p.updated_at)}</td>
    </tr>
  `;
}

function filterProjects() {
  const q = (document.getElementById('proj-search')?.value || '').toLowerCase();
  document.querySelectorAll('#proj-tbody tr').forEach(tr => {
    const name = tr.dataset.name || '';
    const stage = tr.dataset.stage || '';
    const matchSearch = !q || name.includes(q);
    const matchFilter = !window._projFilter || stage === window._projFilter;
    tr.style.display = matchSearch && matchFilter ? '' : 'none';
  });
  document.querySelectorAll('#proj-mobile .mobile-project-item').forEach(el => {
    const name = el.dataset.name || '';
    const stage = el.dataset.stage || '';
    const matchSearch = !q || name.includes(q);
    const matchFilter = !window._projFilter || stage === window._projFilter;
    el.style.display = matchSearch && matchFilter ? '' : 'none';
  });
}

function setProjectFilter(stage) {
  window._projFilter = stage;
  renderProjects(document.getElementById('content'));
}

// ── Project Detail Modal ──
function openProject(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  state.currentProject = p;

  document.getElementById('modal-title').textContent = p.name;
  document.getElementById('modal-sub').textContent = `#${p.id} · ${p.client_name || 'No client'} · ${p.raw_stage || p.stage}`;

  const systems = p.systems;
  const designChecks = getChecklistState(p.id, 'design');
  const installChecks = getChecklistState(p.id, 'install');

  const body = document.getElementById('modal-body');
  const needsReview = isContractNeedsReview(p);
  body.innerHTML = `
    ${needsReview ? `
      <div style="background:#1A0D0D;border:1px solid #DA3633;border-radius:10px;padding:14px 16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="width:10px;height:10px;border-radius:50%;background:#DA3633;animation:pulse 1.5s infinite"></div>
          <span style="font-size:13px;font-weight:600;color:#F85149">REVIEW REQUIRED — SEND TO DESIGN & INSTALL</span>
        </div>
        <div style="font-size:12px;color:#8B949E;margin-bottom:12px">This project has moved to contract. Review the details and send to Chris (Design) and Clint (Install) to begin the handoff.</div>
        <button class="btn-primary" onclick="markContractReviewed(${p.id})" style="background:#238636;padding:10px 20px;font-size:13px">
          ✓ Mark Reviewed & Send to Design/Install
        </button>
      </div>
    ` : ''}
    <div class="tabs" id="modal-tabs">
      <div class="tab active" onclick="switchModalTab('overview')">Overview</div>
      <div class="tab" onclick="switchModalTab('design')">Design</div>
      <div class="tab" onclick="switchModalTab('install')">Install</div>
      <div class="tab" onclick="switchModalTab('notes')">Notes</div>
    </div>
    <div id="modal-tab-content"></div>
  `;

  switchModalTab('overview');
  document.getElementById('project-modal').style.display = 'flex';
}

function switchModalTab(tab) {
  document.querySelectorAll('#modal-tabs .tab').forEach((el, i) => {
    el.classList.toggle('active', ['overview','design','install','notes'][i] === tab);
  });

  const p = state.currentProject;
  if (!p) return;
  const tc = document.getElementById('modal-tab-content');

  if (tab === 'overview') {
    tc.innerHTML = `
      <div class="dashboard-grid">
        <div class="dashboard-card">
          <div class="dashboard-card-title">Project Info</div>
          <div style="font-size:13px;color:#C9D1D9;line-height:1.8">
            <div><strong style="color:#8B949E">Stage:</strong> ${esc(p.raw_stage || p.stage)}</div>
            ${canSee('financials') ? `
              <div><strong style="color:#8B949E">Total Value:</strong> ${fmt(p.total)}</div>
              <div><strong style="color:#8B949E">Equipment:</strong> ${fmt(p.equipment)}</div>
              <div><strong style="color:#8B949E">Labor:</strong> ${fmt(p.labor)}</div>
            ` : ''}
            <div><strong style="color:#8B949E">Created:</strong> ${fmtDate(p.created_at)}</div>
            <div><strong style="color:#8B949E">Updated:</strong> ${fmtDate(p.updated_at)}</div>
            ${p.start_date ? `<div><strong style="color:#8B949E">Install Date:</strong> ${fmtDate(p.start_date)}</div>` : ''}
          </div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-card-title">Client</div>
          <div style="font-size:13px;color:#C9D1D9;line-height:1.8">
            <div><strong style="color:#8B949E">Company:</strong> ${esc(p.client_name || '—')}</div>
            ${canSee('client_contact') ? `
              <div><strong style="color:#8B949E">Contact:</strong> ${esc(p.primary_contact_name || '—')}</div>
              <div><strong style="color:#8B949E">Email:</strong> ${p.primary_contact_email ? `<a href="mailto:${esc(p.primary_contact_email)}" style="color:#58A6FF">${esc(p.primary_contact_email)}</a>` : '—'}</div>
              <div><strong style="color:#8B949E">Phone:</strong> ${esc(p.primary_contact_phone || '—')}</div>
            ` : ''}
            ${p.address ? `<div><strong style="color:#8B949E">Address:</strong> ${esc(p.address)}${p.city ? ', ' + esc(p.city) : ''}${p.state_abbr ? ' ' + esc(p.state_abbr) : ''}</div>` : ''}
          </div>
        </div>
      </div>
      ${p.systems.length ? `
        <div class="dashboard-card" style="margin-top:14px">
          <div class="dashboard-card-title">Scope Tags</div>
          <div>${p.systems.map(systemTagHTML).join(' ')}</div>
        </div>
      ` : ''}
      ${p.description ? `
        <div class="dashboard-card" style="margin-top:14px">
          <div class="dashboard-card-title">Description</div>
          <div style="font-size:13px;color:#C9D1D9;line-height:1.6">${esc(p.description)}</div>
        </div>
      ` : ''}
      ${(() => {
        const gbbGroup = getGBBGroup(p.id);
        const gbbTier = getGBBTier(p.id);
        if (gbbGroup) {
          const goodP = state.projects.find(x => x.id === gbbGroup.good);
          const betterP = state.projects.find(x => x.id === gbbGroup.better);
          const bestP = state.projects.find(x => x.id === gbbGroup.best);
          return `
            <div class="dashboard-card" style="margin-top:14px">
              <div class="dashboard-card-title">
                <span>Good / Better / Best Group</span>
                <span style="font-size:12px;font-weight:500;padding:2px 8px;border-radius:4px;background:${gbbTier === 'better' ? '#0D1626;color:#58A6FF' : gbbTier === 'best' ? '#0D1A0E;color:#3FB950' : '#161B22;color:#6E7681'}">${gbbTier ? gbbTier.toUpperCase() : ''}</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${[{label:'Good', proj:goodP, id:gbbGroup.good}, {label:'Better', proj:betterP, id:gbbGroup.better}, {label:'Best', proj:bestP, id:gbbGroup.best}].map(t => `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:6px;background:${t.id === p.id ? '#0D1626;border:1px solid #1565C0' : '#0D1117;border:1px solid #1C2333'};cursor:${t.id !== p.id ? 'pointer' : 'default'}" ${t.id !== p.id ? `onclick="openProject(${t.id})"` : ''}>
                    <div>
                      <span style="font-size:11px;font-weight:600;color:#6E7681;text-transform:uppercase">${t.label}</span>
                      <div style="font-size:13px;color:#E6EDF3;margin-top:2px">${t.proj ? esc(t.proj.name) : 'Unknown'}</div>
                    </div>
                    ${canSee('financials') && t.proj ? `<span style="font-size:13px;font-weight:500;color:${t.label === 'Better' ? '#58A6FF' : '#6E7681'}">${fmt(t.proj.total)}${t.label === 'Better' ? ' ★' : ''}</span>` : ''}
                  </div>
                `).join('')}
              </div>
              <div style="margin-top:10px;font-size:11px;color:#6E7681">★ Pipeline value uses the Better amount</div>
              <button class="btn btn-sm btn-danger" onclick="showGBBLinkDialog(${p.id})" style="margin-top:8px">Manage GBB Link</button>
            </div>`;
        } else {
          return `
            <div class="dashboard-card" style="margin-top:14px">
              <div class="dashboard-card-title">Good / Better / Best</div>
              <div style="font-size:12px;color:#6E7681;margin-bottom:10px">Link this project to a Good/Better/Best group to track related bids together.</div>
              <button class="btn btn-sm" onclick="showGBBLinkDialog(${p.id})">Link to GBB Group</button>
            </div>`;
        }
      })()}
    `;
  } else if (tab === 'design') {
    renderChecklistTab(tc, p, 'design');
  } else if (tab === 'install') {
    renderChecklistTab(tc, p, 'install');
  } else if (tab === 'notes') {
    const noteKey = `vi_notes_${p.id}`;
    const existing = localStorage.getItem(noteKey) || '';
    tc.innerHTML = `
      <div class="dashboard-card">
        <div class="dashboard-card-title">Project Notes</div>
        <textarea class="form-textarea" id="project-notes" rows="8" placeholder="Add notes about this project…"
          oninput="localStorage.setItem('${noteKey}', this.value)">${esc(existing)}</textarea>
        <div style="margin-top:8px;font-size:11px;color:#6E7681">Notes save automatically</div>
      </div>
    `;
  }
}

function renderChecklistTab(container, project, phase) {
  const systems = project.systems.filter(s => TEMPLATES[phase]?.[s]);

  if (systems.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">${phase === 'design' ? '📐' : '🔧'}</span>No ${phase} checklists — scope tags haven't been detected for this project.<br><br><span style="font-size:11px;color:#6E7681">Checklists auto-generate from scope tags: LED Wall, PA/Audio, Lighting</span></div>`;
    return;
  }

  container.innerHTML = systems.map(sys => {
    const template = TEMPLATES[phase][sys];
    const checkKey = `${project.id}_${phase}_${sys}`;
    const checks = state.checklists[checkKey] || {};
    const total = template.items.length;
    const done = Object.values(checks).filter(Boolean).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return `
      <div class="dashboard-card" style="margin-bottom:14px">
        <div class="dashboard-card-title">
          <span>${template.name}</span>
          <span style="font-size:12px;color:${pct === 100 ? '#3FB950' : '#8B949E'}">${done}/${total} (${pct}%)</span>
        </div>
        <div class="timeline-bar">
          ${template.items.map((_, i) => `<div class="timeline-segment ${checks[i] ? 'done' : ''}"></div>`).join('')}
        </div>
        ${template.items.map((item, i) => `
          <div class="checklist-item ${checks[i] ? 'checked' : ''}" onclick="toggleCheck(${project.id}, '${phase}', '${sys}', ${i})">
            <div class="checklist-box">
              <svg class="checklist-check" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="checklist-label">${esc(item)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

function toggleCheck(projectId, phase, sys, idx) {
  const checkKey = `${projectId}_${phase}_${sys}`;
  if (!state.checklists[checkKey]) state.checklists[checkKey] = {};
  state.checklists[checkKey][idx] = !state.checklists[checkKey][idx];
  save('vi_checklists', state.checklists);

  // Re-render checklist tab
  const tc = document.getElementById('modal-tab-content');
  const p = state.currentProject;
  if (tc && p) {
    const activeTab = document.querySelector('#modal-tabs .tab.active');
    if (activeTab && activeTab.textContent.toLowerCase().includes(phase)) {
      renderChecklistTab(tc, p, phase);
    }
  }
}

function getChecklistState(projectId, phase) {
  const result = {};
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return result;
  project.systems.forEach(sys => {
    if (TEMPLATES[phase]?.[sys]) {
      const key = `${projectId}_${phase}_${sys}`;
      result[sys] = state.checklists[key] || {};
    }
  });
  return result;
}

function closeModal() {
  document.getElementById('project-modal').style.display = 'none';
  state.currentProject = null;
}

// Close modal on overlay click
document.getElementById('project-modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── Calendar ──
function renderCalendar(c) {
  const d = state.calendarDate;
  const month = d.getMonth();
  const year = d.getFullYear();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Build calendar grid
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let cells = '';
  let dayCount = 1;
  const prevMonthDays = new Date(year, month, 0).getDate();

  for (let row = 0; row < 6; row++) {
    cells += '<tr>';
    for (let col = 0; col < 7; col++) {
      const cellIdx = row * 7 + col;
      if (cellIdx < firstDay) {
        const prevDay = prevMonthDays - firstDay + cellIdx + 1;
        cells += `<td class="other-month"><span class="cal-day-num">${prevDay}</span></td>`;
      } else if (dayCount > daysInMonth) {
        const nextDay = dayCount - daysInMonth;
        cells += `<td class="other-month"><span class="cal-day-num">${nextDay}</span></td>`;
        dayCount++;
      } else {
        const isToday = dayCount === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCount).padStart(2, '0')}`;
        const events = getEventsForDate(dateStr);
        cells += `<td class="${isToday ? 'today' : ''}">
          <span class="cal-day-num">${dayCount}</span>
          ${events.map(e => `<div class="cal-event ${e.color}" onclick="openProject(${e.id})" title="${esc(e.name)}">${esc(e.name)}</div>`).join('')}
        </td>`;
        dayCount++;
      }
    }
    cells += '</tr>';
    if (dayCount > daysInMonth) break;
  }

  c.innerHTML = `
    <div class="calendar-container">
      <div class="calendar-controls">
        <div class="calendar-nav">
          <button class="cal-btn" onclick="calNav(-1)">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <span class="cal-month">${months[month]} ${year}</span>
          <button class="cal-btn" onclick="calNav(1)">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
        <button class="cal-btn" onclick="calToday()" style="width:auto;padding:0 10px;font-size:11px">Today</button>
      </div>
      <table class="calendar-grid">
        <thead><tr>${days.map(d => `<th>${d}</th>`).join('')}</tr></thead>
        <tbody>${cells}</tbody>
      </table>
    </div>
  `;
}

function getEventsForDate(dateStr) {
  return state.projects
    .filter(p => {
      if (!p.start_date) return false;
      const sd = p.start_date.substring(0, 10);
      return sd === dateStr;
    })
    .map(p => {
      const stg = STAGES.find(s => s.key === p.stage);
      const colorMap = { lead: 'gray', proposal: 'blue', sent: 'amber', contract: 'green' };
      return { id: p.id, name: p.name, color: colorMap[p.stage] || 'gray' };
    });
}

function calNav(dir) {
  state.calendarDate.setMonth(state.calendarDate.getMonth() + dir);
  renderCalendar(document.getElementById('content'));
}

function calToday() {
  state.calendarDate = new Date();
  renderCalendar(document.getElementById('content'));
}

// ── Shop Work ──
function renderShopWork(c) {
  const tasks = state.shopwork;

  c.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div class="section-title">Shop Work Queue</div>
      <button class="btn-primary" onclick="addShopWork()">+ Add Task</button>
    </div>
    <div class="card">
      ${tasks.length === 0 ? '<div class="empty-state"><span class="empty-icon">🔧</span>No shop work tasks. Add tasks for the team when installs get moved or cancelled.</div>' : ''}
      ${tasks.map((t, i) => `
        <div class="shopwork-item">
          <div class="shopwork-priority priority-${t.priority || 'low'}"></div>
          <div style="flex:1">
            <div class="shopwork-text">${esc(t.text)}</div>
            <div class="shopwork-assignee">${esc(t.assignee || 'Unassigned')} ${t.project ? '· ' + esc(t.project) : ''}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm" onclick="completeShopWork(${i})">Done</button>
            <button class="btn btn-sm btn-danger" onclick="removeShopWork(${i})">✕</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function addShopWork() {
  const text = prompt('Task description:');
  if (!text) return;
  const assignee = prompt('Assign to (name):') || '';
  const priority = prompt('Priority (high/med/low):') || 'low';
  state.shopwork.push({ text, assignee, priority, project: '', created: new Date().toISOString() });
  save('vi_shopwork', state.shopwork);
  renderShopWork(document.getElementById('content'));
}

function completeShopWork(i) {
  state.shopwork.splice(i, 1);
  save('vi_shopwork', state.shopwork);
  renderShopWork(document.getElementById('content'));
}

function removeShopWork(i) {
  if (!confirm('Remove this task?')) return;
  state.shopwork.splice(i, 1);
  save('vi_shopwork', state.shopwork);
  renderShopWork(document.getElementById('content'));
}

// ── Vendors ──
function renderVendors(c) {
  const vendors = state.vendors;
  const cats = ['Audio', 'Video', 'Lighting', 'LED/Display', 'Control/DSP', 'Infrastructure'];

  c.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <input type="text" class="form-input" placeholder="Search vendors…" id="vendor-search"
        oninput="filterVendors()" style="max-width:260px">
      <button class="btn-primary" onclick="addVendor()">+ Add Vendor</button>
    </div>
    <div class="vendors-grid" id="vendors-grid">
      ${vendors.length === 0 ? '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">👥</span>No vendors yet. Add your vendor contacts to enable auto-generated quote request emails.</div>' : ''}
      ${vendors.map((v, i) => `
        <div class="vendor-card" data-name="${esc((v.company + ' ' + v.rep + ' ' + (v.categories || []).join(' ')).toLowerCase())}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div class="vendor-name">${esc(v.company)}</div>
              <div class="vendor-rep">${esc(v.rep || '')}</div>
            </div>
            <button class="btn btn-sm btn-danger" onclick="removeVendor(${i})" style="flex-shrink:0">✕</button>
          </div>
          ${v.email ? `<div class="vendor-email">${esc(v.email)}</div>` : ''}
          ${v.phone ? `<div style="font-size:12px;color:#8B949E;margin-bottom:6px">${esc(v.phone)}</div>` : ''}
          <div class="vendor-tags">
            ${(v.categories || []).map(cat => `<span class="tag tag-audio">${esc(cat)}</span>`).join('')}
          </div>
          ${v.registration ? '<span class="reg-badge">Registration Discount</span>' : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function addVendor() {
  const company = prompt('Company name:');
  if (!company) return;
  const rep = prompt('Rep / Contact name:') || '';
  const email = prompt('Email:') || '';
  const phone = prompt('Phone:') || '';
  const catStr = prompt('Categories (comma-separated: Audio, Video, Lighting, LED/Display, Control/DSP, Infrastructure):') || '';
  const categories = catStr.split(',').map(s => s.trim()).filter(Boolean);
  const registration = confirm('Registration discount available?');

  state.vendors.push({ company, rep, email, phone, categories, registration });
  save('vi_vendors', state.vendors);
  renderVendors(document.getElementById('content'));
}

function removeVendor(i) {
  if (!confirm(`Remove ${state.vendors[i]?.company}?`)) return;
  state.vendors.splice(i, 1);
  save('vi_vendors', state.vendors);
  renderVendors(document.getElementById('content'));
}

function filterVendors() {
  const q = (document.getElementById('vendor-search')?.value || '').toLowerCase();
  document.querySelectorAll('#vendors-grid .vendor-card').forEach(card => {
    card.style.display = (!q || (card.dataset.name || '').includes(q)) ? '' : 'none';
  });
}

// ── Intake ──
const intakeState = { step: 1, data: {} };

function renderIntake(c) {
  const s = intakeState.step;
  const d = intakeState.data;

  const steps = [
    { num: 1, label: 'Client' },
    { num: 2, label: 'Venue' },
    { num: 3, label: 'Scope' },
    { num: 4, label: 'Details' },
    { num: 5, label: 'Quote' },
    { num: 6, label: 'Notes' }
  ];

  const progress = `
    <div style="display:flex;gap:4px;margin-bottom:24px">
      ${steps.map(st => `
        <div style="flex:1;text-align:center">
          <div style="height:4px;border-radius:2px;background:${st.num <= s ? '#1565C0' : '#1C2333'};margin-bottom:4px"></div>
          <div style="font-size:10px;color:${st.num === s ? '#58A6FF' : '#6E7681'};font-weight:${st.num === s ? '600' : '400'}">${st.label}</div>
        </div>
      `).join('')}
    </div>
  `;

  let content = '';

  if (s === 1) {
    content = `
      <div class="card" style="max-width:560px;margin:0 auto">
        <h3 style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:16px">Client Information</h3>
        <div class="form-group">
          <label class="form-label">Company / Client Name</label>
          <input class="form-input" id="int-client" value="${esc(d.client || '')}" placeholder="Search or type client name…">
        </div>
        <div class="form-group">
          <label class="form-label">Contact Name</label>
          <input class="form-input" id="int-contact" value="${esc(d.contact || '')}" placeholder="Primary contact">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" id="int-email" type="email" value="${esc(d.email || '')}" placeholder="email@example.com">
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-input" id="int-phone" value="${esc(d.phone || '')}" placeholder="(555) 123-4567">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <input class="form-input" id="int-address" value="${esc(d.address || '')}" placeholder="Street address, city, state">
        </div>
      </div>
    `;
  } else if (s === 2) {
    const venues = ['Church / Worship', 'Event Center', 'School', 'Theater', 'Office / Conference', 'Studio / Broadcast'];
    content = `
      <div class="card" style="max-width:560px;margin:0 auto">
        <h3 style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:16px">Venue Type</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${venues.map(v => `
            <div onclick="selectVenue(this, '${v}')"
              class="card card-sm" style="cursor:pointer;text-align:center;border-color:${d.venue === v ? '#1565C0' : '#1C2333'};background:${d.venue === v ? '#0D1626' : '#161B22'}">
              <div style="font-size:13px;font-weight:500;color:${d.venue === v ? '#58A6FF' : '#C9D1D9'}">${v}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (s === 3) {
    const scopes = [
      { key: 'audio', label: 'Audio / PA', tag: 'tag-audio' },
      { key: 'video', label: 'Video / Display', tag: 'tag-video' },
      { key: 'lighting', label: 'Lighting', tag: 'tag-lighting' },
      { key: 'led', label: 'LED Wall', tag: 'tag-led' },
      { key: 'control', label: 'Control System', tag: 'tag-control' },
      { key: 'streaming', label: 'Streaming / Broadcast', tag: 'tag-streaming' },
      { key: 'camera', label: 'Camera System', tag: 'tag-streaming' },
      { key: 'infrastructure', label: 'Infrastructure', tag: 'tag-audio' }
    ];
    const sel = d.scope || [];
    content = `
      <div class="card" style="max-width:560px;margin:0 auto">
        <h3 style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:4px">System Scope</h3>
        <p style="font-size:12px;color:#6E7681;margin-bottom:16px">Select all systems included in this project</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${scopes.map(sc => {
            const active = sel.includes(sc.key);
            return `<div onclick="toggleScope('${sc.key}')"
              class="card card-sm" style="cursor:pointer;display:flex;align-items:center;gap:8px;border-color:${active ? '#1565C0' : '#1C2333'};background:${active ? '#0D1626' : '#161B22'}">
              <div class="checklist-box" style="${active ? 'background:#1565C0;border-color:#1565C0' : ''}">
                ${active ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
              </div>
              <span style="font-size:13px;color:${active ? '#58A6FF' : '#C9D1D9'}">${sc.label}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  } else if (s === 4) {
    content = `
      <div class="card" style="max-width:560px;margin:0 auto">
        <h3 style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:16px">Project Details</h3>
        <div class="form-group">
          <label class="form-label">Use Case / Description</label>
          <textarea class="form-textarea" id="int-usecase" placeholder="Describe how the system will be used…">${esc(d.usecase || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project Type</label>
            <select class="form-select" id="int-type">
              <option value="">Select…</option>
              <option value="new" ${d.type === 'new' ? 'selected' : ''}>New Construction</option>
              <option value="retrofit" ${d.type === 'retrofit' ? 'selected' : ''}>Retrofit / Upgrade</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Timeline</label>
            <select class="form-select" id="int-timeline">
              <option value="">Select…</option>
              <option value="asap" ${d.timeline === 'asap' ? 'selected' : ''}>ASAP</option>
              <option value="1-3months" ${d.timeline === '1-3months' ? 'selected' : ''}>1–3 Months</option>
              <option value="3-6months" ${d.timeline === '3-6months' ? 'selected' : ''}>3–6 Months</option>
              <option value="6plus" ${d.timeline === '6plus' ? 'selected' : ''}>6+ Months</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Budget Range (optional)</label>
          <input class="form-input" id="int-budget" value="${esc(d.budget || '')}" placeholder="e.g. $50,000 – $75,000">
        </div>
        <div class="form-group">
          <label class="form-label">Owner-Furnished Equipment (OFE)</label>
          <textarea class="form-textarea" id="int-ofe" rows="3" placeholder="Any existing equipment client wants to keep/reuse?">${esc(d.ofe || '')}</textarea>
        </div>
      </div>
    `;
  } else if (s === 5) {
    content = `
      <div class="card" style="max-width:560px;margin:0 auto">
        <h3 style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:16px">Quote Structure</h3>
        <div style="display:grid;gap:8px;margin-bottom:16px">
          <div onclick="selectQuoteType('single')" class="card card-sm" style="cursor:pointer;border-color:${d.quoteType === 'single' ? '#1565C0' : '#1C2333'};background:${d.quoteType === 'single' ? '#0D1626' : '#161B22'}">
            <div style="font-size:13px;font-weight:500;color:${d.quoteType === 'single' ? '#58A6FF' : '#C9D1D9'}">Single Quote</div>
            <div style="font-size:11px;color:#6E7681;margin-top:2px">One scope of work, one Jetbuilt project</div>
          </div>
          <div onclick="selectQuoteType('gbb')" class="card card-sm" style="cursor:pointer;border-color:${d.quoteType === 'gbb' ? '#1565C0' : '#1C2333'};background:${d.quoteType === 'gbb' ? '#0D1626' : '#161B22'}">
            <div style="font-size:13px;font-weight:500;color:${d.quoteType === 'gbb' ? '#58A6FF' : '#C9D1D9'}">Good / Better / Best</div>
            <div style="font-size:11px;color:#6E7681;margin-top:2px">Three separate Jetbuilt projects — same systems, different tiers</div>
          </div>
        </div>
        ${d.quoteType === 'gbb' ? `
          <div class="form-group">
            <label class="form-label">Differentiator</label>
            <select class="form-select" id="int-differentiator">
              <option value="">Select what varies between tiers…</option>
              <option value="manufacturer" ${d.differentiator === 'manufacturer' ? 'selected' : ''}>Manufacturer Quality / Tier</option>
              <option value="size" ${d.differentiator === 'size' ? 'selected' : ''}>System Size (Small / Medium / Large)</option>
              <option value="features" ${d.differentiator === 'features' ? 'selected' : ''}>Feature Set (Core / Standard / Full)</option>
              <option value="dotpitch" ${d.differentiator === 'dotpitch' ? 'selected' : ''}>LED Dot Pitch / Resolution</option>
              <option value="custom" ${d.differentiator === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
          </div>
        ` : ''}
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Payment Approach</label>
          <select class="form-select" id="int-payment">
            <option value="prepay" ${(d.payment || 'prepay') === 'prepay' ? 'selected' : ''}>Prepay Discount (90% upfront = 7% off equipment + 2% off labor)</option>
            <option value="standard" ${d.payment === 'standard' ? 'selected' : ''}>Standard (100% equipment upfront, labor on completion)</option>
            <option value="progress" ${d.payment === 'progress' ? 'selected' : ''}>Progress Billing (multi-month project)</option>
          </select>
        </div>
      </div>
    `;
  } else if (s === 6) {
    content = `
      <div class="card" style="max-width:560px;margin:0 auto">
        <h3 style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:16px">Notes & Walkthrough</h3>
        <div class="form-group">
          <label class="form-label">Walkthrough Notes</label>
          <textarea class="form-textarea" id="int-notes" rows="4" placeholder="Observations from the site walkthrough…">${esc(d.notes || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Registration Opportunity</label>
          <select class="form-select" id="int-registration">
            <option value="no" ${(d.registration || 'no') === 'no' ? 'selected' : ''}>No</option>
            <option value="yes" ${d.registration === 'yes' ? 'selected' : ''}>Yes — register with vendors</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Additional Notes</label>
          <textarea class="form-textarea" id="int-addnotes" rows="3" placeholder="Anything else…">${esc(d.addnotes || '')}</textarea>
        </div>
      </div>
    `;
  }

  // Nav buttons
  const nav = `
    <div style="display:flex;justify-content:space-between;max-width:560px;margin:20px auto 0;gap:12px">
      ${s > 1 ? `<button class="btn" onclick="intakeNav(-1)" style="flex:1;max-width:160px">← Back</button>` : '<div></div>'}
      ${s < 6
        ? `<button class="btn-primary" onclick="intakeNav(1)" style="flex:1;max-width:200px;padding:14px 20px;font-size:14px;border-radius:8px">Next →</button>`
        : `<button class="btn-primary" onclick="submitIntake()" style="flex:1;max-width:200px;padding:14px 20px;font-size:14px;border-radius:8px;background:#238636">Generate SOW ✓</button>`
      }
    </div>
  `;

  c.innerHTML = progress + content + nav;
}

function selectVenue(el, venue) {
  intakeState.data.venue = venue;
  renderIntake(document.getElementById('content'));
}

function toggleScope(key) {
  if (!intakeState.data.scope) intakeState.data.scope = [];
  const idx = intakeState.data.scope.indexOf(key);
  if (idx >= 0) intakeState.data.scope.splice(idx, 1);
  else intakeState.data.scope.push(key);
  renderIntake(document.getElementById('content'));
}

function selectQuoteType(type) {
  intakeState.data.quoteType = type;
  renderIntake(document.getElementById('content'));
}

function intakeNav(dir) {
  // Save current step data
  saveIntakeStep();
  intakeState.step = Math.max(1, Math.min(6, intakeState.step + dir));
  renderIntake(document.getElementById('content'));
  document.getElementById('content').scrollTop = 0;
}

function saveIntakeStep() {
  const d = intakeState.data;
  const s = intakeState.step;
  if (s === 1) {
    d.client = document.getElementById('int-client')?.value || '';
    d.contact = document.getElementById('int-contact')?.value || '';
    d.email = document.getElementById('int-email')?.value || '';
    d.phone = document.getElementById('int-phone')?.value || '';
    d.address = document.getElementById('int-address')?.value || '';
  } else if (s === 4) {
    d.usecase = document.getElementById('int-usecase')?.value || '';
    d.type = document.getElementById('int-type')?.value || '';
    d.timeline = document.getElementById('int-timeline')?.value || '';
    d.budget = document.getElementById('int-budget')?.value || '';
    d.ofe = document.getElementById('int-ofe')?.value || '';
  } else if (s === 5) {
    d.differentiator = document.getElementById('int-differentiator')?.value || '';
    d.payment = document.getElementById('int-payment')?.value || 'prepay';
  } else if (s === 6) {
    d.notes = document.getElementById('int-notes')?.value || '';
    d.registration = document.getElementById('int-registration')?.value || 'no';
    d.addnotes = document.getElementById('int-addnotes')?.value || '';
  }
}

function submitIntake() {
  saveIntakeStep();
  const d = intakeState.data;
  if (!d.client) { alert('Please enter a client name.'); return; }

  // Generate SOW
  const sow = generateSOW(d);

  const c = document.getElementById('content');
  c.innerHTML = `
    <div style="max-width:700px;margin:0 auto">
      <div class="alert alert-success">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 8l2 2 3.5-3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Intake complete — SOW generated for <strong>${esc(d.client)}</strong></span>
      </div>

      <div class="section-header" style="margin-top:20px">
        <div class="section-title">Scope of Work Preview</div>
        <button class="btn btn-sm" onclick="copySOW()">Copy to Clipboard</button>
      </div>
      <div class="card" id="sow-output" style="font-size:13px;color:#C9D1D9;line-height:1.7;white-space:pre-wrap">${esc(sow)}</div>

      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn-primary" onclick="startNewIntake()">+ New Intake</button>
        <button class="btn" onclick="navigate('dashboard')">Back to Dashboard</button>
      </div>
    </div>
  `;
}

function startNewIntake() {
  intakeState.step = 1;
  intakeState.data = {};
  navigate('intake');
}

function copySOW() {
  const el = document.getElementById('sow-output');
  if (el) {
    navigator.clipboard.writeText(el.textContent).then(() => {
      alert('SOW copied to clipboard!');
    }).catch(() => {
      // Fallback
      const range = document.createRange();
      range.selectNode(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      alert('SOW copied!');
    });
  }
}

// ── SOW Generator ──
function generateSOW(d) {
  const scopeLabels = {
    audio: 'audio/PA system', video: 'video/display system', lighting: 'stage lighting system',
    led: 'LED video wall', control: 'control system', streaming: 'streaming/broadcast system',
    camera: 'camera system', infrastructure: 'low-voltage infrastructure'
  };
  const scopeList = (d.scope || []).map(k => scopeLabels[k] || k);
  const scopeStr = scopeList.length > 1
    ? scopeList.slice(0, -1).join(', ') + ', and ' + scopeList[scopeList.length - 1]
    : scopeList[0] || 'AVL system';

  const paymentTerms = {
    prepay: `Prepay Option (Default): 90% of project total due upon approval. This includes a 7% discount on equipment and 2% discount on labor. Remaining 10% due upon project completion.\n\nIf declined: 100% of equipment cost due upon approval. Labor billed upon completion.`,
    standard: `100% of equipment cost due upon project approval. Labor billed upon project completion.`,
    progress: `100% of equipment cost due upon project approval. Labor progress-billed monthly based on work completed.`
  };

  return `SCOPE OF WORK
${d.client}
${d.venue || ''} ${d.type === 'new' ? '— New Construction' : d.type === 'retrofit' ? '— Retrofit / Upgrade' : ''}
Prepared by Valiant Integrations

──────────────────────────────────

1. PROJECT DESCRIPTION

Valiant Integrations will provide a complete ${scopeStr} for ${d.client}${d.venue ? ' (' + d.venue + ')' : ''}. ${d.usecase || 'The system will be designed to meet the client\'s operational needs with reliability and ease of use as primary goals.'}

${d.ofe ? 'Owner-Furnished Equipment: ' + d.ofe + '\n' : ''}
2. OBJECTIVES

• Deliver a cohesive, integrated ${scopeStr} designed for the client's specific use case
• Ensure reliability, simplicity of operation, and ease of use for non-technical staff and volunteers
• Design with future growth and expansion in mind

3. PROJECT DELIVERABLES

• Comprehensive assessment and system design
• Professional installation and configuration
• Complete quality assurance and testing
• End-user training and operational documentation

4. INITIAL ASSESSMENT AND DESIGN

Valiant will review the ${d.type === 'new' ? 'construction plans and specifications' : 'existing space and infrastructure'} to develop a system approach tailored to ${d.client}'s needs. This includes site evaluation, system design, equipment specification, and documentation including Vectorworks build sets where applicable.

5. INSTALLATION AND CONFIGURATION

Valiant will mount, cable, terminate, program, label, and configure all system components per the approved design. All work will be performed to industry standards with proper cable management, labeling, and documentation.

6. QUALITY ASSURANCE AND TESTING

Upon completion of installation, Valiant will verify all system operations including signal flow, control integration, and real-world use testing. All systems will be tested under normal operating conditions before handoff.

7. TRAINING AND DOCUMENTATION

Valiant will provide hands-on training for designated staff and volunteers. Operational documentation, system diagrams, and configuration backup files will be provided for ongoing reference.

8. RECOMMENDATION

We recommend moving forward at your earliest convenience to begin the assessment and design process. We are happy to adjust the scope to align with your priorities and budget.

9. PAYMENT TERMS

${paymentTerms[d.payment] || paymentTerms.prepay}

──────────────────────────────────
Valiant Integrations
${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

// ── Jetbuilt API ──
async function fetchJetbuilt(endpoint) {
  try {
    const res = await fetch(`/api/jetbuilt?endpoint=${encodeURIComponent(endpoint)}`);
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
  const content_el = document.getElementById('content');

  if (btn) {
    btn.classList.add('syncing');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M7 2l2-2M7 2l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Syncing…';
  }

  if (content_el && state.projects.length === 0) {
    content_el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#6E7681"><div class="spinner" style="margin:0 auto 12px"></div><div style="font-size:13px">Loading projects from Jetbuilt…</div></div>';
  }

  try {
    let allProjects = [];
    let page = 1;
    let hasMore = true;
    let errorMsg = null;

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
      } catch (pageErr) {
        errorMsg = pageErr.message;
        hasMore = false;
      }
    }

    if (allProjects.length > 0) {
      const projects = allProjects.filter(p => {
        const stage = (p.stage || '').toLowerCase();
        return stage !== 'template';
      });
      // Merge: Jetbuilt data updates, but Valiant-only fields are preserved
      const existingMap = {};
      state.projects.forEach(p => { existingMap[p.id] = p; });

      state.projects = projects.map(p => {
        const enriched = enrichProject(p);
        const existing = existingMap[enriched.id];
        if (existing) {
          // Preserve Valiant-only data that Jetbuilt doesn't hold
          enriched.archived = existing.archived;
        }
        return enriched;
      });

      // Cache to localStorage for instant load next time
      try {
        localStorage.setItem('vi_projects_cache', JSON.stringify(state.projects));
        localStorage.setItem('vi_projects_cache_time', new Date().toISOString());
      } catch(e) { console.warn('Cache write failed:', e); }

      document.getElementById('proj-count').textContent = state.projects.length;
      renderCurrentPage();
      setTimeout(fetchClientNames, 500);
    } else {
      if (content_el) {
        content_el.innerHTML = `<div style="padding:20px;background:#1A0D0D;border:1px solid #DA3633;border-radius:8px;color:#F85149;font-size:13px;margin:20px">
          <div style="font-weight:500;margin-bottom:6px">Sync failed</div>
          <div style="font-size:12px;color:#8B949E">${errorMsg || 'No projects returned. Check API key and network connection.'}</div>
          <button onclick="syncJetbuilt()" class="btn-primary" style="margin-top:12px">Retry</button>
        </div>`;
      }
    }
  } catch (err) {
    if (content_el) {
      content_el.innerHTML = `<div style="padding:20px;background:#1A0D0D;border:1px solid #DA3633;border-radius:8px;color:#F85149;font-size:13px;margin:20px">
        <div style="font-weight:500;margin-bottom:6px">Connection error</div>
        <div style="font-size:12px;color:#8B949E">${err.message}</div>
        <button onclick="syncJetbuilt()" class="btn-primary" style="margin-top:12px">Retry</button>
      </div>`;
    }
  } finally {
    state.syncing = false;
    if (btn) {
      btn.classList.remove('syncing');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M7 2l2-2M7 2l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Sync Jetbuilt';
    }
  }
}

async function fetchClientNames() {
  const clientIds = [...new Set(
    state.projects
      .filter(p => p.client?.id && !clientNameCache[p.client.id])
      .map(p => p.client.id)
  )].slice(0, 50);

  if (clientIds.length === 0) return;

  for (let i = 0; i < clientIds.length; i += 5) {
    const batch = clientIds.slice(i, i + 5);
    await Promise.all(batch.map(async (id) => {
      try {
        const data = await fetchJetbuilt(`/clients/${id}`);
        if (data && (data.company_name || data.name)) {
          clientNameCache[id] = {
            name: data.company_name || data.name,
            email: data.primary_contact_email || '',
            phone: data.primary_contact_phone_number_1 || '',
            contact_name: [data.primary_contact_first_name, data.primary_contact_last_name].filter(Boolean).join(' '),
            address: data.address || '',
            city: data.city || '',
            state: data.state || ''
          };
        }
      } catch (e) {}
    }));
    if (i + 5 < clientIds.length) await new Promise(r => setTimeout(r, 300));
  }

  state.projects.forEach(p => {
    if (p.client?.id && clientNameCache[p.client.id]) {
      const cl = clientNameCache[p.client.id];
      p.client_name = cl.name;
      p.primary_contact_name = cl.contact_name;
      p.primary_contact_email = cl.email;
      p.primary_contact_phone = cl.phone;
      if (!p.address && cl.address) p.address = cl.address;
      if (!p.city && cl.city) p.city = cl.city;
      if (!p.state_abbr && cl.state) p.state_abbr = cl.state;
    }
  });

  // Update cache with enriched client names
  try {
    localStorage.setItem('vi_projects_cache', JSON.stringify(state.projects));
  } catch(e) {}

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
  } catch (e) { console.error('Failed to fetch project detail:', e); }
  return null;
}

// ── Init ──
async function init() {
  const c = document.getElementById('content');
  const sel = document.getElementById('role-select');
  if (sel) sel.value = currentUserRole;

  // Inject mobile bottom nav
  injectBottomNav();

  // Load cached projects from localStorage (Layer 1)
  try {
    const cached = localStorage.getItem('vi_projects_cache');
    if (cached) {
      state.projects = JSON.parse(cached);
      document.getElementById('proj-count').textContent = state.projects.length;
      const cacheTime = localStorage.getItem('vi_projects_cache_time');
      console.log(`Loaded ${state.projects.length} projects from cache (${cacheTime || 'unknown'})`);
    }
  } catch(e) { console.warn('Cache load failed:', e); }

  try {
    renderCurrentPage();
  } catch (e) {
    if (c) c.innerHTML = '<div style="padding:24px;color:#F85149;font-size:12px">Render error: ' + e.message + '</div>';
    return;
  }

  if (state.projects.length === 0) {
    const c2 = document.getElementById('content');
    if (c2) {
      c2.innerHTML = `<div style="padding:24px;text-align:center">
        <div style="color:#8B949E;font-size:13px;margin-bottom:12px">Welcome to Valiant Integrations</div>
        <button onclick="syncJetbuilt()" class="btn-primary" style="padding:10px 24px;font-size:14px">Sync Jetbuilt Projects</button>
        <div style="font-size:11px;color:#6E7681;margin-top:8px">Or use + New Intake to create a project</div>
      </div>`;
    }
  }
}

init();
