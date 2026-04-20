// ── Valiant Integrations App ──
// API calls handled via /api/jetbuilt proxy

// ── State ──
let currentUserRole = localStorage.getItem('vi_role') || 'admin';
let currentUserName = localStorage.getItem('vi_user') || 'Jacob';
const clientNameCache = {};

// ── Dashboard Access Options ──
const DASHBOARD_ACCESS = [
  { key: 'admin', label: 'Admin', desc: 'Full access to everything', color: '#58A6FF' },
  { key: 'sales', label: 'Sales', desc: 'Pipeline, proposals, financials, likely to close', color: '#3FB950' },
  { key: 'design', label: 'Design', desc: 'Design checklists, drawings, purchasing queue', color: '#D29922' },
  { key: 'project_manager', label: 'Project Management', desc: 'Scheduling, tasks, install coordination', color: '#BC8CFF' },
  { key: 'installer', label: 'Install', desc: 'Job view, task checklists, daily field work', color: '#FF7B72' }
];

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
  likelyToClose: JSON.parse(localStorage.getItem('vi_likely') || '{}'),
  columnOrder: JSON.parse(localStorage.getItem('vi_col_order') || '{}'),
  team: JSON.parse(localStorage.getItem('vi_team') || '[]'),
  currentPage: 'dashboard',
  dashboardView: null,
  currentProject: null,
  projectTab: 'overview',
  calendarDate: new Date(),
  calendarView: 'month',
  syncing: false,
  timelineMode: localStorage.getItem('vi_timeline_mode') || 'estimated',
  bookedDates: JSON.parse(localStorage.getItem('vi_booked_dates') || '{}'),
  todos: JSON.parse(localStorage.getItem('vi_todos') || '{}'),
  tasks: JSON.parse(localStorage.getItem('vi_tasks') || '[]'),
  widgetTab: 'todo',
  widgetFilter: 'week',
  widgetCollapsed: false,
  expandedCols: {},
  sidebarOpen: false,
  rightPanel: null,
  messages: JSON.parse(localStorage.getItem('vi_messages') || '[]'),
  lastReadTime: parseInt(localStorage.getItem('vi_last_read') || '0'),
  lastReadByChannel: JSON.parse(localStorage.getItem('vi_last_read_ch') || '{}'),
  activeConversation: null,
  meetings: JSON.parse(localStorage.getItem('vi_meetings') || '[]'),
  noteSections: JSON.parse(localStorage.getItem('vi_note_sections') || '{}'),
  projectDrive: JSON.parse(localStorage.getItem('vi_project_drive') || '{}'),
  projectFiles: JSON.parse(localStorage.getItem('vi_project_files') || '{}')
};

// ── Team Roster ──
if (state.team.length === 0) {
  state.team = [
    { id: 1, name: 'Jacob', access: ['admin','sales','design','project_manager','installer'], primaryRole: 'admin', email: '', phone: '', initials: 'JA', status: 'active' }
  ];
  save('vi_team', state.team);
}

state.team.forEach(m => {
  if (!m.access) {
    m.access = m.role ? [m.role] : ['installer'];
    m.primaryRole = m.role || m.access[0];
    m.status = m.status || 'active';
    delete m.role;
  }
});

function getTeamMember(id) {
  return state.team.find(m => m.id === id);
}

function getTeamByAccess(accessKey) {
  return state.team.filter(m => m.access.includes(accessKey) || m.access.includes('admin'));
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function hasAccess(memberId, accessKey) {
  const m = getTeamMember(memberId);
  if (!m) return false;
  return m.access.includes('admin') || m.access.includes(accessKey);
}

function addTeamMember(name, access, primaryRole, email, phone) {
  const id = state.team.length > 0 ? Math.max(...state.team.map(m => m.id)) + 1 : 1;
  state.team.push({
    id, name, access: access || ['installer'], primaryRole: primaryRole || access[0] || 'installer',
    email: email || '', phone: phone || '', initials: getInitials(name), status: 'pending'
  });
  save('vi_team', state.team);
}

function removeTeamMember(id) {
  const member = getTeamMember(id);
  if (member && member.name === currentUserName) {
    alert('Cannot remove the currently active user. Switch to another user first.');
    return;
  }
  state.team = state.team.filter(m => m.id !== id);
  save('vi_team', state.team);
}

function switchUser(memberId) {
  const member = getTeamMember(memberId);
  if (!member) return;
  currentUserName = member.name;
  currentUserRole = member.primaryRole || member.access[0] || 'installer';
  localStorage.setItem('vi_user', member.name);
  localStorage.setItem('vi_role', currentUserRole);
  localStorage.setItem('vi_active_member', memberId);

  const userAvatar = document.querySelector('.user-avatar');
  const userName = document.querySelector('.user-name');
  const userRole = document.querySelector('.user-role');
  if (userAvatar) userAvatar.textContent = member.initials || getInitials(member.name);
  if (userName) userName.textContent = member.name;
  if (userRole) {
    const da = DASHBOARD_ACCESS.find(r => r.key === currentUserRole);
    userRole.textContent = da?.label || currentUserRole;
  }

  const sel = document.getElementById('role-select');
  if (sel) sel.value = memberId;

  state.dashboardView = member.primaryRole || member.access[0];

  renderCurrentPage();
}

function getActiveTeamMemberId() {
  return parseInt(localStorage.getItem('vi_active_member')) || state.team[0]?.id || 1;
}

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
const contractReviewed = JSON.parse(localStorage.getItem('vi_contract_reviewed') || '{}');

function isContractNeedsReview(project) {
  return project.stage === 'contract' && !contractReviewed[project.id];
}

function markContractReviewed(projectId) {
  contractReviewed[projectId] = new Date().toISOString();
  localStorage.setItem('vi_contract_reviewed', JSON.stringify(contractReviewed));
  renderCurrentPage();
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
    },
    control: {
      name: 'Control System Design',
      items: [
        'Control platform selected (Q-SYS / Crestron / AMX / Extron / simple relay)',
        'Platform selection justified by budget, complexity, and client needs',
        'Core/processor selected and rack location determined',
        'I/O requirements defined (inputs, outputs, GPIO, serial, network)',
        'Block diagram created showing all connected devices',
        'Network topology designed (separate VLAN for AV control if required)',
        'Dante / AVB networking designed if applicable',
        'UCI/touchpanel layout designed and reviewed with client',
        'Physical touchpanel locations determined and mounting method specified',
        'Third-party device control verified (serial, IP, IR, relay)',
        'Scheduling and automation logic defined (room combining, presets)',
        'Programming scope documented (scenes, presets, macros)',
        'Cable schedule completed for control wiring',
        'Power and UPS requirements confirmed',
        'IT coordination required — document IP addresses, VLANs, firewall rules',
        'Shop work identified (rack pre-build, initial programming at shop)'
      ]
    },
    streaming: {
      name: 'Streaming / Broadcast Design',
      items: [
        'Streaming platform determined (YouTube Live, Vimeo, Facebook, custom RTMP)',
        'Encoder hardware or software selected (Tricaster, vMix, OBS, hardware encoder)',
        'Encoder location determined and network path planned',
        'Bitrate, resolution, and latency requirements confirmed with client',
        'Multiview layout designed (program, preview, return feeds)',
        'NDI / SDI / HDMI signal routing diagram created',
        'Upstream internet connection speed verified (upload bandwidth)',
        'Dedicated streaming VLAN or network path specified',
        'Redundancy plan documented (backup encoder, backup stream key)',
        'Graphics and lower thirds workflow defined',
        'Recording workflow defined (local NAS, cloud, portable drive)',
        'Replay/highlight capability required — specify solution',
        'Intercom / IFB system for talent required — specify',
        'Cable schedule completed for video and data runs',
        'Shop work identified (encoder pre-build, initial config)'
      ]
    },
    camera: {
      name: 'Camera System Design',
      items: [
        'Camera positions determined and documented on floor plan',
        'Camera type specified per position (PTZ, manned, jib, POV)',
        'PTZ camera model selected and justified per position requirements',
        'Cable runs designed per camera position (SDI, HDMI, or NDI/IP)',
        'PTZ control protocol selected (VISCA over IP, VISCA over serial, NDI)',
        'Camera control device specified (joystick, software, control panel)',
        'Video switcher/router integration designed',
        'Return video feed to camera operators designed',
        'Lens requirements specified (telephoto, wide, standard) per position',
        'Lighting levels at camera positions verified — cameras need minimum foot-candles',
        'Tally system designed (active tally lights for talent awareness)',
        'Shot preset count defined per PTZ camera',
        'Power over Ethernet (PoE) or local power specified per camera',
        'Cable schedule completed',
        'Shop work identified'
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
    },
    control: {
      name: 'Control System Install',
      items: [
        'Core/processor rack-mounted and powered',
        'All I/O connections wired and labeled per block diagram',
        'Network switch configured — VLANs, IP reservations, firewall rules applied',
        'Dante / AVB network configured and verified if applicable',
        'All controlled devices verified on network or serial connection',
        'Third-party device control tested (each device responds to commands)',
        'Touchpanel(s) mounted and powered',
        'Touchpanel connected to core and project loaded',
        'All UCI pages functional — buttons trigger correct actions',
        'Room combining logic tested (all combine / split scenarios)',
        'Presets and scenes programmed and verified',
        'Scheduling / automation tested',
        'Volume controls verified across all zones',
        'Source routing tested — all sources to all displays/zones',
        'Backup project file saved to Google Drive',
        'Client walkthrough completed — staff can operate independently'
      ]
    },
    streaming: {
      name: 'Streaming / Broadcast Install',
      items: [
        'Encoder hardware racked and powered',
        'All video inputs connected and verified in encoder software',
        'Audio inputs connected and levels set',
        'Multiview output configured and displaying correctly',
        'Stream keys entered and RTMP destinations configured',
        'Test stream pushed — verified on destination platform',
        'Upload bandwidth confirmed adequate for configured bitrate',
        'Recording workflow tested — files saving to correct location',
        'Redundant stream path tested if specified',
        'Graphics system connected and integrated',
        'Lower thirds workflow verified with operator',
        'Replay system configured and tested if applicable',
        'Intercom / IFB system functional if specified',
        'All cable runs labeled and dressed',
        'Backup encoder config file saved',
        'Operator training completed — staff can run show independently'
      ]
    },
    camera: {
      name: 'Camera System Install',
      items: [
        'All camera mounting hardware installed at specified positions',
        'Cameras mounted and physically aimed at primary position',
        'All cable runs pulled, terminated, and labeled',
        'SDI / HDMI / NDI signal verified at switcher for each camera',
        'PTZ cameras connected to control network and responding to commands',
        'IP addresses assigned and documented for all PTZ cameras',
        'Shot presets programmed per camera (minimum 3 per PTZ)',
        'Joystick / control panel calibrated and all cameras reachable',
        'Tally system wired and functional (cameras show red when live)',
        'Return video feed verified at camera operator positions',
        'All cameras color-balanced and exposure matched',
        'Switcher integrated — all cameras available as selectable sources',
        'Recording / streaming path tested with all cameras',
        'PoE switch confirmed powering all cameras at full load',
        'Backup PTZ preset file saved per camera',
        'Operator training completed — basic PTZ operation and shot calling'
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
  if (t.includes('control') || t.includes('qsys') || t.includes('q-sys') || t.includes('crestron') || t.includes('extron') || t.includes('amx') || t.includes('automation')) systems.push('control');
  if (t.includes('stream') || t.includes('broadcast') || t.includes('encoder') || t.includes('vmix') || t.includes('tricaster') || t.includes('switcher') || t.includes('video produc')) systems.push('streaming');
  if (t.includes('camera') || t.includes('ptz') || t.includes('cam ') || t.includes('video camera') || t.includes('imag')) systems.push('camera');
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
    led_wall:   ['LED Wall',   'tag-led'],
    pa_install: ['Audio/PA',   'tag-audio'],
    lighting:   ['Lighting',   'tag-lighting'],
    control:    ['Control',    'tag-control'],
    streaming:  ['Streaming',  'tag-streaming'],
    video:      ['Video',      'tag-video'],
    camera:     ['Camera',     'tag-camera']
  };
  const [label, cls] = map[sys] || [sys, 'tag-audio'];
  return `<span class="tag ${cls}">${label}</span>`;
}

function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Timeline Helpers (Estimated vs. Booked) ──
function getProjectDates(project) {
  if (state.timelineMode === 'booked') {
    const booked = state.bookedDates[project.id];
    if (booked?.start) return { start: booked.start, end: booked.end || null, source: 'booked' };
  }
  return { start: project.start_date || null, end: project.end_date || null, source: 'estimated' };
}

function setBookedDates(projectId, start, end) {
  if (!start) {
    delete state.bookedDates[projectId];
  } else {
    state.bookedDates[projectId] = { start, end: end || '' };
  }
  save('vi_booked_dates', state.bookedDates);
}

function toggleTimelineMode() {
  state.timelineMode = state.timelineMode === 'estimated' ? 'booked' : 'estimated';
  localStorage.setItem('vi_timeline_mode', state.timelineMode);
  renderCurrentPage();
}

function hasBookedDates(projectId) {
  return !!(state.bookedDates[projectId]?.start);
}

function fmtDateRange(start, end) {
  if (!start) return '—';
  const s = shortDate(start);
  const e = end ? shortDate(end) : null;
  return e ? `${s} – ${e}` : s;
}

function getBookedTimeline(projectId) {
  const b = state.bookedDates[projectId];
  return (b && b.start) ? b : null;
}

function getInstallDateDisplay(project) {
  const booked = getBookedTimeline(project.id);
  if (state.timelineMode === 'booked') {
    if (booked) {
      const end = booked.end && booked.end !== booked.start ? ' – ' + shortDate(booked.end) : '';
      return { label: 'Booked', value: shortDate(booked.start) + end, color: '#3FB950' };
    }
    if (project.start_date) {
      return { label: 'Est.', value: shortDate(project.start_date), color: '#6E7681' };
    }
    return { label: 'Booked', value: 'Not set', color: '#6E7681' };
  }
  if (project.start_date) {
    const end = project.end_date ? ' – ' + shortDate(project.end_date) : '';
    return { label: 'Est.', value: shortDate(project.start_date) + end, color: '#8B949E' };
  }
  return { label: 'Est.', value: 'Not set', color: '#6E7681' };
}

function showSetBookedDatesDialog(projectId) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  const existing = getBookedTimeline(projectId);

  let dialog = document.getElementById('booked-dates-dialog');
  if (dialog) dialog.remove();
  dialog = document.createElement('div');
  dialog.id = 'booked-dates-dialog';
  dialog.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:120;display:flex;align-items:center;justify-content:center;padding:20px';

  dialog.innerHTML = `
    <div style="background:#161B22;border:1px solid #30363D;border-radius:12px;padding:20px;max-width:380px;width:100%">
      <div style="font-size:15px;font-weight:600;color:#E6EDF3;margin-bottom:4px">Set Booked Install Dates</div>
      <div style="font-size:12px;color:#6E7681;margin-bottom:16px">${esc(p.name)}</div>

      ${p.start_date ? `<div style="font-size:11px;color:#6E7681;margin-bottom:12px;padding:8px 10px;background:#0D1117;border-radius:6px">
        <span style="color:#8B949E">Jetbuilt estimated:</span> ${fmtDate(p.start_date)}${p.end_date ? ' – ' + fmtDate(p.end_date) : ''}
      </div>` : ''}

      <div class="form-group">
        <label class="form-label">Booked Start Date</label>
        <input class="form-input" type="date" id="booked-start" value="${existing?.start || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Booked End Date <span style="color:#6E7681;font-weight:400">(optional)</span></label>
        <input class="form-input" type="date" id="booked-end" value="${existing?.end || ''}">
      </div>

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-primary" onclick="saveBookedDatesDialog(${projectId})" style="flex:1;padding:11px">Save</button>
        ${existing ? `<button class="btn btn-danger" onclick="setBookedDates(${projectId},'','');document.getElementById('booked-dates-dialog')?.remove();renderCurrentPage()">Clear</button>` : ''}
        <button class="btn" onclick="document.getElementById('booked-dates-dialog')?.remove()">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove(); });
}

function saveBookedDatesDialog(projectId) {
  const start = document.getElementById('booked-start')?.value;
  const end = document.getElementById('booked-end')?.value || '';
  if (!start) { alert('Please set a start date.'); return; }
  setBookedDates(projectId, start, end);
  document.getElementById('booked-dates-dialog')?.remove();
  renderCurrentPage();
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
    client: p.client || { id: p.client_id },
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
    zip: p.zip || p.postal_code || '',
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

// ── Archive System ──
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

// ── Likely to Close ──
function isLikelyToClose(projectId) {
  return !!state.likelyToClose[projectId];
}

function toggleLikelyToClose(projectId) {
  if (state.likelyToClose[projectId]) {
    delete state.likelyToClose[projectId];
  } else {
    state.likelyToClose[projectId] = new Date().toISOString();
  }
  save('vi_likely', state.likelyToClose);
  renderCurrentPage();
}

function getLikelyToCloseTotal() {
  const projects = state.projects.filter(p => !p.archived && isLikelyToClose(p.id));
  return getPipelineValue(projects);
}

// ── Column Ordering ──
function getColumnOrder(stage) {
  return state.columnOrder[stage] || [];
}

function setColumnOrder(stage, orderedIds) {
  state.columnOrder[stage] = orderedIds;
  save('vi_col_order', state.columnOrder);
}

function sortByColumnOrder(projects, stage) {
  const order = getColumnOrder(stage);
  const likely = [];
  const ordered = [];
  const rest = [];

  projects.forEach(p => {
    if (isLikelyToClose(p.id)) {
      likely.push(p);
    } else if (order.includes(p.id)) {
      ordered.push(p);
    } else {
      rest.push(p);
    }
  });

  likely.sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai >= 0 && bi >= 0) return ai - bi;
    return 0;
  });

  ordered.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  return [...likely, ...ordered, ...rest];
}

function onReorderDragStart(e, projectId, stage) {
  e.dataTransfer.setData('text/plain', projectId);
  e.dataTransfer.setData('reorder-stage', stage);
  e.target.style.opacity = '0.4';
}

function onReorderDrop(e, targetId, stage) {
  e.preventDefault();
  e.stopPropagation();
  const sourceId = parseInt(e.dataTransfer.getData('text/plain'));
  const reorderStage = e.dataTransfer.getData('reorder-stage');

  if (!sourceId) return;

  if (reorderStage !== stage) {
    moveProjectToStage(sourceId, stage);
    return;
  }

  if (sourceId === targetId) return;

  const stageProjects = state.projects.filter(p => !p.archived && p.stage === stage);
  const sorted = sortByColumnOrder(stageProjects, stage);
  const ids = sorted.map(p => p.id);

  const fromIdx = ids.indexOf(sourceId);
  if (fromIdx >= 0) ids.splice(fromIdx, 1);
  const toIdx = ids.indexOf(targetId);
  if (toIdx >= 0) ids.splice(toIdx, 0, sourceId);
  else ids.push(sourceId);

  setColumnOrder(stage, ids);
  renderCurrentPage();
}

// ── GBB ──
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
        <button class="btn btn-danger" onclick="unlinkGBB(${projectId});document.getElementById('gbb-dialog')?.remove();renderCurrentPage()">Unlink Group</button>
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
  renderCurrentPage();
}

function getPipelineValue(projects) {
  let total = 0;
  const counted = new Set();
  projects.forEach(p => {
    if (counted.has(p.id)) return;
    const group = getGBBGroup(p.id);
    if (group) {
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

function getDashboardTitle() {
  const view = state.dashboardView || currentUserRole;
  const roleLabels = {
    admin: 'Admin Dashboard',
    sales: 'Sales Dashboard',
    design: 'Design Dashboard',
    project_manager: 'Project Management Dashboard',
    installer: 'Install Dashboard'
  };
  return `${currentUserName}\u2019s ${roleLabels[view] || 'Dashboard'}`;
}

function switchDashboardView(view) {
  state.dashboardView = view;
  renderDashboard(document.getElementById('content'));
}

// ── Drag & Drop ──
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
  if (p.archived) {
    delete state.archived[projectId];
    save('vi_archived', state.archived);
    p.archived = null;
  }
  p.stage = newStage;
  try { localStorage.setItem('vi_projects_cache', JSON.stringify(state.projects)); } catch(e) {}
  renderCurrentPage();
}

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

  const likely = isLikelyToClose(projectId);
  menu.innerHTML = `
    <div onclick="toggleLikelyToClose(${projectId});document.getElementById('move-menu')?.remove()" style="padding:14px 20px;color:${likely ? '#6E7681' : '#3FB950'};font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;background:${likely ? 'transparent' : '#0D1A0E'};-webkit-tap-highlight-color:transparent">
      ${likely ? '⊘ Remove Likely to Close' : '★ Mark Likely to Close'}
    </div>
    <div style="border-top:1px solid #30363D;margin:4px 0"></div>
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

// ── Bottom Nav (mobile) ──
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
    <div onclick="navigate('team');document.getElementById('more-menu')?.remove()" style="padding:14px 20px;color:#C9D1D9;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;-webkit-tap-highlight-color:transparent">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="7" r="3.5"/><circle cx="17" cy="7" r="2.5"/><path d="M2 20c0-3.866 3.134-6 7-6s7 2.134 7 6"/><path d="M17 14c2.761 0 5 1.567 5 4"/></svg>
      Team
    </div>
    <div style="border-top:1px solid #30363D;margin:4px 0"></div>
    <div onclick="syncJetbuilt();document.getElementById('more-menu')?.remove()" style="padding:14px 20px;color:#58A6FF;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;-webkit-tap-highlight-color:transparent">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12A8 8 0 1 1 12 4"/><path d="M12 4l3-3M12 4l3 3"/></svg>
      Sync Jetbuilt
    </div>
  `;
  document.body.appendChild(menu);
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
  state.currentProject = null;
  document.getElementById('more-menu')?.remove();
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('#bottom-nav .bnav-item').forEach(el => {
    const p = el.dataset.page;
    el.classList.toggle('active', p === page || (page === 'dashboard' && p === 'dashboard'));
  });
  const titles = {
    dashboard: 'Dashboard', calendar: 'Calendar', projects: 'Projects',
    shopwork: 'Shop Work', vendors: 'Vendors', intake: 'New Intake', team: 'Team'
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
      case 'team': renderTeam(c); break;
      case 'project': renderProjectPage(c); break;
      default: renderDashboard(c);
    }
  } catch (e) {
    c.innerHTML = `<div class="alert alert-error">Render error: ${e.message}</div>`;
    console.error(e);
  }
  updateRightPanel();
}

// ── Project Page Navigation ──
// v1.16: project detail is a full page, not a modal
function openProject(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  state.currentProject = p;
  state.projectTab = getDefaultProjectTab();
  state.currentPage = 'project';
  // Clear active highlighting on nav (project is not in nav)
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#bottom-nav .bnav-item').forEach(el => el.classList.remove('active'));
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = p.name;
  renderCurrentPage();
  const c = document.getElementById('content');
  if (c) c.scrollTop = 0;
}

function getDefaultProjectTab() {
  const view = state.dashboardView || currentUserRole;
  if (view === 'design') return 'design';
  if (view === 'installer' || view === 'project_manager') return 'install';
  return 'overview';
}

function closeProjectPage() {
  state.currentProject = null;
  navigate('dashboard');
}

function switchProjectTab(tab) {
  state.projectTab = tab;
  renderProjectPage(document.getElementById('content'));
}

// ── To-Do List (per-role) ──
function getTodos(role) {
  return (state.todos[role] || []);
}

function addTodo(text) {
  const role = state.dashboardView || currentUserRole;
  if (!state.todos[role]) state.todos[role] = [];
  state.todos[role].unshift({ id: Date.now(), text, done: false, doneAt: null });
  save('vi_todos', state.todos);
  renderCurrentPage();
}

function toggleTodo(id) {
  const role = state.dashboardView || currentUserRole;
  const item = (state.todos[role] || []).find(t => t.id === id);
  if (!item) return;
  item.done = !item.done;
  item.doneAt = item.done ? new Date().toISOString() : null;
  save('vi_todos', state.todos);
  renderCurrentPage();
}

function deleteTodo(id) {
  const role = state.dashboardView || currentUserRole;
  state.todos[role] = (state.todos[role] || []).filter(t => t.id !== id);
  save('vi_todos', state.todos);
  renderCurrentPage();
}

function clearCompletedTodos() {
  const role = state.dashboardView || currentUserRole;
  state.todos[role] = (state.todos[role] || []).filter(t => !t.done);
  save('vi_todos', state.todos);
  renderCurrentPage();
}

// ── Tasks ──
function getTaskUrgency(dueDate) {
  if (!dueDate) return { label: '', color: '#6E7681', bg: 'transparent', border: '#1C2333' };
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(dueDate); due.setHours(0,0,0,0);
  const diff = Math.round((due - now) / 86400000);
  if (diff < 0)  return { label: 'Overdue',   color: '#F85149', bg: '#1A0D0D', border: '#DA363344' };
  if (diff === 0) return { label: 'Today',    color: '#D29922', bg: '#1A130D', border: '#9E6A0344' };
  if (diff <= 3)  return { label: `${diff}d`,  color: '#58A6FF', bg: '#0D1626', border: '#1565C044' };
  if (diff <= 7)  return { label: `${diff}d`,  color: '#8B949E', bg: '#0D1117', border: '#1C2333' };
  return              { label: fmtDate(dueDate), color: '#6E7681', bg: '#0D1117', border: '#1C2333' };
}

function addTask(text, dueDate, projectId) {
  const activeMemberId = getActiveTeamMemberId();
  state.tasks.push({
    id: Date.now(),
    text,
    dueDate: dueDate || '',
    projectId: projectId || null,
    memberId: activeMemberId,
    done: false,
    doneAt: null
  });
  state.tasks.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  save('vi_tasks', state.tasks);
  renderCurrentPage();
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  task.doneAt = task.done ? new Date().toISOString() : null;
  save('vi_tasks', state.tasks);
  renderCurrentPage();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  save('vi_tasks', state.tasks);
  renderCurrentPage();
}

// ── Project Assignments ──
function getProjectAssignment(projectId) {
  return state.assignments[projectId] || { design: [], install: [] };
}

function isAssignedTo(projectId, phase, memberId) {
  const a = getProjectAssignment(projectId);
  return (a[phase] || []).includes(memberId);
}

function toggleProjectAssignment(projectId, phase, memberId) {
  if (!state.assignments[projectId]) state.assignments[projectId] = { design: [], install: [] };
  const list = state.assignments[projectId][phase] || [];
  const idx = list.indexOf(memberId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(memberId);
  state.assignments[projectId][phase] = list;
  save('vi_assignments', state.assignments);
  if (state.currentPage === 'project' && state.currentProject?.id === projectId) {
    renderCurrentPage();
  }
}

function getDerivedTasks(role) {
  const derived = [];
  const activeProjects = state.projects.filter(p => !p.archived);
  const memberId = getActiveTeamMemberId();

  if (role === 'design' || role === 'admin') {
    activeProjects.forEach(p => {
      if (!['proposal','sent','contract'].includes(p.stage)) return;
      if (role !== 'admin' && !isAssignedTo(p.id, 'design', memberId)) return;
      p.systems.forEach(sys => {
        const template = TEMPLATES.design[sys];
        if (!template) return;
        const checkKey = `${p.id}_design_${sys}`;
        const checks = state.checklists[checkKey] || {};
        const incomplete = template.items.filter((_, i) => !checks[i]);
        if (incomplete.length > 0) {
          derived.push({
            id: `derived_design_${p.id}_${sys}`,
            text: `${template.name}: ${incomplete.length} item${incomplete.length !== 1 ? 's' : ''} remaining`,
            projectId: p.id,
            projectName: p.name,
            dueDate: p.start_date || '',
            source: 'design',
            done: false
          });
        }
      });
    });
  }

  if (role === 'installer' || role === 'project_manager' || role === 'admin') {
    activeProjects.filter(p => p.stage === 'contract').forEach(p => {
      if (role !== 'admin' && !isAssignedTo(p.id, 'install', memberId)) return;
      p.systems.forEach(sys => {
        const template = TEMPLATES.install[sys];
        if (!template) return;
        const checkKey = `${p.id}_install_${sys}`;
        const checks = state.checklists[checkKey] || {};
        const incomplete = template.items.filter((_, i) => !checks[i]);
        if (incomplete.length > 0) {
          derived.push({
            id: `derived_install_${p.id}_${sys}`,
            text: `${template.name}: ${incomplete.length} item${incomplete.length !== 1 ? 's' : ''} remaining`,
            projectId: p.id,
            projectName: p.name,
            dueDate: p.start_date || '',
            source: 'install',
            done: false
          });
        }
      });
    });
  }

  return derived;
}

function showAddTaskDialog() {
  let d = document.getElementById('add-task-dialog');
  if (d) { d.remove(); return; }
  d = document.createElement('div');
  d.id = 'add-task-dialog';
  d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:120;display:flex;align-items:center;justify-content:center;padding:20px';

  const projectOptions = state.projects
    .filter(p => !p.archived)
    .map(p => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join('');

  d.innerHTML = `
    <div style="background:#161B22;border:1px solid #30363D;border-radius:12px;padding:20px;max-width:380px;width:100%">
      <div style="font-size:15px;font-weight:600;color:#E6EDF3;margin-bottom:16px">Add Task</div>
      <div class="form-group">
        <label class="form-label">Task</label>
        <input class="form-input" id="new-task-text" placeholder="What needs to get done?" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input class="form-input" type="date" id="new-task-date">
        </div>
        <div class="form-group">
          <label class="form-label">Project <span style="color:#6E7681;font-weight:400">(optional)</span></label>
          <select class="form-select" id="new-task-project">
            <option value="">None</option>
            ${projectOptions}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn-primary" onclick="submitAddTask()" style="flex:1;padding:11px">Add Task</button>
        <button class="btn" onclick="document.getElementById('add-task-dialog')?.remove()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(d);
  d.addEventListener('click', e => { if (e.target === d) d.remove(); });
  document.getElementById('new-task-text')?.focus();

  document.getElementById('new-task-text')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitAddTask();
  });
}

function switchWidgetTab(tab) {
  state.widgetTab = tab;
  renderCurrentPage();
}

function switchWidgetFilter(filter) {
  state.widgetFilter = filter;
  renderCurrentPage();
}

function toggleWidgetCollapsed() {
  state.widgetCollapsed = !state.widgetCollapsed;
  renderCurrentPage();
}

function toggleColExpanded(stage) {
  state.expandedCols[stage] = !state.expandedCols[stage];
  renderCurrentPage();
}

function submitAddTask() {
  const text = document.getElementById('new-task-text')?.value?.trim();
  const dueDate = document.getElementById('new-task-date')?.value || '';
  const projectId = parseInt(document.getElementById('new-task-project')?.value) || null;
  if (!text) { document.getElementById('new-task-text')?.focus(); return; }
  addTask(text, dueDate, projectId);
  document.getElementById('add-task-dialog')?.remove();
}
// ── Dashboard Widgets ──
function renderTodoWidget(role) {
  const all = getTodos(role);
  const active = all.filter(t => !t.done);
  const done = all.filter(t => t.done);
  const showAll = state._todoExpanded;
  const visible = showAll ? active : active.slice(0, 5);
  const hidden = active.length - 5;

  const roleLabel = DASHBOARD_ACCESS.find(d => d.key === role)?.label || role;
  const roleColor = DASHBOARD_ACCESS.find(d => d.key === role)?.color || '#8B949E';

  return `
    <div class="dashboard-card" style="height:100%">
      <div class="dashboard-card-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span>To-Do <span style="font-size:10px;font-weight:400;color:${roleColor};padding:1px 6px;border-radius:3px;background:${roleColor}18;margin-left:4px">${roleLabel}</span></span>
        ${active.length > 0 ? `<span style="font-size:11px;color:#6E7681;font-weight:400">${active.length} open</span>` : ''}
      </div>

      <div style="display:flex;gap:6px;margin-bottom:10px">
        <input class="form-input" id="todo-input-${role}" placeholder="Add item…"
          style="flex:1;padding:8px 10px;font-size:13px"
          onkeydown="if(event.key==='Enter'){const v=this.value.trim();if(v){addTodo(v);this.value=''}}">
        <button class="btn-primary" style="padding:8px 12px;font-size:13px;flex-shrink:0"
          onclick="const v=document.getElementById('todo-input-${role}')?.value?.trim();if(v){addTodo(v);document.getElementById('todo-input-${role}').value=''}">+</button>
      </div>

      ${active.length === 0 && done.length === 0 ? `
        <div style="text-align:center;padding:16px 0;color:#6E7681;font-size:12px">No items — add one above</div>
      ` : ''}

      <div style="display:flex;flex-direction:column;gap:2px">
        ${visible.map(t => `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 6px;border-radius:6px;background:#0D1117;border:1px solid #1C2333;margin-bottom:2px">
            <div onclick="toggleTodo(${t.id})" style="width:16px;height:16px;border-radius:4px;border:1.5px solid #30363D;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent"></div>
            <span style="flex:1;font-size:13px;color:#C9D1D9;line-height:1.3">${esc(t.text)}</span>
            <button onclick="deleteTodo(${t.id})" style="background:none;border:none;color:#6E7681;cursor:pointer;padding:2px 4px;font-size:14px;line-height:1;-webkit-tap-highlight-color:transparent" title="Remove">×</button>
          </div>
        `).join('')}
      </div>

      ${!showAll && hidden > 0 ? `
        <div onclick="state._todoExpanded=true;renderCurrentPage()" style="font-size:11px;color:#58A6FF;cursor:pointer;padding:6px 0;text-align:center;-webkit-tap-highlight-color:transparent">
          +${hidden} more
        </div>
      ` : showAll && active.length > 5 ? `
        <div onclick="state._todoExpanded=false;renderCurrentPage()" style="font-size:11px;color:#6E7681;cursor:pointer;padding:6px 0;text-align:center">
          Show less
        </div>
      ` : ''}

      ${done.length > 0 ? `
        <details style="margin-top:8px">
          <summary style="font-size:11px;color:#6E7681;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;-webkit-tap-highlight-color:transparent">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            ${done.length} completed
            <span onclick="event.preventDefault();event.stopPropagation();clearCompletedTodos()" style="color:#F85149;margin-left:auto;font-size:10px">Clear all</span>
          </summary>
          <div style="margin-top:6px;display:flex;flex-direction:column;gap:2px">
            ${done.slice(0, 8).map(t => `
              <div style="display:flex;align-items:center;gap:8px;padding:6px;border-radius:6px;opacity:0.5">
                <div onclick="toggleTodo(${t.id})" style="width:16px;height:16px;border-radius:4px;border:1.5px solid #3FB950;background:#3FB95022;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="#3FB950" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <span style="flex:1;font-size:12px;color:#6E7681;text-decoration:line-through">${esc(t.text)}</span>
                <button onclick="deleteTodo(${t.id})" style="background:none;border:none;color:#6E7681;cursor:pointer;padding:2px 4px;font-size:14px">×</button>
              </div>
            `).join('')}
          </div>
        </details>
      ` : ''}
    </div>
  `;
}

function renderTasksWidget(role) {
  const memberId = getActiveTeamMemberId();
  const filter = state.widgetFilter;

  const now = new Date(); now.setHours(0,0,0,0);
  const weekOut = new Date(now); weekOut.setDate(weekOut.getDate() + 7);

  function isThisWeek(dueDate) {
    if (!dueDate) return false;
    const d = new Date(dueDate); d.setHours(0,0,0,0);
    return d <= weekOut;
  }

  const allManual = state.tasks.filter(t => t.memberId === memberId && !t.done);
  const completedTasks = state.tasks.filter(t => t.memberId === memberId && t.done);
  const derived = getDerivedTasks(role);

  const manualFiltered = filter === 'week'
    ? allManual.filter(t => !t.dueDate || isThisWeek(t.dueDate))
    : allManual;

  const manualSorted = [...manualFiltered].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  const allActive = [...derived, ...manualSorted];
  const hiddenCount = filter === 'week' ? allManual.filter(t => t.dueDate && !isThisWeek(t.dueDate)).length : 0;

  return `
    <div class="dashboard-card" style="height:100%">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="dashboard-card-title" style="margin-bottom:0">Tasks</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="display:flex;background:#0D1117;border:1px solid #30363D;border-radius:5px;overflow:hidden;font-size:11px">
            <div onclick="switchWidgetFilter('week')" style="padding:4px 10px;cursor:pointer;-webkit-tap-highlight-color:transparent;${filter === 'week' ? 'background:#1565C0;color:#58A6FF;font-weight:500' : 'color:#6E7681'}">This Week</div>
            <div onclick="switchWidgetFilter('all')" style="padding:4px 10px;cursor:pointer;-webkit-tap-highlight-color:transparent;${filter === 'all' ? 'background:#1565C0;color:#58A6FF;font-weight:500' : 'color:#6E7681'}">All</div>
          </div>
          <button class="btn btn-sm" onclick="showAddTaskDialog()" style="font-size:11px;padding:4px 10px">+ Add</button>
        </div>
      </div>

      ${allActive.length === 0 ? `
        <div style="text-align:center;padding:16px 0;color:#6E7681;font-size:12px">
          ${filter === 'week' ? 'No tasks due this week' : 'No tasks yet'}
        </div>
      ` : ''}

      <div style="display:flex;flex-direction:column;gap:4px;max-height:320px;overflow-y:auto;padding-right:2px">
        ${allActive.map(t => {
          const urgency = getTaskUrgency(t.dueDate);
          const proj = t.projectId ? state.projects.find(p => p.id === t.projectId) : null;
          const isDerived = !!t.source;

          return `
            <div style="display:flex;align-items:flex-start;gap:8px;padding:9px 10px;border-radius:8px;background:${urgency.bg};border:1px solid ${urgency.border};cursor:${isDerived ? 'pointer' : 'default'}"
              ${isDerived ? `onclick="openProject(${t.projectId})"` : ''}>
              ${!isDerived ? `
                <div onclick="event.stopPropagation();toggleTask(${t.id})" style="width:16px;height:16px;border-radius:4px;border:1.5px solid #30363D;cursor:pointer;flex-shrink:0;margin-top:1px;-webkit-tap-highlight-color:transparent"></div>
              ` : `
                <div style="width:16px;height:16px;border-radius:4px;background:${t.source === 'design' ? '#D2992222' : '#58A6FF22'};border:1.5px solid ${t.source === 'design' ? '#D29922' : '#58A6FF'};flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4h6M4 1v6" stroke="${t.source === 'design' ? '#D29922' : '#58A6FF'}" stroke-width="1.3" stroke-linecap="round"/></svg>
                </div>
              `}
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;color:#C9D1D9;line-height:1.3">${esc(t.text)}</div>
                ${(proj || t.projectName) ? `<div style="font-size:11px;color:#6E7681;margin-top:2px">📁 ${esc(proj?.name || t.projectName || '')}</div>` : ''}
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
                ${urgency.label ? `<span style="font-size:10px;font-weight:600;color:${urgency.color};white-space:nowrap">${urgency.label}</span>` : ''}
                ${!isDerived ? `<button onclick="event.stopPropagation();deleteTask(${t.id})" style="background:none;border:none;color:#6E7681;cursor:pointer;padding:0;font-size:14px;line-height:1">×</button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${filter === 'week' && hiddenCount > 0 ? `
        <div onclick="switchWidgetFilter('all')" style="font-size:11px;color:#58A6FF;cursor:pointer;padding:6px 0;text-align:center;-webkit-tap-highlight-color:transparent">
          +${hiddenCount} more — view all
        </div>
      ` : ''}

      ${completedTasks.length > 0 ? `
        <details style="margin-top:10px">
          <summary style="font-size:11px;color:#6E7681;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;-webkit-tap-highlight-color:transparent">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            ${completedTasks.length} completed
          </summary>
          <div style="margin-top:6px;display:flex;flex-direction:column;gap:2px">
            ${completedTasks.slice(0, 6).map(t => {
              const proj = t.projectId ? state.projects.find(p => p.id === t.projectId) : null;
              return `
                <div style="display:flex;align-items:center;gap:8px;padding:7px;border-radius:6px;opacity:0.45">
                  <div onclick="toggleTask(${t.id})" style="width:16px;height:16px;border-radius:4px;border:1.5px solid #3FB950;background:#3FB95022;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center">
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="#3FB950" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:12px;color:#6E7681;text-decoration:line-through">${esc(t.text)}</div>
                    ${proj ? `<div style="font-size:10px;color:#6E7681">${esc(proj.name)}</div>` : ''}
                  </div>
                  <button onclick="deleteTask(${t.id})" style="background:none;border:none;color:#6E7681;cursor:pointer;padding:2px 4px;font-size:14px">×</button>
                </div>
              `;
            }).join('')}
          </div>
        </details>
      ` : ''}
    </div>
  `;
}

function getCloseRate() {
  const contracted = state.projects.filter(p => !p.archived && p.stage === 'contract').length;
  const lost = Object.keys(state.archived).filter(id => state.archived[id] === 'lost').length;
  const total = contracted + lost;
  return total > 0 ? Math.round((contracted / total) * 100) : null;
}

// ── Right Panel ──
function toggleRightPanel(panel) {
  state.rightPanel = state.rightPanel === panel ? null : panel;
  if (state.rightPanel !== 'messages') state.activeConversation = null;
  if (state.rightPanel === 'messages' && state.activeConversation) {
    markChannelRead(state.activeConversation);
  }
  updateRightPanel();
  if (state.rightPanel === 'messages' && state.activeConversation) {
    setTimeout(() => { const el = document.getElementById('msg-list'); if (el) el.scrollTop = el.scrollHeight; }, 50);
  }
}

function getDMChannelId(id1, id2) {
  return `dm_${Math.min(id1, id2)}_${Math.max(id1, id2)}`;
}

function getChannelMessages(channelId) {
  return state.messages.filter(m => (m.channelId || 'team') === channelId);
}

function getChannelUnread(channelId) {
  const myId = getActiveTeamMemberId();
  const lastRead = state.lastReadByChannel[channelId] || 0;
  return state.messages.filter(m =>
    (m.channelId || 'team') === channelId &&
    m.senderId !== myId &&
    m.timestamp > lastRead
  ).length;
}

function markChannelRead(channelId) {
  state.lastReadByChannel[channelId] = Date.now();
  localStorage.setItem('vi_last_read_ch', JSON.stringify(state.lastReadByChannel));
}

function getUnreadCount() {
  const myId = getActiveTeamMemberId();
  return state.messages.filter(m => {
    const ch = m.channelId || 'team';
    const lastRead = state.lastReadByChannel[ch] || 0;
    return m.senderId !== myId && m.timestamp > lastRead;
  }).length;
}

function openConversation(channelId) {
  state.activeConversation = channelId;
  markChannelRead(channelId);
  updateRightPanel();
  setTimeout(() => { const el = document.getElementById('msg-list'); if (el) el.scrollTop = el.scrollHeight; }, 50);
}

function closeConversation() {
  state.activeConversation = null;
  updateRightPanel();
}

function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input?.value?.trim();
  if (!text) return;
  const member = getTeamMember(getActiveTeamMemberId());
  if (!member) return;
  state.messages.push({
    id: Date.now(),
    senderId: member.id,
    senderName: member.name,
    senderInitials: member.initials || getInitials(member.name),
    senderColor: DASHBOARD_ACCESS.find(d => d.key === member.primaryRole)?.color || '#6E7681',
    text,
    channelId: state.activeConversation || 'team',
    timestamp: Date.now()
  });
  save('vi_messages', state.messages);
  if (input) input.value = '';
  updateRightPanel();
  setTimeout(() => { const list = document.getElementById('msg-list'); if (list) list.scrollTop = list.scrollHeight; }, 50);
}

function getNoteSections(role) {
  return state.noteSections[role] || [];
}

function addNoteSection(role, title, type) {
  if (!state.noteSections[role]) state.noteSections[role] = [];
  state.noteSections[role].push({
    id: Date.now(), title: title || 'Untitled',
    type: type || 'text', content: '', items: [], collapsed: false
  });
  save('vi_note_sections', state.noteSections);
  renderCurrentPage();
}

function deleteNoteSection(role, id) {
  state.noteSections[role] = (state.noteSections[role] || []).filter(s => s.id !== id);
  save('vi_note_sections', state.noteSections);
  renderCurrentPage();
}

function toggleNoteSectionCollapsed(role, id) {
  const s = (state.noteSections[role] || []).find(x => x.id === id);
  if (s) { s.collapsed = !s.collapsed; save('vi_note_sections', state.noteSections); renderCurrentPage(); }
}

function updateNoteSectionText(role, id, content) {
  const s = (state.noteSections[role] || []).find(x => x.id === id);
  if (s) { s.content = content; save('vi_note_sections', state.noteSections); }
}

function addNoteChecklistItem(role, sectionId, text) {
  const s = (state.noteSections[role] || []).find(x => x.id === sectionId);
  if (!s || !text.trim()) return;
  if (!s.items) s.items = [];
  s.items.push({ id: Date.now(), text: text.trim(), done: false });
  save('vi_note_sections', state.noteSections);
  renderCurrentPage();
}

function toggleNoteChecklistItem(role, sectionId, itemId) {
  const s = (state.noteSections[role] || []).find(x => x.id === sectionId);
  if (!s) return;
  const item = (s.items || []).find(i => i.id === itemId);
  if (item) { item.done = !item.done; save('vi_note_sections', state.noteSections); renderCurrentPage(); }
}

function deleteNoteChecklistItem(role, sectionId, itemId) {
  const s = (state.noteSections[role] || []).find(x => x.id === sectionId);
  if (!s) return;
  s.items = (s.items || []).filter(i => i.id !== itemId);
  save('vi_note_sections', state.noteSections);
  renderCurrentPage();
}

function showAddSectionDialog(role) {
  let d = document.getElementById('add-section-dialog');
  if (d) { d.remove(); return; }
  d = document.createElement('div');
  d.id = 'add-section-dialog';
  d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:120;display:flex;align-items:center;justify-content:center;padding:20px';
  d.innerHTML = `
    <div style="background:#161B22;border:1px solid #30363D;border-radius:12px;padding:20px;max-width:340px;width:100%">
      <div style="font-size:15px;font-weight:600;color:#E6EDF3;margin-bottom:16px">Add Section</div>
      <div class="form-group">
        <label class="form-label">Heading</label>
        <input class="form-input" id="ns-title" placeholder="e.g. Follow-ups, Weekly Goals…" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div id="ns-type-text" onclick="document.getElementById('ns-type-text').style.borderColor='#58A6FF';document.getElementById('ns-type-checklist').style.borderColor='#1C2333';window._nsType='text'"
            style="padding:10px;border-radius:8px;border:1px solid #58A6FF;background:#0D1626;cursor:pointer;text-align:center">
            <div style="font-size:13px;font-weight:500;color:#58A6FF">📝 Text</div>
            <div style="font-size:10px;color:#6E7681;margin-top:2px">Free-form notes</div>
          </div>
          <div id="ns-type-checklist" onclick="document.getElementById('ns-type-checklist').style.borderColor='#58A6FF';document.getElementById('ns-type-text').style.borderColor='#1C2333';window._nsType='checklist'"
            style="padding:10px;border-radius:8px;border:1px solid #1C2333;background:#0D1117;cursor:pointer;text-align:center">
            <div style="font-size:13px;font-weight:500;color:#C9D1D9">☑ Checklist</div>
            <div style="font-size:10px;color:#6E7681;margin-top:2px">Check-off items</div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn-primary" onclick="submitAddSection('${role}')" style="flex:1;padding:11px">Add</button>
        <button class="btn" onclick="document.getElementById('add-section-dialog')?.remove()">Cancel</button>
      </div>
    </div>
  `;
  window._nsType = 'text';
  document.body.appendChild(d);
  d.addEventListener('click', e => { if (e.target === d) d.remove(); });
  document.getElementById('ns-title')?.focus();
  document.getElementById('ns-title')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitAddSection(role); });
}

function submitAddSection(role) {
  const title = document.getElementById('ns-title')?.value?.trim();
  if (!title) { document.getElementById('ns-title')?.focus(); return; }
  addNoteSection(role, title, window._nsType || 'text');
  document.getElementById('add-section-dialog')?.remove();
}

function renderNotesSection(role, s) {
  const doneCount = s.type === 'checklist' ? (s.items || []).filter(i => i.done).length : 0;
  const totalCount = s.type === 'checklist' ? (s.items || []).length : 0;
  return `
    <div style="border:1px solid #1C2333;border-radius:8px;margin-bottom:8px;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:#161B22;cursor:pointer;-webkit-tap-highlight-color:transparent"
        onclick="toggleNoteSectionCollapsed('${role}', ${s.id})">
        <div style="display:flex;align-items:center;gap:8px;min-width:0">
          <span style="font-size:11px;color:#6E7681">${s.type === 'checklist' ? '☑' : '📝'}</span>
          <span style="font-size:13px;font-weight:500;color:#E6EDF3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.title)}</span>
          ${s.type === 'checklist' && totalCount > 0 ? `<span style="font-size:10px;color:${doneCount === totalCount ? '#3FB950' : '#6E7681'}">${doneCount}/${totalCount}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="color:#6E7681;transform:${s.collapsed ? 'rotate(-90deg)' : 'rotate(0)'};transition:transform 0.15s"><path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <button onclick="event.stopPropagation();deleteNoteSection('${role}',${s.id})" style="background:none;border:none;color:#6E7681;cursor:pointer;font-size:14px;padding:0;line-height:1">×</button>
        </div>
      </div>
      ${!s.collapsed ? `
        <div style="padding:10px 12px;background:#0D1117">
          ${s.type === 'text' ? `
            <textarea
              style="width:100%;background:transparent;border:none;color:#C9D1D9;font-size:12px;line-height:1.6;resize:none;outline:none;font-family:'DM Sans',sans-serif;min-height:60px"
              placeholder="Start typing…"
              oninput="updateNoteSectionText('${role}',${s.id},this.value)"
            >${esc(s.content || '')}</textarea>
          ` : `
            <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">
              ${(s.items || []).map(item => `
                <div style="display:flex;align-items:center;gap:8px">
                  <div onclick="toggleNoteChecklistItem('${role}',${s.id},${item.id})"
                    style="width:15px;height:15px;border-radius:3px;border:1.5px solid ${item.done ? '#3FB950' : '#30363D'};background:${item.done ? '#3FB95022' : 'transparent'};cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center">
                    ${item.done ? `<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="#3FB950" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
                  </div>
                  <span style="flex:1;font-size:12px;color:${item.done ? '#6E7681' : '#C9D1D9'};text-decoration:${item.done ? 'line-through' : 'none'}">${esc(item.text)}</span>
                  <button onclick="deleteNoteChecklistItem('${role}',${s.id},${item.id})" style="background:none;border:none;color:#6E7681;cursor:pointer;font-size:13px;padding:0">×</button>
                </div>
              `).join('')}
            </div>
            <div style="display:flex;gap:6px">
              <input class="form-input" id="cl-input-${s.id}" placeholder="Add item…"
                style="flex:1;padding:6px 8px;font-size:12px"
                onkeydown="if(event.key==='Enter'){const v=this.value.trim();if(v){addNoteChecklistItem('${role}',${s.id},v);}}">
              <button class="btn btn-sm" onclick="const v=document.getElementById('cl-input-${s.id}')?.value?.trim();if(v)addNoteChecklistItem('${role}',${s.id},v)"
                style="padding:5px 10px;font-size:12px">+</button>
            </div>
          `}
        </div>
      ` : ''}
    </div>
  `;
}

function renderMessagesList(channelId) {
  channelId = channelId || state.activeConversation || 'team';
  const myId = getActiveTeamMemberId();
  const messages = getChannelMessages(channelId);
  if (messages.length === 0) {
    return '<div style="text-align:center;padding:32px 12px;color:#6E7681;font-size:12px">No messages yet.<br>Say something 👋</div>';
  }
  let lastDate = '';
  return messages.map(m => {
    const isMe = m.senderId === myId;
    const dt = new Date(m.timestamp);
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const dateDivider = dateStr !== lastDate
      ? `<div style="text-align:center;font-size:10px;color:#6E7681;padding:8px 0;margin:4px 0">${dateStr}</div>`
      : '';
    lastDate = dateStr;
    return `${dateDivider}
      <div style="display:flex;flex-direction:${isMe ? 'row-reverse' : 'row'};align-items:flex-end;gap:6px;margin-bottom:8px">
        ${!isMe ? `<div style="width:26px;height:26px;border-radius:50%;background:${m.senderColor}22;border:1px solid ${m.senderColor}66;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:${m.senderColor};flex-shrink:0">${esc(m.senderInitials)}</div>` : ''}
        <div style="max-width:80%">
          ${!isMe ? `<div style="font-size:10px;color:#6E7681;margin-bottom:2px;padding-left:2px">${esc(m.senderName)}</div>` : ''}
          <div style="background:${isMe ? '#1565C0' : '#161B22'};border:1px solid ${isMe ? '#1565C066' : '#30363D'};border-radius:${isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px'};padding:7px 10px;font-size:12px;color:#E6EDF3;line-height:1.4;word-break:break-word">${esc(m.text)}</div>
          <div style="font-size:9px;color:#6E7681;margin-top:2px;text-align:${isMe ? 'right' : 'left'};padding:0 2px">${timeStr}</div>
        </div>
      </div>`;
  }).join('');
}

function injectRightPanel() {
  if (document.getElementById('right-panel')) return;
  const el = document.createElement('div');
  el.id = 'right-panel';
  document.body.appendChild(el);
  updateRightPanel();
}

function updateRightPanel() {
  const el = document.getElementById('right-panel');
  if (!el) return;
  el.innerHTML = renderRightPanelHTML();
  const main = document.getElementById('main');
  if (main && window.innerWidth > 768) {
    main.style.paddingRight = state.rightPanel ? '336px' : '52px';
  }
  if (state.rightPanel === 'messages' && state.activeConversation) {
    const list = document.getElementById('msg-list');
    if (list) list.scrollTop = list.scrollHeight;
  }
}

function getUpcomingMeetings() {
  const today = new Date().toISOString().slice(0, 10);
  return state.meetings
    .filter(m => m.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 5);
}

function scheduleMeeting() {
  const title = document.getElementById('mtg-title')?.value?.trim();
  const date  = document.getElementById('mtg-date')?.value;
  const time  = document.getElementById('mtg-time')?.value || '';
  const dur   = document.getElementById('mtg-dur')?.value || '1hr';
  const notes = document.getElementById('mtg-notes')?.value?.trim() || '';
  if (!title || !date) { alert('Title and date are required.'); return; }
  const attendees = [];
  document.querySelectorAll('#mtg-attendees [data-mid]').forEach(el => {
    if (el.classList.contains('selected')) attendees.push(parseInt(el.dataset.mid));
  });
  state.meetings.push({
    id: Date.now(), title, date, time, duration: dur,
    attendees, notes, createdBy: getActiveTeamMemberId(), createdAt: Date.now()
  });
  save('vi_meetings', state.meetings);
  ['mtg-title','mtg-date','mtg-time','mtg-notes'].forEach(id => {
    const f = document.getElementById(id); if (f) f.value = '';
  });
  updateRightPanel();
}

function deleteMeeting(id) {
  state.meetings = state.meetings.filter(m => m.id !== id);
  save('vi_meetings', state.meetings);
  updateRightPanel();
}

function renderRightPanelHTML() {
  const role = currentUserRole;
  const panel = state.rightPanel;
  const sections = getNoteSections(role);
  const unread = getUnreadCount();
  const upcoming = getUpcomingMeetings();
  const activeTasks = state.tasks.filter(t => t.memberId === getActiveTeamMemberId() && !t.done).length;

  const icons = [
    { key: 'notes',    title: 'Notes',          badge: sections.length || null,
      svg: '<svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M3 2h8l3.5 3.5V15H3V2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.5 2v4H14M5.5 7h5M5.5 9.5h6M5.5 12h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>' },
    { key: 'task',     title: 'Quick Add Task',  badge: activeTasks || null, badgeColor: '#D29922',
      svg: '<svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5.5v6M5.5 8.5h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' },
    { key: 'messages', title: 'Team Messages',   badge: unread || null, badgeColor: '#F85149',
      svg: '<svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M2 3h13v9H9.5l-3.5 2.5V12H2V3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>' },
    { key: 'schedule', title: 'Schedule Meeting', badge: upcoming.length || null, badgeColor: '#BC8CFF',
      svg: '<svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 7.5h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="11" r="1" fill="currentColor"/></svg>' },
  ];

  const strip = `<div class="rpanel-strip">
    ${icons.map(ic => {
      const bc = ic.badgeColor || '#1565C0';
      return `<div class="rpanel-icon${panel === ic.key ? ' rpanel-icon-active' : ''}" onclick="toggleRightPanel('${ic.key}')" title="${ic.title}">
        ${ic.svg}
        ${ic.badge ? `<span class="rpanel-badge" style="background:${bc}">${ic.badge > 9 ? '9+' : ic.badge}</span>` : ''}
      </div>`;
    }).join('')}
  </div>`;

  if (!panel) return strip;

  const notesPanel = `
    <div class="rpanel-header">
      <div>
        <div class="rpanel-header-title">Notes</div>
        <div style="font-size:10px;color:${DASHBOARD_ACCESS.find(d=>d.key===role)?.color||'#6E7681'}">${DASHBOARD_ACCESS.find(d=>d.key===role)?.label||role}</div>
      </div>
      <button class="btn btn-sm" onclick="showAddSectionDialog('${role}')" style="font-size:11px;padding:4px 10px">+ Section</button>
    </div>
    <div class="rpanel-body">
      ${sections.length === 0
        ? '<div style="text-align:center;padding:28px 12px;color:#6E7681;font-size:12px">No sections yet.<br><span style="color:#C9D1D9">Tap + Section</span> to get started.</div>'
        : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            ${sections.map(s => {
              const doneCount = s.type === 'checklist' ? (s.items||[]).filter(i=>i.done).length : 0;
              const totalCount = s.type === 'checklist' ? (s.items||[]).length : 0;
              const preview = s.type === 'text'
                ? (s.content?.slice(0,36) + (s.content?.length > 36 ? '…' : '') || '')
                : (s.items||[]).slice(0,2).map(i=>(i.done?'✓ ':'· ')+i.text.slice(0,14)).join('\n');
              return `<div onclick="toggleNoteSectionCollapsed('${role}',${s.id})" style="background:#161B22;border:1px solid ${s.collapsed?'#1C2333':'#30363D'};border-radius:8px;padding:9px 10px;cursor:pointer;-webkit-tap-highlight-color:transparent">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                  <span style="font-size:10px;color:#6E7681">${s.type==='checklist'?'☑':'📝'}</span>
                  <button onclick="event.stopPropagation();deleteNoteSection('${role}',${s.id})" style="background:none;border:none;color:#6E7681;cursor:pointer;font-size:12px;padding:0;line-height:1">×</button>
                </div>
                <div style="font-size:12px;font-weight:500;color:#E6EDF3;word-break:break-word;margin-bottom:3px">${esc(s.title)}</div>
                ${s.type==='checklist'&&totalCount>0
                  ? `<div style="font-size:10px;color:${doneCount===totalCount?'#3FB950':'#6E7681'}">${doneCount}/${totalCount} done</div>`
                  : preview ? `<div style="font-size:10px;color:#6E7681;line-height:1.4;white-space:pre-line">${esc(preview)}</div>` : ''}
              </div>`;
            }).join('')}
          </div>
          ${sections.filter(s=>!s.collapsed).map(s=>renderNotesSection(role,s)).join('')}`}
    </div>`;

  const projectOptions = state.projects.filter(p=>!p.archived)
    .map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const taskPanel = `
    <div class="rpanel-header"><div class="rpanel-header-title">Quick Add Task</div></div>
    <div class="rpanel-body">
      <div class="form-group">
        <input class="form-input" id="qt-text" placeholder="What needs to get done?" style="font-size:13px">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input class="form-input" type="date" id="qt-date" style="font-size:12px">
        </div>
        <div class="form-group">
          <label class="form-label">Project</label>
          <select class="form-select" id="qt-proj" style="font-size:12px">
            <option value="">None</option>${projectOptions}
          </select>
        </div>
      </div>
      <button class="btn-primary" onclick="quickAddTask()" style="width:100%;padding:10px;font-size:13px;margin-top:4px">Add Task</button>
      ${activeTasks > 0 ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #1C2333">
        <div style="font-size:11px;color:#6E7681;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Open (${activeTasks})</div>
        ${state.tasks.filter(t=>t.memberId===getActiveTeamMemberId()&&!t.done).slice(0,6).map(t=>{
          const u=getTaskUrgency(t.dueDate);
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #0D1117">
            <div onclick="toggleTask(${t.id})" style="width:14px;height:14px;border-radius:3px;border:1.5px solid #30363D;cursor:pointer;flex-shrink:0"></div>
            <span style="flex:1;font-size:12px;color:#C9D1D9">${esc(t.text)}</span>
            ${u.label ? `<span style="font-size:10px;font-weight:600;color:${u.color}">${u.label}</span>` : ''}
          </div>`;
        }).join('')}
      </div>` : ''}
    </div>`;

  const myId = getActiveTeamMemberId();
  let messagesPanel;

  if (!state.activeConversation) {
    const teamUnread = getChannelUnread('team');
    const teamLast = getChannelMessages('team').slice(-1)[0];
    const teamPreview = teamLast
      ? (teamLast.senderId === myId ? 'You: ' : '') + teamLast.text.slice(0, 32) + (teamLast.text.length > 32 ? '…' : '')
      : 'No messages yet';

    const dms = state.team.filter(m => m.id !== myId).map(m => {
      const chId = getDMChannelId(myId, m.id);
      const last = getChannelMessages(chId).slice(-1)[0];
      const unread = getChannelUnread(chId);
      const preview = last
        ? (last.senderId === myId ? 'You: ' : '') + last.text.slice(0, 32) + (last.text.length > 32 ? '…' : '')
        : 'Start a conversation…';
      const color = DASHBOARD_ACCESS.find(d => d.key === m.primaryRole)?.color || '#6E7681';
      return { m, chId, preview, unread, color, last };
    });

    messagesPanel = `
      <div class="rpanel-header"><div class="rpanel-header-title">Messages</div></div>
      <div class="rpanel-body" style="padding:8px">
        <div onclick="openConversation('team')" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;cursor:pointer;margin-bottom:4px;background:#161B22;border:1px solid #1C2333;-webkit-tap-highlight-color:transparent">
          <div style="width:36px;height:36px;border-radius:50%;background:#1565C022;border:1.5px solid #1565C0;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#58A6FF" stroke-width="1.3"><circle cx="5" cy="6" r="2.5"/><circle cx="11" cy="6" r="2"/><path d="M1 13c0-2.761 1.791-4 4-4s4 1.239 4 4"/><path d="M11 9.5c2 0 3.5.9 3.5 2.5"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:13px;font-weight:500;color:#E6EDF3">Team</span>
              ${teamUnread > 0 ? `<span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;background:#DA3633;color:#fff">${teamUnread}</span>` : ''}
            </div>
            <div style="font-size:11px;color:#6E7681;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(teamPreview)}</div>
          </div>
        </div>
        <div style="font-size:10px;color:#6E7681;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;padding:8px 4px 4px">Direct Messages</div>
        ${dms.length === 0 ? '<div style="font-size:12px;color:#6E7681;padding:8px 4px">Add team members to start DMs</div>' :
          dms.map(({ m, chId, preview, unread, color }) => `
            <div onclick="openConversation('${chId}')" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;cursor:pointer;margin-bottom:4px;background:${unread > 0 ? '#0D1626' : 'transparent'};border:1px solid ${unread > 0 ? '#1565C044' : 'transparent'};-webkit-tap-highlight-color:transparent">
              <div style="width:36px;height:36px;border-radius:50%;background:${color}22;border:1.5px solid ${color}66;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:${color};flex-shrink:0">${esc(m.initials || getInitials(m.name))}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <span style="font-size:13px;font-weight:${unread > 0 ? '600' : '500'};color:#E6EDF3">${esc(m.name)}</span>
                  ${unread > 0 ? `<span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;background:#DA3633;color:#fff">${unread}</span>` : ''}
                </div>
                <div style="font-size:11px;color:${unread > 0 ? '#C9D1D9' : '#6E7681'};margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(preview)}</div>
              </div>
            </div>
          `).join('')}
      </div>`;
  } else {
    const isTeam = state.activeConversation === 'team';
    let headerName, headerSub, headerColor;
    if (isTeam) {
      headerName = 'Team';
      headerSub = `${state.team.length} members`;
      headerColor = '#58A6FF';
    } else {
      const parts = state.activeConversation.split('_');
      const otherId = parseInt(parts[1]) === myId ? parseInt(parts[2]) : parseInt(parts[1]);
      const other = getTeamMember(otherId);
      headerName = other?.name || 'Unknown';
      headerColor = DASHBOARD_ACCESS.find(d => d.key === other?.primaryRole)?.color || '#6E7681';
      headerSub = DASHBOARD_ACCESS.find(d => d.key === other?.primaryRole)?.label || '';
    }

    messagesPanel = `
      <div class="rpanel-header" style="gap:8px">
        <button onclick="closeConversation()" style="background:none;border:none;color:#6E7681;cursor:pointer;padding:4px;display:flex;align-items:center;-webkit-tap-highlight-color:transparent">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:#E6EDF3">${esc(headerName)}</div>
          ${headerSub ? `<div style="font-size:10px;color:${headerColor}">${esc(headerSub)}</div>` : ''}
        </div>
      </div>
      <div id="msg-list" class="rpanel-body" style="flex:1;display:flex;flex-direction:column">
        ${renderMessagesList(state.activeConversation)}
      </div>
      <div style="padding:10px;border-top:1px solid #1C2333;flex-shrink:0">
        <div style="display:flex;gap:6px;align-items:flex-end">
          <textarea id="msg-input" placeholder="Message ${esc(headerName)}…"
            style="flex:1;background:#0D1117;border:1px solid #30363D;border-radius:8px;color:#E6EDF3;font-size:12px;font-family:'DM Sans',sans-serif;padding:8px 10px;resize:none;outline:none;line-height:1.4;max-height:80px;min-height:36px"
            rows="1"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}"
            oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px'"></textarea>
          <button onclick="sendMessage()" style="background:#1565C0;border:none;border-radius:8px;color:#fff;cursor:pointer;padding:8px 10px;-webkit-tap-highlight-color:transparent">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7L2 2l2.5 5L2 12l10-5z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>`;
  }

  const schedulePanel = `
    <div class="rpanel-header"><div class="rpanel-header-title">Schedule Meeting</div></div>
    <div class="rpanel-body">
      <div class="form-group">
        <input class="form-input" id="mtg-title" placeholder="Meeting title" style="font-size:13px">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-input" type="date" id="mtg-date" style="font-size:12px">
        </div>
        <div class="form-group">
          <label class="form-label">Time</label>
          <input class="form-input" type="time" id="mtg-time" style="font-size:12px">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Duration</label>
        <select class="form-select" id="mtg-dur" style="font-size:12px">
          <option value="30min">30 min</option>
          <option value="1hr" selected>1 hour</option>
          <option value="2hr">2 hours</option>
          <option value="halfday">Half day</option>
          <option value="allday">All day</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Attendees</label>
        <div id="mtg-attendees" style="display:flex;flex-wrap:wrap;gap:6px">
          ${state.team.map(m => {
            const c = DASHBOARD_ACCESS.find(d=>d.key===m.primaryRole)?.color||'#6E7681';
            return `<div data-mid="${m.id}" onclick="this.classList.toggle('selected');this.style.borderColor=this.classList.contains('selected')?'${c}':'#1C2333';this.style.background=this.classList.contains('selected')?'${c}18':'transparent';this.style.color=this.classList.contains('selected')?'${c}':'#6E7681'"
              style="padding:4px 10px;border-radius:20px;border:1px solid #1C2333;font-size:11px;color:#6E7681;cursor:pointer;-webkit-tap-highlight-color:transparent">${esc(m.name)}</div>`;
          }).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes <span style="color:#6E7681;font-weight:400">(optional)</span></label>
        <textarea class="form-textarea" id="mtg-notes" rows="2" placeholder="Agenda, location…" style="font-size:12px"></textarea>
      </div>
      <button class="btn-primary" onclick="scheduleMeeting()" style="width:100%;padding:10px;font-size:13px">Schedule</button>
      ${upcoming.length > 0 ? `
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #1C2333">
          <div style="font-size:11px;color:#6E7681;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Upcoming</div>
          ${upcoming.map(m => {
            const dateStr = new Date(m.date + 'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
            const attendeeNames = m.attendees.map(id=>getTeamMember(id)?.name||'').filter(Boolean).join(', ');
            return `<div style="padding:8px 0;border-bottom:1px solid #0D1117">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div style="font-size:12px;font-weight:500;color:#E6EDF3">${esc(m.title)}</div>
                <button onclick="deleteMeeting(${m.id})" style="background:none;border:none;color:#6E7681;cursor:pointer;font-size:13px;padding:0;flex-shrink:0">×</button>
              </div>
              <div style="font-size:11px;color:#58A6FF;margin-top:2px">${dateStr}${m.time ? ' · ' + m.time : ''} · ${m.duration}</div>
              ${attendeeNames ? `<div style="font-size:10px;color:#6E7681;margin-top:1px">${esc(attendeeNames)}</div>` : ''}
            </div>`;
          }).join('')}
        </div>` : ''}
    </div>`;

  const contentMap = { notes: notesPanel, task: taskPanel, messages: messagesPanel, schedule: schedulePanel };

  return `
    <div class="rpanel-content">${contentMap[panel] || ''}</div>
    ${strip}
  `;
}

function quickAddTask() {
  const text = document.getElementById('qt-text')?.value?.trim();
  const dueDate = document.getElementById('qt-date')?.value || '';
  const projectId = parseInt(document.getElementById('qt-proj')?.value) || null;
  if (!text) { document.getElementById('qt-text')?.focus(); return; }
  addTask(text, dueDate, projectId);
  const inp = document.getElementById('qt-text');
  if (inp) inp.value = '';
  updateRightPanel();
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

  STAGES.forEach(s => {
    byStage[s.key] = sortByColumnOrder(byStage[s.key], s.key);
  });

  const totalValue = getPipelineValue(projects);
  const activeCount = projects.filter(p => p.stage === 'contract').length;
  const reviewCount = projects.filter(p => isContractNeedsReview(p)).length;
  const archivedCount = state.projects.filter(p => p.archived).length;
  const likelyValue = getLikelyToCloseTotal();
  const likelyCount = projects.filter(p => isLikelyToClose(p.id)).length;

  const activeView = state.dashboardView || currentUserRole;
  const activeMember = getTeamMember(getActiveTeamMemberId());
  const userAccess = activeMember?.access || ['admin'];
  document.getElementById('page-title').textContent = getDashboardTitle();

  const viewTabs = userAccess.length > 1 ? `
    <div style="display:flex;gap:4px;margin-bottom:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px">
      ${userAccess.map(a => {
        const da = DASHBOARD_ACCESS.find(d => d.key === a);
        if (!da) return '';
        const isActive = a === activeView;
        return '<div onclick="switchDashboardView(\'' + a + '\')" style="padding:8px 14px;font-size:12px;font-weight:500;border-radius:6px;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;' + (isActive ? 'background:' + da.color + '22;color:' + da.color + ';border:1px solid ' + da.color + '44' : 'background:#161B22;color:#6E7681;border:1px solid #1C2333') + '">' + da.label + '</div>';
      }).join('')}
    </div>
  ` : '';

  const closeRate = getCloseRate();

  c.innerHTML = `
    ${viewTabs}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;align-items:start">
      <div class="metrics-grid" style="margin-bottom:0">
        <div class="metric-card">
          <div class="metric-label">Pipeline Value</div>
          <div class="metric-value">${fmt(totalValue)}</div>
          <div class="metric-sub">${projects.length} projects${archivedCount > 0 ? ', ' + archivedCount + ' archived' : ''}</div>
        </div>
        <div class="metric-card" style="${likelyCount > 0 ? 'border-color:#238636' : ''}">
          <div class="metric-label">Likely to Close</div>
          <div class="metric-value" style="${likelyCount > 0 ? 'color:#3FB950' : ''}">${fmt(likelyValue)}</div>
          <div class="metric-sub">${likelyCount} project${likelyCount !== 1 ? 's' : ''} flagged</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Contracted</div>
          <div class="metric-value">${activeCount}</div>
          <div class="metric-sub">${reviewCount > 0 ? '<span style="color:#F85149;font-weight:500">' + reviewCount + ' needs review</span>' : 'All reviewed'}</div>
        </div>
        <div class="metric-card" style="${closeRate !== null && closeRate >= 50 ? 'border-color:#238636' : ''}">
          <div class="metric-label">Close Rate</div>
          <div class="metric-value" style="${closeRate !== null && closeRate >= 50 ? 'color:#3FB950' : ''}">${closeRate !== null ? closeRate + '%' : '—'}</div>
          <div class="metric-sub">${closeRate !== null ? activeCount + ' won · ' + Object.values(state.archived).filter(v => v === 'lost').length + ' lost' : 'No closed deals yet'}</div>
        </div>
      </div>
      <div>${renderTasksWidget(activeView)}</div>
    </div>

    <div class="section-header">
      <div class="section-title">Pipeline</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="display:flex;background:#0D1117;border:1px solid #30363D;border-radius:6px;overflow:hidden;font-size:11px">
          <div onclick="if(state.timelineMode!=='estimated')toggleTimelineMode()" style="padding:5px 12px;cursor:pointer;transition:all 0.15s;${state.timelineMode === 'estimated' ? 'background:#1565C0;color:#58A6FF;font-weight:500' : 'color:#6E7681'}">Estimated</div>
          <div onclick="if(state.timelineMode!=='booked')toggleTimelineMode()" style="padding:5px 12px;cursor:pointer;transition:all 0.15s;${state.timelineMode === 'booked' ? 'background:#1565C0;color:#58A6FF;font-weight:500' : 'color:#6E7681'}">Booked</div>
        </div>
        <button class="section-action" onclick="navigate('projects')">View All</button>
      </div>
    </div>
    <div class="pipeline-grid">
      ${STAGES.map(s => {
        const col = byStage[s.key] || [];
        const LIMIT = 10;
        const expanded = !!state.expandedCols[s.key];
        const visible = expanded ? col : col.slice(0, LIMIT);
        const hiddenCount = col.length - LIMIT;
        return `
        <div class="pipeline-col" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDropStage(event, '${s.key}')">
          <div class="pipeline-col-header">
            <span class="pipeline-col-name">${s.label}</span>
            <span class="pipeline-col-count">${col.length}</span>
          </div>
          ${visible.map(p => {
            const gbbTier = getGBBTier(p.id);
            const gbbBadge = gbbTier ? '<span style="font-size:9px;font-weight:600;padding:1px 5px;border-radius:3px;background:' + (gbbTier === 'better' ? '#0D1626;color:#58A6FF;border:1px solid #1565C0' : gbbTier === 'best' ? '#0D1A0E;color:#3FB950;border:1px solid #238636' : '#161B22;color:#6E7681;border:1px solid #30363D') + '">' + gbbTier.toUpperCase() + '</span>' : '';
            const likely = isLikelyToClose(p.id);
            return '<div class="project-card' + (likely ? ' likely-card' : '') + '" draggable="true" ondragstart="onReorderDragStart(event, ' + p.id + ', \'' + s.key + '\')" ondragend="onDragEnd(event)" ondragover="event.preventDefault()" ondrop="onReorderDrop(event, ' + p.id + ', \'' + s.key + '\')" onclick="openProject(' + p.id + ')" style="' + (isContractNeedsReview(p) ? 'border-color:#DA3633' : likely ? 'border-color:#238636' : '') + '">' + (likely ? '<div class="likely-badge">LIKELY TO CLOSE</div>' : '') + (isContractNeedsReview(p) ? '<div style="background:#DA3633;color:#fff;font-size:10px;font-weight:600;padding:4px 8px;border-radius:4px;margin-bottom:8px;text-align:center;letter-spacing:0.03em">REVIEW — SEND TO DESIGN & INSTALL</div>' : '') + '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div class="project-card-name">' + esc(p.name) + '</div><div style="display:flex;gap:3px;align-items:center">' + gbbBadge + '</div></div><div class="project-card-client">' + esc(p.client_name || 'No client') + (p.city ? ' · ' + esc(p.city) + (p.state_abbr ? ', ' + esc(p.state_abbr) : '') : '') + '</div>' + (() => { const dt = getInstallDateDisplay(p); return '<div style="font-size:10px;color:' + dt.color + ';margin-top:3px"><span style="opacity:0.7">' + dt.label + ':</span> ' + dt.value + '</div>'; })() + '<div class="project-card-footer">' + (canSee('financials') ? '<span class="project-card-value">' + fmt(p.total) + '</span>' : '<span></span>') + '<div style="display:flex;align-items:center;gap:4px"><span class="status-pill status-' + s.color + '">' + s.label + '</span><button class="move-btn" onclick="event.stopPropagation();showMoveMenu(' + p.id + ', event)" title="Move">\u22EE</button></div></div>' + (p.systems.length ? '<div style="margin-top:6px">' + p.systems.map(systemTagHTML).join('') + '</div>' : '') + '</div>';
          }).join('')}
          ${col.length === 0 ? '<div class="empty-state" style="padding:20px 10px;font-size:12px">No projects</div>' : ''}
          ${!expanded && hiddenCount > 0 ? `<div onclick="event.stopPropagation();toggleColExpanded('${s.key}')" style="text-align:center;padding:8px 6px;font-size:11px;color:#58A6FF;cursor:pointer;border-top:1px solid #1C2333;margin-top:4px;-webkit-tap-highlight-color:transparent">+${hiddenCount} more</div>` : ''}
          ${expanded && col.length > LIMIT ? `<div onclick="event.stopPropagation();toggleColExpanded('${s.key}')" style="text-align:center;padding:8px 6px;font-size:11px;color:#6E7681;cursor:pointer;border-top:1px solid #1C2333;margin-top:4px;-webkit-tap-highlight-color:transparent">Show less ↑</div>` : ''}
        </div>`;
      }).join('')}
    </div>

    <div class="archive-row">
      ${ARCHIVE_BINS.map(b => {
        const count = getArchivedProjects(b.key).length;
        return '<div class="archive-bin" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDropArchive(event, \'' + b.key + '\')"><span class="archive-icon">' + b.icon + '</span><span class="archive-label">' + b.label + '</span>' + (count > 0 ? '<span class="archive-count" onclick="toggleArchiveExpand(\'' + b.key + '\')">' + count + '</span>' : '') + '</div>';
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
    <div class="section-header"><div class="section-title">Recently Updated</div></div>
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
            <th>Project</th><th>Client</th><th>Stage</th>
            ${canSee('financials') ? '<th>Value</th>' : ''}
            <th>Systems</th><th>Updated</th>
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
                <div style="font-size:12px;color:#6E7681;margin-top:2px">${esc(p.client_name || 'No client')}${p.city ? ' · ' + esc(p.city) + (p.state_abbr ? ', ' + esc(p.state_abbr) : '') : ''}</div>
                ${(() => { const dt = getInstallDateDisplay(p); return `<div style="font-size:11px;color:${dt.color};margin-top:2px">${dt.label}: ${dt.value}</div>`; })()}
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
      <td><div class="proj-name">${esc(p.name)}</div><div class="proj-id">#${p.id}</div></td>
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
    tr.style.display = (!q || name.includes(q)) && (!window._projFilter || stage === window._projFilter) ? '' : 'none';
  });
  document.querySelectorAll('#proj-mobile .mobile-project-item').forEach(el => {
    const name = el.dataset.name || '';
    const stage = el.dataset.stage || '';
    el.style.display = (!q || name.includes(q)) && (!window._projFilter || stage === window._projFilter) ? '' : 'none';
  });
}

function setProjectFilter(stage) {
  window._projFilter = stage;
  renderProjects(document.getElementById('content'));
}

// ── Project Page (v1.16: full-page) ──
function renderProjectPage(c) {
  const p = state.currentProject;
  if (!p) { navigate('dashboard'); return; }
  const tab = state.projectTab || 'overview';
  const needsReview = isContractNeedsReview(p);
  const stg = STAGES.find(s => s.key === p.stage) || STAGES[0];
  const likely = isLikelyToClose(p.id);
  const gbbTier = getGBBTier(p.id);

  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = p.name;

  const gbbBadgeStyle = gbbTier === 'better' ? 'background:#0D1626;color:#58A6FF;border:1px solid #1565C0'
    : gbbTier === 'best' ? 'background:#0D1A0E;color:#3FB950;border:1px solid #238636'
    : 'background:#161B22;color:#6E7681;border:1px solid #30363D';

  const railItems = [
    { key: 'overview', label: 'Overview' },
    { key: 'details',  label: 'Details'  },
    { key: 'design',   label: 'Design'   },
    { key: 'install',  label: 'Install'  },
    { key: 'files',    label: 'Files'    },
    { key: 'notes',    label: 'Notes'    }
  ];

  const railHTML = railItems.map(item => `
    <div class="prail-item ${tab === item.key ? 'active' : ''}" onclick="switchProjectTab('${item.key}')">${item.label}</div>
  `).join('');

  // Page structure: existing header at top (unchanged from Stage B), then body split into rail + content
  c.innerHTML = `
    <div class="project-page">
      <div class="project-page-header">
        <div class="project-page-top">
          <button class="project-back-btn" onclick="closeProjectPage()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Back</span>
          </button>
          <div class="project-page-title-block">
            <div class="project-page-name">${esc(p.name)}</div>
            <div class="project-page-sub">#${p.id} · ${esc(p.client_name || 'No client')}${p.city ? ' · ' + esc(p.city) + (p.state_abbr ? ', ' + esc(p.state_abbr) : '') : ''}</div>
          </div>
          <div class="project-page-actions">
            <span class="status-pill status-${stg.color}">${stg.label}</span>
            ${gbbTier ? `<span style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:3px;${gbbBadgeStyle}">${gbbTier.toUpperCase()}</span>` : ''}
            <button class="btn btn-sm" onclick="toggleLikelyToClose(${p.id})" title="${likely ? 'Remove Likely to Close' : 'Mark Likely to Close'}" style="${likely ? 'background:#0D1A0E;border-color:#238636;color:#3FB950' : ''};min-height:32px;padding:4px 10px"><span style="font-size:14px">★</span></button>
          </div>
        </div>
        ${p.systems.length ? `<div class="project-page-tags">${p.systems.map(systemTagHTML).join('')}</div>` : ''}
        ${needsReview ? `
          <div class="project-page-review-banner">
            <div style="display:flex;align-items:center;gap:8px;flex:1">
              <div style="width:8px;height:8px;border-radius:50%;background:#DA3633;animation:pulse 1.5s infinite;flex-shrink:0"></div>
              <span style="font-size:12px;font-weight:600;color:#F85149">REVIEW REQUIRED &mdash; SEND TO DESIGN &amp; INSTALL</span>
            </div>
            <button class="btn-primary" onclick="markContractReviewed(${p.id})" style="background:#238636;padding:6px 12px;font-size:12px;min-height:32px">&#10003; Mark Reviewed</button>
          </div>
        ` : ''}
      </div>
      <div class="project-page-body-wrap">
        <aside class="prail">${railHTML}</aside>
        <div class="project-page-body" id="project-page-body"></div>
      </div>
    </div>
  `;
  renderProjectTabContent();
}

function renderProjectTabContent() {
  const body = document.getElementById('project-page-body');
  const p = state.currentProject;
  if (!body || !p) return;
  const tab = state.projectTab;

  if (tab === 'overview') {
    body.innerHTML = renderProjectOverviewHTML(p);
  } else if (tab === 'details') {
    body.innerHTML = renderProjectDetailsHTML(p);
  } else if (tab === 'design') {
    body.innerHTML = '';
    renderChecklistTab(body, p, 'design');
  } else if (tab === 'install') {
    body.innerHTML = '';
    renderChecklistTab(body, p, 'install');
  } else if (tab === 'files') {
    body.innerHTML = renderProjectFilesHTML(p);
  } else if (tab === 'notes') {
    const noteKey = `vi_notes_${p.id}`;
    const existing = localStorage.getItem(noteKey) || '';
    body.innerHTML = `
      <div class="dashboard-card">
        <div class="dashboard-card-title">Project Notes</div>
        <textarea class="form-textarea" id="project-notes" rows="12" placeholder="Add notes about this project…"
          oninput="localStorage.setItem('${noteKey}', this.value)">${esc(existing)}</textarea>
        <div style="margin-top:8px;font-size:11px;color:#6E7681">Notes save automatically</div>
      </div>
    `;
  }
}

function renderProjectOverviewHTML(p) {
  const gbbGroup = getGBBGroup(p.id);
  const gbbTier = getGBBTier(p.id);
  return `
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
        </div>
      </div>
      <div class="dashboard-card">
        <div class="dashboard-card-title">Client</div>
        <div style="font-size:13px;color:#C9D1D9;line-height:1.9">
          <div style="font-size:14px;font-weight:500;color:#E6EDF3;margin-bottom:4px">${esc(p.client_name || '—')}</div>
          ${canSee('client_contact') ? `
            ${p.primary_contact_name ? `<div style="color:#8B949E">${esc(p.primary_contact_name)}</div>` : ''}
            ${p.primary_contact_email ? `<div><a href="mailto:${esc(p.primary_contact_email)}" style="color:#58A6FF;text-decoration:none">${esc(p.primary_contact_email)}</a></div>` : ''}
            ${p.primary_contact_phone ? `<div><a href="tel:${esc(p.primary_contact_phone)}" style="color:#58A6FF;text-decoration:none">${esc(p.primary_contact_phone)}</a></div>` : ''}
          ` : ''}
          ${p.address || p.city ? `<div style="font-size:12px;color:#6E7681;margin-top:4px">${[p.address, p.city, p.state_abbr].filter(Boolean).join(', ')}</div>` : ''}
        </div>
      </div>
    </div>
    ${(() => {
      const files = state.projectFiles[p.id] || {};
      const renders = (files.renders || []).filter(r => r.url);
      if (renders.length === 0) return '';
      return `
        <div class="dashboard-card" style="margin-top:14px">
          <div class="dashboard-card-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Renders</span>
            <button class="btn btn-sm" onclick="switchProjectTab('files')" style="font-size:11px">Manage in Files &rarr;</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
            ${renders.slice(0, 6).map(r => {
              const isImage = r.url && /\.(png|jpe?g|gif|webp)$/i.test(r.url);
              const driveImgId = extractDriveFileId(r.url);
              const thumbUrl = driveImgId ? `https://drive.google.com/thumbnail?id=${driveImgId}&sz=w400` : (isImage ? r.url : null);
              return `
                <a href="${esc(r.url)}" target="_blank" rel="noopener" style="display:block;aspect-ratio:4/3;background:#0D1117;border:1px solid #1C2333;border-radius:6px;overflow:hidden;text-decoration:none;position:relative">
                  ${thumbUrl
                    ? `<img src="${esc(thumbUrl)}" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                       <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;color:#6E7681;font-size:11px;padding:8px;text-align:center">${esc(r.label || 'Render')}</div>`
                    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#58A6FF;font-size:11px;padding:8px;text-align:center">
                         <div>
                           <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="margin:0 auto 4px"><path d="M3 15l4-4 3 3 4-5 3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="3" width="16" height="14" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>
                           <div>${esc(r.label || 'Render')}</div>
                         </div>
                       </div>`}
                </a>
              `;
            }).join('')}
          </div>
          ${renders.length > 6 ? `<div style="text-align:center;margin-top:8px;font-size:11px;color:#6E7681">+${renders.length - 6} more in Files tab</div>` : ''}
        </div>
      `;
    })()}
    <div class="dashboard-card" style="margin-top:14px">
      <div class="dashboard-card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>Install Timeline</span>
        <button class="btn btn-sm" onclick="showSetBookedDatesDialog(${p.id})" style="font-size:11px">
          ${getBookedTimeline(p.id) ? 'Edit Booked Dates' : 'Set Booked Dates'}
        </button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px">
        <div style="padding:10px 12px;background:#0D1117;border-radius:8px;border:1px solid #1C2333">
          <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Estimated (Jetbuilt)</div>
          <div style="font-size:13px;color:${p.start_date ? '#C9D1D9' : '#6E7681'}">${p.start_date ? fmtDate(p.start_date) : '— Not set'}</div>
        </div>
        <div style="padding:10px 12px;background:${getBookedTimeline(p.id) ? '#0D1A0E' : '#0D1117'};border-radius:8px;border:1px solid ${getBookedTimeline(p.id) ? '#238636' : '#1C2333'}">
          <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Booked Install</div>
          ${(() => {
            const b = getBookedTimeline(p.id);
            if (!b) return '<div style="font-size:13px;color:#6E7681">— Not booked</div>';
            const end = b.end && b.end !== b.start ? ' – ' + fmtDate(b.end) : '';
            return `<div style="font-size:13px;color:#3FB950">${fmtDate(b.start)}${end}</div>`;
          })()}
        </div>
      </div>
    </div>
    ${p.systems.length ? `
      <div class="dashboard-card" style="margin-top:14px">
        <div class="dashboard-card-title">Scope Tags</div>
        <div>${p.systems.map(systemTagHTML).join(' ')}</div>
      </div>
    ` : ''}
    <div class="dashboard-card" style="margin-top:14px">
      <div class="dashboard-card-title">Project Team</div>
      ${['design', 'install'].map(phase => {
        const assigned = getProjectAssignment(p.id)[phase] || [];
        const eligible = state.team.filter(m =>
          phase === 'design' ? m.access.includes('design') || m.access.includes('admin')
          : m.access.includes('installer') || m.access.includes('project_manager') || m.access.includes('admin')
        );
        const phaseColor = phase === 'design' ? '#D29922' : '#58A6FF';
        const phaseLabel = phase === 'design' ? 'Design' : 'Install';
        return `
          <div style="margin-bottom:10px">
            <div style="font-size:11px;font-weight:600;color:${phaseColor};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${phaseLabel}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${eligible.map(m => {
                const active = assigned.includes(m.id);
                const color = DASHBOARD_ACCESS.find(d => d.key === m.primaryRole)?.color || '#6E7681';
                return `
                  <div onclick="toggleProjectAssignment(${p.id},'${phase}',${m.id})"
                    style="display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;cursor:pointer;border:1px solid ${active ? color + '66' : '#1C2333'};background:${active ? color + '18' : '#0D1117'};-webkit-tap-highlight-color:transparent">
                    <div style="width:20px;height:20px;border-radius:50%;background:${color}22;border:1px solid ${color}66;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:${color}">${esc(m.initials || m.name.slice(0,2).toUpperCase())}</div>
                    <span style="font-size:12px;color:${active ? '#E6EDF3' : '#6E7681'};font-weight:${active ? '500' : '400'}">${esc(m.name)}</span>
                    ${active ? `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
                  </div>`;
              }).join('')}
              ${eligible.length === 0 ? `<span style="font-size:12px;color:#6E7681">No ${phaseLabel.toLowerCase()} team members yet</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ${p.description ? `
      <div class="dashboard-card" style="margin-top:14px">
        <div class="dashboard-card-title">Description</div>
        <div style="font-size:13px;color:#C9D1D9;line-height:1.6">${esc(p.description)}</div>
      </div>
    ` : ''}
    ${(() => {
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
}

function renderChecklistTab(container, project, phase) {
  const systems = project.systems.filter(s => TEMPLATES[phase]?.[s]);
  if (systems.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">${phase === 'design' ? '📐' : '🔧'}</span>No ${phase} checklists — scope tags haven't been detected for this project.<br><br><span style="font-size:11px;color:#6E7681">Checklists auto-generate from scope tags: LED Wall, PA/Audio, Lighting, Control, Streaming, Camera</span></div>`;
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
  const p = state.currentProject;
  if (p && state.projectTab === phase) {
    const body = document.getElementById('project-page-body');
    if (body) { body.innerHTML = ''; renderChecklistTab(body, p, phase); }
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

// ── Drive URL helpers (Stage B v1.17) ──
function extractDriveFolderId(url) {
  if (!url) return null;
  // Matches: /folders/{ID}, /drive/folders/{ID}, ?id={ID}
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/drive\/u\/\d+\/folders\/([a-zA-Z0-9_-]+)/
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function extractDriveFileId(url) {
  if (!url) return null;
  // Matches: /file/d/{ID}, ?id={ID}, open?id={ID}
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function getProjectDriveUrl(projectId) {
  return state.projectDrive[projectId] || '';
}

function setProjectDriveUrl(projectId, url) {
  if (url && url.trim()) {
    state.projectDrive[projectId] = url.trim();
  } else {
    delete state.projectDrive[projectId];
  }
  save('vi_project_drive', state.projectDrive);
}

function getProjectFiles(projectId) {
  return state.projectFiles[projectId] || { renders: [], drawings: [], asbuilts: [], contracts: [], other: [] };
}

function addProjectFile(projectId, category, label, url) {
  if (!state.projectFiles[projectId]) {
    state.projectFiles[projectId] = { renders: [], drawings: [], asbuilts: [], contracts: [], other: [] };
  }
  if (!state.projectFiles[projectId][category]) state.projectFiles[projectId][category] = [];
  state.projectFiles[projectId][category].push({
    id: Date.now(),
    label: label || 'Untitled',
    url: url || '',
    added: new Date().toISOString()
  });
  save('vi_project_files', state.projectFiles);
}

function removeProjectFile(projectId, category, fileId) {
  if (!state.projectFiles[projectId]) return;
  state.projectFiles[projectId][category] = (state.projectFiles[projectId][category] || []).filter(f => f.id !== fileId);
  save('vi_project_files', state.projectFiles);
}

function saveProjectDriveUrl(projectId) {
  const input = document.getElementById('drive-url-input');
  if (!input) return;
  setProjectDriveUrl(projectId, input.value);
  renderProjectTabContent();
}

function promptAddFile(projectId, category) {
  const label = prompt('File name / description:');
  if (!label) return;
  const url = prompt('Drive / web URL:');
  if (!url) return;
  addProjectFile(projectId, category, label, url);
  renderProjectTabContent();
}

function confirmRemoveFile(projectId, category, fileId) {
  if (!confirm('Remove this file link?')) return;
  removeProjectFile(projectId, category, fileId);
  renderProjectTabContent();
}

function renderProjectDetailsHTML(p) {
  return `
    <div class="dashboard-grid">
      <div class="dashboard-card">
        <div class="dashboard-card-title">Client</div>
        <div style="font-size:13px;color:#C9D1D9;line-height:1.9">
          <div style="font-size:15px;font-weight:500;color:#E6EDF3;margin-bottom:6px">${esc(p.client_name || '—')}</div>
          ${canSee('client_contact') ? `
            ${p.primary_contact_name ? `<div><strong style="color:#8B949E">Contact:</strong> ${esc(p.primary_contact_name)}</div>` : ''}
            ${p.primary_contact_email ? `<div><strong style="color:#8B949E">Email:</strong> <a href="mailto:${esc(p.primary_contact_email)}" style="color:#58A6FF;text-decoration:none">${esc(p.primary_contact_email)}</a></div>` : ''}
            ${p.primary_contact_phone ? `<div><strong style="color:#8B949E">Phone:</strong> <a href="tel:${esc(p.primary_contact_phone)}" style="color:#58A6FF;text-decoration:none">${esc(p.primary_contact_phone)}</a></div>` : ''}
          ` : '<div style="font-size:12px;color:#6E7681">Contact info hidden &mdash; requires client_contact permission</div>'}
        </div>
      </div>
      <div class="dashboard-card">
        <div class="dashboard-card-title">Location</div>
        <div style="font-size:13px;color:#C9D1D9;line-height:1.9">
          ${p.address ? `<div><strong style="color:#8B949E">Address:</strong> ${esc(p.address)}</div>` : ''}
          ${p.city ? `<div><strong style="color:#8B949E">City:</strong> ${esc(p.city)}${p.state_abbr ? ', ' + esc(p.state_abbr) : ''}</div>` : ''}
          ${p.zip ? `<div><strong style="color:#8B949E">ZIP:</strong> ${esc(p.zip)}</div>` : ''}
          ${!p.address && !p.city && !p.zip ? '<div style="font-size:12px;color:#6E7681">No address on file</div>' : ''}
          ${p.address || p.city ? `
            <div style="margin-top:10px">
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.address, p.city, p.state_abbr].filter(Boolean).join(', '))}" target="_blank" rel="noopener" style="font-size:12px;color:#58A6FF;text-decoration:none">
                Open in Google Maps &rarr;
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="dashboard-card" style="margin-top:14px">
      <div class="dashboard-card-title">Project Metadata</div>
      <div style="font-size:13px;color:#C9D1D9;line-height:1.9">
        <div><strong style="color:#8B949E">Project ID:</strong> <span style="font-family:'DM Mono',monospace;font-size:12px">#${p.id}</span></div>
        <div><strong style="color:#8B949E">Stage:</strong> ${esc(p.raw_stage || p.stage)}</div>
        ${p.jetbuilt_id ? `<div><strong style="color:#8B949E">Jetbuilt ID:</strong> <span style="font-family:'DM Mono',monospace;font-size:12px">${p.jetbuilt_id}</span></div>` : ''}
        <div><strong style="color:#8B949E">Created:</strong> ${fmtDate(p.created_at)}</div>
        <div><strong style="color:#8B949E">Last Updated:</strong> ${fmtDate(p.updated_at)}</div>
      </div>
    </div>

    ${p.systems.length ? `
      <div class="dashboard-card" style="margin-top:14px">
        <div class="dashboard-card-title">Scope Tags</div>
        <div style="margin-bottom:8px">${p.systems.map(systemTagHTML).join(' ')}</div>
        <div style="font-size:11px;color:#6E7681">Auto-detected from project name and description. These drive the design and install checklists.</div>
      </div>
    ` : ''}

    ${p.description ? `
      <div class="dashboard-card" style="margin-top:14px">
        <div class="dashboard-card-title">Description</div>
        <div style="font-size:13px;color:#C9D1D9;line-height:1.6;white-space:pre-wrap">${esc(p.description)}</div>
      </div>
    ` : ''}

    ${p.notes ? `
      <div class="dashboard-card" style="margin-top:14px">
        <div class="dashboard-card-title">Jetbuilt Notes</div>
        <div style="font-size:13px;color:#C9D1D9;line-height:1.6;white-space:pre-wrap">${esc(p.notes)}</div>
        <div style="margin-top:8px;font-size:11px;color:#6E7681">These are notes from Jetbuilt. Use the Notes tab for working notes.</div>
      </div>
    ` : ''}
  `;
}

function renderProjectFilesHTML(p) {
  const driveUrl = getProjectDriveUrl(p.id);
  const folderId = extractDriveFolderId(driveUrl);
  const files = getProjectFiles(p.id);

  const categories = [
    { key: 'renders', label: 'Renders', icon: 'image', desc: 'Sales renders and layout visuals shared with the client' },
    { key: 'drawings', label: 'CAD Drawings', icon: 'blueprint', desc: 'Vectorworks build sets, plots, schedules' },
    { key: 'asbuilts', label: 'As-builts', icon: 'document', desc: 'Final drawings after install is complete' },
    { key: 'contracts', label: 'Contracts & SOWs', icon: 'contract', desc: 'Signed contracts, scope documents, change orders' },
    { key: 'other', label: 'Other Files', icon: 'file', desc: 'Reference photos, spec sheets, anything else' }
  ];

  return `
    <div class="dashboard-card" style="margin-bottom:14px">
      <div class="dashboard-card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>Google Drive Folder</span>
        ${driveUrl ? `<a href="${esc(driveUrl)}" target="_blank" rel="noopener" class="btn btn-sm" style="text-decoration:none;font-size:11px;color:#58A6FF;border-color:#1565C0">Open in Drive &rarr;</a>` : ''}
      </div>
      <div style="display:flex;gap:8px;align-items:stretch">
        <input class="form-input" id="drive-url-input" placeholder="Paste Google Drive folder URL..."
          value="${esc(driveUrl)}" style="flex:1;font-size:13px"
          onkeydown="if(event.key==='Enter')saveProjectDriveUrl(${p.id})">
        <button class="btn-primary" onclick="saveProjectDriveUrl(${p.id})" style="padding:10px 16px;font-size:13px;flex-shrink:0">Save</button>
      </div>
      ${driveUrl && !folderId ? `
        <div style="margin-top:10px;padding:10px 12px;background:#1A150D;border:1px solid #9E6A03;border-radius:6px;font-size:12px;color:#D29922">
          Unable to parse folder ID from URL. Make sure it&rsquo;s a Drive <strong>folder</strong> link (contains /folders/...), not a single file.
        </div>
      ` : ''}
      ${folderId ? `
        <div style="margin-top:10px;font-size:11px;color:#6E7681;display:flex;align-items:center;gap:6px">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#3FB950" stroke-width="1.3"/><path d="M4 6l1.5 1.5L8 5" stroke="#3FB950" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Folder linked. To show embedded preview, folder must be shared &ldquo;Anyone with link &mdash; Viewer&rdquo; in Drive.
        </div>
      ` : ''}
    </div>

    ${folderId ? `
      <div class="dashboard-card" style="margin-bottom:14px;padding:0;overflow:hidden">
        <div style="padding:10px 16px;border-bottom:1px solid #1C2333;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;font-weight:600;color:#6E7681;text-transform:uppercase;letter-spacing:0.08em">Embedded Drive Preview</span>
          <span style="font-size:10px;color:#6E7681">If blank, folder sharing may be restricted</span>
        </div>
        <iframe src="https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid"
          style="width:100%;height:480px;border:none;display:block;background:#0D1117"
          title="Google Drive folder"></iframe>
      </div>
    ` : `
      <div class="dashboard-card" style="margin-bottom:14px;text-align:center;padding:40px 20px">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style="margin:0 auto 12px;opacity:0.4">
          <path d="M8 12h10l4 6h18v20a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" stroke="#6E7681" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <div style="font-size:14px;color:#8B949E;margin-bottom:4px">No Drive folder linked</div>
        <div style="font-size:12px;color:#6E7681">Paste the Google Drive folder URL above to link this project&rsquo;s files.</div>
      </div>
    `}

    <div style="display:flex;align-items:center;justify-content:space-between;margin:20px 0 12px">
      <div class="section-title">File Links</div>
      <span style="font-size:11px;color:#6E7681">Quick links to specific files within Drive or elsewhere</span>
    </div>

    ${categories.map(cat => {
      const items = files[cat.key] || [];
      return `
        <div class="dashboard-card" style="margin-bottom:10px">
          <div class="dashboard-card-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div>
              <span>${cat.label}</span>
              ${items.length > 0 ? `<span style="margin-left:6px;font-size:10px;color:#6E7681;font-weight:400">${items.length}</span>` : ''}
            </div>
            <button class="btn btn-sm" onclick="promptAddFile(${p.id}, '${cat.key}')" style="font-size:11px;padding:5px 10px">+ Add</button>
          </div>
          <div style="font-size:11px;color:#6E7681;margin-bottom:8px">${cat.desc}</div>
          ${items.length === 0 ? `
            <div style="font-size:12px;color:#6E7681;font-style:italic;padding:4px 0">No ${cat.label.toLowerCase()} linked yet</div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:4px">
              ${items.map(item => {
                const driveFileId = extractDriveFileId(item.url);
                const thumbUrl = driveFileId ? `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w80` : null;
                return `
                  <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;background:#0D1117;border:1px solid #1C2333">
                    ${thumbUrl ? `
                      <img src="${esc(thumbUrl)}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0;background:#161B22" onerror="this.style.display='none'">
                    ` : `
                      <div style="width:36px;height:36px;border-radius:4px;background:#161B22;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#6E7681">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
                      </div>
                    `}
                    <div style="flex:1;min-width:0">
                      <a href="${esc(item.url)}" target="_blank" rel="noopener" style="font-size:13px;color:#E6EDF3;text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.label)}</a>
                      <div style="font-size:10px;color:#6E7681;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.url)}</div>
                    </div>
                    <button onclick="confirmRemoveFile(${p.id}, '${cat.key}', ${item.id})" style="background:none;border:none;color:#6E7681;cursor:pointer;padding:4px 8px;font-size:16px;line-height:1;flex-shrink:0" title="Remove">&times;</button>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `;
    }).join('')}
  `;
}

// Legacy no-op (project-modal no longer used but kept for safety)
function closeModal() {
  const m = document.getElementById('project-modal');
  if (m) m.style.display = 'none';
  state.currentProject = null;
}
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
          ${events.map(e => `<div class="cal-event ${e.color}" onclick="openProject(${e.id})" title="${esc(e.name)}" style="${e.booked ? 'border-left:2px solid #3FB950' : ''}">${esc(e.name)}</div>`).join('')}
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
          <button class="cal-btn" onclick="calNav(-1)"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
          <span class="cal-month">${months[month]} ${year}</span>
          <button class="cal-btn" onclick="calNav(1)"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="display:flex;background:#0D1117;border:1px solid #30363D;border-radius:6px;overflow:hidden;font-size:11px">
            <div onclick="if(state.timelineMode!=='estimated')toggleTimelineMode()" style="padding:4px 10px;cursor:pointer;${state.timelineMode === 'estimated' ? 'background:#1565C0;color:#58A6FF;font-weight:500' : 'color:#6E7681'}">Est.</div>
            <div onclick="if(state.timelineMode!=='booked')toggleTimelineMode()" style="padding:4px 10px;cursor:pointer;${state.timelineMode === 'booked' ? 'background:#238636;color:#3FB950;font-weight:500' : 'color:#6E7681'}">Booked</div>
          </div>
          <button class="cal-btn" onclick="calToday()" style="width:auto;padding:0 10px;font-size:11px">Today</button>
        </div>
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
      const dates = getProjectDates(p);
      if (!dates.start) return false;
      const sd = dates.start.substring(0, 10);
      if (sd === dateStr) return true;
      if (dates.end) {
        const start = new Date(dates.start);
        const end = new Date(dates.end);
        const check = new Date(dateStr);
        return check >= start && check <= end;
      }
      return false;
    })
    .map(p => {
      const dates = getProjectDates(p);
      const colorMap = { lead: 'gray', proposal: 'blue', sent: 'amber', contract: 'green' };
      return { id: p.id, name: p.name, color: colorMap[p.stage] || 'gray', booked: dates.source === 'booked' };
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

// ── Team ──
const ROLE_OPTIONS = DASHBOARD_ACCESS;

function renderTeam(c) {
  const activeMemberId = getActiveTeamMemberId();
  c.innerHTML = `
    <div style="max-width:640px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-size:18px;font-weight:600;color:#E6EDF3">Team</div>
          <div style="font-size:12px;color:#6E7681;margin-top:2px">${state.team.length} member${state.team.length !== 1 ? 's' : ''} · ${state.team.filter(m => m.status === 'pending').length} pending invite</div>
        </div>
        <button class="btn-primary" onclick="showAddMemberDialog()" style="padding:10px 20px;font-size:13px">+ Add Member</button>
      </div>
      <div class="card" style="margin-bottom:16px;padding:12px 16px;background:#0D1626;border-color:#1565C0">
        <div style="font-size:11px;color:#58A6FF;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Active User</div>
        <div style="font-size:14px;color:#E6EDF3;font-weight:500">${esc(currentUserName)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
          ${(getTeamMember(activeMemberId)?.access || []).map(a => {
            const da = DASHBOARD_ACCESS.find(d => d.key === a);
            return da ? '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:' + da.color + '22;color:' + da.color + ';border:1px solid ' + da.color + '44">' + da.label + '</span>' : '';
          }).join('')}
        </div>
      </div>
      <div class="alert alert-info" style="margin-bottom:16px">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v3M8 10v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <span>Set up team accounts now. When the database is ready, each pending member will receive an invite email to claim their account.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${state.team.map(m => {
          const isActive = m.id === activeMemberId;
          const primaryColor = DASHBOARD_ACCESS.find(d => d.key === m.primaryRole)?.color || '#6E7681';
          return `
            <div class="card card-sm" style="${isActive ? 'border-color:#1565C0;background:#0D1626' : ''}">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:44px;height:44px;border-radius:50%;background:${primaryColor}22;border:1.5px solid ${primaryColor};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:${primaryColor};flex-shrink:0">${esc(m.initials || getInitials(m.name))}</div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:14px;font-weight:500;color:#E6EDF3">${esc(m.name)}</span>
                    ${isActive ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#1565C0;color:#fff;font-weight:600">YOU</span>' : ''}
                    ${m.status === 'pending' ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#1A150D;color:#D29922;border:1px solid #9E6A03;font-weight:600">PENDING INVITE</span>' : ''}
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">
                    ${(m.access || []).map(a => {
                      const da = DASHBOARD_ACCESS.find(d => d.key === a);
                      return da ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:' + da.color + '15;color:' + da.color + '">' + da.label + '</span>' : '';
                    }).join('')}
                  </div>
                  ${m.email ? '<div style="font-size:11px;color:#6E7681;margin-top:3px">' + esc(m.email) + '</div>' : ''}
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                  ${!isActive ? '<button class="btn btn-sm" onclick="switchUser(' + m.id + ')" style="color:#58A6FF;border-color:#1565C0">Switch</button>' : ''}
                  <button class="btn btn-sm" onclick="showEditMemberDialog(${m.id})">Edit</button>
                  ${state.team.length > 1 && !isActive ? '<button class="btn btn-sm btn-danger" onclick="confirmRemoveMember(' + m.id + ')">✕</button>' : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function showAddMemberDialog() { showMemberDialog(null); }
function showEditMemberDialog(id) { showMemberDialog(id); }

function showMemberDialog(memberId) {
  const existing = memberId ? getTeamMember(memberId) : null;
  const title = existing ? 'Edit Team Member' : 'Add Team Member';
  const existingAccess = existing?.access || [];
  let modal = document.getElementById('team-dialog');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'team-dialog';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:480px">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="modal-close" onclick="document.getElementById('team-dialog')?.remove()">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input class="form-input" id="tm-name" value="${existing ? esc(existing.name) : ''}" placeholder="Full name">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" id="tm-email" type="email" value="${existing ? esc(existing.email || '') : ''}" placeholder="email@company.com">
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-input" id="tm-phone" value="${existing ? esc(existing.phone || '') : ''}" placeholder="(555) 123-4567">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Dashboard Access</label>
          <div style="font-size:11px;color:#6E7681;margin-bottom:8px">Check all dashboards this person should have access to</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${DASHBOARD_ACCESS.map(da => {
              const checked = existingAccess.includes(da.key);
              return `
                <div onclick="toggleAccessCheck('${da.key}')" class="checklist-item ${checked ? 'checked' : ''}" data-access="${da.key}" style="padding:10px 12px;border-radius:8px;border:1px solid ${checked ? da.color + '44' : '#1C2333'};background:${checked ? da.color + '11' : '#0D1117'};cursor:pointer;border-bottom:none;min-height:auto">
                  <div class="checklist-box" style="${checked ? 'background:' + da.color + ';border-color:' + da.color : ''}">
                    <svg class="checklist-check" width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div style="flex:1">
                    <div style="font-size:13px;font-weight:500;color:${checked ? da.color : '#C9D1D9'}">${da.label}</div>
                    <div style="font-size:11px;color:#6E7681">${da.desc}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Primary Dashboard</label>
          <select class="form-select" id="tm-primary">
            ${DASHBOARD_ACCESS.map(da => `<option value="${da.key}" ${existing?.primaryRole === da.key ? 'selected' : ''}>${da.label}</option>`).join('')}
          </select>
          <div style="font-size:11px;color:#6E7681;margin-top:4px">The default view when this person opens the app</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn-primary" onclick="saveMemberDialog(${memberId || 'null'})" style="flex:1;padding:12px">Save</button>
          <button class="btn" onclick="document.getElementById('team-dialog')?.remove()">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function toggleAccessCheck(key) {
  const el = document.querySelector(`[data-access="${key}"]`);
  if (!el) return;
  el.classList.toggle('checked');
  const da = DASHBOARD_ACCESS.find(d => d.key === key);
  const checked = el.classList.contains('checked');
  const box = el.querySelector('.checklist-box');
  if (box) box.style.cssText = checked ? `background:${da.color};border-color:${da.color}` : '';
  el.style.borderColor = checked ? da.color + '44' : '#1C2333';
  el.style.background = checked ? da.color + '11' : '#0D1117';
  const label = el.querySelector('div > div:first-child');
  if (label) label.style.color = checked ? da.color : '#C9D1D9';
}

function saveMemberDialog(memberId) {
  const name = document.getElementById('tm-name')?.value?.trim();
  const email = document.getElementById('tm-email')?.value?.trim() || '';
  const phone = document.getElementById('tm-phone')?.value?.trim() || '';
  const primaryRole = document.getElementById('tm-primary')?.value || 'installer';
  const access = [];
  document.querySelectorAll('#team-dialog [data-access]').forEach(el => {
    if (el.classList.contains('checked')) access.push(el.dataset.access);
  });
  if (!name) { alert('Please enter a name.'); return; }
  if (access.length === 0) { alert('Please select at least one dashboard access.'); return; }
  if (memberId) {
    const member = getTeamMember(memberId);
    if (member) {
      member.name = name;
      member.access = access;
      member.primaryRole = primaryRole;
      member.email = email;
      member.phone = phone;
      member.initials = getInitials(name);
      if (memberId === getActiveTeamMemberId()) {
        currentUserName = name;
        currentUserRole = primaryRole;
        localStorage.setItem('vi_user', name);
        localStorage.setItem('vi_role', primaryRole);
      }
    }
  } else {
    addTeamMember(name, access, primaryRole, email, phone);
  }
  save('vi_team', state.team);
  document.getElementById('team-dialog')?.remove();
  renderTeam(document.getElementById('content'));
}

function confirmRemoveMember(id) {
  const member = getTeamMember(id);
  if (!member) return;
  if (confirm(`Remove ${member.name} from the team?`)) {
    removeTeamMember(id);
    renderTeam(document.getElementById('content'));
  }
}

// ── Intake ──
const intakeState = { step: 1, data: {} };

function renderIntake(c) {
  const s = intakeState.step;
  const d = intakeState.data;
  const steps = [
    { num: 1, label: 'Client' }, { num: 2, label: 'Venue' }, { num: 3, label: 'Scope' },
    { num: 4, label: 'Details' }, { num: 5, label: 'Quote' }, { num: 6, label: 'Notes' }
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
        <div class="form-group"><label class="form-label">Company / Client Name</label>
          <input class="form-input" id="int-client" value="${esc(d.client || '')}" placeholder="Search or type client name…"></div>
        <div class="form-group"><label class="form-label">Contact Name</label>
          <input class="form-input" id="int-contact" value="${esc(d.contact || '')}" placeholder="Primary contact"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Email</label>
            <input class="form-input" id="int-email" type="email" value="${esc(d.email || '')}" placeholder="email@example.com"></div>
          <div class="form-group"><label class="form-label">Phone</label>
            <input class="form-input" id="int-phone" value="${esc(d.phone || '')}" placeholder="(555) 123-4567"></div>
        </div>
        <div class="form-group"><label class="form-label">Address</label>
          <input class="form-input" id="int-address" value="${esc(d.address || '')}" placeholder="Street address, city, state"></div>
      </div>
    `;
  } else if (s === 2) {
    const venues = ['Church / Worship', 'Event Center', 'School', 'Theater', 'Office / Conference', 'Studio / Broadcast'];
    content = `
      <div class="card" style="max-width:560px;margin:0 auto">
        <h3 style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:16px">Venue Type</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${venues.map(v => `
            <div onclick="selectVenue(this, '${v}')" class="card card-sm" style="cursor:pointer;text-align:center;border-color:${d.venue === v ? '#1565C0' : '#1C2333'};background:${d.venue === v ? '#0D1626' : '#161B22'}">
              <div style="font-size:13px;font-weight:500;color:${d.venue === v ? '#58A6FF' : '#C9D1D9'}">${v}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (s === 3) {
    const scopes = [
      { key: 'audio', label: 'Audio / PA' }, { key: 'video', label: 'Video / Display' },
      { key: 'lighting', label: 'Lighting' }, { key: 'led', label: 'LED Wall' },
      { key: 'control', label: 'Control System' }, { key: 'streaming', label: 'Streaming / Broadcast' },
      { key: 'camera', label: 'Camera System' }, { key: 'infrastructure', label: 'Infrastructure' }
    ];
    const sel = d.scope || [];
    content = `
      <div class="card" style="max-width:560px;margin:0 auto">
        <h3 style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:4px">System Scope</h3>
        <p style="font-size:12px;color:#6E7681;margin-bottom:16px">Select all systems included in this project</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${scopes.map(sc => {
            const active = sel.includes(sc.key);
            return `<div onclick="toggleScope('${sc.key}')" class="card card-sm" style="cursor:pointer;display:flex;align-items:center;gap:8px;border-color:${active ? '#1565C0' : '#1C2333'};background:${active ? '#0D1626' : '#161B22'}">
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
        <div class="form-group"><label class="form-label">Use Case / Description</label>
          <textarea class="form-textarea" id="int-usecase" placeholder="Describe how the system will be used…">${esc(d.usecase || '')}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Project Type</label>
            <select class="form-select" id="int-type">
              <option value="">Select…</option>
              <option value="new" ${d.type === 'new' ? 'selected' : ''}>New Construction</option>
              <option value="retrofit" ${d.type === 'retrofit' ? 'selected' : ''}>Retrofit / Upgrade</option>
            </select></div>
          <div class="form-group"><label class="form-label">Timeline</label>
            <select class="form-select" id="int-timeline">
              <option value="">Select…</option>
              <option value="asap" ${d.timeline === 'asap' ? 'selected' : ''}>ASAP</option>
              <option value="1-3months" ${d.timeline === '1-3months' ? 'selected' : ''}>1–3 Months</option>
              <option value="3-6months" ${d.timeline === '3-6months' ? 'selected' : ''}>3–6 Months</option>
              <option value="6plus" ${d.timeline === '6plus' ? 'selected' : ''}>6+ Months</option>
            </select></div>
        </div>
        <div class="form-group"><label class="form-label">Budget Range (optional)</label>
          <input class="form-input" id="int-budget" value="${esc(d.budget || '')}" placeholder="e.g. $50,000 – $75,000"></div>
        <div class="form-group"><label class="form-label">Owner-Furnished Equipment (OFE)</label>
          <textarea class="form-textarea" id="int-ofe" rows="3" placeholder="Any existing equipment client wants to keep/reuse?">${esc(d.ofe || '')}</textarea></div>
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
          <div class="form-group"><label class="form-label">Differentiator</label>
            <select class="form-select" id="int-differentiator">
              <option value="">Select what varies between tiers…</option>
              <option value="manufacturer" ${d.differentiator === 'manufacturer' ? 'selected' : ''}>Manufacturer Quality / Tier</option>
              <option value="size" ${d.differentiator === 'size' ? 'selected' : ''}>System Size (Small / Medium / Large)</option>
              <option value="features" ${d.differentiator === 'features' ? 'selected' : ''}>Feature Set (Core / Standard / Full)</option>
              <option value="dotpitch" ${d.differentiator === 'dotpitch' ? 'selected' : ''}>LED Dot Pitch / Resolution</option>
              <option value="custom" ${d.differentiator === 'custom' ? 'selected' : ''}>Custom</option>
            </select></div>
        ` : ''}
        <div class="form-group" style="margin-top:16px"><label class="form-label">Payment Approach</label>
          <select class="form-select" id="int-payment">
            <option value="prepay" ${(d.payment || 'prepay') === 'prepay' ? 'selected' : ''}>Prepay Discount (90% upfront = 7% off equipment + 2% off labor)</option>
            <option value="standard" ${d.payment === 'standard' ? 'selected' : ''}>Standard (100% equipment upfront, labor on completion)</option>
            <option value="progress" ${d.payment === 'progress' ? 'selected' : ''}>Progress Billing (multi-month project)</option>
          </select></div>
      </div>
    `;
  } else if (s === 6) {
    content = `
      <div class="card" style="max-width:560px;margin:0 auto">
        <h3 style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:16px">Notes & Walkthrough</h3>
        <div class="form-group"><label class="form-label">Walkthrough Notes</label>
          <textarea class="form-textarea" id="int-notes" rows="4" placeholder="Observations from the site walkthrough…">${esc(d.notes || '')}</textarea></div>
        <div class="form-group"><label class="form-label">Registration Opportunity</label>
          <select class="form-select" id="int-registration">
            <option value="no" ${(d.registration || 'no') === 'no' ? 'selected' : ''}>No</option>
            <option value="yes" ${d.registration === 'yes' ? 'selected' : ''}>Yes — register with vendors</option>
          </select></div>
        <div class="form-group"><label class="form-label">Additional Notes</label>
          <textarea class="form-textarea" id="int-addnotes" rows="3" placeholder="Anything else…">${esc(d.addnotes || '')}</textarea></div>
      </div>
    `;
  }
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
      const range = document.createRange();
      range.selectNode(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      alert('SOW copied!');
    });
  }
}

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
      const projects = allProjects.filter(p => (p.stage || '').toLowerCase() !== 'template');
      const existingMap = {};
      state.projects.forEach(p => { existingMap[p.id] = p; });
      state.projects = projects.map(p => {
        const enriched = enrichProject(p);
        const existing = existingMap[enriched.id];
        if (existing) enriched.archived = existing.archived;
        return enriched;
      });
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
      .filter(p => {
        const id = p.client?.id || p.client_id;
        return id && !clientNameCache[id];
      })
      .map(p => p.client?.id || p.client_id)
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
            phone: data.primary_contact_phone_number_1 || data.primary_contact_phone || '',
            contact_name: [data.primary_contact_first_name, data.primary_contact_last_name].filter(Boolean).join(' '),
            address: data.address || data.street || '',
            city: data.city || '',
            state: data.state || '',
            zip: data.zip || data.postal_code || ''
          };
        }
      } catch (e) {}
    }));
    if (i + 5 < clientIds.length) await new Promise(r => setTimeout(r, 300));
  }
  state.projects.forEach(p => {
    const clientId = p.client?.id || p.client_id;
    if (clientId && clientNameCache[clientId]) {
      const cl = clientNameCache[clientId];
      p.client_name = cl.name;
      p.primary_contact_name = cl.contact_name;
      p.primary_contact_email = cl.email;
      p.primary_contact_phone = cl.phone;
      if (!p.address && cl.address) p.address = cl.address;
      if (!p.city && cl.city) p.city = cl.city;
      if (!p.state_abbr && cl.state) p.state_abbr = cl.state;
      if (!p.zip && cl.zip) p.zip = cl.zip;
    }
  });
  try { localStorage.setItem('vi_projects_cache', JSON.stringify(state.projects)); } catch(e) {}
  renderCurrentPage();
}

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
  if (sel) {
    sel.innerHTML = state.team.map(m => {
      const da = DASHBOARD_ACCESS.find(d => d.key === m.primaryRole);
      return `<option value="${m.id}" ${m.id === getActiveTeamMemberId() ? 'selected' : ''}>${esc(m.name)} (${da?.label || m.primaryRole})</option>`;
    }).join('');
    sel.onchange = function() { switchUser(parseInt(this.value)); };
  }
  const userAvatar = document.querySelector('.user-avatar');
  const userName = document.querySelector('.user-name');
  const userRole = document.querySelector('.user-role');
  if (userAvatar) userAvatar.textContent = getInitials(currentUserName);
  if (userName) userName.textContent = currentUserName;
  if (userRole) {
    const da = DASHBOARD_ACCESS.find(d => d.key === currentUserRole);
    userRole.textContent = da?.label || currentUserRole;
  }
  injectBottomNav();
  injectRightPanel();
  const activeMemberInit = getTeamMember(getActiveTeamMemberId());
  if (activeMemberInit && activeMemberInit.access.includes('admin')) {
    const toolsSection = document.querySelectorAll('.nav-section')[1];
    if (toolsSection && !document.querySelector('[data-page="team"]')) {
      const teamLink = document.createElement('a');
      teamLink.className = 'nav-item';
      teamLink.dataset.page = 'team';
      teamLink.onclick = () => navigate('team');
      teamLink.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" stroke-width="1.2"/><circle cx="11" cy="5" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M1 14c0-2.761 2.239-4.5 5-4.5s5 1.739 5 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M11 9.5c1.933 0 3.5 1.119 3.5 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><span>Team</span>';
      toolsSection.appendChild(teamLink);
    }
  }
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
