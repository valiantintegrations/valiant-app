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

// ── Permission System (Pass 3A) ──
// Flag-based permissions. Bundles are presets. Users get a bundle + optional overrides.
// All permission keys in use across the app:
const PERMISSION_KEYS = [
  // Admin / users
  'admin.system',                 // Master Admin — can grant any permission
  'admin.view_users',             // See Admin > Users list
  'admin.assign_permissions',     // Change what bundle or permissions another user has (capped to grantor's level)
  'admin.edit_bundles',           // Tune what each bundle includes (Master Admin only, practically)
  // User management — granular by the bundle of the user being managed
  // Each key grants add/edit/remove for users on that bundle
  'admin.edit_users.installer',
  'admin.edit_users.warehouse',
  'admin.edit_users.designer',
  'admin.edit_users.project_manager',
  'admin.edit_users.sales',
  'admin.edit_users.accountant',
  'admin.edit_users.design_admin',
  'admin.edit_users.install_admin',
  'admin.edit_users.owner_cfo',
  'admin.edit_users.master_admin',  // Only Master Admin should hold this
  // Projects
  'projects.view_all',
  'projects.create',
  'projects.edit',
  'projects.delete',
  'projects.change_stage',
  // Team assignment — granular by role slot being filled
  'projects.assign_team.sales',
  'projects.assign_team.design',
  'projects.assign_team.pm',
  'projects.assign_team.install',
  'projects.assign_team.warehouse',
  // Design
  'design.view',
  'design.edit',
  'design.assign_tasks',          // Assign sub-tasks within Design phase
  // Install
  'install.view',
  'install.edit',
  'install.manage_crew',
  // Purchasing / warehouse
  'purchasing.view',
  'purchasing.edit',
  'warehouse.receive',
  'warehouse.view_inventory',
  // Vendors
  'vendors.view',
  'vendors.manage',
  // Financials — tiered
  'financials.view_project_totals',  // Total value, equipment price, labor price per project
  'financials.view_margins',         // Margin %, cost basis, equipment cost vs price
  'financials.view_cashflow',        // Salary, direct costs, ops expenses — CFO / Owner tier
  // Dashboard visibility — grants access to department management dashboards
  'dashboards.install_mgmt',      // Installation Department Management dashboard
  'dashboards.design_mgmt',       // Design Department Management dashboard
  'dashboards.sales_mgmt',        // Sales Department Management dashboard
  // Templates — Kris and others can suggest additions; reviewers accept/reject
  'templates.review',             // Review incoming template suggestions and accept/reject them
  // Sales / client
  'sales.view_pipeline',
  'sales.send_proposals',
  'client.view_contact'
];

// Helper: all user-management permissions (used in Master Admin / Owner bundles)
const _ALL_USER_EDIT_PERMS = [
  'admin.edit_users.installer', 'admin.edit_users.warehouse', 'admin.edit_users.designer',
  'admin.edit_users.project_manager', 'admin.edit_users.sales', 'admin.edit_users.accountant',
  'admin.edit_users.design_admin', 'admin.edit_users.install_admin',
  'admin.edit_users.owner_cfo', 'admin.edit_users.master_admin'
];
const _ALL_ASSIGN_TEAM_PERMS = [
  'projects.assign_team.sales', 'projects.assign_team.design',
  'projects.assign_team.pm', 'projects.assign_team.install', 'projects.assign_team.warehouse'
];

// Bundle presets — editable by Master Admin (future: via Admin > Bundles)
const DEFAULT_BUNDLES = {
  'master_admin': {
    label: 'Master Admin',
    desc: 'Every permission. Only Master Admins can grant admin.system.',
    color: '#F85149',
    permissions: [...PERMISSION_KEYS]
  },
  'owner_cfo': {
    label: 'Owner / CFO',
    desc: 'Everything except granting Master Admin status',
    color: '#BC8CFF',
    permissions: PERMISSION_KEYS.filter(k => k !== 'admin.system' && k !== 'admin.edit_users.master_admin')
  },
  'install_admin': {
    label: 'Install Admin',
    desc: 'Manage install + warehouse users, assign install/warehouse teams, basic project financials',
    color: '#FF7B72',
    permissions: [
      'admin.view_users','admin.assign_permissions',
      'admin.edit_users.installer','admin.edit_users.warehouse',
      'projects.view_all','projects.edit','projects.change_stage',
      'projects.assign_team.install','projects.assign_team.warehouse',
      'install.view','install.edit','install.manage_crew',
      'purchasing.view','warehouse.receive','warehouse.view_inventory',
      'vendors.view',
      'financials.view_project_totals',
      'design.view','design.assign_tasks',
      'client.view_contact',
      'templates.review',
      'dashboards.install_mgmt'
    ]
  },
  'design_admin': {
    label: 'Design Admin',
    desc: 'Manage designers, assign design teams, design oversight, project financials (no margins)',
    color: '#D29922',
    permissions: [
      'admin.view_users','admin.assign_permissions',
      'admin.edit_users.designer',
      'projects.view_all','projects.edit',
      'projects.assign_team.design',
      'design.view','design.edit','design.assign_tasks',
      'install.view',
      'purchasing.view','purchasing.edit',
      'vendors.view','vendors.manage',
      'financials.view_project_totals',
      'client.view_contact',
      'templates.review',
      'dashboards.design_mgmt'
    ]
  },
  'sales': {
    label: 'Sales',
    desc: 'Pipeline, proposals, project financials, assign sales / design work',
    color: '#3FB950',
    permissions: [
      'projects.view_all','projects.create','projects.edit','projects.change_stage',
      'projects.assign_team.sales',
      'design.view','design.assign_tasks',
      'install.view',
      'sales.view_pipeline','sales.send_proposals',
      'financials.view_project_totals',
      'client.view_contact',
      'vendors.view',
      'dashboards.sales_mgmt'
    ]
  },
  'project_manager': {
    label: 'Project Manager',
    desc: 'Cross-project oversight, can assign all role slots, project financials',
    color: '#58A6FF',
    permissions: [
      'projects.view_all','projects.edit','projects.change_stage',
      ..._ALL_ASSIGN_TEAM_PERMS,
      'design.view','design.assign_tasks',
      'install.view','install.edit','install.manage_crew',
      'purchasing.view','warehouse.view_inventory',
      'vendors.view',
      'financials.view_project_totals',
      'client.view_contact',
      'dashboards.install_mgmt','dashboards.design_mgmt','dashboards.sales_mgmt'
    ]
  },
  'designer': {
    label: 'Designer',
    desc: 'Design work on assigned projects, equipment visibility (no margins)',
    color: '#A371F7',
    permissions: [
      'design.view','design.edit','design.assign_tasks',
      'install.view',
      'purchasing.view',
      'vendors.view',
      'financials.view_project_totals',
      'client.view_contact'
    ]
  },
  'installer': {
    label: 'Installer',
    desc: 'Assigned jobs only, no financials',
    color: '#F0883E',
    permissions: [
      'install.view','install.edit',
      'design.view'
    ]
  },
  'warehouse': {
    label: 'Warehouse',
    desc: 'Receive equipment, manage inventory, no financials',
    color: '#6E7681',
    permissions: [
      'warehouse.receive','warehouse.view_inventory',
      'purchasing.view',
      'install.view'
    ]
  },
  'accountant': {
    label: 'Accountant',
    desc: 'Financials across all projects; cannot edit projects or assign work',
    color: '#8B949E',
    permissions: [
      'projects.view_all',
      'sales.view_pipeline',
      'financials.view_project_totals','financials.view_margins','financials.view_cashflow',
      'vendors.view'
    ]
  }
};

// state.bundles and state.userPermissions are initialized after state is declared (see below)

function getUserPermissions(memberId) {
  const up = state.userPermissions[memberId];
  if (!up) return null;
  return up;
}

function getEffectivePermissions(memberId) {
  // Returns a Set of permission keys the user effectively has
  const up = getUserPermissions(memberId);
  const set = new Set();
  if (!up) return set;
  const bundle = state.bundles[up.bundle];
  if (bundle) bundle.permissions.forEach(p => set.add(p));
  if (up.overrides) {
    Object.entries(up.overrides).forEach(([k, v]) => {
      if (v === true) set.add(k);
      else if (v === false) set.delete(k);
    });
  }
  return set;
}

function hasPermission(memberId, permKey) {
  return getEffectivePermissions(memberId).has(permKey);
}

function currentUserHasPermission(permKey) {
  const id = getActiveTeamMemberId();
  if (!id) return false;
  return hasPermission(id, permKey);
}

function setUserBundle(memberId, bundleKey) {
  if (!state.userPermissions[memberId]) state.userPermissions[memberId] = {};
  state.userPermissions[memberId].bundle = bundleKey;
  if (!state.userPermissions[memberId].overrides) state.userPermissions[memberId].overrides = {};
  save('vi_user_perms', state.userPermissions);
}

function setUserPermissionOverride(memberId, permKey, value) {
  // value: true (grant), false (deny), null (clear override — use bundle default)
  if (!state.userPermissions[memberId]) state.userPermissions[memberId] = { bundle: 'installer', overrides: {} };
  if (!state.userPermissions[memberId].overrides) state.userPermissions[memberId].overrides = {};
  if (value === null) {
    delete state.userPermissions[memberId].overrides[permKey];
  } else {
    state.userPermissions[memberId].overrides[permKey] = value;
  }
  save('vi_user_perms', state.userPermissions);
}

function setUserRole(role) {
  currentUserRole = role;
  localStorage.setItem('vi_role', role);
  const sel = document.getElementById('role-select');
  if (sel) sel.value = role;
  renderCurrentPage();
}

// canSee() — LEGACY, still used across the codebase.
// New calls should use currentUserHasPermission('financials.view_margins') etc.
// This wrapper routes legacy permission keys to the new system where possible.
function canSee(permission) {
  // Try new system first if user has assigned bundle
  const newMap = {
    financials:        'financials.view_project_totals',
    labor:             'financials.view_project_totals',
    equipment_total:   'financials.view_project_totals',
    client_contact:    'client.view_contact',
    margins:           'financials.view_margins',
    change_stage:      'projects.change_stage',
    view_all_projects: 'projects.view_all'
  };
  const newKey = newMap[permission];
  const activeMember = getTeamMember(getActiveTeamMemberId());
  if (activeMember && state.userPermissions[activeMember.id]) {
    if (newKey) return currentUserHasPermission(newKey);
    // Special case: legacy 'assign_team' means "can assign to any role slot"
    if (permission === 'assign_team') {
      return _ALL_ASSIGN_TEAM_PERMS.some(k => currentUserHasPermission(k));
    }
  }
  // Fall back to legacy role-based map
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
  projectFiles: JSON.parse(localStorage.getItem('vi_project_files') || '{}'),
  contractDates: JSON.parse(localStorage.getItem('vi_contract_dates') || '{}'),
  projectType: JSON.parse(localStorage.getItem('vi_project_type') || '{}'),
  milestones: JSON.parse(localStorage.getItem('vi_milestones') || '{}'),
  readyForInstall: JSON.parse(localStorage.getItem('vi_ready_install') || '{}'),
  estimatedInstallOverride: JSON.parse(localStorage.getItem('vi_estimated_install') || '{}'),
  meetingLogs: JSON.parse(localStorage.getItem('vi_meeting_logs') || '{}'),
  planningAssignments: JSON.parse(localStorage.getItem('vi_planning_assignments') || '{}'),
  vehicles: JSON.parse(localStorage.getItem('vi_vehicles') || '[]'),
  tools: JSON.parse(localStorage.getItem('vi_tools') || '[]'),
  bundles: JSON.parse(localStorage.getItem('vi_bundles') || 'null') || JSON.parse(JSON.stringify(DEFAULT_BUNDLES)),
  userPermissions: JSON.parse(localStorage.getItem('vi_user_perms') || '{}'),
  dashboardMode: localStorage.getItem('vi_dashboard_mode') || 'mine',
  subtasks: JSON.parse(localStorage.getItem('vi_subtasks') || '{}'),
  templateSuggestions: JSON.parse(localStorage.getItem('vi_template_suggestions') || '[]'),
  templateCustomizations: JSON.parse(localStorage.getItem('vi_template_customizations') || '{}'),
  projectPins: JSON.parse(localStorage.getItem('vi_project_pins') || '{}'),
  projectSiteNotes: JSON.parse(localStorage.getItem('vi_project_site_notes') || '{}'),
  closeoutChecklist: JSON.parse(localStorage.getItem('vi_closeout_checklist') || '{}'),
  actionsManual: JSON.parse(localStorage.getItem('vi_actions_manual') || '[]'),
  actionsState: JSON.parse(localStorage.getItem('vi_actions_state') || '{}'),
  actionsArchive: JSON.parse(localStorage.getItem('vi_actions_archive') || '[]'),
  actionsTouchLog: JSON.parse(localStorage.getItem('vi_actions_touch_log') || '{}'),
  mobilizationFlags: JSON.parse(localStorage.getItem('vi_mobilization_flags') || '{}'),
  mobilizationEditing: {},
  salesDashTab: localStorage.getItem('vi_sales_dash_tab') || 'action',
  mapsApiKey: null,
  mapsApiLoaded: false
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

// Permissions bootstrap — migrate existing team to bundles on first load
(function migrateUsersToBundles() {
  // Detect stale bundles (old permission keys) and refresh to new DEFAULT_BUNDLES
  // Check Master Admin bundle for the presence of old 'admin.edit_users' (without suffix)
  const stale = state.bundles?.master_admin?.permissions?.includes('admin.edit_users');
  if (stale) {
    state.bundles = JSON.parse(JSON.stringify(DEFAULT_BUNDLES));
    save('vi_bundles', state.bundles);
  }

  let changed = false;
  const roleToBundle = {
    'admin': 'master_admin',
    'sales': 'sales',
    'design': 'designer',
    'project_manager': 'project_manager',
    'installer': 'installer'
  };
  state.team.forEach(m => {
    if (!state.userPermissions[m.id]) {
      if (m.id === 1 || m.name === 'Jacob') {
        state.userPermissions[m.id] = { bundle: 'master_admin', overrides: {} };
      } else {
        const bundleKey = roleToBundle[m.primaryRole] || 'installer';
        state.userPermissions[m.id] = { bundle: bundleKey, overrides: {} };
      }
      changed = true;
    }
    // Clear stale permission overrides using old keys
    if (state.userPermissions[m.id].overrides) {
      const oldKeys = ['admin.edit_users','projects.assign_team'];
      oldKeys.forEach(k => {
        if (k in state.userPermissions[m.id].overrides) {
          delete state.userPermissions[m.id].overrides[k];
          changed = true;
        }
      });
    }
  });
  if (changed) save('vi_user_perms', state.userPermissions);
})();

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

  // Re-evaluate nav visibility (Team/Admin show/hide based on new user)
  document.querySelector('[data-page="team"]')?.remove();
  document.querySelector('[data-page="admin"]')?.remove();
  if (typeof refreshAdminNav === 'function') refreshAdminNav();

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

// Canonical scope tags used on intake + mobilization. Drives which design checklists apply.
const SCOPE_TAGS = [
  'PA System',
  'LED Wall',
  'Key Lights',
  'House Lights',
  'Broadcast Video System',
  'Streaming Audio System',
  'Camera',
  'Control (Q-sys)',
  'Control (AHM)',
  'Control (Atlona)',
  'Distributed Audio',
  'TVs',
  'Projection',
  'Conferencing',
  'Mics',
  'Acoustic Treatment',
  'Drape',
  'Network'
];

// Mobilization checklist items — used by Sales Action tab + project Overview.
// Each item auto-checks based on derived project state (with optional manual flags).
const MOBILIZATION_ITEMS = [
  { key: 'sales_lead',       label: 'Sales Lead designated',       hint: 'Usually pre-set at project creation' },
  { key: 'design_lead',      label: 'Design Lead designated',      hint: 'Person owning design phase work' },
  { key: 'pm_lead',          label: 'PM Lead designated',          hint: 'Project manager for cross-phase coordination' },
  { key: 'install_window',   label: 'Estimated install window set',hint: 'Approximate dates for forward planning' },
  { key: 'scope_tags',       label: 'Project scope tags confirmed',hint: 'Drives which design checklists apply' },
  { key: 'site_briefing',    label: 'Site briefing started',       hint: 'Location pins added — or skipped if not needed' },
  { key: 'design_kickoff',   label: 'Initial design kickoff scheduled', hint: 'Meeting on the books to start design' }
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

// "Send to Design & Install" — finalizes mobilization. Triggered from the
// mobilization dialog's footer button when all 7 checklist items are done.
// Effects: contract reviewed flag set, project drops out of Sales Dept's
// mobilization queue, project surfaces on Planning dashboard.
function sendProjectToInstall(projectId) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  // Hard guard — should be enforced by UI but double-check
  if (!isMobilizationComplete(projectId)) {
    showToast('Mobilization checklist incomplete', 'error');
    return;
  }
  // Set the reviewed flag (uses existing contractReviewed map for backwards compat)
  contractReviewed[projectId] = new Date().toISOString();
  localStorage.setItem('vi_contract_reviewed', JSON.stringify(contractReviewed));
  // Also set project field for new code paths
  p.contract_reviewed_at = contractReviewed[projectId];
  save('vi_projects', state.projects);
  // Close the dialog
  document.getElementById('mobilization-dialog')?.remove();
  showToast(`${p.name} sent to Design & Install`, 'success');
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

function setBookedDates(projectId, start, end, opts) {
  if (!start) {
    delete state.bookedDates[projectId];
  } else {
    const entry = { start, end: end || '' };
    if (opts) {
      if (opts.excludeWeekends !== undefined) entry.excludeWeekends = !!opts.excludeWeekends;
      if (Array.isArray(opts.weekendIncludes)) entry.weekendIncludes = [...opts.weekendIncludes];
    }
    state.bookedDates[projectId] = entry;
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
  const stored = state.bookedDates?.[projectId] || {};

  openInstallWindowPicker({
    projectId,
    mode: 'booked',
    initialStart: existing?.start,
    initialEnd: existing?.end,
    initialExcludeWeekends: stored.excludeWeekends !== false, // default true if not stored
    initialWeekendIncludes: stored.weekendIncludes || [],
    onConfirm: (start, end, result) => {
      setBookedDates(projectId, start, end, {
        excludeWeekends: result.excludeWeekends,
        weekendIncludes: result.weekendIncludes
      });
      renderCurrentPage();
    }
  });
}

// Legacy save handler retained for any inline callers; new picker calls setBookedDates directly
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
    // Jetbuilt additional fields (Pass 1 of Overview redesign)
    jb_project_type: p.project_type || '',
    jb_close_date: p.close_date || '',
    jb_commission_date: p.commission_date || '',
    jb_estimated_install: p.estimated_install_on || '',
    jb_price_valid_until: p.price_valid_until || '',
    jb_probability: parseFloat(p.probability) || null,
    jb_custom_id: p.custom_id || '',
    jb_version: p.version || '',
    jb_contract_number: p.contract_number || '',
    jb_budget: parseFloat(p.budget) || null,
    jb_paid_to_date: parseFloat(p.paid_to_date) || 0,
    jb_total_margin: p.total_margin ? parseFloat(p.total_margin) : null,
    jb_equipment_margin: p.equipment_margin ? parseFloat(p.equipment_margin) : null,
    jb_shipping_total: parseFloat(p.shipping_total) || 0,
    jb_tax_total: parseFloat(p.tax_total) || 0,
    jb_owner_name: p.owner?.full_name || '',
    jb_pm_name: p.project_manager?.full_name || '',
    jb_engineer_name: p.engineer?.full_name || '',
    jb_market_segment: p.market_segment?.name || '',
    jb_company_location: p.company_location?.name || '',
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

  const canChangeStage = currentUserHasPermission('projects.change_stage');
  const canDelete = currentUserHasPermission('projects.delete');

  const stageItems = canChangeStage ? STAGES.map(s =>
    `<div onclick="moveProjectToStage(${projectId},'${s.key}');document.getElementById('move-menu')?.remove()" style="padding:14px 20px;color:#C9D1D9;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;-webkit-tap-highlight-color:transparent">
      <span class="status-pill status-${s.color}" style="font-size:11px">${s.label}</span>
    </div>`
  ).join('') : '';

  const archiveItems = canDelete ? ARCHIVE_BINS.map(b =>
    `<div onclick="archiveProject(${projectId},'${b.key}');document.getElementById('move-menu')?.remove()" style="padding:14px 20px;color:${b.color};font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px">
      ${b.icon} ${b.label}
    </div>`
  ).join('') : '';

  const likely = isLikelyToClose(projectId);
  menu.innerHTML = `
    <div onclick="toggleLikelyToClose(${projectId});document.getElementById('move-menu')?.remove()" style="padding:14px 20px;color:${likely ? '#6E7681' : '#3FB950'};font-size:14px;cursor:pointer;display:flex;align-items:center;gap:10px;background:${likely ? 'transparent' : '#0D1A0E'};-webkit-tap-highlight-color:transparent">
      ${likely ? '⊘ Remove Likely to Close' : '★ Mark Likely to Close'}
    </div>
    ${canChangeStage ? `
      <div style="border-top:1px solid #30363D;margin:4px 0"></div>
      <div style="padding:8px 20px 4px;font-size:11px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em">Move to Stage</div>
      ${stageItems}
    ` : ''}
    ${canDelete ? `
      <div style="border-top:1px solid #30363D;margin:4px 0"></div>
      <div style="padding:8px 20px 4px;font-size:11px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em">Archive</div>
      ${archiveItems}
    ` : ''}
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
    <div class="bnav-item bnav-quick" onclick="openQuickActions()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>
      <span>Quick</span>
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
  if (typeof removeTopbarBackButton === 'function') removeTopbarBackButton();
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('#bottom-nav .bnav-item').forEach(el => {
    const p = el.dataset.page;
    el.classList.toggle('active', p === page || (page === 'dashboard' && p === 'dashboard'));
  });
  const titles = {
    dashboard: 'Dashboard', calendar: 'Calendar', projects: 'Projects',
    'open-projects': 'Open Projects',
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
      case 'open-projects': renderOpenProjects(c); break;
      case 'shopwork': renderShopWork(c); break;
      case 'vendors': renderVendors(c); break;
      case 'intake': renderIntake(c); break;
      case 'team': renderTeam(c); break;
      case 'admin': renderAdmin(c); break;
      case 'project': renderProjectPage(c); break;
      default: renderDashboard(c);
    }
  } catch (e) {
    c.innerHTML = `<div class="alert alert-error">Render error: ${e.message}</div>`;
    console.error(e);
  }
  updateRightPanel();
  if (typeof updateContextNav === 'function') updateContextNav();
}

// ── Project Page Navigation ──
// v1.16: project detail is a full page, not a modal
function openProject(id, tabOrAnchor, anchor) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  // Remember where we came from so Back returns to the right page
  if (state.currentPage && state.currentPage !== 'project') {
    state.projectOrigin = state.currentPage;
  } else if (!state.projectOrigin) {
    state.projectOrigin = 'dashboard';
  }
  state.currentProject = p;
  // If second arg looks like a known tab, use it as the tab. Otherwise treat as anchor on default tab.
  const KNOWN_TABS = ['overview','progress','details','design','install','location','files','notes'];
  let tab = getDefaultProjectTab();
  let anchorKey = null;
  if (tabOrAnchor && KNOWN_TABS.includes(tabOrAnchor)) {
    tab = tabOrAnchor;
    anchorKey = anchor || null;
  } else if (tabOrAnchor) {
    // It's an anchor, not a tab. Decide which tab the anchor belongs to.
    anchorKey = tabOrAnchor;
    if (anchorKey === 'attention' || anchorKey === 'needs-attention') tab = 'overview';
    else tab = 'progress'; // milestone anchors default to progress
  }
  state.projectTab = tab;
  state.projectPendingAnchor = anchorKey;
  state.currentPage = 'project';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#bottom-nav .bnav-item').forEach(el => el.classList.remove('active'));
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = p.name;
  injectTopbarBackButton();
  renderCurrentPage();
  const c = document.getElementById('content');
  if (c) c.scrollTop = 0;
  // After render, scroll to anchor if specified
  if (anchorKey) {
    setTimeout(() => scrollToProjectAnchor(anchorKey), 100);
  }
}

// Scroll to a labeled anchor within the project page and briefly highlight it
function scrollToProjectAnchor(anchorKey) {
  if (!anchorKey) return;
  const el = document.querySelector(`[data-project-anchor="${anchorKey}"]`);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const offset = 20;
  window.scrollTo({ top: window.scrollY + rect.top - offset, behavior: 'smooth' });
  // Briefly highlight
  el.classList.add('project-anchor-flash');
  setTimeout(() => el.classList.remove('project-anchor-flash'), 1800);
  state.projectPendingAnchor = null;
}

function injectTopbarBackButton() {
  // Remove any existing back button first
  document.getElementById('topbar-back-btn')?.remove();
  const titleEl = document.getElementById('page-title');
  if (!titleEl) return;
  const btn = document.createElement('button');
  btn.id = 'topbar-back-btn';
  btn.className = 'topbar-back-btn';
  btn.setAttribute('aria-label', 'Back');
  btn.title = 'Back';
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  btn.onclick = function() { closeProjectPage(); };
  titleEl.parentNode.insertBefore(btn, titleEl);
}

function removeTopbarBackButton() {
  document.getElementById('topbar-back-btn')?.remove();
}

function getDefaultProjectTab() {
  const view = state.dashboardView || currentUserRole;
  if (view === 'design') return 'design';
  if (view === 'installer' || view === 'project_manager') return 'install';
  return 'overview';
}

function closeProjectPage() {
  state.currentProject = null;
  removeTopbarBackButton();
  const origin = state.projectOrigin || 'dashboard';
  state.projectOrigin = null;
  navigate(origin);
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

// ── Project Assignments (Pass 3B: expanded role slots) ──
// New shape per project: { sales: [{id, lead}], design: [...], pm: [...], install: [...], warehouse: [...] }
// Legacy shape: { design: [1, 2], install: [3] } — auto-migrated on access
const ASSIGNMENT_ROLES = [
  { key: 'sales',     label: 'Sales',       color: '#3FB950', desc: 'Client relationship, contract holder' },
  { key: 'design',    label: 'Design',      color: '#A371F7', desc: 'CAD, engineering, BOM' },
  { key: 'pm',        label: 'Project Manager', color: '#58A6FF', desc: 'Owns schedule + coordination' },
  { key: 'install',   label: 'Install',     color: '#F85149', desc: 'On-site crew' },
  { key: 'warehouse', label: 'Warehouse',   color: '#F0883E', desc: 'Receiving + staging' }
];

function migrateAssignment(a) {
  // Normalize a project's assignment object to new shape. Handles legacy and new.
  const out = { sales: [], design: [], pm: [], install: [], warehouse: [] };
  if (!a) return out;
  ASSIGNMENT_ROLES.forEach(r => {
    const raw = a[r.key];
    if (!raw) { out[r.key] = []; return; }
    if (Array.isArray(raw)) {
      out[r.key] = raw.map((item, idx) => {
        if (typeof item === 'number' || typeof item === 'string') {
          // Legacy: bare member id — first one becomes lead
          return { id: parseInt(item), lead: idx === 0 };
        }
        if (item && typeof item === 'object') {
          return { id: parseInt(item.id), lead: !!item.lead };
        }
        return null;
      }).filter(Boolean);
    }
  });
  return out;
}

function getProjectAssignment(projectId) {
  const raw = state.assignments[projectId];
  return migrateAssignment(raw);
}

function setProjectAssignment(projectId, role, list) {
  if (!state.assignments[projectId]) state.assignments[projectId] = {};
  // Persist migrated version of whole project to avoid future legacy reads
  const full = migrateAssignment(state.assignments[projectId]);
  full[role] = list;
  state.assignments[projectId] = full;
  save('vi_assignments', state.assignments);
}

function isAssignedToProject(memberId, projectId, role) {
  const a = getProjectAssignment(projectId);
  if (role) return (a[role] || []).some(x => x.id === memberId);
  return ASSIGNMENT_ROLES.some(r => (a[r.key] || []).some(x => x.id === memberId));
}

function isLeadOnProject(memberId, projectId, role) {
  const a = getProjectAssignment(projectId);
  return (a[role] || []).some(x => x.id === memberId && x.lead);
}

function getLeadForRole(projectId, role) {
  const a = getProjectAssignment(projectId);
  return (a[role] || []).find(x => x.lead) || null;
}

function toggleRoleAssignment(projectId, role, memberId) {
  const a = getProjectAssignment(projectId);
  const list = a[role] || [];
  const idx = list.findIndex(x => x.id === memberId);
  if (idx >= 0) {
    const wasLead = list[idx].lead;
    list.splice(idx, 1);
    // If the removed member was Lead and there are others left, promote the first one
    if (wasLead && list.length > 0) list[0].lead = true;
  } else {
    // If no one is Lead yet, make this new assignee the Lead
    const hasLead = list.some(x => x.lead);
    list.push({ id: memberId, lead: !hasLead });
  }
  setProjectAssignment(projectId, role, list);
  // Always re-render — mobile paths and dashboard surfaces need the update too,
  // not just the project page in-place panel
  renderCurrentPage();
}

function setRoleLead(projectId, role, memberId) {
  // Find current lead and count affected manual actions before prompting
  const a = getProjectAssignment(projectId);
  const list = a[role] || [];
  const currentLead = list.find(x => x.lead);
  const currentLeadId = currentLead?.id || null;

  // If no change, just return
  if (currentLeadId === memberId) return;

  // Count manual actions on this project assigned to current lead
  const newLeadName = getTeamMember(memberId)?.name || 'this person';
  const oldLeadName = currentLeadId ? (getTeamMember(currentLeadId)?.name || 'previous lead') : null;
  const affectedManual = (state.actionsManual || []).filter(m =>
    m.projectId === projectId &&
    currentLeadId &&
    m.assigneeId === currentLeadId
  );

  // Auto-actions auto-cascade because they're computed live from the lead.
  // For manual actions, prompt the user.
  const projectName = state.projects.find(p => p.id === projectId)?.name || 'this project';
  const proceed = function(reassignManual) {
    list.forEach(x => x.lead = (x.id === memberId));
    setProjectAssignment(projectId, role, list);
    if (reassignManual && affectedManual.length > 0) {
      affectedManual.forEach(m => { m.assigneeId = memberId; });
      _persistActionsManual();
    }
    if (state.currentPage === 'project' && state.currentProject?.id === projectId) {
      renderCurrentPage();
    } else {
      renderCurrentPage();
    }
    if (typeof showToast === 'function') {
      const note = affectedManual.length > 0 && reassignManual
        ? ` &middot; ${affectedManual.length} manual action${affectedManual.length === 1 ? '' : 's'} reassigned`
        : '';
      showToast(`${role} lead set to ${newLeadName}${note}`, 'success');
    }
  };

  if (oldLeadName && affectedManual.length > 0) {
    // Prompt with checkbox
    document.getElementById('lead-cascade-dialog')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'lead-cascade-dialog';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-container" style="max-width:420px">
        <div class="modal-header">
          <div class="modal-title">Change ${esc(role)} lead?</div>
          <button class="modal-close" onclick="document.getElementById('lead-cascade-dialog')?.remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div style="font-size:13px;color:#C9D1D9;line-height:1.5;margin-bottom:14px">
            ${esc(role.charAt(0).toUpperCase() + role.slice(1))} lead on <strong>${esc(projectName)}</strong> changes from <strong>${esc(oldLeadName)}</strong> to <strong>${esc(newLeadName)}</strong>.
          </div>
          <div style="background:#0D1117;border:1px solid #1C2333;border-radius:6px;padding:10px 12px;margin-bottom:14px">
            <div style="font-size:11px;color:#8B949E;margin-bottom:6px">Auto-derived actions reassign automatically.</div>
            <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12px;color:#E6EDF3">
              <input type="checkbox" id="cascade-manual" checked style="margin-top:2px">
              <span>Also reassign <strong>${affectedManual.length} manual action${affectedManual.length === 1 ? '' : 's'}</strong> previously assigned to ${esc(oldLeadName)}</span>
            </label>
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn" onclick="document.getElementById('lead-cascade-dialog')?.remove()" style="flex:1">Cancel</button>
            <button type="button" class="btn-primary" onclick="_confirmLeadChange(${projectId}, '${role}', ${memberId})" style="flex:2">Change Lead</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    // No manual actions affected — just proceed
    proceed(false);
  }
}

function _confirmLeadChange(projectId, role, memberId) {
  const cascade = document.getElementById('cascade-manual')?.checked || false;
  const a = getProjectAssignment(projectId);
  const list = a[role] || [];
  const currentLead = list.find(x => x.lead);
  const currentLeadId = currentLead?.id || null;
  const affectedManual = (state.actionsManual || []).filter(m =>
    m.projectId === projectId &&
    currentLeadId &&
    m.assigneeId === currentLeadId
  );
  list.forEach(x => x.lead = (x.id === memberId));
  setProjectAssignment(projectId, role, list);
  if (cascade && affectedManual.length > 0) {
    affectedManual.forEach(m => { m.assigneeId = memberId; });
    _persistActionsManual();
  }
  document.getElementById('lead-cascade-dialog')?.remove();
  const newLeadName = getTeamMember(memberId)?.name || 'this person';
  const note = cascade && affectedManual.length > 0
    ? ` · ${affectedManual.length} manual action${affectedManual.length === 1 ? '' : 's'} reassigned`
    : '';
  if (typeof showToast === 'function') showToast(`${role} lead set to ${newLeadName}${note}`, 'success');
  renderCurrentPage();
}

// ── Legacy compatibility — used by old renderers until migrated ──
function isAssignedTo(projectId, phase, memberId) {
  // Old callers pass 'design' or 'install' — map 'install' correctly
  return isAssignedToProject(memberId, projectId, phase);
}

function toggleProjectAssignment(projectId, phase, memberId) {
  toggleRoleAssignment(projectId, phase, memberId);
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
  const activeMember = getTeamMember(getActiveTeamMemberId());
  const memberId = activeMember?.id;
  document.getElementById('page-title').textContent = 'Dashboard';

  const canSeeAllProjects = currentUserHasPermission('projects.view_all');
  const isMasterAdmin = currentUserHasPermission('admin.system');
  const canSeeInstallMgmt = currentUserHasPermission('dashboards.install_mgmt');
  const canSeeDesignMgmt = currentUserHasPermission('dashboards.design_mgmt');
  const canSeeSalesMgmt = currentUserHasPermission('dashboards.sales_mgmt');

  // Migrate legacy 'install' mode to 'install_mgmt'
  let dashboardMode = state.dashboardMode;
  if (dashboardMode === 'install') {
    dashboardMode = 'install_mgmt';
    state.dashboardMode = dashboardMode;
    localStorage.setItem('vi_dashboard_mode', dashboardMode);
  }

  // Default ordering: Master Admin → executive, otherwise first available dept dashboard, otherwise mine
  if (!dashboardMode) {
    if (isMasterAdmin) dashboardMode = 'executive';
    else if (canSeeSalesMgmt) dashboardMode = 'sales_mgmt';
    else if (canSeeDesignMgmt) dashboardMode = 'design_mgmt';
    else if (canSeeInstallMgmt) dashboardMode = 'install_mgmt';
    else dashboardMode = 'mine';
  }
  // Fallbacks if user lost permissions since last choice
  if (dashboardMode === 'executive' && !isMasterAdmin) dashboardMode = 'mine';
  if (dashboardMode === 'pipeline' && !canSeeAllProjects) dashboardMode = 'mine';
  if (dashboardMode === 'install_mgmt' && !canSeeInstallMgmt) dashboardMode = 'mine';
  if (dashboardMode === 'design_mgmt' && !canSeeDesignMgmt) dashboardMode = 'mine';
  if (dashboardMode === 'sales_mgmt' && !canSeeSalesMgmt) dashboardMode = 'mine';

  const activeProjects = state.projects.filter(p => !p.archived);
  const myAssignments = computeMyAssignments(memberId, activeProjects);
  const totalMyWork = Object.values(myAssignments).reduce((n, arr) => n + arr.length, 0);
  const myCloseoutCount = getMyCloseoutProjects(memberId).length;

  // Build mode tabs
  const tabs = [];
  if (isMasterAdmin) tabs.push({ key: 'executive', label: 'Executive' });
  tabs.push({ key: 'mine', label: 'My Work', badge: totalMyWork });
  if (canSeeSalesMgmt) {
    tabs.push({ key: 'sales_mgmt', label: 'Sales Dept' });
  }
  if (canSeeDesignMgmt) {
    tabs.push({ key: 'design_mgmt', label: 'Design Dept' });
  }
  if (canSeeInstallMgmt) {
    tabs.push({ key: 'install_mgmt', label: 'Planning' });
  }
  if (canSeeAllProjects) tabs.push({ key: 'pipeline', label: 'Full Pipeline' });

  // Horizontally scrollable tab bar for mobile
  const modeToggle = tabs.length > 1 ? `
    <div class="dash-mode-scroll" style="display:block;overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 0 14px;padding:0 0 4px;white-space:nowrap">
      <div class="dash-mode-inner" style="display:inline-flex;background:#0D1117;border:1px solid #30363D;border-radius:6px;overflow:hidden;font-size:12px;white-space:nowrap;vertical-align:top">
        ${tabs.map(t => `
          <div onclick="setDashboardMode('${t.key}')" style="padding:8px 14px;cursor:pointer;transition:all 0.15s;${dashboardMode === t.key ? 'background:#1565C0;color:#58A6FF;font-weight:500' : 'color:#8B949E'};-webkit-tap-highlight-color:transparent;display:inline-flex;align-items:center;gap:5px;border-right:1px solid #30363D">
            ${t.label}${t.badge > 0 ? `<span style="opacity:0.7;margin-left:2px">${t.badge}</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  if (dashboardMode === 'executive') {
    c.innerHTML = modeToggle + renderExecutiveDashboard(activeProjects);
  } else if (dashboardMode === 'install_mgmt') {
    c.innerHTML = modeToggle + renderInstallMgmtDashboard(activeProjects);
  } else if (dashboardMode === 'design_mgmt') {
    c.innerHTML = modeToggle + renderDesignMgmtDashboard(activeProjects);
  } else if (dashboardMode === 'sales_mgmt') {
    c.innerHTML = modeToggle + renderSalesMgmtDashboard(activeProjects);
  } else if (dashboardMode === 'mine') {
    c.innerHTML = modeToggle + renderMyWorkDashboard(memberId, activeProjects, myAssignments, activeMember);
  } else {
    c.innerHTML = modeToggle + renderPipelineDashboard(activeProjects);
  }
}

// Alert counts for tab badges
function countSalesMgmtAlerts(projects) {
  // Alerts = proposals sent 7+ days ago without response, or contracts needing review
  let count = 0;
  projects.forEach(p => {
    if (isContractNeedsReview(p)) count++;
  });
  return count;
}

function countDesignMgmtAlerts(projects) {
  // Alerts = designs past kickoff without activity, pending template suggestions
  const pending = (state.templateSuggestions || []).filter(s => s.status === 'pending').length;
  return pending;
}

function setDashboardMode(mode) {
  state.dashboardMode = mode;
  localStorage.setItem('vi_dashboard_mode', mode);
  renderDashboard(document.getElementById('content'));
}

// Compute everything a member is assigned to, grouped by role
function computeMyAssignments(memberId, projects) {
  const out = { sales: [], design: [], pm: [], install: [], warehouse: [] };
  if (!memberId) return out;
  projects.forEach(p => {
    const a = getProjectAssignment(p.id);
    ASSIGNMENT_ROLES.forEach(r => {
      const entry = (a[r.key] || []).find(x => x.id === memberId);
      if (entry) {
        out[r.key].push({ project: p, isLead: entry.lead });
      }
    });
  });
  return out;
}

// Sort projects by urgency: booked install within 30d first, then upcoming, then everything else
function sortByUrgency(projects) {
  return [...projects].sort((a, b) => {
    const aDate = getInstallWindow(a)?.start;
    const bDate = getInstallWindow(b)?.start;
    if (aDate && bDate) return new Date(aDate) - new Date(bDate);
    if (aDate) return -1;
    if (bDate) return 1;
    // Fall back to stage order + progress
    const aStage = STAGES.findIndex(s => s.key === a.stage);
    const bStage = STAGES.findIndex(s => s.key === b.stage);
    return bStage - aStage;
  });
}

function renderMyWorkDashboard(memberId, activeProjects, myAssignments, activeMember) {
  const totalAssigned = Object.values(myAssignments).reduce((n, arr) => n + arr.length, 0);
  const myCloseoutProjects = getMyCloseoutProjects(memberId);

  // If no assignments at all AND no closeouts waiting, show empty state
  if (totalAssigned === 0 && myCloseoutProjects.length === 0) {
    const canSeeAll = currentUserHasPermission('projects.view_all');
    return `
      <div style="max-width:520px;margin:60px auto;text-align:center;padding:40px 20px">
        <svg width="56" height="56" viewBox="0 0 48 48" fill="none" style="margin:0 auto 16px;opacity:0.4">
          <path d="M8 12h32M8 20h32M8 28h20M8 36h14" stroke="#6E7681" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:6px">You're not on any active projects</div>
        <div style="font-size:13px;color:#8B949E;margin-bottom:16px">When someone assigns you to a project&rsquo;s Sales, Design, PM, Install, or Warehouse role, it&rsquo;ll show up here organized by role.</div>
        ${canSeeAll ? `<button class="btn-primary" onclick="setDashboardMode('pipeline')" style="padding:10px 20px;font-size:13px">View Full Pipeline &rarr;</button>` : ''}
      </div>
    `;
  }

  // Closeout banner — sticky at top if any projects are waiting
  const closeoutBanner = myCloseoutProjects.length > 0 ? `
    <div class="dashboard-card" style="margin-bottom:16px;border-left:3px solid #DA3633;background:#1A0D0D">
      <div class="dashboard-card-title">
        <span style="color:#F85149;display:flex;align-items:center;gap:6px">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 12h12L7 1zM7 5v3M7 10v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Closeout Review Needed &middot; ${myCloseoutProjects.length}
        </span>
      </div>
      <div style="font-size:12px;color:#8B949E;margin-bottom:10px">Booked install end date has passed. Confirm the project is wrapped up or extend the install window.</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${myCloseoutProjects.map(p => {
          const win = getInstallWindow(p);
          const daysOver = win?.end ? Math.abs(daysUntil(win.end)) : 0;
          const checklist = getCloseoutChecklist(p.id);
          const doneCount = CLOSEOUT_ITEMS.filter(ci => checklist[ci.key]?.checked).length;
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:#0D1117;border:1px solid #1C2333;border-radius:5px">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500;color:#E6EDF3;cursor:pointer" onclick="openProject(${p.id})">${esc(p.name)}</div>
                <div style="font-size:11px;color:#8B949E;margin-top:2px">${esc(p.client_name || '')} &middot; ${daysOver} day${daysOver === 1 ? '' : 's'} past end date${doneCount > 0 ? ` &middot; <span style="color:#3FB950">${doneCount}/4 confirmed</span>` : ''}</div>
              </div>
              <button class="btn-primary" onclick="openCloseoutDialog(${p.id})" style="padding:6px 12px;font-size:12px;background:#238636;flex-shrink:0">
                Close Out &rarr;
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  // Compute overall readiness metrics relevant to this user
  const allMyProjects = new Set();
  Object.values(myAssignments).forEach(arr => arr.forEach(a => allMyProjects.add(a.project.id)));
  const myProjects = activeProjects.filter(p => allMyProjects.has(p.id));
  const urgentProjects = myProjects.filter(p => {
    const win = getInstallWindow(p);
    if (!win) return false;
    const days = daysUntil(win.start);
    return days !== null && days >= 0 && days <= 14;
  });
  const flaggedProjects = myProjects.filter(p => computeProjectFlags(p).total > 0);

  // If there are no other assignments but there's a closeout, just show the banner
  if (totalAssigned === 0) {
    return closeoutBanner;
  }

  // Build summary row
  const summaryRow = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:18px">
      <div class="metric-card">
        <div class="metric-label">My Projects</div>
        <div class="metric-value">${myProjects.length}</div>
        <div class="metric-sub">across ${Object.keys(myAssignments).filter(k => myAssignments[k].length > 0).length} role${Object.keys(myAssignments).filter(k => myAssignments[k].length > 0).length === 1 ? '' : 's'}</div>
      </div>
      ${urgentProjects.length > 0 ? `
        <div class="metric-card" style="border-color:#DA3633">
          <div class="metric-label">Urgent</div>
          <div class="metric-value" style="color:#F85149">${urgentProjects.length}</div>
          <div class="metric-sub">install within 14 days</div>
        </div>
      ` : ''}
      ${flaggedProjects.length > 0 ? `
        <div class="metric-card" style="border-color:#9E6A03">
          <div class="metric-label">Needs Attention</div>
          <div class="metric-value" style="color:#D29922">${flaggedProjects.length}</div>
          <div class="metric-sub">has flagged items</div>
        </div>
      ` : ''}
    </div>
  `;

  // Build sections — one per role that has assignments
  const sections = ASSIGNMENT_ROLES.map(r => {
    const assignments = myAssignments[r.key];
    if (!assignments.length) return '';
    // Sort: Leads first, then by urgency
    const sortedAssignments = [...assignments].sort((a, b) => {
      if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
      const aDate = getInstallWindow(a.project)?.start;
      const bDate = getInstallWindow(b.project)?.start;
      if (aDate && bDate) return new Date(aDate) - new Date(bDate);
      if (aDate) return -1;
      if (bDate) return 1;
      return 0;
    });
    const leadCount = assignments.filter(a => a.isLead).length;

    return `
      <div class="mywork-section">
        <div class="mywork-section-header">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:8px;height:8px;border-radius:50%;background:${r.color}"></div>
            <div class="mywork-section-title" style="color:${r.color}">${r.label}</div>
            <div class="mywork-section-count">${assignments.length}${leadCount > 0 ? ` · ${leadCount} lead` : ''}</div>
          </div>
        </div>
        <div class="mywork-cards">
          ${sortedAssignments.map(entry => renderMyWorkCard(entry.project, r, entry.isLead)).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Build "My Actions" — sales-relevant actions assigned to this user
  const myActions = buildSalesActions(activeProjects, memberId, 'mine');
  const myActionsHTML = myActions.length === 0 ? '' : `
    <div class="dashboard-card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="dashboard-card-title" style="margin:0;color:#58A6FF">Actions Assigned to Me &middot; ${myActions.length}</div>
        <button type="button" onclick="setDashboardMode('sales_mgmt');setSalesDashTab('action')" class="btn btn-sm" style="font-size:11px;padding:4px 10px">View all in Sales</button>
      </div>
      ${myActions.slice(0, 8).map(a => renderActionRow(a)).join('')}
      ${myActions.length > 8 ? `<div style="text-align:center;font-size:11px;color:#8B949E;margin-top:8px">+ ${myActions.length - 8} more</div>` : ''}
    </div>
  `;

  return `
    ${closeoutBanner}
    ${summaryRow}
    ${myActionsHTML}
    ${sections}
  `;
}

function renderMyWorkCard(p, role, isLead) {
  const phaseData = PHASES.map(ph => ({ phase: ph, pct: phaseProgress(p, ph) }));
  const totalMilestones = PHASES.reduce((s, ph) => s + ph.milestones.length, 0);
  const doneMilestones = PHASES.reduce((s, ph) => s + ph.milestones.filter(m => milestoneProgress(p, ph, m) >= 1).length, 0);
  const overallPct = totalMilestones > 0 ? (doneMilestones / totalMilestones) : 0;
  const win = getInstallWindow(p);
  const days = win ? daysUntil(win.start) : null;
  const cdClass = win ? countdownClass(win.start) : '';
  const flags = computeProjectFlags(p);
  const urgent = days !== null && days >= 0 && days <= 14;
  const stg = STAGES.find(s => s.key === p.stage) || STAGES[0];

  // My sub-tasks in this phase (if role is design or install)
  const activeId = getActiveTeamMemberId();
  const subtaskPhase = role.key === 'design' ? 'design' : (role.key === 'install' ? 'install' : null);
  let mySubtasksBadge = '';
  if (subtaskPhase) {
    const subtasks = getSubtasks(p.id, subtaskPhase);
    const mine = subtasks.filter(t => t.assignee_id === activeId && t.status !== 'done');
    if (mine.length > 0) {
      mySubtasksBadge = `<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#0D1626;color:#58A6FF;border:1px solid #1565C0">${mine.length} task${mine.length === 1 ? '' : 's'}</span>`;
    }
  }

  return `
    <div class="mywork-card ${isLead ? 'is-lead' : ''} ${urgent ? 'urgent' : ''}" onclick="openProject(${p.id})" style="${isLead ? `border-left:3px solid ${role.color}` : ''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${isLead ? `<div style="width:10px;height:10px;border-radius:50%;background:${role.color};flex-shrink:0" title="Lead"></div>` : ''}
            <span style="font-size:13px;font-weight:600;color:#E6EDF3">${esc(p.name)}</span>
          </div>
          <div style="font-size:11px;color:#8B949E;margin-top:2px">${esc(p.client_name || 'No client')}${p.city ? ' · ' + esc(p.city) : ''}</div>
        </div>
        <span class="status-pill status-${stg.color}" style="font-size:10px;flex-shrink:0">${stg.label}</span>
      </div>

      <!-- Segmented progress map -->
      <div class="mywork-pmap">
        ${phaseData.map(d => {
          const w = (d.phase.milestones.length / totalMilestones) * 100;
          return `
            <div class="mywork-pmap-seg" style="width:${w}%" title="${d.phase.label}: ${Math.round(d.pct * 100)}%">
              <div class="mywork-pmap-fill" style="width:${Math.round(d.pct * 100)}%;background:${d.phase.color}"></div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px">
        <div style="font-size:11px;color:#8B949E">${doneMilestones}/${totalMilestones} milestones</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          ${mySubtasksBadge}
          ${flags.total > 0 ? `<span class="flag-badge-tap" onclick="event.stopPropagation();openProject(${p.id},'attention')" style="font-size:10px;padding:2px 6px;border-radius:3px;background:#1A150D;color:#D29922;border:1px solid #9E6A03;cursor:pointer">${flags.total} flag${flags.total === 1 ? '' : 's'}</span>` : ''}
          ${win ? `<span class="countdown-pill ${cdClass}">${fmtCountdown(win.start)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

// Executive dashboard — high-level business overview for Master Admin
function renderExecutiveDashboard(activeProjects) {
  const totalValue = getPipelineValue(activeProjects);
  const likelyValue = getLikelyToCloseTotal();
  const likelyCount = activeProjects.filter(p => isLikelyToClose(p.id)).length;
  const closeRate = getCloseRate();
  const archivedCount = state.projects.filter(p => p.archived).length;
  const wonCount = Object.values(state.archived).filter(v => v === 'won').length;
  const lostCount = Object.values(state.archived).filter(v => v === 'lost').length;
  const contractedCount = activeProjects.filter(p => p.stage === 'contract').length;
  const reviewCount = activeProjects.filter(p => isContractNeedsReview(p)).length;

  // Project status breakdown
  const byStage = {};
  STAGES.forEach(s => byStage[s.key] = 0);
  activeProjects.forEach(p => {
    if (byStage[p.stage] !== undefined) byStage[p.stage]++;
  });

  // Install pipeline — projects with upcoming installs
  const upcomingInstalls = activeProjects
    .map(p => ({ p, win: getInstallWindow(p) }))
    .filter(x => x.win)
    .map(x => ({ ...x, days: daysUntil(x.win.start) }))
    .filter(x => x.days !== null && x.days >= -7)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  // Stuck projects — haven't moved in 21+ days, or contract phase with no install date
  const stuckProjects = activeProjects.filter(p => {
    if (p.stage === 'contract' && !getInstallWindow(p)) return true;
    const lastActivity = state.recentActivity?.[p.id];
    if (!lastActivity) return false;
    const days = (Date.now() - new Date(lastActivity).getTime()) / 86400000;
    return days > 21;
  }).slice(0, 6);

  // Cross-project flag rollup — projects with flags, grouped
  const flaggedProjects = activeProjects
    .map(p => ({ p, flags: computeProjectFlags(p) }))
    .filter(x => x.flags.total > 0)
    .sort((a, b) => b.flags.total - a.flags.total);
  const totalFlags = flaggedProjects.reduce((s, x) => s + x.flags.total, 0);

  // Ready for install — gated projects that have hit the Mark Ready button
  const readyForInstall = activeProjects.filter(p => isMarkedReadyForInstall(p.id));

  // Projects currently in install
  const inInstall = activeProjects.filter(p => {
    const installPhase = PHASES.find(ph => ph.key === 'install');
    const pct = phaseProgress(p, installPhase);
    return pct > 0 && pct < 1;
  });

  return `
    <!-- Hero metrics row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:20px">
      <div class="metric-card">
        <div class="metric-label">Pipeline Value</div>
        <div class="metric-value">${fmt(totalValue)}</div>
        <div class="metric-sub">${activeProjects.length} active projects</div>
      </div>
      <div class="metric-card" style="${likelyCount > 0 ? 'border-color:#238636' : ''}">
        <div class="metric-label">Likely to Close</div>
        <div class="metric-value" style="${likelyCount > 0 ? 'color:#3FB950' : ''}">${fmt(likelyValue)}</div>
        <div class="metric-sub">${likelyCount} project${likelyCount !== 1 ? 's' : ''} flagged</div>
      </div>
      <div class="metric-card" style="${closeRate !== null && closeRate >= 50 ? 'border-color:#238636' : ''}">
        <div class="metric-label">Close Rate</div>
        <div class="metric-value" style="${closeRate !== null && closeRate >= 50 ? 'color:#3FB950' : ''}">${closeRate !== null ? closeRate + '%' : '—'}</div>
        <div class="metric-sub">${wonCount} won · ${lostCount} lost</div>
      </div>
      <div class="metric-card" style="${reviewCount > 0 ? 'border-color:#DA3633' : ''}">
        <div class="metric-label">Needs Review</div>
        <div class="metric-value" style="${reviewCount > 0 ? 'color:#F85149' : ''}">${reviewCount}</div>
        <div class="metric-sub">${contractedCount} contracted total</div>
      </div>
    </div>

    <!-- Two-column layout: Install pipeline + Project status -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px;margin-bottom:20px">
      <!-- Pipeline by stage -->
      <div class="dashboard-card">
        <div class="dashboard-card-title">Pipeline by Stage</div>
        ${STAGES.map(s => {
          const count = byStage[s.key];
          const pct = activeProjects.length > 0 ? (count / activeProjects.length) * 100 : 0;
          return `
            <div style="margin-bottom:8px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
                <span style="font-size:12px;color:#C9D1D9">${s.label}</span>
                <span style="font-size:11px;color:#6E7681">${count}</span>
              </div>
              <div style="height:5px;background:#0D1117;border:1px solid #1C2333;border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:var(--status-${s.color}, #58A6FF);transition:width 0.3s ease"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Upcoming installs -->
      <div class="dashboard-card">
        <div class="dashboard-card-title">Upcoming Installs</div>
        ${upcomingInstalls.length === 0 ? `
          <div style="font-size:12px;color:#6E7681;font-style:italic;padding:10px 0">No installs scheduled in the near term</div>
        ` : upcomingInstalls.map(({ p, win, days }) => {
          const cdClass = countdownClass(win.start);
          return `
            <div onclick="openProject(${p.id})" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:6px;cursor:pointer;background:#0D1117;border:1px solid #1C2333;margin-bottom:5px;-webkit-tap-highlight-color:transparent">
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;color:#E6EDF3;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
                <div style="font-size:10px;color:#6E7681;margin-top:1px">${esc(p.client_name || '')}${win.source === 'booked' ? ' · Booked' : ' · Estimated'}</div>
              </div>
              <span class="countdown-pill ${cdClass}" style="flex-shrink:0">${fmtCountdown(win.start)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Full-width attention section -->
    ${(stuckProjects.length > 0 || flaggedProjects.length > 0 || readyForInstall.length > 0) ? `
      <div class="dashboard-card" style="margin-bottom:20px">
        <div class="dashboard-card-title">Attention &amp; Action</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px">
          ${readyForInstall.length > 0 ? `
            <div>
              <div style="font-size:11px;font-weight:700;color:#3FB950;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Ready for Install · ${readyForInstall.length}</div>
              ${readyForInstall.slice(0, 5).map(p => `
                <div onclick="openProject(${p.id})" style="font-size:12px;color:#C9D1D9;padding:4px 0;cursor:pointer;-webkit-tap-highlight-color:transparent;border-bottom:1px solid #1C2333">${esc(p.name)}</div>
              `).join('')}
            </div>
          ` : ''}
          ${inInstall.length > 0 ? `
            <div>
              <div style="font-size:11px;font-weight:700;color:#F85149;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">In Install · ${inInstall.length}</div>
              ${inInstall.slice(0, 5).map(p => {
                const installPhase = PHASES.find(ph => ph.key === 'install');
                const pct = Math.round(phaseProgress(p, installPhase) * 100);
                return `<div onclick="openProject(${p.id})" style="font-size:12px;color:#C9D1D9;padding:4px 0;cursor:pointer;-webkit-tap-highlight-color:transparent;border-bottom:1px solid #1C2333;display:flex;align-items:center;justify-content:space-between"><span>${esc(p.name)}</span><span style="font-size:10px;color:#6E7681">${pct}%</span></div>`;
              }).join('')}
            </div>
          ` : ''}
          ${stuckProjects.length > 0 ? `
            <div>
              <div style="font-size:11px;font-weight:700;color:#D29922;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Stuck · ${stuckProjects.length}</div>
              ${stuckProjects.slice(0, 5).map(p => {
                const stg = STAGES.find(s => s.key === p.stage);
                return `<div onclick="openProject(${p.id})" style="font-size:12px;color:#C9D1D9;padding:4px 0;cursor:pointer;-webkit-tap-highlight-color:transparent;border-bottom:1px solid #1C2333;display:flex;align-items:center;justify-content:space-between"><span>${esc(p.name)}</span><span style="font-size:10px;color:#6E7681">${stg?.label || ''}</span></div>`;
              }).join('')}
            </div>
          ` : ''}
          ${flaggedProjects.length > 0 ? `
            <div>
              <div style="font-size:11px;font-weight:700;color:#F85149;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Flagged Issues · ${totalFlags}</div>
              ${flaggedProjects.slice(0, 5).map(({ p, flags }) => `
                <div onclick="openProject(${p.id})" style="font-size:12px;color:#C9D1D9;padding:4px 0;cursor:pointer;-webkit-tap-highlight-color:transparent;border-bottom:1px solid #1C2333;display:flex;align-items:center;justify-content:space-between"><span>${esc(p.name)}</span><span style="font-size:10px;color:#F85149">${flags.total}</span></div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''}

    <!-- Archive summary -->
    <div class="archive-row" style="margin-top:4px">
      ${ARCHIVE_BINS.map(b => {
        const count = getArchivedProjects(b.key).length;
        return '<div class="archive-bin" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDropArchive(event, \'' + b.key + '\')"><span class="archive-icon">' + b.icon + '</span><span class="archive-label">' + b.label + '</span>' + (count > 0 ? '<span class="archive-count" onclick="toggleArchiveExpand(\'' + b.key + '\')">' + count + '</span>' : '') + '</div>';
      }).join('')}
    </div>
    <div id="archive-expanded"></div>
    ${renderRecentActivity()}
  `;
}

function renderPipelineDashboard(projects) {
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
  const closeRate = getCloseRate();

  const activeView = state.dashboardView || currentUserRole;
  const activeMember = getTeamMember(getActiveTeamMemberId());
  const userAccess = activeMember?.access || ['admin'];

  const viewTabs = userAccess.length > 1 ? `
    <div class="legacy-role-tabs" style="display:flex;gap:4px;margin-bottom:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px">
      ${userAccess.map(a => {
        const da = DASHBOARD_ACCESS.find(d => d.key === a);
        if (!da) return '';
        const isActive = a === activeView;
        return '<div onclick="switchDashboardView(\'' + a + '\')" style="padding:8px 14px;font-size:12px;font-weight:500;border-radius:6px;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;' + (isActive ? 'background:' + da.color + '22;color:' + da.color + ';border:1px solid ' + da.color + '44' : 'background:#161B22;color:#6E7681;border:1px solid #1C2333') + '">' + da.label + '</div>';
      }).join('')}
    </div>
  ` : '';

  return `
    ${viewTabs}
    <div class="metrics-tasks-row" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;align-items:start">
      <div class="metrics-grid" style="margin-bottom:0">
        ${canSee('financials') ? `
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
        ` : ''}
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
        <div data-context-section="${s.key}" class="pipeline-col${col.length === 0 ? ' pipeline-col-empty' : ''}" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDropStage(event, '${s.key}')">
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
    { key: 'progress', label: 'Progress' },
    { key: 'details',  label: 'Details'  },
    { key: 'design',   label: 'Design'   },
    { key: 'install',  label: 'Install'  },
    { key: 'location', label: 'Location' },
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
            <span>${(() => {
              const origin = state.projectOrigin || 'dashboard';
              const labels = { dashboard: 'Dashboard', projects: 'Projects', calendar: 'Calendar', shopwork: 'Shop Work', vendors: 'Vendors' };
              return labels[origin] || 'Back';
            })()}</span>
          </button>
          <div class="project-page-title-block">
            <div class="project-page-name">${esc(p.name)}</div>
            <div class="project-page-sub">#${p.id} · ${esc(p.client_name || 'No client')}${p.city ? ' · ' + esc(p.city) + (p.state_abbr ? ', ' + esc(p.state_abbr) : '') : ''}</div>
          </div>
          <div class="project-page-actions">
            ${projectTypeBadgeHTML(p)}
            <span class="status-pill status-${stg.color}">${stg.label}</span>
            ${gbbTier ? `<span style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:3px;${gbbBadgeStyle}">${gbbTier.toUpperCase()}</span>` : ''}
          </div>
        </div>
        ${p.systems.length ? `<div class="project-page-tags">${p.systems.map(systemTagHTML).join('')}</div>` : ''}
        ${needsReview ? `
          <div class="project-page-review-banner">
            <div style="display:flex;align-items:center;gap:8px;flex:1">
              <div style="width:8px;height:8px;border-radius:50%;background:#DA3633;animation:pulse 1.5s infinite;flex-shrink:0"></div>
              <span style="font-size:12px;font-weight:600;color:#F85149">MOBILIZATION REQUIRED &mdash; COMPLETE TO SEND TO DESIGN &amp; INSTALL</span>
            </div>
            <button class="btn-primary" onclick="openMobilizationDialog(${p.id})" style="background:#238636;padding:6px 12px;font-size:12px;min-height:32px">Open Checklist &rarr;</button>
          </div>
        ` : ''}
        ${p._stage_divergence ? `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:#161B22;border:1px solid #30363D;border-left:3px solid #58A6FF;border-radius:4px;margin-top:8px">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:#58A6FF"><path d="M8 2v4M8 10v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/></svg>
            <div style="flex:1;min-width:0;font-size:11px;color:#C9D1D9">
              Jetbuilt shows this project as <strong style="color:#58A6FF">${esc(p._stage_divergence.jb_stage)}</strong>. Valiant manages stage independently after contract.
            </div>
            <button class="btn btn-sm" onclick="dismissStageDivergence(${p.id})" style="font-size:10px;padding:3px 8px;color:#8B949E" title="Dismiss">&times;</button>
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
  } else if (tab === 'progress') {
    body.innerHTML = renderProjectProgressHTML(p);
  } else if (tab === 'details') {
    body.innerHTML = renderProjectDetailsHTML(p);
  } else if (tab === 'design') {
    body.innerHTML = '';
    renderChecklistTab(body, p, 'design');
  } else if (tab === 'install') {
    body.innerHTML = '';
    renderChecklistTab(body, p, 'install');
  } else if (tab === 'location') {
    body.innerHTML = '';
    renderLocationTab(body, p);
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
  const flags = computeProjectFlags(p);
  const contractDate = getContractDate(p.id);
  const installWin = getInstallWindow(p);
  const stg = STAGES.find(s => s.key === p.stage) || STAGES[0];

  // Compute readiness data for all phases
  const phaseData = PHASES.map(ph => {
    const pct = phaseProgress(p, ph);
    const unlocked = isPhaseUnlocked(p, ph.key);
    const doneMilestones = ph.milestones.filter(m => milestoneProgress(p, ph, m) >= 1).length;
    return { phase: ph, pct, unlocked, doneMilestones, totalMilestones: ph.milestones.length };
  });

  // Milestone-weighted overall progress (30 milestones total)
  const totalMilestones = phaseData.reduce((s, d) => s + d.totalMilestones, 0);
  const doneMilestonesSum = phaseData.reduce((s, d) => s + d.doneMilestones, 0);
  // For partial credit in overall %, use sum of actual progress values
  const fractionalDone = PHASES.reduce((sum, ph) =>
    sum + ph.milestones.reduce((s, m) => s + milestoneProgress(p, ph, m), 0), 0);
  const overallPct = totalMilestones > 0 ? (fractionalDone / totalMilestones) : 0;

  const serialBeforeParallel = phaseData.filter(d => !d.phase.parallel && d.phase.key !== 'install');
  const parallelPhases = phaseData.filter(d => d.phase.parallel);
  const installPhase = phaseData.find(d => d.phase.key === 'install');
  const readyForInstall = isReadyForInstall(p);
  const marked = isMarkedReadyForInstall(p.id);

  return `
    ${isProjectInCloseout(p) ? (() => {
      const win = getInstallWindow(p);
      const daysOver = win?.end ? Math.abs(daysUntil(win.end)) : 0;
      const checklist = getCloseoutChecklist(p.id);
      const doneCount = CLOSEOUT_ITEMS.filter(ci => checklist[ci.key]?.checked).length;
      const canEdit = currentUserHasPermission('install.edit');
      return `
        <div class="dashboard-card" style="margin-bottom:14px;border-left:3px solid #DA3633;background:#1A0D0D">
          <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div style="width:36px;height:36px;border-radius:50%;background:#DA363322;border:1.5px solid #DA3633;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 12h12L7 1zM7 5v3M7 10v.5" stroke="#F85149" stroke-width="1.5" stroke-linecap="round"/></svg>
            </div>
            <div style="flex:1;min-width:200px">
              <div style="font-size:14px;font-weight:600;color:#F85149">Closeout Review Needed</div>
              <div style="font-size:12px;color:#C9D1D9;margin-top:3px">Booked install ended ${daysOver} day${daysOver === 1 ? '' : 's'} ago. Confirm wrap-up or extend the window.${doneCount > 0 ? ` <span style="color:#3FB950">${doneCount}/4 confirmed</span>` : ''}</div>
            </div>
            ${canEdit ? `
              <button class="btn-primary" onclick="openCloseoutDialog(${p.id})" style="padding:8px 16px;font-size:12px;background:#238636;flex-shrink:0">Close Out &rarr;</button>
            ` : ''}
          </div>
        </div>
      `;
    })() : ''}

    <!-- Overall progress + segmented linear map -->
    <div class="dashboard-card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-size:11px;font-weight:600;color:#6E7681;text-transform:uppercase;letter-spacing:0.08em">Overall Progress</div>
          <div style="font-size:28px;font-weight:700;color:#E6EDF3;line-height:1.1;margin-top:2px">${Math.round(overallPct * 100)}%</div>
          <div style="font-size:11px;color:#8B949E;margin-top:2px">${doneMilestonesSum} of ${totalMilestones} milestones complete${marked ? ' &middot; <span style="color:#3FB950">Ready for Install</span>' : ''}</div>
        </div>
        <button class="btn btn-sm" onclick="switchProjectTab('progress')" style="font-size:11px;padding:6px 12px">Manage Milestones &rarr;</button>
      </div>

      <!-- Segmented linear progress map -->
      <div class="pmap-wrap">
        <div class="pmap-track">
          ${phaseData.map(d => {
            const width = (d.totalMilestones / totalMilestones) * 100;
            return `
              <div class="pmap-seg" style="width:${width}%;--seg-color:${d.phase.color}" title="${d.phase.label}: ${Math.round(d.pct * 100)}%">
                <div class="pmap-seg-fill" style="width:${Math.round(d.pct * 100)}%;background:${d.phase.color}"></div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="pmap-labels">
          ${phaseData.map(d => {
            const width = (d.totalMilestones / totalMilestones) * 100;
            return `
              <div class="pmap-label" style="width:${width}%">
                <div class="pmap-label-name" style="color:${d.pct >= 1 ? d.phase.color : '#8B949E'}">${d.phase.label}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Readiness detail card -->
    <div class="dashboard-card" style="margin-bottom:14px">
      <div class="dashboard-card-title">Phase Readiness</div>

      <!-- Sales group: combined Lead+Proposal+Contract as one segmented bar -->
      ${(() => {
        const salesMilestones = serialBeforeParallel.reduce((s, d) => s + d.totalMilestones, 0);
        const salesDone = serialBeforeParallel.reduce((s, d) => s + d.doneMilestones, 0);
        const salesPct = salesMilestones > 0 ? (serialBeforeParallel.reduce((s, d) =>
          s + d.phase.milestones.reduce((ms, m) => ms + milestoneProgress(p, d.phase, m), 0), 0) / salesMilestones) : 0;
        return `
          <div class="ready-sales-row">
            <div class="ready-sales-head">
              <span class="ready-sales-label">Sales</span>
              <span class="ready-phase-count">${salesDone} of ${salesMilestones}</span>
              <span class="ready-phase-pct" style="color:${salesPct >= 1 ? '#3FB950' : '#E6EDF3'}">${Math.round(salesPct * 100)}%</span>
            </div>
            <div class="ready-sales-track">
              ${serialBeforeParallel.map(d => {
                const w = (d.totalMilestones / salesMilestones) * 100;
                return `
                  <div class="ready-sales-seg" style="width:${w}%">
                    <div class="ready-sales-seg-fill" style="width:${Math.round(d.pct * 100)}%;background:${d.phase.color}"></div>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="ready-sales-sublabels">
              ${serialBeforeParallel.map(d => {
                const w = (d.totalMilestones / salesMilestones) * 100;
                return `
                  <div class="ready-sales-sublabel" style="width:${w}%;color:${d.pct >= 1 ? d.phase.color : '#6E7681'}">
                    <span>${d.phase.label}</span>
                    <span class="ready-sales-sublabel-pct">${Math.round(d.pct * 100)}%</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      })()}

      <!-- Parallel phases group -->
      <div class="ready-parallel-group">
        <div class="ready-parallel-header">
          <span class="ready-parallel-title">Parallel &mdash; All required for Install</span>
          <span class="ready-parallel-avg">${Math.round((parallelPhases.reduce((s, d) => s + d.pct, 0) / parallelPhases.length) * 100)}%</span>
        </div>
        ${parallelPhases.map(d => `
          <div class="ready-phase-row ${d.pct >= 1 ? 'done' : ''} ${!d.unlocked ? 'locked' : ''}">
            <div class="ready-phase-head">
              <span class="ready-phase-label" style="color:${d.phase.color}">${d.phase.label}</span>
              <span class="ready-phase-count">${d.doneMilestones} of ${d.totalMilestones}</span>
              <span class="ready-phase-pct">${Math.round(d.pct * 100)}%</span>
            </div>
            <div class="ready-phase-bar">
              <div class="ready-phase-fill" style="width:${Math.round(d.pct * 100)}%;background:${d.phase.color}"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Ready for Install gate -->
      <div class="ready-gate ${readyForInstall ? 'ready-gate-open' : 'ready-gate-locked'}">
        ${readyForInstall ? (marked ? `
          <div class="ready-gate-inner">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="#3FB950" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Marked Ready for Install</span>
            <button class="btn btn-sm" onclick="unmarkReadyForInstall(${p.id})" style="margin-left:auto;font-size:11px;padding:4px 10px">Unmark</button>
          </div>
        ` : `
          <div class="ready-gate-inner">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#3FB950" stroke-width="2"/><path d="M6 8l1.5 1.5L10 6.5" stroke="#3FB950" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>All parallel phases complete</span>
            <button class="btn-primary" onclick="markReadyForInstall(${p.id})" style="margin-left:auto;background:#238636;padding:6px 12px;font-size:12px;min-height:32px">Mark Ready for Install &rarr;</button>
          </div>
        `) : `
          <div class="ready-gate-inner">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="6" width="8" height="6" rx="1" stroke="#6E7681" stroke-width="1.4"/><path d="M5 6V4a2 2 0 0 1 4 0v2" stroke="#6E7681" stroke-width="1.4"/></svg>
            <span>Install locked &mdash; complete all parallel phases first</span>
          </div>
        `}
      </div>

      <!-- Install phase progress (only shows when ready or in progress) -->
      ${(marked || installPhase.pct > 0) ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #1C2333">
          <div class="ready-phase-row ${installPhase.pct >= 1 ? 'done' : ''}">
            <div class="ready-phase-head">
              <span class="ready-phase-label" style="color:${installPhase.phase.color}">Install</span>
              <span class="ready-phase-count">${installPhase.doneMilestones} of ${installPhase.totalMilestones}</span>
              <span class="ready-phase-pct">${Math.round(installPhase.pct * 100)}%</span>
            </div>
            <div class="ready-phase-bar">
              <div class="ready-phase-fill" style="width:${Math.round(installPhase.pct * 100)}%;background:${installPhase.phase.color}"></div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Needs Attention (multi-audience executive summary) -->
    <div class="dashboard-card${flags.total > 0 ? ' needs-attention-active' : ''}" data-project-anchor="attention" style="margin-bottom:14px${flags.total > 0 ? ';border-color:#9E6A03;border-width:2px' : ''}">
      <div class="dashboard-card-title">Needs Attention${flags.total > 0 ? ` <span style="font-size:11px;color:#D29922;font-weight:600;margin-left:6px">${flags.total} item${flags.total === 1 ? '' : 's'}</span>` : ''}</div>
      ${flags.total === 0 ? `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0">
          <div style="width:8px;height:8px;border-radius:50%;background:#3FB950"></div>
          <span style="font-size:13px;color:#3FB950;font-weight:500">All clear &mdash; nothing flagged</span>
        </div>
      ` : `
        <div class="attn-grid">
          ${['sales', 'design', 'management', 'install'].map(group => {
            const items = flags[group] || [];
            const labels = { sales: 'Sales', design: 'Design', management: 'Management', install: 'Install' };
            const colors = { sales: '#D29922', design: '#A371F7', management: '#58A6FF', install: '#F0883E' };
            if (items.length === 0) {
              const active = isDomainActive(p, group);
              return `
                <div class="attn-group ${active ? 'attn-ok' : 'attn-clear'}">
                  <div class="attn-group-label" style="color:${colors[group]}">${labels[group]}</div>
                  <div class="attn-group-empty" style="${active ? 'color:#3FB950;font-style:normal' : ''}">${active ? 'No issues' : 'Not started'}</div>
                </div>
              `;
            }
            return `
              <div class="attn-group">
                <div class="attn-group-label" style="color:${colors[group]}">${labels[group]}</div>
                ${items.map(flag => `
                  <div class="attn-item attn-${flag.level}">
                    <div class="attn-dot"></div>
                    <span>${flag.text}</span>
                  </div>
                `).join('')}
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>

    <!-- Install Dates card (editable) -->
    <div class="dashboard-card" style="margin-bottom:14px">
      <div class="dashboard-card-title">Install Dates</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px">
        <!-- Estimated install -->
        <div style="padding:12px;background:#0D1117;border-radius:8px;border:1px solid #1C2333">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em">Estimated (from Jetbuilt)</div>
            ${currentUserHasPermission('projects.edit') ? `<button class="btn btn-sm" onclick="showEstimatedInstallDialog(${p.id})" style="font-size:10px;padding:3px 8px">Edit</button>` : ''}
          </div>
          ${(() => {
            const est = getEstimatedInstall(p);
            if (!est) return '<div style="font-size:13px;color:#6E7681;font-style:italic">Not set</div>';
            const cd = countdownClass(est);
            return `
              <div style="font-size:16px;font-weight:600;color:#E6EDF3">${fmtDate(est)}</div>
              <div style="margin-top:4px"><span class="countdown-pill ${cd}">${fmtCountdown(est)}</span></div>
            `;
          })()}
        </div>
        <!-- Booked window -->
        <div style="padding:12px;background:${getBookedTimeline(p.id) ? '#0D1A0E' : '#0D1117'};border-radius:8px;border:1px solid ${getBookedTimeline(p.id) ? '#238636' : '#1C2333'}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em">Booked Install Window</div>
            ${currentUserHasPermission('projects.edit') ? `<button class="btn btn-sm" onclick="showSetBookedDatesDialog(${p.id})" style="font-size:10px;padding:3px 8px">${getBookedTimeline(p.id) ? 'Edit' : 'Book'}</button>` : ''}
          </div>
          ${(() => {
            const b = getBookedTimeline(p.id);
            if (!b) return '<div style="font-size:13px;color:#6E7681;font-style:italic">Not booked</div>';
            const sameDay = !b.end || b.end === b.start;
            const cd = countdownClass(b.start);
            return `
              <div style="font-size:16px;font-weight:600;color:#3FB950">${fmtDate(b.start)}${sameDay ? '' : ' &ndash; ' + fmtDate(b.end)}</div>
              <div style="margin-top:4px"><span class="countdown-pill ${cd}">${fmtCountdown(b.start)}</span></div>
            `;
          })()}
        </div>
      </div>
    </div>

    <!-- Contract date card -->
    <div class="dashboard-card" style="margin-bottom:14px">
      <div class="dashboard-card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>Contract</span>
        ${currentUserHasPermission('projects.edit') ? `<button class="btn btn-sm" onclick="showContractDateDialog(${p.id})" style="font-size:11px;padding:4px 10px">
          ${contractDate ? 'Edit' : 'Set date'}
        </button>` : ''}
      </div>
      ${contractDate ? `
        <div style="font-size:20px;font-weight:600;color:#E6EDF3;line-height:1.1">${fmtDate(contractDate)}</div>
        <div style="font-size:12px;color:#8B949E;margin-top:4px">Signed ${fmtCountdown(contractDate)}</div>
      ` : `
        <div style="font-size:14px;color:#6E7681;font-style:italic">No contract date set</div>
        <div style="font-size:11px;color:#6E7681;margin-top:4px">Set this when the contract is signed</div>
      `}
    </div>

    <!-- Shop Work card -->
    ${(() => {
      const tasks = getShopWorkForProject(p.id);
      const openTasks = tasks.filter(t => t.status !== 'done');
      const doneTasks = tasks.filter(t => t.status === 'done');
      return `
        <div class="dashboard-card" style="margin-bottom:14px">
          <div class="dashboard-card-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Shop Work${tasks.length > 0 ? ` · ${doneTasks.length}/${tasks.length}` : ''}</span>
            <button class="btn btn-sm" onclick="showShopWorkDialog();setTimeout(()=>{const sel=document.getElementById('sw-project');if(sel)sel.value='${p.id}'},50)" style="font-size:11px;padding:4px 10px">+ Add</button>
          </div>
          ${tasks.length === 0 ? `
            <div style="font-size:13px;color:#6E7681;font-style:italic">No shop tasks linked to this project yet</div>
            <div style="font-size:11px;color:#6E7681;margin-top:4px">Examples: build rack, prewire, pre-program DSP, tag cables</div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:4px">
              ${tasks.map(t => {
                const assignee = t.assignee_id ? getTeamMember(t.assignee_id) : null;
                const priorityColors = { high: '#F85149', med: '#D29922', low: '#6E7681' };
                const priorityColor = priorityColors[t.priority] || '#6E7681';
                const isDone = t.status === 'done';
                return `
                  <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#0D1117;border:1px solid #1C2333;border-radius:4px;${isDone ? 'opacity:0.5' : ''}">
                    <div style="width:6px;height:6px;border-radius:50%;background:${priorityColor};flex-shrink:0"></div>
                    <div style="flex:1;min-width:0">
                      <div style="font-size:12px;color:#E6EDF3;${isDone ? 'text-decoration:line-through' : ''}">${esc(t.text)}</div>
                      ${assignee ? `<div style="font-size:10px;color:#6E7681;margin-top:1px">${esc(assignee.name)}</div>` : '<div style="font-size:10px;color:#D29922;margin-top:1px">Unassigned</div>'}
                    </div>
                    ${!isDone ? `<button class="btn btn-sm" onclick="completeShopWork(${t.id})" style="font-size:10px;padding:3px 8px;color:#3FB950">Done</button>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `;
    })()}

    <div style="display:none"><!-- spacer; legacy marker --></div>

<!-- LEGACY_ANCHOR -->

    <!-- Proposal activity (only in proposal stage) -->
    ${p.stage === 'proposal' && p.jb_price_valid_until ? (() => {
      const days = daysUntil(p.jb_price_valid_until);
      const cdClass = countdownClass(p.jb_price_valid_until);
      return `
        <div class="dashboard-card" style="margin-top:14px">
          <div class="dashboard-card-title">Proposal Activity</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
            <div style="padding:10px 12px;background:#0D1117;border-radius:8px;border:1px solid #1C2333">
              <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Valid Until</div>
              <div style="font-size:14px;color:#E6EDF3">${fmtDate(p.jb_price_valid_until)}</div>
              <div style="margin-top:4px"><span class="countdown-pill ${cdClass}">${fmtCountdown(p.jb_price_valid_until)}</span></div>
            </div>
            ${p.jb_probability !== null ? `
              <div style="padding:10px 12px;background:#0D1117;border-radius:8px;border:1px solid #1C2333">
                <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Probability</div>
                <div style="font-size:14px;color:#E6EDF3">${Math.round(p.jb_probability * 100)}%</div>
              </div>
            ` : ''}
            ${p.jb_close_date ? `
              <div style="padding:10px 12px;background:#0D1117;border-radius:8px;border:1px solid #1C2333">
                <div style="font-size:10px;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Expected Close</div>
                <div style="font-size:14px;color:#E6EDF3">${fmtDate(p.jb_close_date)}</div>
              </div>
            ` : ''}
          </div>
          <div style="margin-top:10px;font-size:11px;color:#6E7681">Detailed proposal view counts and links will land on the Quote tab (coming soon)</div>
        </div>
      `;
    })() : ''}

    <!-- Renders preview -->
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

    <!-- Project Team (5 role slots with Lead flag) -->
    <div class="dashboard-card" style="margin-top:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="dashboard-card-title" style="margin-bottom:0">Project Team</div>
        ${_ALL_ASSIGN_TEAM_PERMS.some(k => currentUserHasPermission(k)) ? `<button class="btn btn-sm" onclick="showAssignTeamDialog(${p.id})" style="font-size:11px;padding:4px 10px">Manage</button>` : ''}
      </div>
      ${(() => {
        const a = getProjectAssignment(p.id);
        const rows = ASSIGNMENT_ROLES.map(r => {
          const assigned = a[r.key] || [];
          if (assigned.length === 0) return `
            <div class="team-slot-row">
              <div class="team-slot-role" style="color:${r.color}">${r.label}</div>
              <div class="team-slot-empty">Unassigned</div>
            </div>
          `;
          return `
            <div class="team-slot-row">
              <div class="team-slot-role" style="color:${r.color}">${r.label}</div>
              <div class="team-slot-members">
                ${assigned.map(x => {
                  const m = getTeamMember(x.id);
                  if (!m) return '';
                  const color = DASHBOARD_ACCESS.find(d => d.key === m.primaryRole)?.color || '#6E7681';
                  return `
                    <div class="team-slot-pill${x.lead ? ' is-lead' : ''}" title="${x.lead ? 'Lead — ' : ''}${esc(m.name)}">
                      <div class="team-slot-avatar" style="background:${color}22;border-color:${color};color:${color}">${esc(m.initials || m.name.slice(0,2).toUpperCase())}</div>
                      <span>${esc(m.name)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('');
        return `<div class="team-slots">${rows}</div>`;
      })()}
    </div>

    ${p.description ? `
      <div class="dashboard-card" style="margin-top:14px">
        <div class="dashboard-card-title">Description</div>
        <div style="font-size:13px;color:#C9D1D9;line-height:1.6;white-space:pre-wrap">${esc(p.description)}</div>
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
                  ${canSee('financials') && t.proj ? `<span style="font-size:13px;font-weight:500;color:${t.label === 'Better' ? '#58A6FF' : '#6E7681'}">${fmt(t.proj.total)}${t.label === 'Better' ? ' &#9733;' : ''}</span>` : ''}
                </div>
              `).join('')}
            </div>
            <div style="margin-top:10px;font-size:11px;color:#6E7681">&#9733; Pipeline value uses the Better amount</div>
            ${currentUserHasPermission('projects.edit') ? `<button class="btn btn-sm btn-danger" onclick="showGBBLinkDialog(${p.id})" style="margin-top:8px">Manage GBB Link</button>` : ''}
          </div>`;
      } else {
        return '';
      }
    })()}
  `;
}

// ── Project Team Assignment dialog (Pass 3B) ──
function showAssignTeamDialog(projectId) {
  const p = state.projects.find(pr => pr.id === projectId);
  if (!p) return;
  // Allow if user can assign at least one role slot
  if (!_ALL_ASSIGN_TEAM_PERMS.some(k => currentUserHasPermission(k))) return;
  document.getElementById('assign-team-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'assign-team-dialog';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:640px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column">
      <div class="modal-header">
        <div>
          <div class="modal-title">Project Team: ${esc(p.name)}</div>
          <div class="modal-sub">Assign team members to each role. Click the circle to mark someone as Lead.</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('assign-team-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body" id="assign-team-body" style="overflow-y:auto;flex:1">
        ${renderAssignTeamBody(projectId)}
      </div>
      <div style="padding:12px 14px;border-top:1px solid #1C2333;display:flex;justify-content:flex-end">
        <button class="btn-primary" onclick="document.getElementById('assign-team-dialog')?.remove();renderCurrentPage()" style="padding:8px 16px;font-size:13px">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function renderAssignTeamBody(projectId) {
  const a = getProjectAssignment(projectId);
  // Filter to roles the current user is allowed to assign
  const allowedRoles = ASSIGNMENT_ROLES.filter(r => currentUserHasPermission(`projects.assign_team.${r.key}`));
  if (allowedRoles.length === 0) {
    return '<div style="padding:20px;text-align:center;color:#8B949E;font-size:13px">You don&rsquo;t have permission to assign any role slots on this project.</div>';
  }
  return allowedRoles.map(r => {
    const assigned = a[r.key] || [];
    const eligible = state.team.filter(m => m.status !== 'inactive');
    return `
      <div class="assign-role-block" style="border-left:3px solid ${r.color}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
          <div>
            <div style="font-size:13px;font-weight:600;color:${r.color}">${r.label}</div>
            <div style="font-size:11px;color:#6E7681;margin-top:2px">${esc(r.desc)}</div>
          </div>
          <div style="font-size:11px;color:#8B949E">${assigned.length} assigned</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${eligible.map(m => {
            const isAssigned = assigned.some(x => x.id === m.id);
            const isLead = assigned.some(x => x.id === m.id && x.lead);
            const memberColor = DASHBOARD_ACCESS.find(d => d.key === m.primaryRole)?.color || '#6E7681';
            return `
              <div class="assign-chip${isAssigned ? ' active' : ''}${isLead ? ' lead' : ''}" style="${isAssigned ? `border-color:${r.color}66;background:${r.color}15` : ''}">
                <div onclick="toggleRoleAssignment(${projectId},'${r.key}',${m.id});refreshAssignTeamBody(${projectId})" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 10px 4px 4px;-webkit-tap-highlight-color:transparent">
                  <div style="width:22px;height:22px;border-radius:50%;background:${memberColor}22;border:1px solid ${memberColor};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:${memberColor}">${esc(m.initials || m.name.slice(0,2).toUpperCase())}</div>
                  <span style="font-size:12px;color:${isAssigned ? '#E6EDF3' : '#8B949E'};font-weight:${isAssigned ? '500' : '400'}">${esc(m.name)}</span>
                </div>
                ${isAssigned ? `
                  <button onclick="setRoleLead(${projectId},'${r.key}',${m.id});refreshAssignTeamBody(${projectId})" title="${isLead ? 'Lead' : 'Make Lead'}" style="background:transparent;border:none;padding:3px 10px 3px 4px;cursor:pointer;-webkit-tap-highlight-color:transparent">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isLead ? r.color : 'transparent'};border:1.5px solid ${isLead ? r.color : '#6E7681'}"></span>
                  </button>
                ` : ''}
              </div>
            `;
          }).join('')}
          ${eligible.length === 0 ? `<div style="font-size:12px;color:#6E7681;font-style:italic">No active team members</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function refreshAssignTeamBody(projectId) {
  const body = document.getElementById('assign-team-body');
  if (body) body.innerHTML = renderAssignTeamBody(projectId);
}

// ── Progress tab: where milestones get checked off (Stage C Pass 1) ──
function renderProjectProgressHTML(p) {
  const readyForInstall = isReadyForInstall(p);
  const marked = isMarkedReadyForInstall(p.id);

  return `
    <div class="dashboard-card" style="margin-bottom:14px">
      <div class="dashboard-card-title">Project Milestones</div>
      <div style="font-size:12px;color:#8B949E;line-height:1.5">
        Work through each phase's milestones in order. Design, Purchasing, and Planning run in parallel &mdash; all three must complete before Install can begin. Progress here drives the bars on the Overview tab.
      </div>
    </div>

    ${PHASES.map(phase => {
      const pct = phaseProgress(p, phase);
      const unlocked = isPhaseUnlocked(p, phase.key);
      const doneMilestones = phase.milestones.filter(m => milestoneProgress(p, phase, m) >= 1).length;
      const parallel = phase.parallel;

      return `
        <div class="dashboard-card" data-project-anchor="phase_${phase.key}" style="margin-bottom:12px;${!unlocked ? 'opacity:0.55' : ''}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:14px;font-weight:600;color:${phase.color}">${phase.label}</span>
              ${parallel ? `<span style="font-size:10px;font-weight:600;color:#6E7681;text-transform:uppercase;letter-spacing:0.06em;padding:2px 6px;background:#161B22;border-radius:3px">Parallel</span>` : ''}
              ${!unlocked ? `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" style="opacity:0.6"><rect x="3" y="6" width="8" height="6" rx="1" stroke="#6E7681" stroke-width="1.4"/><path d="M5 6V4a2 2 0 0 1 4 0v2" stroke="#6E7681" stroke-width="1.4"/></svg>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:11px;color:#8B949E">${doneMilestones} of ${phase.milestones.length}</span>
              <span style="font-size:13px;font-weight:600;color:${pct >= 1 ? '#3FB950' : '#E6EDF3'}">${Math.round(pct * 100)}%</span>
            </div>
          </div>
          <div class="ready-phase-bar" style="margin-bottom:14px">
            <div class="ready-phase-fill" style="width:${Math.round(pct * 100)}%;background:${phase.color}"></div>
          </div>

          <div style="display:flex;flex-direction:column;gap:2px">
            ${phase.milestones.map((milestone, idx) => {
              const mPct = milestoneProgress(p, phase, milestone);
              const mDone = mPct >= 1;
              const mUnlocked = isMilestoneUnlocked(p, phase, idx);
              const isLinked = !!milestone.linkedChecklist;
              const action = getMilestoneAction(phase.key, milestone.key);
              return `
                <div class="milestone-row ${mDone ? 'done' : ''} ${!mUnlocked ? 'locked' : ''}" data-project-anchor="milestone_${phase.key}_${milestone.key}">
                  <div class="milestone-check ${mDone ? 'checked' : ''}" onclick="${mUnlocked && !isLinked ? `toggleMilestone(${p.id}, '${phase.key}', '${milestone.key}')` : ''}">
                    ${mDone ? '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
                  </div>
                  <div class="milestone-body">
                    <div class="milestone-label">${esc(milestone.label)}</div>
                    ${isLinked ? `
                      <div class="milestone-sub">
                        <span>Progress auto-computed from <a href="#" onclick="event.preventDefault();switchProjectTab('${milestone.linkedChecklist}')" style="color:#58A6FF;text-decoration:none">${milestone.linkedChecklist} checklists</a></span>
                        <span style="color:${mDone ? '#3FB950' : '#8B949E'}">${Math.round(mPct * 100)}%</span>
                      </div>
                      ${mPct > 0 && mPct < 1 ? `
                        <div class="milestone-subbar">
                          <div class="milestone-subfill" style="width:${Math.round(mPct * 100)}%;background:${phase.color}"></div>
                        </div>
                      ` : ''}
                    ` : ''}
                  </div>
                  ${action && mUnlocked ? `
                    <button class="milestone-action" onclick="triggerMilestoneAction(${p.id}, '${phase.key}', '${milestone.key}')" title="${esc(action.label)}">
                      ${action.type === 'email'
                        ? '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="3" width="11" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M2 4l5 4 5-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                        : action.type === 'tab'
                          ? '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                          : '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'}
                      <span>${esc(action.label)}</span>
                    </button>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('')}

    <!-- Bottom readiness gate -->
    <div class="ready-gate ${readyForInstall ? 'ready-gate-open' : 'ready-gate-locked'}" style="margin-top:14px">
      ${readyForInstall ? (marked ? `
        <div class="ready-gate-inner">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="#3FB950" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Marked Ready for Install &mdash; ${fmtDate(state.readyForInstall[p.id]?.slice(0,10))}</span>
          <button class="btn btn-sm" onclick="unmarkReadyForInstall(${p.id})" style="margin-left:auto;font-size:11px;padding:4px 10px">Unmark</button>
        </div>
      ` : `
        <div class="ready-gate-inner">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#3FB950" stroke-width="2"/><path d="M6 8l1.5 1.5L10 6.5" stroke="#3FB950" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>All parallel phases complete</span>
          <button class="btn-primary" onclick="markReadyForInstall(${p.id})" style="margin-left:auto;background:#238636;padding:6px 12px;font-size:12px;min-height:32px">Mark Ready for Install &rarr;</button>
        </div>
      `) : `
        <div class="ready-gate-inner">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="6" width="8" height="6" rx="1" stroke="#6E7681" stroke-width="1.4"/><path d="M5 6V4a2 2 0 0 1 4 0v2" stroke="#6E7681" stroke-width="1.4"/></svg>
          <span>Install locked &mdash; complete all parallel phases first</span>
        </div>
      `}
    </div>
  `;
}

function renderChecklistTab(container, project, phase) {
  // Sub-tasks section (Pass 4A) — top of every Design/Install tab
  const subtasksHTML = renderSubtasksSection(project, phase);

  const systems = project.systems.filter(s => TEMPLATES[phase]?.[s]);
  if (systems.length === 0) {
    container.innerHTML = subtasksHTML + `<div class="empty-state"><span class="empty-icon">${phase === 'design' ? '📐' : '🔧'}</span>No ${phase} checklists — scope tags haven't been detected for this project.<br><br><span style="font-size:11px;color:#6E7681">Checklists auto-generate from scope tags: LED Wall, PA/Audio, Lighting, Control, Streaming, Camera</span></div>`;
    return;
  }
  container.innerHTML = subtasksHTML + systems.map(sys => {
    const template = TEMPLATES[phase][sys];
    const items = getTemplateItems(phase, sys);
    const checkKey = `${project.id}_${phase}_${sys}`;
    const checks = state.checklists[checkKey] || {};
    const total = items.length;
    const done = Object.values(checks).filter(Boolean).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const origCount = template.items.length;
    return `
      <div class="dashboard-card" style="margin-bottom:14px">
        <div class="dashboard-card-title">
          <span>${template.name}</span>
          <span style="font-size:12px;color:${pct === 100 ? '#3FB950' : '#8B949E'}">${done}/${total} (${pct}%)</span>
        </div>
        <div class="timeline-bar">
          ${items.map((_, i) => `<div class="timeline-segment ${checks[i] ? 'done' : ''}"></div>`).join('')}
        </div>
        ${items.map((item, i) => {
          const isCustom = i >= origCount;
          return `
          <div class="checklist-item ${checks[i] ? 'checked' : ''}" onclick="toggleCheck(${project.id}, '${phase}', '${sys}', ${i})">
            <div class="checklist-box">
              <svg class="checklist-check" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="checklist-label">${esc(item)}${isCustom ? ' <span style="font-size:9px;color:#58A6FF;padding:1px 5px;border-radius:3px;background:#0D1626;border:1px solid #1565C0;margin-left:4px;vertical-align:middle">ADDED</span>' : ''}</span>
          </div>
        `;
        }).join('')}
      </div>
    `;
  }).join('');
}

// Returns the effective items for a template: base items plus any accepted customizations
function getTemplateItems(phase, scope) {
  const base = TEMPLATES[phase]?.[scope]?.items || [];
  const customs = state.templateCustomizations?.[`${phase}.${scope}`] || [];
  return [...base, ...customs];
}

// ── Sub-tasks UI (Pass 4A) ──
function renderSubtasksSection(project, phase) {
  const tasks = getSubtasks(project.id, phase);
  const activeId = getActiveTeamMemberId();
  const canManage = canCreateSubtasks(phase);
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const openCount = tasks.length - doneCount;

  // Sort: open first, then by priority (high>med>low), then by assignee (you first)
  const priorityRank = { high: 0, med: 1, low: 2 };
  const sorted = [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
    const pDiff = (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
    if (pDiff !== 0) return pDiff;
    if (a.assignee_id === activeId && b.assignee_id !== activeId) return -1;
    if (b.assignee_id === activeId && a.assignee_id !== activeId) return 1;
    return 0;
  });

  const phaseRoleKey = phase === 'design' ? 'design' : 'install';
  const leadInfo = getLeadForRole(project.id, phaseRoleKey);
  const leadName = leadInfo ? getTeamMember(leadInfo.id)?.name : null;

  return `
    <div class="dashboard-card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div class="dashboard-card-title" style="margin-bottom:0">${phase === 'design' ? 'Design' : 'Install'} Sub-tasks</div>
          ${tasks.length > 0 ? `<span style="font-size:11px;color:#6E7681">${doneCount} of ${tasks.length} done</span>` : ''}
          ${leadName ? `<span style="font-size:10px;padding:2px 7px;border-radius:3px;background:#0D1626;color:#58A6FF;border:1px solid #1565C0" title="Lead ${phase === 'design' ? 'Designer' : 'Installer'}">Lead: ${esc(leadName)}</span>` : ''}
        </div>
        ${canManage ? `<button class="btn-primary" onclick="showSubtaskDialog(${project.id}, '${phase}')" style="padding:6px 12px;font-size:12px">+ Add Task</button>` : ''}
      </div>

      ${tasks.length === 0 ? `
        <div style="font-size:12px;color:#6E7681;font-style:italic;padding:8px 0">
          ${canManage ? `No sub-tasks yet. Break up the ${phase} phase into work items and assign them to team members.` : `No sub-tasks yet. ${leadName ? leadName + ' (Lead) can' : 'The Lead can'} add tasks here.`}
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:4px">
          ${sorted.map(t => renderSubtaskRow(project.id, phase, t, activeId, canManage)).join('')}
        </div>
      `}
    </div>
  `;
}

function renderSubtaskRow(projectId, phase, task, activeId, canManage) {
  const assignee = task.assignee_id ? getTeamMember(task.assignee_id) : null;
  const isMine = task.assignee_id === activeId;
  const isDone = task.status === 'done';
  const priorityColors = { high: '#F85149', med: '#D29922', low: '#6E7681' };
  const priorityColor = priorityColors[task.priority] || '#6E7681';
  const canToggle = canManage || isMine;
  const memberColor = assignee ? (DASHBOARD_ACCESS.find(d => d.key === assignee.primaryRole)?.color || '#6E7681') : '#6E7681';

  // Due date pill
  let duePill = '';
  if (task.due_date && !isDone) {
    const days = daysUntil(task.due_date);
    const cdClass = countdownClass(task.due_date);
    duePill = `<span class="countdown-pill ${cdClass}" style="font-size:10px">${fmtCountdown(task.due_date)}</span>`;
  } else if (task.due_date && isDone) {
    duePill = `<span style="font-size:10px;color:#6E7681">${fmtDate(task.due_date)}</span>`;
  }

  return `
    <div class="subtask-row ${isDone ? 'done' : ''}" style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:${isMine && !isDone ? '#0D1626' : '#0D1117'};border:1px solid ${isMine && !isDone ? '#1565C0' : '#1C2333'};border-radius:5px">
      <!-- Checkbox -->
      <div onclick="${canToggle ? `toggleSubtaskStatus(${projectId}, '${phase}', ${task.id})` : ''}"
        style="width:18px;height:18px;border-radius:4px;border:1.5px solid ${isDone ? '#3FB950' : (canToggle ? '#58A6FF' : '#30363D')};background:${isDone ? '#3FB950' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:${canToggle ? 'pointer' : 'not-allowed'};-webkit-tap-highlight-color:transparent">
        ${isDone ? '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
      </div>

      <!-- Priority dot -->
      <div style="width:6px;height:6px;border-radius:50%;background:${priorityColor};flex-shrink:0" title="${task.priority} priority"></div>

      <!-- Text + assignee -->
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:#E6EDF3;${isDone ? 'text-decoration:line-through;opacity:0.6' : ''}">${esc(task.text)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:3px;font-size:10px;color:#6E7681;flex-wrap:wrap">
          ${assignee ? `
            <span style="display:inline-flex;align-items:center;gap:4px">
              <span style="width:14px;height:14px;border-radius:50%;background:${memberColor}22;border:1px solid ${memberColor};display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;color:${memberColor}">${esc(assignee.initials || assignee.name.slice(0,2).toUpperCase())}</span>
              <span style="color:${isMine ? '#58A6FF' : '#8B949E'}">${esc(assignee.name)}${isMine ? ' (you)' : ''}</span>
            </span>
          ` : '<span style="color:#D29922">Unassigned</span>'}
          ${duePill}
        </div>
      </div>

      <!-- Edit/Delete (Lead / manager only) -->
      ${canManage ? `
        <div style="display:flex;gap:2px;flex-shrink:0">
          <button class="btn btn-sm" onclick="showSubtaskDialog(${projectId}, '${phase}', ${task.id})" style="font-size:10px;padding:3px 7px">Edit</button>
          <button class="btn btn-sm" onclick="confirmDeleteSubtask(${projectId}, '${phase}', ${task.id})" style="font-size:11px;padding:3px 7px;color:#8B949E" title="Delete">×</button>
        </div>
      ` : ''}
    </div>
  `;
}

function showSubtaskDialog(projectId, phase, taskId) {
  const task = taskId ? getSubtasks(projectId, phase).find(t => t.id === taskId) : null;
  const isEdit = !!task;
  if (!canCreateSubtasks(phase)) return;

  // Eligible assignees: everyone on the project in that phase role OR active team
  const phaseRole = phase === 'design' ? 'design' : 'install';
  const a = getProjectAssignment(projectId);
  const assignedToRole = (a[phaseRole] || []).map(x => x.id);
  const eligible = state.team.filter(m => m.status !== 'inactive');
  // Sort: people assigned to this phase first
  eligible.sort((x, y) => {
    const xOn = assignedToRole.includes(x.id);
    const yOn = assignedToRole.includes(y.id);
    if (xOn !== yOn) return xOn ? -1 : 1;
    return 0;
  });

  document.getElementById('subtask-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'subtask-dialog';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:480px">
      <div class="modal-header">
        <div>
          <div class="modal-title">${isEdit ? 'Edit' : 'New'} ${phase === 'design' ? 'Design' : 'Install'} Task</div>
          <div class="modal-sub">${isEdit ? 'Update task details' : 'Break up the work and assign it'}</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('subtask-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Task</label>
        <textarea id="st-text" class="form-textarea" rows="2" placeholder="${phase === 'design' ? 'e.g. Finalize DSP signal flow, deliver CAD set for LED wall...' : 'e.g. Pre-wire rack, tag cables, commission audio chain...'}" style="width:100%;margin-bottom:12px">${esc(task?.text || '')}</textarea>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Assign to</label>
            <select id="st-assignee" class="form-input" style="width:100%">
              <option value="">Unassigned</option>
              ${assignedToRole.length > 0 ? `<optgroup label="On ${phase} team">${eligible.filter(m => assignedToRole.includes(m.id)).map(m => `<option value="${m.id}" ${task?.assignee_id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>` : ''}
              <optgroup label="Other team members">${eligible.filter(m => !assignedToRole.includes(m.id)).map(m => `<option value="${m.id}" ${task?.assignee_id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Priority</label>
            <select id="st-priority" class="form-input" style="width:100%">
              <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="med" ${(!task || task.priority === 'med') ? 'selected' : ''}>Medium</option>
              <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>
        </div>

        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Due date (optional)</label>
        <input type="date" id="st-due" class="form-input" value="${esc(task?.due_date || '')}" style="width:100%;margin-bottom:14px">

        ${!isEdit && (() => {
          const p = state.projects.find(pr => pr.id === projectId);
          const scopes = (p?.systems || []).filter(s => TEMPLATES[phase]?.[s]);
          if (scopes.length === 0) return '';
          return `
            <div style="padding:10px 12px;background:#0D1117;border:1px solid #1C2333;border-radius:5px;margin-bottom:14px">
              <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">
                <input type="checkbox" id="st-suggest-template" style="margin-top:3px">
                <label for="st-suggest-template" style="font-size:12px;color:#C9D1D9;cursor:pointer">Also suggest adding this to a template</label>
              </div>
              <div id="st-suggest-scope-wrap" style="display:none;padding-left:24px;margin-top:6px">
                <label style="font-size:10px;color:#8B949E;display:block;margin-bottom:3px">Which template?</label>
                <select id="st-suggest-scope" class="form-input" style="width:100%;font-size:12px">
                  ${scopes.map(s => `<option value="${s}">${esc(TEMPLATES[phase][s].name)}</option>`).join('')}
                </select>
                <div style="font-size:10px;color:#6E7681;margin-top:4px">A reviewer will approve or reject before it&rsquo;s added to the template for future projects.</div>
              </div>
            </div>
            <script>
              (function(){
                const cb = document.getElementById('st-suggest-template');
                const wrap = document.getElementById('st-suggest-scope-wrap');
                if (cb && wrap) cb.onchange = () => { wrap.style.display = cb.checked ? 'block' : 'none'; };
              })();
            </script>
          `;
        })()}

        <div style="display:flex;gap:8px">
          <button class="btn" style="flex:1" onclick="document.getElementById('subtask-dialog')?.remove()">Cancel</button>
          <button class="btn-primary" style="flex:1" onclick="saveSubtask(${projectId}, '${phase}', ${taskId || 'null'})">${isEdit ? 'Save' : 'Add Task'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Focus the textarea
  setTimeout(() => document.getElementById('st-text')?.focus(), 50);
}

function saveSubtask(projectId, phase, taskId) {
  const text = document.getElementById('st-text')?.value?.trim();
  if (!text) { alert('Task description required'); return; }
  const assigneeVal = document.getElementById('st-assignee')?.value;
  const priority = document.getElementById('st-priority')?.value || 'med';
  const dueVal = document.getElementById('st-due')?.value;
  const assignee_id = assigneeVal ? parseInt(assigneeVal) : null;
  const due_date = dueVal || null;

  if (taskId) {
    updateSubtask(projectId, phase, taskId, { text, assignee_id, priority, due_date });
  } else {
    addSubtask(projectId, phase, { text, assignee_id, priority, due_date });
    // Check if template suggestion was requested
    const suggestCb = document.getElementById('st-suggest-template');
    if (suggestCb?.checked) {
      const scope = document.getElementById('st-suggest-scope')?.value;
      if (scope) createTemplateSuggestion({ phase, scope, text, project_id: projectId });
    }
  }
  document.getElementById('subtask-dialog')?.remove();
  rerenderCurrentTab();
}

// ── Template suggestions (Pass 4B) ──
function createTemplateSuggestion({ phase, scope, text, project_id }) {
  const suggestion = {
    id: Date.now() + Math.random(),
    phase, scope, text, project_id,
    suggested_by: getActiveTeamMemberId(),
    created_at: new Date().toISOString(),
    status: 'pending'
  };
  state.templateSuggestions.push(suggestion);
  save('vi_template_suggestions', state.templateSuggestions);
  // Brief confirmation — non-blocking
  showToast(`Template suggestion submitted. A reviewer will decide whether to add it to the ${TEMPLATES[phase][scope]?.name || scope} template.`);
}

function getPendingSuggestions() {
  return state.templateSuggestions.filter(s => s.status === 'pending');
}

function acceptTemplateSuggestion(suggestionId) {
  const s = state.templateSuggestions.find(x => x.id === suggestionId);
  if (!s) return;
  if (!currentUserHasPermission('templates.review')) return;
  // Add to template customizations
  const key = `${s.phase}.${s.scope}`;
  if (!state.templateCustomizations[key]) state.templateCustomizations[key] = [];
  state.templateCustomizations[key].push(s.text);
  save('vi_template_customizations', state.templateCustomizations);
  s.status = 'accepted';
  s.reviewed_by = getActiveTeamMemberId();
  s.reviewed_at = new Date().toISOString();
  save('vi_template_suggestions', state.templateSuggestions);
  renderCurrentPage();
}

function rejectTemplateSuggestion(suggestionId) {
  const s = state.templateSuggestions.find(x => x.id === suggestionId);
  if (!s) return;
  if (!currentUserHasPermission('templates.review')) return;
  s.status = 'rejected';
  s.reviewed_by = getActiveTeamMemberId();
  s.reviewed_at = new Date().toISOString();
  save('vi_template_suggestions', state.templateSuggestions);
  renderCurrentPage();
}

// Toast helper (non-blocking confirmation)
function showToast(msg, kind = 'info') {
  const existing = document.getElementById('vi-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'vi-toast';
  const colors = { info: '#1565C0', success: '#238636', warn: '#9E6A03', error: '#DA3633' };
  toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#161B22;color:#E6EDF3;padding:12px 18px;border-radius:6px;border:1px solid ${colors[kind] || colors.info};box-shadow:0 4px 20px rgba(0,0,0,0.4);font-size:13px;z-index:99999;max-width:420px;line-height:1.4`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; }, 3000);
  setTimeout(() => toast.remove(), 3500);
}

function confirmDeleteSubtask(projectId, phase, taskId) {
  if (!confirm('Delete this task?')) return;
  deleteSubtask(projectId, phase, taskId);
  rerenderCurrentTab();
}

function dismissStageDivergence(projectId) {
  const p = state.projects.find(pr => pr.id === projectId);
  if (!p) return;
  delete p._stage_divergence;
  // Update the raw_stage so this project's current JB stage is treated as the baseline going forward
  if (p._jb_stage_current) p.raw_stage = p._jb_stage_current;
  try { localStorage.setItem('vi_projects_cache', JSON.stringify(state.projects)); } catch(e) {}
  renderCurrentPage();
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

// ── Project Classifier (Pass 1) ──
const PROJECT_TYPES = [
  { key: 'install',     label: 'Install',      color: '#1565C0', bg: '#0D1626' },
  { key: 'service',     label: 'Service Call', color: '#D29922', bg: '#1A150D' },
  { key: 'box_sale',    label: 'Box Sale',     color: '#3FB950', bg: '#0D1A0E' },
  { key: 'design',      label: 'Design Only',  color: '#A371F7', bg: '#1A0D26' },
  { key: 'rental',      label: 'Rental',       color: '#F0883E', bg: '#1A1208' }
];

function getProjectType(p) {
  // Override wins; fall back to Jetbuilt's project_type, then default to 'install'
  if (state.projectType[p.id]) return state.projectType[p.id];
  const jbType = p.jb_project_type || '';
  if (jbType === 'project') return 'install';  // Jetbuilt calls installs "project"
  if (['service', 'box_sale', 'design', 'rental'].includes(jbType)) return jbType;
  return 'install';
}

function setProjectType(projectId, type) {
  state.projectType[projectId] = type;
  save('vi_project_type', state.projectType);
  renderCurrentPage();
}

function projectTypeBadgeHTML(p) {
  const type = getProjectType(p);
  const meta = PROJECT_TYPES.find(t => t.key === type) || PROJECT_TYPES[0];
  return `<span class="ptype-badge" style="background:${meta.bg};color:${meta.color};border:1px solid ${meta.color}40" onclick="showProjectTypeDialog(${p.id})" title="Click to change">${meta.label}</span>`;
}

function showProjectTypeDialog(projectId) {
  const p = state.projects.find(pr => pr.id === projectId);
  if (!p) return;
  const current = getProjectType(p);
  document.getElementById('ptype-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'ptype-dialog';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:400px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Project Type</div>
          <div class="modal-sub">Classification override &mdash; will sync back to Jetbuilt later</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('ptype-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:6px">
          ${PROJECT_TYPES.map(t => `
            <button class="ptype-option ${current === t.key ? 'active' : ''}" onclick="setProjectType(${projectId}, '${t.key}');document.getElementById('ptype-dialog')?.remove()"
              style="background:${current === t.key ? t.bg : '#0D1117'};border:1px solid ${current === t.key ? t.color : '#1C2333'};color:${current === t.key ? t.color : '#C9D1D9'};padding:12px 14px;border-radius:8px;text-align:left;font-size:13px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif">
              ${t.label}
            </button>
          `).join('')}
        </div>
        ${p.jb_project_type ? `<div style="margin-top:14px;font-size:11px;color:#6E7681">Jetbuilt value: <code style="color:#8B949E">${esc(p.jb_project_type)}</code></div>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ── Contract Date (Pass 1) ──
function getContractDate(projectId) {
  return state.contractDates[projectId] || '';
}

function setContractDate(projectId, date) {
  if (date) state.contractDates[projectId] = date;
  else delete state.contractDates[projectId];
  save('vi_contract_dates', state.contractDates);
}

function showContractDateDialog(projectId) {
  const existing = getContractDate(projectId);
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('contract-date-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'contract-date-dialog';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:420px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Contract Signed Date</div>
          <div class="modal-sub">The day the contract was signed &mdash; not the close date</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('contract-date-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <label style="font-size:12px;color:#8B949E;font-weight:500;display:block;margin-bottom:6px">Date signed</label>
        <input type="date" id="contract-date-input" class="form-input" value="${esc(existing)}" style="width:100%">
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" onclick="document.getElementById('contract-date-input').value='${today}'" style="flex:1">Use Today</button>
          ${existing ? `<button class="btn btn-danger" onclick="setContractDate(${projectId}, '');document.getElementById('contract-date-dialog')?.remove();renderCurrentPage()">Clear</button>` : ''}
          <button class="btn-primary" onclick="const v=document.getElementById('contract-date-input').value;if(v){setContractDate(${projectId}, v);document.getElementById('contract-date-dialog')?.remove();renderCurrentPage()}" style="flex:1">Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ── Install Countdown (Pass 1) ──

// Returns the effective estimated install date — user override wins over Jetbuilt's value
function getEstimatedInstall(p) {
  // Override may be a legacy string OR a {start, end} object.
  // Returns just the start date as a string (for callers that expect a single date).
  // For range-aware callers, use getEstimatedInstallRange instead.
  const override = state.estimatedInstallOverride?.[p.id];
  if (override && typeof override === 'object') return override.start || '';
  return override || p.jb_estimated_install || '';
}

function getEstimatedInstallRange(p) {
  const override = state.estimatedInstallOverride?.[p.id];
  if (override && typeof override === 'object' && override.start) {
    return { start: override.start, end: override.end || override.start };
  }
  if (typeof override === 'string' && override) {
    return { start: override, end: override };
  }
  if (p.jb_estimated_install) {
    return { start: p.jb_estimated_install, end: p.jb_estimated_install };
  }
  return null;
}

function setEstimatedInstallOverride(projectId, dateOrRange) {
  if (!state.estimatedInstallOverride) state.estimatedInstallOverride = {};
  if (!dateOrRange) {
    delete state.estimatedInstallOverride[projectId];
  } else if (typeof dateOrRange === 'string') {
    state.estimatedInstallOverride[projectId] = dateOrRange;
  } else {
    // Object with {start, end, [excludeWeekends], [weekendIncludes]}
    const entry = {
      start: dateOrRange.start,
      end: dateOrRange.end || dateOrRange.start
    };
    if (dateOrRange.excludeWeekends !== undefined) entry.excludeWeekends = !!dateOrRange.excludeWeekends;
    if (Array.isArray(dateOrRange.weekendIncludes)) entry.weekendIncludes = [...dateOrRange.weekendIncludes];
    state.estimatedInstallOverride[projectId] = entry;
  }
  save('vi_estimated_install', state.estimatedInstallOverride);
}

function showEstimatedInstallDialog(projectId) {
  const p = state.projects.find(pr => pr.id === projectId);
  if (!p) return;
  const existing = getEstimatedInstallRange(p);
  const stored = state.estimatedInstallOverride?.[projectId];
  const storedObj = (stored && typeof stored === 'object') ? stored : {};
  openInstallWindowPicker({
    projectId,
    mode: 'estimated',
    initialStart: existing?.start,
    initialEnd: existing?.end,
    initialExcludeWeekends: storedObj.excludeWeekends !== false,
    initialWeekendIncludes: storedObj.weekendIncludes || [],
    onConfirm: (start, end, result) => {
      setEstimatedInstallOverride(projectId, {
        start, end,
        excludeWeekends: result.excludeWeekends,
        weekendIncludes: result.weekendIncludes
      });
      renderCurrentPage();
    }
  });
}

function getInstallWindow(p) {
  // Prefer booked window; fall back to estimated (with user override)
  const booked = getBookedTimeline(p.id);
  if (booked && booked.start) {
    return {
      start: booked.start,
      end: booked.end || booked.start,
      source: 'booked'
    };
  }
  const est = getEstimatedInstallRange(p);
  if (est) {
    return {
      start: est.start,
      end: est.end,
      source: 'estimated'
    };
  }
  return null;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function fmtCountdown(dateStr) {
  const days = daysUntil(dateStr);
  if (days === null) return '';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `in ${days}d`;
}

function countdownClass(dateStr) {
  const days = daysUntil(dateStr);
  if (days === null) return '';
  if (days < 0) return 'cd-past';
  if (days <= 7) return 'cd-urgent';
  if (days <= 14) return 'cd-soon';
  return 'cd-ok';
}

// ── Phase & Milestone System (Stage C Pass 1) ──
// Project readiness workflow: Lead → Proposal → Contract → [Design + Purchasing + Planning parallel] → Install
// Milestones are sequential within each phase; parallel phases can be worked independently.

const PHASES = [
  { key: 'lead', label: 'Lead', color: '#8B949E', parallel: false, milestones: [
    { key: 'contact_made',       label: 'Initial contact made with client' },
    { key: 'walkthrough_sched',  label: 'Walkthrough scheduled with client' }
  ]},
  { key: 'proposal', label: 'Proposal', color: '#D29922', parallel: false, milestones: [
    { key: 'walkthrough_done',   label: 'Walkthrough completed' },
    { key: 'proposal_built',     label: 'Proposal built' },
    { key: 'proposal_sent',      label: 'Proposal sent to client' }
  ]},
  { key: 'contract', label: 'Contract', color: '#58A6FF', parallel: false, milestones: [
    { key: 'client_signed',      label: 'Client signed contract' },
    { key: 'countersigned_sent', label: 'Countersigned contract sent back to client' },
    { key: 'deposit_invoice',    label: 'Deposit invoice sent' },
    { key: 'insurance_tax',      label: 'Insurance & tax info sent' },
    { key: 'install_dates_est',  label: 'Estimated install dates entered' },
    { key: 'crew_total_est',     label: 'Estimated crew total entered' }
  ]},
  { key: 'design', label: 'Design', color: '#A371F7', parallel: true, milestones: [
    { key: 'design_kickoff',     label: 'Design Kickoff Meeting' },
    { key: 'design_completed',   label: 'Design Completed', linkedChecklist: 'design' },
    { key: 'design_handoff',     label: 'Design Handoff Meeting' }
  ]},
  { key: 'purchasing', label: 'Purchasing', color: '#3FB950', parallel: true, milestones: [
    { key: 'all_ordered',        label: 'All equipment ordered' },
    { key: 'all_arrived',        label: 'All equipment arrived at warehouse' }
  ]},
  { key: 'planning', label: 'Planning', color: '#F0883E', parallel: true, milestones: [
    { key: 'install_tasks',      label: 'Install tasks made' },
    { key: 'install_schedule',   label: 'Install schedule made' },
    { key: 'client_expect_sent', label: 'Client expectations & schedule sent' },
    { key: 'crew_assigned',      label: 'Crew assigned' },
    { key: 'vehicles_assigned',  label: 'Vehicles assigned' },
    { key: 'tools_assigned',     label: 'Tools assigned' }
  ]},
  { key: 'install', label: 'Install', color: '#F85149', parallel: false, gatedByParallel: true, milestones: [
    { key: 'shop_work_done',     label: 'Shop work completed' },
    { key: 'job_prepped',        label: 'Job prepped' },
    { key: 'job_loaded',         label: 'Job loaded' },
    { key: 'install_started',    label: 'Install started' },
    { key: 'install_complete',   label: 'Install complete', linkedChecklist: 'install' },
    { key: 'commissioning',      label: 'Job commissioning' },
    { key: 'asbuilt_updated',    label: 'As-built updated' },
    { key: 'unload_deprep',      label: 'Unload & de-prep' }
  ]}
];

// Milestone action registry — keys are "phaseKey.milestoneKey"
// Types: 'email' (opens email modal), 'tab' (jumps to another tab), 'dialog' (opens a custom modal)
const MILESTONE_ACTIONS = {
  'lead.walkthrough_sched': {
    type: 'email',
    label: 'Schedule Walkthrough',
    template: 'walkthrough_schedule'
  },
  'proposal.walkthrough_done': {
    type: 'dialog',
    label: 'Log Walkthrough',
    handler: 'showLogWalkthroughDialog'
  },
  'proposal.proposal_built': {
    type: 'tab',
    label: 'Open Quote Tab',
    tab: 'files',  // placeholder until Quote tab exists
    note: 'Quote tab coming soon — using Files for now'
  },
  'proposal.proposal_sent': {
    type: 'email',
    label: 'Send Proposal',
    template: 'proposal_send'
  },
  'contract.client_signed': {
    type: 'tab',
    label: 'Upload Signed Contract',
    tab: 'files'
  },
  'contract.countersigned_sent': {
    type: 'email',
    label: 'Send Countersigned',
    template: 'countersigned_send'
  },
  'contract.deposit_invoice': {
    type: 'email',
    label: 'Send Deposit Invoice',
    template: 'deposit_invoice'
  },
  'contract.insurance_tax': {
    type: 'email',
    label: 'Send Insurance & Tax',
    template: 'insurance_tax'
  },
  'contract.install_dates_est': {
    type: 'dialog',
    label: 'Set Estimated Dates',
    handler: 'showEstimatedInstallDialog'
  },
  'design.design_kickoff': {
    type: 'dialog',
    label: 'Log Kickoff Meeting',
    handler: 'showLogMeetingDialog',
    arg: 'kickoff'
  },
  'design.design_completed': {
    type: 'tab',
    label: 'Open Design Tab',
    tab: 'design'
  },
  'design.design_handoff': {
    type: 'dialog',
    label: 'Log Handoff Meeting',
    handler: 'showLogMeetingDialog',
    arg: 'handoff'
  },
  'planning.client_expect_sent': {
    type: 'email',
    label: 'Send to Client',
    template: 'client_expectations'
  },
  'planning.crew_assigned': {
    type: 'dialog',
    label: 'Assign Crew',
    handler: 'showCrewAssignDialog'
  },
  'planning.vehicles_assigned': {
    type: 'dialog',
    label: 'Assign Vehicles',
    handler: 'showVehiclesAssignDialog'
  },
  'planning.tools_assigned': {
    type: 'dialog',
    label: 'Assign Tools',
    handler: 'showToolsAssignDialog'
  },
  'install.install_complete': {
    type: 'tab',
    label: 'Open Install Tab',
    tab: 'install'
  }
};

function getMilestoneAction(phaseKey, milestoneKey) {
  return MILESTONE_ACTIONS[`${phaseKey}.${milestoneKey}`] || null;
}

function triggerMilestoneAction(projectId, phaseKey, milestoneKey) {
  const action = getMilestoneAction(phaseKey, milestoneKey);
  if (!action) return;
  if (action.type === 'tab') {
    switchProjectTab(action.tab);
  } else if (action.type === 'email') {
    showMilestoneEmailDialog(projectId, phaseKey, milestoneKey, action.template);
  } else if (action.type === 'dialog') {
    // Call the named handler with project id (and arg if present)
    const fn = window[action.handler];
    if (typeof fn === 'function') {
      action.arg ? fn(projectId, action.arg) : fn(projectId);
    }
  }
}

// ── Email template system (Stage C Pass 2A) ──
// Each template returns { subject, body } given the project
const EMAIL_TEMPLATES = {
  walkthrough_schedule: (p) => ({
    subject: `Site walkthrough for ${p.name}`,
    body: `Hi ${(p.primary_contact_name || p.client_name || '').split(' ')[0] || 'there'},

I'd like to schedule a site walkthrough for ${p.name} so we can finalize the scope and take any necessary measurements.

Proposed date/time: [DATE] at [TIME]
Location: ${[p.address, p.city, p.state_abbr].filter(Boolean).join(', ') || '[to confirm]'}
Expected duration: 30-60 minutes

Please let me know if this works, or suggest an alternative that fits your schedule.

Thanks,
[Your name]
Valiant Integrations`
  }),
  proposal_send: (p) => ({
    subject: `Proposal: ${p.name}`,
    body: `Hi ${(p.primary_contact_name || p.client_name || '').split(' ')[0] || 'there'},

Please find attached our proposal for ${p.name}. I've built it around the scope we discussed during the walkthrough, and it reflects the priorities you outlined.

A few quick notes:
- The pricing is valid until [DATE]
- We'd typically plan an install window of [X days]
- If you'd like to walk through it together, I'm happy to get on a call

Let me know if you have any questions.

Thanks,
[Your name]
Valiant Integrations`
  }),
  countersigned_send: (p) => ({
    subject: `Countersigned contract: ${p.name}`,
    body: `Hi ${(p.primary_contact_name || p.client_name || '').split(' ')[0] || 'there'},

Attached is the countersigned contract for ${p.name} for your records.

Next steps on our side:
- A deposit invoice will follow shortly
- Our insurance and W-9 will be sent separately
- We'll share estimated install dates once purchasing is confirmed

Thanks for choosing Valiant Integrations.

[Your name]`
  }),
  deposit_invoice: (p) => ({
    subject: `Deposit invoice: ${p.name}`,
    body: `Hi ${(p.primary_contact_name || p.client_name || '').split(' ')[0] || 'there'},

Please find the deposit invoice for ${p.name} attached. Payment of this deposit will allow us to begin ordering equipment and locking in install dates.

Payment is due per the terms in the contract. Let me know if you have any questions.

Thanks,
[Your name]
Valiant Integrations`
  }),
  insurance_tax: (p) => ({
    subject: `Insurance & tax documents: ${p.name}`,
    body: `Hi ${(p.primary_contact_name || p.client_name || '').split(' ')[0] || 'there'},

For ${p.name}, attached are our:
- Certificate of Insurance
- W-9

Please forward to your AP/accounting team as needed. Let me know if there's any additional documentation you need.

Thanks,
[Your name]
Valiant Integrations`
  }),
  client_expectations: (p) => {
    const win = getInstallWindow(p);
    const dates = win ? `${fmtDate(win.start)}${win.end && win.end !== win.start ? ' – ' + fmtDate(win.end) : ''}` : '[install dates]';
    return {
      subject: `Install expectations & schedule: ${p.name}`,
      body: `Hi ${(p.primary_contact_name || p.client_name || '').split(' ')[0] || 'there'},

As we get close to install for ${p.name}, here's what to expect:

Schedule: ${dates}
Crew size: [X technicians]
Access needs: [parking, loading dock, freight elevator, etc.]
Site readiness needed: [cleared space, power, networking access, etc.]
Work hours: [typical schedule, breaks]

Please let us know if there are any site-specific requirements we should know about — security badging, insurance certificates for the venue, scheduled quiet hours, etc.

Thanks,
[Your name]
Valiant Integrations`
    };
  }
};

function showMilestoneEmailDialog(projectId, phaseKey, milestoneKey, templateKey) {
  const p = state.projects.find(pr => pr.id === projectId);
  if (!p) return;
  const tpl = EMAIL_TEMPLATES[templateKey];
  if (!tpl) return;
  const rendered = tpl(p);
  const to = p.primary_contact_email || '';

  document.getElementById('mail-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'mail-dialog';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:640px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Compose Email</div>
          <div class="modal-sub">Review, edit, then send or copy</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('mail-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">To</label>
        <input type="email" id="mail-to" class="form-input" value="${esc(to)}" style="width:100%;margin-bottom:10px">

        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Subject</label>
        <input type="text" id="mail-subject" class="form-input" value="${esc(rendered.subject)}" style="width:100%;margin-bottom:10px">

        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Body</label>
        <textarea id="mail-body" class="form-textarea" rows="14" style="width:100%;font-family:inherit;font-size:13px;line-height:1.5">${esc(rendered.body)}</textarea>

        <div style="margin-top:10px;font-size:11px;color:#6E7681;padding:8px 10px;background:#0D1117;border:1px solid #1C2333;border-radius:6px">
          <strong style="color:#8B949E">Tip:</strong> &ldquo;Open in Email Client&rdquo; launches your default mail app with all fields pre-filled. If that doesn&rsquo;t work, use &ldquo;Copy to Clipboard&rdquo; and paste into Gmail/Outlook web.
        </div>

        <div style="display:flex;gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#8B949E;flex:1;min-width:180px">
            <input type="checkbox" id="mail-check-milestone" checked style="margin:0">
            Check off milestone after sending
          </label>
          <button class="btn" onclick="copyMilestoneEmail()">Copy to Clipboard</button>
          <button class="btn-primary" onclick="sendMilestoneEmail(${projectId}, '${phaseKey}', '${milestoneKey}')">Open in Email Client</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function copyMilestoneEmail() {
  const to = document.getElementById('mail-to')?.value || '';
  const subject = document.getElementById('mail-subject')?.value || '';
  const body = document.getElementById('mail-body')?.value || '';
  const text = `To: ${to}\nSubject: ${subject}\n\n${body}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('#mail-dialog .btn:not(.btn-primary)');
      if (btn) { const orig = btn.textContent; btn.textContent = '✓ Copied'; setTimeout(() => btn.textContent = orig, 1500); }
    });
  }
}

function sendMilestoneEmail(projectId, phaseKey, milestoneKey) {
  const to = document.getElementById('mail-to')?.value || '';
  const subject = document.getElementById('mail-subject')?.value || '';
  const body = document.getElementById('mail-body')?.value || '';
  const shouldCheck = document.getElementById('mail-check-milestone')?.checked;
  // mailto: URL (encoded)
  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  if (shouldCheck) {
    setMilestone(projectId, phaseKey, milestoneKey, true);
  }
  setTimeout(() => {
    document.getElementById('mail-dialog')?.remove();
    renderCurrentPage();
  }, 300);
}

// ── Meeting logs (Pass 2B) ──
function getMeetingLog(projectId, type) {
  return state.meetingLogs?.[projectId]?.[type] || null;
}

function saveMeetingLog(projectId, type, data) {
  if (!state.meetingLogs[projectId]) state.meetingLogs[projectId] = {};
  state.meetingLogs[projectId][type] = { ...data, saved_at: new Date().toISOString() };
  save('vi_meeting_logs', state.meetingLogs);
}

function showMeetingLogDialog(projectId, type, config) {
  // type: 'walkthrough' | 'design_kickoff' | 'design_handoff'
  // config: { title, milestonePhase, milestoneKey }
  const p = state.projects.find(pr => pr.id === projectId);
  if (!p) return;
  const existing = getMeetingLog(projectId, type) || {};
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('meeting-log-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'meeting-log-dialog';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:520px">
      <div class="modal-header">
        <div>
          <div class="modal-title">${esc(config.title)}</div>
          <div class="modal-sub">${esc(p.name)} &middot; Log the meeting once it&rsquo;s done</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('meeting-log-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Meeting date</label>
        <input type="date" id="mlog-date" class="form-input" value="${esc(existing.date || today)}" style="width:100%;margin-bottom:12px">

        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Attendees</label>
        <input type="text" id="mlog-attendees" class="form-input" value="${esc(existing.attendees || '')}" placeholder="e.g. Jacob, Kris, client rep"  style="width:100%;margin-bottom:12px">

        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Notes / decisions</label>
        <textarea id="mlog-notes" class="form-textarea" rows="6" placeholder="What was discussed, decided, or needs follow-up..." style="width:100%;font-family:inherit;font-size:13px;line-height:1.5">${esc(existing.notes || '')}</textarea>

        <div style="display:flex;gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#8B949E;flex:1;min-width:160px">
            <input type="checkbox" id="mlog-check-milestone" ${existing.date ? '' : 'checked'} style="margin:0">
            Check off milestone after saving
          </label>
          <button class="btn" onclick="document.getElementById('meeting-log-dialog')?.remove()">Cancel</button>
          <button class="btn-primary" onclick="saveMeetingLogAndClose(${projectId}, '${type}', '${config.milestonePhase}', '${config.milestoneKey}')" style="padding:8px 14px;font-size:13px">Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveMeetingLogAndClose(projectId, type, phaseKey, milestoneKey) {
  const date = document.getElementById('mlog-date')?.value || '';
  const attendees = document.getElementById('mlog-attendees')?.value || '';
  const notes = document.getElementById('mlog-notes')?.value || '';
  const shouldCheck = document.getElementById('mlog-check-milestone')?.checked;
  saveMeetingLog(projectId, type, { date, attendees, notes });
  if (shouldCheck && phaseKey && milestoneKey) {
    setMilestone(projectId, phaseKey, milestoneKey, true);
  }
  document.getElementById('meeting-log-dialog')?.remove();
  renderCurrentPage();
}

function showLogWalkthroughDialog(projectId) {
  showMeetingLogDialog(projectId, 'walkthrough', {
    title: 'Log Walkthrough',
    milestonePhase: 'proposal',
    milestoneKey: 'walkthrough_done'
  });
}

function showLogMeetingDialog(projectId, which) {
  if (which === 'kickoff') {
    showMeetingLogDialog(projectId, 'design_kickoff', {
      title: 'Log Design Kickoff Meeting',
      milestonePhase: 'design',
      milestoneKey: 'design_kickoff'
    });
  } else if (which === 'handoff') {
    showMeetingLogDialog(projectId, 'design_handoff', {
      title: 'Log Design Handoff Meeting',
      milestonePhase: 'design',
      milestoneKey: 'design_handoff'
    });
  }
}

// ── Planning assignments (crew, vehicles, tools) ──
function getPlanningAssignment(projectId, kind) {
  return state.planningAssignments?.[projectId]?.[kind] || [];
}

function setPlanningAssignment(projectId, kind, ids) {
  if (!state.planningAssignments[projectId]) state.planningAssignments[projectId] = {};
  state.planningAssignments[projectId][kind] = ids;
  save('vi_planning_assignments', state.planningAssignments);
}

function toggleAssignmentPick(projectId, kind, id) {
  const current = getPlanningAssignment(projectId, kind);
  const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
  setPlanningAssignment(projectId, kind, next);
  // Re-render picker contents (keep dialog open)
  const content = document.getElementById('assign-dialog-content');
  if (content && window._assignDialogRefresh) window._assignDialogRefresh();
}

function showAssignmentDialog(projectId, kind, config) {
  // kind: 'crew' | 'vehicles' | 'tools'
  // config: { title, milestonePhase, milestoneKey, options: [...], getColor?, groupBy? }
  const p = state.projects.find(pr => pr.id === projectId);
  if (!p) return;
  document.getElementById('assign-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'assign-dialog';
  modal.className = 'modal-overlay';

  const renderInner = () => {
    const picked = getPlanningAssignment(projectId, kind);
    let listHTML = '';
    if (config.groupBy) {
      // Group options by category/type
      const groups = {};
      config.options.forEach(opt => {
        const g = opt[config.groupBy] || 'other';
        if (!groups[g]) groups[g] = [];
        groups[g].push(opt);
      });
      listHTML = Object.entries(groups).map(([g, items]) => `
        <div style="margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;color:#6E7681;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">${esc(g)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${items.map(opt => {
              const active = picked.includes(opt.id);
              const color = config.getColor ? config.getColor(opt) : '#58A6FF';
              return `
                <div onclick="toggleAssignmentPick(${projectId}, '${kind}', '${opt.id}')"
                  style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;cursor:pointer;border:1px solid ${active ? color + '66' : '#1C2333'};background:${active ? color + '18' : '#0D1117'};-webkit-tap-highlight-color:transparent;font-size:12px;color:${active ? '#E6EDF3' : '#8B949E'}">
                  ${active ? `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` : `<div style="width:11px;height:11px;border:1px solid #30363D;border-radius:3px"></div>`}
                  <span>${esc(opt.name)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('');
    } else {
      listHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px">${config.options.map(opt => {
        const active = picked.includes(opt.id);
        const color = config.getColor ? config.getColor(opt) : '#58A6FF';
        return `
          <div onclick="toggleAssignmentPick(${projectId}, '${kind}', '${opt.id}')"
            style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;cursor:pointer;border:1px solid ${active ? color + '66' : '#1C2333'};background:${active ? color + '18' : '#0D1117'};-webkit-tap-highlight-color:transparent;font-size:12px;color:${active ? '#E6EDF3' : '#8B949E'}">
            ${active ? `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5L9 3" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` : `<div style="width:11px;height:11px;border:1px solid #30363D;border-radius:3px"></div>`}
            <span>${esc(opt.name)}</span>
          </div>
        `;
      }).join('')}</div>`;
    }

    const picked2 = getPlanningAssignment(projectId, kind);
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:12px;color:#8B949E">
        <span>${picked2.length} ${kind === 'crew' ? 'selected' : 'picked'}</span>
        ${picked2.length > 0 ? `<button class="btn btn-sm" onclick="setPlanningAssignment(${projectId}, '${kind}', []);window._assignDialogRefresh()" style="font-size:11px;padding:4px 8px">Clear all</button>` : ''}
      </div>
      ${listHTML}
    `;
  };

  modal.innerHTML = `
    <div class="modal-container" style="max-width:540px">
      <div class="modal-header">
        <div>
          <div class="modal-title">${esc(config.title)}</div>
          <div class="modal-sub">${esc(p.name)}</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('assign-dialog')?.remove();window._assignDialogRefresh=null">&times;</button>
      </div>
      <div class="modal-body">
        <div id="assign-dialog-content">${renderInner()}</div>

        <div style="display:flex;gap:8px;margin-top:16px;align-items:center;flex-wrap:wrap;border-top:1px solid #1C2333;padding-top:12px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#8B949E;flex:1;min-width:180px">
            <input type="checkbox" id="assign-check-milestone" checked style="margin:0">
            Check off milestone when done
          </label>
          <button class="btn" onclick="document.getElementById('assign-dialog')?.remove();window._assignDialogRefresh=null">Close</button>
          <button class="btn-primary" onclick="finalizeAssignment(${projectId}, '${kind}', '${config.milestonePhase}', '${config.milestoneKey}')" style="padding:8px 14px;font-size:13px">Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  window._assignDialogRefresh = () => {
    const container = document.getElementById('assign-dialog-content');
    if (container) container.innerHTML = renderInner();
  };
}

function finalizeAssignment(projectId, kind, phaseKey, milestoneKey) {
  const shouldCheck = document.getElementById('assign-check-milestone')?.checked;
  const picked = getPlanningAssignment(projectId, kind);
  if (shouldCheck && picked.length > 0 && phaseKey && milestoneKey) {
    setMilestone(projectId, phaseKey, milestoneKey, true);
  }
  document.getElementById('assign-dialog')?.remove();
  window._assignDialogRefresh = null;
  renderCurrentPage();
}

function showCrewAssignDialog(projectId) {
  const eligible = state.team.filter(m =>
    m.access.includes('installer') || m.access.includes('project_manager') || m.access.includes('admin')
  );
  showAssignmentDialog(projectId, 'crew', {
    title: 'Assign Crew',
    milestonePhase: 'planning',
    milestoneKey: 'crew_assigned',
    options: eligible.map(m => ({ id: String(m.id), name: m.name, role: m.primaryRole })),
    getColor: (opt) => DASHBOARD_ACCESS.find(d => d.key === opt.role)?.color || '#58A6FF'
  });
}

function showVehiclesAssignDialog(projectId) {
  showAssignmentDialog(projectId, 'vehicles', {
    title: 'Assign Vehicles',
    milestonePhase: 'planning',
    milestoneKey: 'vehicles_assigned',
    options: state.vehicles || [],
    groupBy: 'type',
    getColor: () => '#F0883E'
  });
}

function showToolsAssignDialog(projectId) {
  showAssignmentDialog(projectId, 'tools', {
    title: 'Assign Tools',
    milestonePhase: 'planning',
    milestoneKey: 'tools_assigned',
    options: state.tools || [],
    groupBy: 'category',
    getColor: () => '#3FB950'
  });
}

function getMilestone(projectId, phaseKey, milestoneKey) {
  return state.milestones?.[projectId]?.[phaseKey]?.[milestoneKey] || false;
}

function setMilestone(projectId, phaseKey, milestoneKey, value) {
  if (!state.milestones[projectId]) state.milestones[projectId] = {};
  if (!state.milestones[projectId][phaseKey]) state.milestones[projectId][phaseKey] = {};
  if (value) {
    state.milestones[projectId][phaseKey][milestoneKey] = true;
  } else {
    delete state.milestones[projectId][phaseKey][milestoneKey];
  }
  save('vi_milestones', state.milestones);
}

// Compute progress for a single milestone (0 to 1).
// Binary milestones: 0 or 1. Milestones linked to checklists: partial based on checklist completion.
function milestoneProgress(p, phase, milestone) {
  const done = getMilestone(p.id, phase.key, milestone.key);
  if (done) return 1;
  // Priority 1: Sub-tasks for the phase — if any exist, they drive progress for linkedChecklist milestones
  if (milestone.linkedChecklist) {
    const subtasks = getSubtasks(p.id, milestone.linkedChecklist);
    if (subtasks.length > 0) {
      const doneCount = subtasks.filter(t => t.status === 'done').length;
      return doneCount / subtasks.length;
    }
    // Priority 2: Fall back to linked scope checklists
    const relevantSystems = p.systems.filter(s => TEMPLATES[milestone.linkedChecklist]?.[s]);
    if (relevantSystems.length === 0) return 0;
    let totalItems = 0;
    let completedItems = 0;
    relevantSystems.forEach(sys => {
      const items = getTemplateItems(milestone.linkedChecklist, sys);
      const key = `${p.id}_${milestone.linkedChecklist}_${sys}`;
      const checks = state.checklists[key] || {};
      totalItems += items.length;
      completedItems += items.filter((_, i) => checks[i]).length;
    });
    return totalItems > 0 ? completedItems / totalItems : 0;
  }
  return 0;
}

// ── Sub-tasks (Pass 4A) ──
// Shape: state.subtasks[projectId][phase] = [{id, text, assignee_id, status, due_date, priority, created_by, created_at, completed_at}]
function getSubtasks(projectId, phase) {
  return state.subtasks?.[projectId]?.[phase] || [];
}

function addSubtask(projectId, phase, taskData) {
  if (!state.subtasks[projectId]) state.subtasks[projectId] = {};
  if (!state.subtasks[projectId][phase]) state.subtasks[projectId][phase] = [];
  const task = {
    id: Date.now() + Math.random(),
    text: taskData.text || '',
    assignee_id: taskData.assignee_id || null,
    status: 'open',
    due_date: taskData.due_date || null,
    priority: taskData.priority || 'med',
    created_by: getActiveTeamMemberId(),
    created_at: new Date().toISOString()
  };
  state.subtasks[projectId][phase].push(task);
  save('vi_subtasks', state.subtasks);
  return task;
}

function updateSubtask(projectId, phase, taskId, changes) {
  const tasks = getSubtasks(projectId, phase);
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  Object.assign(task, changes);
  if (changes.status === 'done' && !task.completed_at) {
    task.completed_at = new Date().toISOString();
  } else if (changes.status === 'open') {
    delete task.completed_at;
  }
  save('vi_subtasks', state.subtasks);
}

function deleteSubtask(projectId, phase, taskId) {
  if (!state.subtasks[projectId]?.[phase]) return;
  state.subtasks[projectId][phase] = state.subtasks[projectId][phase].filter(t => t.id !== taskId);
  save('vi_subtasks', state.subtasks);
}

function toggleSubtaskStatus(projectId, phase, taskId) {
  const tasks = getSubtasks(projectId, phase);
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  // Permission check: user must be the assignee OR have design.assign_tasks
  const activeId = getActiveTeamMemberId();
  const canManage = currentUserHasPermission(phase === 'install' ? 'install.edit' : 'design.assign_tasks');
  const isAssignee = task.assignee_id === activeId;
  if (!canManage && !isAssignee) return;
  updateSubtask(projectId, phase, taskId, { status: task.status === 'done' ? 'open' : 'done' });
  rerenderCurrentTab();
}

function canCreateSubtasks(phase) {
  // design.assign_tasks covers design phase; for install, use install.edit (will refine later)
  if (phase === 'design') return currentUserHasPermission('design.assign_tasks');
  if (phase === 'install') return currentUserHasPermission('install.edit');
  return false;
}

function canEditSubtask(projectId, phase, task) {
  if (canCreateSubtasks(phase)) return true;
  // Assignees can toggle their own but not edit details
  return false;
}

function rerenderCurrentTab() {
  const p = state.currentProject;
  if (!p) return;
  const body = document.getElementById('project-page-body');
  if (!body) return;
  const tab = state.projectTab;
  if (tab === 'design') { body.innerHTML = ''; renderChecklistTab(body, p, 'design'); }
  else if (tab === 'install') { body.innerHTML = ''; renderChecklistTab(body, p, 'install'); }
  else renderCurrentPage();
}

// Compute progress for a whole phase (0 to 1). Equal weight per milestone.
function phaseProgress(p, phase) {
  if (phase.milestones.length === 0) return 0;
  const total = phase.milestones.reduce((sum, m) => sum + milestoneProgress(p, phase, m), 0);
  return total / phase.milestones.length;
}

// Check whether the previous phase is complete (for sequential phase gating).
// Parallel phases: gated only by all prior serial phases being complete.
function isPhaseUnlocked(p, phaseKey) {
  const idx = PHASES.findIndex(ph => ph.key === phaseKey);
  if (idx === 0) return true;
  const phase = PHASES[idx];
  // For Install: gated by all parallel phases (design, purchasing, planning) being 100%
  if (phase.gatedByParallel) {
    const parallels = PHASES.filter(ph => ph.parallel);
    return parallels.every(pp => phaseProgress(p, pp) >= 1);
  }
  // For parallel phases: unlocked when contract is complete
  if (phase.parallel) {
    const contract = PHASES.find(ph => ph.key === 'contract');
    return phaseProgress(p, contract) >= 1;
  }
  // Serial phases: unlocked when previous phase is complete
  const prev = PHASES[idx - 1];
  return phaseProgress(p, prev) >= 1;
}

// Check whether a specific milestone is unlocked (sequential within phase).
function isMilestoneUnlocked(p, phase, milestoneIdx) {
  if (!isPhaseUnlocked(p, phase.key)) return false;
  if (milestoneIdx === 0) return true;
  // All previous milestones in this phase must be done
  for (let i = 0; i < milestoneIdx; i++) {
    if (milestoneProgress(p, phase, phase.milestones[i]) < 1) return false;
  }
  return true;
}

function isReadyForInstall(p) {
  const parallels = PHASES.filter(ph => ph.parallel);
  return parallels.every(pp => phaseProgress(p, pp) >= 1);
}

function isMarkedReadyForInstall(projectId) {
  return !!state.readyForInstall[projectId];
}

function markReadyForInstall(projectId) {
  state.readyForInstall[projectId] = new Date().toISOString();
  save('vi_ready_install', state.readyForInstall);
  renderCurrentPage();
}

function unmarkReadyForInstall(projectId) {
  delete state.readyForInstall[projectId];
  save('vi_ready_install', state.readyForInstall);
  renderCurrentPage();
}

function toggleMilestone(projectId, phaseKey, milestoneKey) {
  const current = getMilestone(projectId, phaseKey, milestoneKey);
  setMilestone(projectId, phaseKey, milestoneKey, !current);
  renderCurrentPage();
}



// ── Needs Attention Flags ──
function computeProjectFlags(p) {
  const flags = { sales: [], design: [], management: [], install: [] };
  const stage = p.stage;
  const contractDate = getContractDate(p.id);
  const booked = getBookedTimeline(p.id);
  const installWin = getInstallWindow(p);

  // SALES flags
  if (p.jb_price_valid_until) {
    const validDays = daysUntil(p.jb_price_valid_until);
    if (validDays !== null && validDays >= 0 && validDays <= 14) {
      flags.sales.push({ level: validDays <= 7 ? 'red' : 'yellow', text: `Proposal expires ${fmtCountdown(p.jb_price_valid_until)}` });
    } else if (validDays !== null && validDays < 0 && stage === 'proposal') {
      flags.sales.push({ level: 'red', text: `Proposal expired ${fmtCountdown(p.jb_price_valid_until)}` });
    }
  }
  // Stage stale check — no updates in 30+ days for active stages
  if (['lead', 'proposal', 'contract'].includes(stage) && p.updated_at) {
    const daysSinceUpdate = Math.abs(daysUntil(p.updated_at.slice(0, 10)));
    if (daysSinceUpdate > 30) {
      flags.sales.push({ level: 'yellow', text: `No activity in ${daysSinceUpdate}d` });
    }
  }

  // MANAGEMENT flags
  if (stage === 'contract' && !contractDate) {
    flags.management.push({ level: 'yellow', text: 'Contract date not set' });
  }
  if (isContractNeedsReview(p)) {
    flags.management.push({ level: 'red', text: 'Contract needs review' });
  }
  if (stage === 'contract' && !booked) {
    flags.management.push({ level: 'yellow', text: 'Install dates not booked' });
  }

  // DESIGN flags
  if (stage === 'contract' && p.systems.length === 0) {
    flags.design.push({ level: 'yellow', text: 'No scope tags detected' });
  }

  // INSTALL flags
  if (installWin) {
    const startDays = daysUntil(installWin.start);
    if (startDays !== null && startDays >= 0 && startDays <= 14 && stage !== 'install') {
      flags.install.push({ level: startDays <= 7 ? 'red' : 'yellow', text: `Install ${fmtCountdown(installWin.start)} &mdash; prep readiness?` });
    }
  }

  const total = flags.sales.length + flags.design.length + flags.management.length + flags.install.length;
  return { ...flags, total };
}

// Per-domain "is tracking started yet" for the Needs Attention empty state.
// Returns true when the domain is active for this project (so empty = "No issues"),
// false when nothing is expected yet (so empty = "Not started").
function isDomainActive(p, domain) {
  const stage = p.stage;
  const installWin = getInstallWindow(p);
  switch (domain) {
    case 'sales':
      // Sales is always active unless project is done/dead
      return !['install', 'completed', 'lost', 'icebox'].includes(stage);
    case 'design':
      // Design starts once scope is known AND we're at proposal or past
      return p.systems.length > 0 && ['proposal', 'contract', 'install', 'completed'].includes(stage);
    case 'management':
      // Management starts at contract stage
      return ['contract', 'install', 'completed'].includes(stage);
    case 'install': {
      // Install is active once a booked window or approaching estimated install exists, or stage is install
      if (stage === 'install' || stage === 'completed') return true;
      if (!installWin) return false;
      const days = daysUntil(installWin.start);
      return days !== null && days <= 30 && days >= -30;
    }
    default:
      return false;
  }
}


// ── Drive URL helpers ──
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
  const canEdit = currentUserHasPermission('projects.edit');

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
      ${canEdit ? `
        <div style="display:flex;gap:8px;align-items:stretch">
          <input class="form-input" id="drive-url-input" placeholder="Paste Google Drive folder URL..."
            value="${esc(driveUrl)}" style="flex:1;font-size:13px"
            onkeydown="if(event.key==='Enter')saveProjectDriveUrl(${p.id})">
          <button class="btn-primary" onclick="saveProjectDriveUrl(${p.id})" style="padding:10px 16px;font-size:13px;flex-shrink:0">Save</button>
        </div>
      ` : (driveUrl ? '' : `<div style="font-size:12px;color:#6E7681;font-style:italic">No Drive folder linked. Ask a project editor to set one up.</div>`)}
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
            <button class="btn btn-sm" ${canEdit ? `onclick="promptAddFile(${p.id}, '${cat.key}')"` : 'disabled style="opacity:0.4;cursor:not-allowed"'} style="font-size:11px;padding:5px 10px">+ Add</button>
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
                    ${canEdit ? `<button onclick="confirmRemoveFile(${p.id}, '${cat.key}', ${item.id})" style="background:none;border:none;color:#6E7681;cursor:pointer;padding:4px 8px;font-size:16px;line-height:1;flex-shrink:0" title="Remove">&times;</button>` : ''}
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
          ${events.map(e => `<div class="cal-event cal-event-${e.color}" onclick="openProject(${e.id})" title="${esc(e.name)}${e.booked ? ' (Booked)' : ' (Estimated)'}">${esc(e.name)}</div>`).join('')}
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
        <div style="display:flex;align-items:center;gap:10px">
          <div style="display:flex;align-items:center;gap:10px;font-size:11px">
            <span style="display:inline-flex;align-items:center;gap:4px;color:#8B949E">
              <span style="width:10px;height:10px;border-radius:2px;background:#58A6FF"></span> Estimated
            </span>
            <span style="display:inline-flex;align-items:center;gap:4px;color:#8B949E">
              <span style="width:10px;height:10px;border-radius:2px;background:#3FB950"></span> Booked
            </span>
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

function getCalendarDates(p) {
  // Always returns the best dates: booked if it exists, otherwise estimated.
  // Doesn't depend on state.timelineMode — calendar always shows current best date.
  const booked = state.bookedDates[p.id];
  if (booked?.start) return { start: booked.start, end: booked.end || null, source: 'booked' };
  if (p.start_date) return { start: p.start_date, end: p.end_date || null, source: 'estimated' };
  return { start: null, end: null, source: null };
}

function getEventsForDate(dateStr) {
  return state.projects
    .filter(p => {
      if (p.archived) return false;
      const dates = getCalendarDates(p);
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
      const dates = getCalendarDates(p);
      // Color is now determined by booked vs estimated, not by stage
      // Booked = green, Estimated = blue
      return {
        id: p.id,
        name: p.name,
        booked: dates.source === 'booked',
        color: dates.source === 'booked' ? 'booked' : 'estimated'
      };
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

// ═══════════════════════════════════════════════════════════════
// LOCATION TAB (Stage D)
// Google Maps satellite view with click-to-place pin drops
// per project, for site layout & crew briefings.
// ═══════════════════════════════════════════════════════════════

const PIN_TYPES = [
  { key: 'parking',    label: 'Parking',        icon: 'P', color: '#58A6FF' },
  { key: 'entrance',   label: 'Main Entrance',  icon: 'E', color: '#3FB950' },
  { key: 'loading',    label: 'Loading Dock',   icon: 'L', color: '#F0883E' },
  { key: 'power',      label: 'Power Panel',    icon: '⚡', color: '#D29922' },
  { key: 'staging',    label: 'Staging Area',   icon: 'S', color: '#A371F7' },
  { key: 'foh',        label: 'FOH Position',   icon: 'F', color: '#F85149' },
  { key: 'rack',       label: 'Rack Location',  icon: 'R', color: '#BC8CFF' },
  { key: 'custom',     label: 'Custom Note',    icon: '?', color: '#8B949E' }
];

function getProjectAddressString(p) {
  const parts = [p.address, p.city, p.state_abbr, p.zip].filter(Boolean);
  return parts.join(', ');
}

function getProjectPins(projectId) {
  return state.projectPins[projectId] || [];
}

function saveProjectPins(projectId, pins) {
  state.projectPins[projectId] = pins;
  save('vi_project_pins', state.projectPins);
}

function getProjectSiteNotes(projectId) {
  return state.projectSiteNotes[projectId] || '';
}

function saveProjectSiteNotes(projectId, notes) {
  state.projectSiteNotes[projectId] = notes;
  save('vi_project_site_notes', state.projectSiteNotes);
}

async function renderLocationTab(container, project) {
  const address = getProjectAddressString(project);
  const canEdit = currentUserHasPermission('projects.edit');

  if (!address) {
    container.innerHTML = `
      <div class="dashboard-card">
        <div class="dashboard-card-title">Location</div>
        <div style="padding:20px;text-align:center;color:#8B949E;font-size:13px">
          <div style="font-size:32px;opacity:0.4;margin-bottom:8px">📍</div>
          <div style="margin-bottom:6px">No address set for this project</div>
          <div style="font-size:11px;color:#6E7681">Add an address on the Details tab to enable site mapping.</div>
        </div>
      </div>
    `;
    return;
  }

  // Show scaffold immediately
  container.innerHTML = `
    <div id="location-tab-root">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:14px;font-weight:600;color:#E6EDF3">Site Location</div>
          <div style="font-size:11px;color:#8B949E;margin-top:2px">${esc(address)} <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" style="color:#58A6FF;margin-left:6px">Open in Google Maps &rarr;</a></div>
        </div>
      </div>
      <div id="map-loading" style="padding:60px 20px;text-align:center;background:#0D1117;border:1px solid #1C2333;border-radius:6px;color:#6E7681">
        <div class="spinner" style="margin:0 auto 10px"></div>
        <div style="font-size:12px">Loading satellite view…</div>
      </div>
      <div id="map-host" style="display:none"></div>
    </div>
  `;

  // Load Google Maps API if we haven't already
  try {
    await ensureGoogleMapsLoaded();
  } catch (err) {
    const host = document.getElementById('map-loading');
    if (host) {
      host.innerHTML = `
        <div style="font-size:32px;opacity:0.5;margin-bottom:8px">🗺️</div>
        <div style="font-size:13px;color:#E6EDF3;margin-bottom:6px">Maps not configured</div>
        <div style="font-size:11px;color:#8B949E;max-width:380px;margin:0 auto 14px">${esc(err.message || 'Google Maps API key is not set up yet.')}</div>
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" class="btn-primary" style="padding:8px 16px;font-size:12px;text-decoration:none;display:inline-block">Open in Google Maps &rarr;</a>
      `;
    }
    return;
  }

  // Render the map
  renderGoogleMapForProject(project, canEdit);
}

async function ensureGoogleMapsLoaded() {
  if (state.mapsApiLoaded && window.google?.maps) return;
  // Fetch key from our serverless function
  if (!state.mapsApiKey) {
    const resp = await fetch('/api/maps-config');
    const data = await resp.json();
    if (!data.configured) {
      throw new Error(data.error || 'Maps key not configured');
    }
    state.mapsApiKey = data.apiKey;
  }
  // Inject script tag if not already loaded
  if (window.google?.maps) {
    state.mapsApiLoaded = true;
    return;
  }
  await new Promise((resolve, reject) => {
    if (window._mapsLoadingPromise) {
      window._mapsLoadingPromise.then(resolve).catch(reject);
      return;
    }
    window._mapsLoadingPromise = new Promise((res, rej) => {
      window._mapsOnLoad = () => { state.mapsApiLoaded = true; res(); };
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(state.mapsApiKey)}&callback=_mapsOnLoad&libraries=geocoding&loading=async`;
      script.async = true;
      script.defer = true;
      script.onerror = () => rej(new Error('Failed to load Google Maps script'));
      document.head.appendChild(script);
    });
    window._mapsLoadingPromise.then(resolve).catch(reject);
  });
}

async function renderGoogleMapForProject(project, canEdit) {
  const address = getProjectAddressString(project);
  const host = document.getElementById('location-tab-root');
  if (!host) return;

  // Build map container
  const mapViewType = state.mapViewType || 'hybrid';
  host.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:10px">
      <div style="min-width:0;flex:1">
        <div style="font-size:14px;font-weight:600;color:#E6EDF3">Site Location</div>
        <div style="font-size:11px;color:#8B949E;margin-top:2px;word-break:break-word">${esc(address)} <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" style="color:#58A6FF;margin-left:6px;white-space:nowrap">Open in Maps &rarr;</a></div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap">
        <button onclick="openSiteBriefing(${project.id})" class="btn btn-sm" style="font-size:11px;padding:5px 12px;display:inline-flex;align-items:center;gap:5px">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 3V1h6v2M4 10H2v-5h10v5h-2M4 8h6v5H4z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Print Briefing
        </button>
        <div style="display:flex;gap:4px;background:#0D1117;border:1px solid #30363D;border-radius:6px;overflow:hidden;font-size:11px">
          ${[{ k: 'hybrid', l: 'Satellite' }, { k: 'roadmap', l: 'Map' }].map(m => `
            <div onclick="setMapViewType('${m.k}')" style="padding:6px 12px;cursor:pointer;transition:all 0.15s;${mapViewType === m.k ? 'background:#1565C0;color:#58A6FF;font-weight:500' : 'color:#8B949E'};-webkit-tap-highlight-color:transparent">${m.l}</div>
          `).join('')}
        </div>
      </div>
    </div>

    ${canEdit ? `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap;padding:10px;background:#0D1117;border:1px solid #1C2333;border-radius:6px">
      <div style="font-size:11px;color:#8B949E;font-weight:500;margin-right:4px">Add pin:</div>
      ${PIN_TYPES.map(pt => `
        <button onclick="startPinPlacement('${pt.key}')" id="pin-btn-${pt.key}" class="pin-type-btn" style="padding:4px 10px;font-size:11px;background:#161B22;border:1px solid ${pt.color}44;color:${pt.color};border-radius:4px;cursor:pointer;-webkit-tap-highlight-color:transparent;display:inline-flex;align-items:center;gap:5px">
          <span style="width:14px;height:14px;border-radius:50%;background:${pt.color};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">${pt.icon}</span>
          ${pt.label}
        </button>
      `).join('')}
    </div>
    <div id="pin-placement-hint" style="display:none;padding:8px 12px;background:#0D1A0E;border:1px solid #238636;border-radius:5px;margin-bottom:10px;font-size:12px;color:#3FB950">
      <span id="pin-placement-label"></span> &mdash; Click on the map where you want to place this pin. <a href="#" onclick="event.preventDefault();cancelPinPlacement()" style="color:#58A6FF;margin-left:8px">Cancel</a>
    </div>
    ` : ''}

    <div id="project-map" style="width:100%;height:500px;border:1px solid #1C2333;border-radius:6px;overflow:hidden;background:#0D1117"></div>

    <div class="dashboard-card" style="margin-top:14px">
      <div class="dashboard-card-title">Site Notes</div>
      ${canEdit ? `
        <textarea id="site-notes-field" class="form-textarea" rows="4" placeholder="Alternate access, lift requirements, after-hours contact, parking restrictions, etc.&#10;&#10;These notes travel with the project — crew will see them before install day."
          oninput="debouncedSaveSiteNotes(${project.id}, this.value)">${esc(getProjectSiteNotes(project.id))}</textarea>
        <div style="margin-top:6px;font-size:11px;color:#6E7681">Notes save automatically</div>
      ` : `
        <div style="padding:10px;background:#0D1117;border:1px solid #1C2333;border-radius:5px;font-size:13px;color:#C9D1D9;white-space:pre-wrap;min-height:60px">${esc(getProjectSiteNotes(project.id)) || '<span style="color:#6E7681;font-style:italic">No site notes yet</span>'}</div>
      `}
    </div>
  `;

  // Geocode the address and build the map
  const mapEl = document.getElementById('project-map');
  if (!mapEl || !window.google?.maps) return;

  const geocoder = new google.maps.Geocoder();
  try {
    const result = await new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results?.[0]) resolve(results[0]);
        else reject(new Error(`Geocoding failed: ${status}`));
      });
    });
    const loc = result.geometry.location;
    const center = { lat: loc.lat(), lng: loc.lng() };

    const map = new google.maps.Map(mapEl, {
      center,
      zoom: 19,
      mapTypeId: mapViewType === 'roadmap' ? 'roadmap' : 'hybrid',
      tilt: 0,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true
    });

    // Save map reference so view-type toggle can update it
    state._currentMap = map;
    state._currentMapProject = project;

    // Place the project marker at the geocoded address
    new google.maps.Marker({
      position: center,
      map,
      title: project.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#DA3633',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2
      }
    });

    // Render existing pins
    state._currentMapMarkers = [];
    const pins = getProjectPins(project.id);
    pins.forEach(pin => addPinMarkerToMap(map, project.id, pin, canEdit));

    // Set up click-to-place
    if (canEdit) {
      map.addListener('click', (e) => {
        if (!state._pendingPinType) return;
        const pinType = state._pendingPinType;
        const newPin = {
          id: Date.now() + Math.random(),
          type: pinType.key,
          label: pinType.label,
          lat: e.latLng.lat(),
          lng: e.latLng.lng()
        };
        // For custom pins, prompt for label
        if (pinType.key === 'custom') {
          const custom = prompt('Label for this pin:');
          if (!custom) { cancelPinPlacement(); return; }
          newPin.label = custom;
        }
        const pins = getProjectPins(project.id);
        pins.push(newPin);
        saveProjectPins(project.id, pins);
        addPinMarkerToMap(map, project.id, newPin, canEdit);
        cancelPinPlacement();
      });
    }
  } catch (err) {
    mapEl.innerHTML = `
      <div style="padding:40px 20px;text-align:center;color:#6E7681">
        <div style="font-size:32px;opacity:0.5;margin-bottom:8px">🗺️</div>
        <div style="font-size:13px;color:#E6EDF3;margin-bottom:6px">Could not find this address on the map</div>
        <div style="font-size:11px;color:#8B949E;max-width:380px;margin:0 auto 14px">${esc(err.message || '')} — check that the address on the Details tab is complete and accurate.</div>
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" class="btn" style="padding:6px 14px;font-size:12px;text-decoration:none;display:inline-block">Try in Google Maps &rarr;</a>
      </div>
    `;
  }
}

function addPinMarkerToMap(map, projectId, pin, canEdit) {
  const pinType = PIN_TYPES.find(pt => pt.key === pin.type) || PIN_TYPES[PIN_TYPES.length - 1];
  const marker = new google.maps.Marker({
    position: { lat: pin.lat, lng: pin.lng },
    map,
    title: pin.label,
    draggable: canEdit,
    label: {
      text: pinType.icon,
      color: '#fff',
      fontSize: '11px',
      fontWeight: '700'
    },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: pinType.color,
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2
    }
  });

  const infoContent = `
    <div style="color:#333;font-size:13px;min-width:180px;padding:2px">
      <div style="font-weight:600;margin-bottom:4px">${esc(pin.label)}</div>
      <div style="font-size:11px;color:#666;margin-bottom:8px">${pinType.label}</div>
      ${canEdit ? `
        <div style="display:flex;gap:6px">
          <button onclick="renamePinInline(${projectId}, ${pin.id})" style="padding:4px 8px;font-size:11px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:3px;cursor:pointer">Rename</button>
          <button onclick="deletePin(${projectId}, ${pin.id})" style="padding:4px 8px;font-size:11px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:3px;cursor:pointer">Delete</button>
        </div>
      ` : ''}
    </div>
  `;
  const info = new google.maps.InfoWindow({ content: infoContent });
  marker.addListener('click', () => info.open(map, marker));

  if (canEdit) {
    marker.addListener('dragend', (e) => {
      const pins = getProjectPins(projectId);
      const target = pins.find(p => p.id === pin.id);
      if (target) {
        target.lat = e.latLng.lat();
        target.lng = e.latLng.lng();
        saveProjectPins(projectId, pins);
      }
    });
  }

  state._currentMapMarkers.push({ id: pin.id, marker, info });
}

function startPinPlacement(typeKey) {
  const pt = PIN_TYPES.find(x => x.key === typeKey);
  if (!pt) return;
  state._pendingPinType = pt;
  const hint = document.getElementById('pin-placement-hint');
  const label = document.getElementById('pin-placement-label');
  if (hint) hint.style.display = 'block';
  if (label) label.innerHTML = `Placing <strong>${esc(pt.label)}</strong>`;
  // Highlight the active pin button
  document.querySelectorAll('.pin-type-btn').forEach(btn => btn.style.outline = '');
  const active = document.getElementById(`pin-btn-${typeKey}`);
  if (active) active.style.outline = `2px solid ${pt.color}`;
}

function cancelPinPlacement() {
  state._pendingPinType = null;
  const hint = document.getElementById('pin-placement-hint');
  if (hint) hint.style.display = 'none';
  document.querySelectorAll('.pin-type-btn').forEach(btn => btn.style.outline = '');
}

function setMapViewType(type) {
  state.mapViewType = type;
  if (state._currentMap) {
    state._currentMap.setMapTypeId(type === 'roadmap' ? 'roadmap' : 'hybrid');
  }
  // Re-render just the toggle buttons by re-rendering the whole tab
  if (state.currentProject && state.projectTab === 'location') {
    rerenderCurrentTab();
  }
}

function renamePinInline(projectId, pinId) {
  const pins = getProjectPins(projectId);
  const pin = pins.find(p => p.id === pinId);
  if (!pin) return;
  const newLabel = prompt('New label:', pin.label);
  if (!newLabel) return;
  pin.label = newLabel;
  saveProjectPins(projectId, pins);
  // Update marker
  const entry = state._currentMapMarkers?.find(m => m.id === pinId);
  if (entry) {
    entry.marker.setTitle(newLabel);
    entry.info.close();
  }
  rerenderCurrentTab();
}

function deletePin(projectId, pinId) {
  if (!confirm('Delete this pin?')) return;
  const pins = getProjectPins(projectId).filter(p => p.id !== pinId);
  saveProjectPins(projectId, pins);
  // Remove marker
  const entry = state._currentMapMarkers?.find(m => m.id === pinId);
  if (entry) {
    entry.marker.setMap(null);
    entry.info.close();
  }
  state._currentMapMarkers = (state._currentMapMarkers || []).filter(m => m.id !== pinId);
}

// Debounced site notes saver
let _siteNotesTimer = null;
function debouncedSaveSiteNotes(projectId, value) {
  if (_siteNotesTimer) clearTimeout(_siteNotesTimer);
  _siteNotesTimer = setTimeout(() => saveProjectSiteNotes(projectId, value), 400);
}

// ── Print Briefing ──
// Opens a new window with a paper-sized pre-install briefing page ready to print or save as PDF.
function openSiteBriefing(projectId) {
  const p = state.projects.find(pr => pr.id === projectId);
  if (!p) return;
  const address = getProjectAddressString(p);
  const pins = getProjectPins(projectId);
  const siteNotes = getProjectSiteNotes(projectId);
  const assignment = getProjectAssignment(projectId);
  const win = getInstallWindow(p);

  // Gather team by role
  const teamByRole = ASSIGNMENT_ROLES.map(r => {
    const people = (assignment[r.key] || []).map(entry => {
      const m = getTeamMember(entry.id);
      return { name: m?.name || 'Unknown', lead: entry.lead };
    });
    return { role: r, people };
  }).filter(x => x.people.length > 0);

  // Compose Jetbuilt link if we have a project ID
  const jbId = p.jetbuilt_id || p.id;

  // Must pass the key to the new window too — it can't share our runtime state
  const apiKey = state.mapsApiKey || '';

  const pinTypeMap = {};
  PIN_TYPES.forEach(pt => { pinTypeMap[pt.key] = pt; });

  const briefingWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!briefingWindow) {
    alert('Popup blocked. Please allow popups for this site to print briefings.');
    return;
  }

  const installWindowLine = win
    ? `${fmtDate(win.start)}${win.end && win.end !== win.start ? ' – ' + fmtDate(win.end) : ''} <span style="color:#888;font-size:10pt">(${win.source === 'booked' ? 'Booked' : 'Estimated'})</span>`
    : '<span style="color:#999">Not yet scheduled</span>';

  const scopeLine = (p.systems || []).map(s => TAG_LABELS?.[s] || s).join(' · ') || 'General';
  const clientName = p.client_name || 'No client';
  const printedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Site Briefing — ${esc(p.name)}</title>
<style>
  @page { size: letter portrait; margin: 0.4in; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #222;
    margin: 0;
    padding: 20px;
    background: #fff;
    font-size: 10.5pt;
    line-height: 1.4;
  }
  .toolbar {
    position: sticky; top: 0;
    background: #f3f4f6; border: 1px solid #d1d5db;
    padding: 10px 14px; margin: -20px -20px 16px;
    display: flex; gap: 10px; align-items: center; justify-content: space-between;
    z-index: 100;
  }
  .toolbar .title { font-size: 11pt; color: #374151; font-weight: 600; }
  .toolbar button {
    padding: 6px 14px; font-size: 11pt; font-weight: 600;
    background: #1f4e79; color: #fff; border: none; border-radius: 4px; cursor: pointer;
  }
  .toolbar button.secondary {
    background: #fff; color: #374151; border: 1px solid #d1d5db;
  }
  @media print {
    .toolbar { display: none !important; }
    body { padding: 0; }
  }

  .header {
    border-bottom: 3px solid #1f4e79;
    padding-bottom: 12px;
    margin-bottom: 14px;
  }
  .header .eyebrow {
    font-size: 8pt; font-weight: 700; letter-spacing: 0.15em;
    color: #1f4e79; text-transform: uppercase;
  }
  .header h1 {
    font-size: 20pt; margin: 4px 0 6px; color: #111;
  }
  .header .meta {
    display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px;
    font-size: 10pt; color: #444; margin-top: 6px;
  }
  .header .meta strong { color: #222; }

  .section-title {
    font-size: 9pt; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: #1f4e79;
    border-bottom: 1px solid #d1d5db; padding-bottom: 3px;
    margin: 14px 0 8px;
  }

  .map-wrap {
    border: 1px solid #d1d5db;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .map-wrap img { display: block; width: 100%; height: auto; }
  .map-placeholder {
    padding: 80px 20px;
    text-align: center;
    background: #f9fafb;
    color: #6b7280;
    font-size: 11pt;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }

  .pin-list { list-style: none; padding: 0; margin: 0; font-size: 10pt; }
  .pin-list li {
    display: flex; align-items: center; gap: 8px;
    padding: 4px 0;
    border-bottom: 1px dotted #e5e7eb;
  }
  .pin-list li:last-child { border-bottom: none; }
  .pin-badge {
    width: 20px; height: 20px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; font-size: 9pt; font-weight: 700;
    flex-shrink: 0;
  }

  .team-list { font-size: 10pt; }
  .team-row {
    padding: 4px 0;
    border-bottom: 1px dotted #e5e7eb;
  }
  .team-row:last-child { border-bottom: none; }
  .team-role {
    font-size: 8pt; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #6b7280;
    margin-bottom: 2px;
  }
  .lead-tag {
    display: inline-block;
    font-size: 7pt; font-weight: 700;
    padding: 1px 5px; background: #1f4e79; color: #fff;
    border-radius: 2px; margin-left: 4px;
    vertical-align: middle;
  }

  .notes-box {
    background: #f9fafb;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 10px 12px;
    font-size: 10pt;
    white-space: pre-wrap;
    min-height: 50px;
    color: #222;
  }
  .notes-empty { color: #9ca3af; font-style: italic; }

  .footer {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #d1d5db;
    font-size: 8pt;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
  }

  .scope-row {
    font-size: 10pt;
    padding: 6px 10px;
    background: #f3f4f6;
    border-left: 3px solid #1f4e79;
    border-radius: 2px;
    margin-bottom: 14px;
  }
  .scope-row strong { color: #1f4e79; margin-right: 6px; }
</style>
</head>
<body>
  <div class="toolbar">
    <div class="title">Site Briefing — ${esc(p.name)}</div>
    <div style="display:flex;gap:8px">
      <button class="secondary" onclick="window.close()">Close</button>
      <button onclick="window.print()">🖨 Print / Save as PDF</button>
    </div>
  </div>

  <div class="header">
    <div class="eyebrow">Site Briefing</div>
    <h1>${esc(p.name)}</h1>
    <div class="meta">
      <div><strong>Client:</strong> ${esc(clientName)}</div>
      <div><strong>Project #:</strong> ${esc(p.jb_custom_id || p.id)}</div>
      <div><strong>Address:</strong> ${esc(address || 'Not set')}</div>
      <div><strong>Install:</strong> ${installWindowLine}</div>
    </div>
  </div>

  <div class="scope-row"><strong>Scope:</strong> ${esc(scopeLine)}</div>

  <div class="section-title">Site Layout</div>
  <div class="map-wrap" id="map-wrap">
    ${address && apiKey ? buildStaticMapHTML(address, pins, apiKey) : '<div class="map-placeholder">Map not available — check that project has an address and Maps API key is configured.</div>'}
  </div>

  <div class="two-col">
    <div>
      <div class="section-title">Pin Legend</div>
      ${pins.length === 0 ? '<div style="font-size:10pt;color:#9ca3af;font-style:italic">No pins placed on this site</div>' : `
        <ul class="pin-list">
          ${pins.map((pin, i) => {
            const pt = pinTypeMap[pin.type] || pinTypeMap.custom;
            return `<li>
              <span class="pin-badge" style="background:${pt.color}">${i + 1}</span>
              <span><strong>${esc(pin.label)}</strong> <span style="color:#6b7280;font-size:9pt">— ${esc(pt.label)}</span></span>
            </li>`;
          }).join('')}
        </ul>
      `}
    </div>
    <div>
      <div class="section-title">Team</div>
      ${teamByRole.length === 0 ? '<div style="font-size:10pt;color:#9ca3af;font-style:italic">No team assignments yet</div>' : `
        <div class="team-list">
          ${teamByRole.map(tr => `
            <div class="team-row">
              <div class="team-role">${esc(tr.role.label)}</div>
              <div>${tr.people.map(pp => esc(pp.name) + (pp.lead ? '<span class="lead-tag">LEAD</span>' : '')).join(', ')}</div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  </div>

  <div class="section-title">Site Notes</div>
  <div class="notes-box">${siteNotes ? esc(siteNotes) : '<span class="notes-empty">No site notes recorded</span>'}</div>

  <div class="footer">
    <div>Valiant Integrations · Printed ${esc(printedDate)}</div>
    <div>Project #${esc(p.jb_custom_id || p.id)}</div>
  </div>
</body>
</html>`;

  briefingWindow.document.write(html);
  briefingWindow.document.close();
}

// Build the Static Maps image URL with pins overlaid
function buildStaticMapHTML(address, pins, apiKey) {
  // Escape address for URL and limit size
  const base = 'https://maps.googleapis.com/maps/api/staticmap';
  const params = new URLSearchParams();
  params.set('size', '800x500');
  params.set('scale', '2'); // retina for print clarity
  params.set('maptype', 'hybrid');
  params.set('center', address);
  params.set('zoom', '19');
  params.set('key', apiKey);
  // Project-address marker (red, prominent)
  params.append('markers', `color:red|size:mid|${address}`);
  // Custom pins — Google Static accepts lat,lng directly
  // Group by color since the API encodes them as separate markers parameters
  const pinTypeMap = {};
  PIN_TYPES.forEach(pt => { pinTypeMap[pt.key] = pt; });
  pins.forEach((pin, i) => {
    const pt = pinTypeMap[pin.type] || pinTypeMap.custom;
    // Static API takes a hex color prefixed with 0x (no #), no alpha
    const hex = pt.color.replace('#', '0x');
    // Use a numeric label (1, 2, ...) matching the legend
    const label = String(i + 1);
    params.append('markers', `color:${hex}|label:${label}|${pin.lat},${pin.lng}`);
  });
  const url = `${base}?${params.toString()}`;
  // Check URL length — Static Maps has an 8192 char limit
  if (url.length > 8000) {
    return '<div class="map-placeholder">Too many pins to render in a single briefing image. Consider consolidating pins or printing a higher-scale view.</div>';
  }
  return `<img src="${url}" alt="Site layout map" onerror="this.parentElement.innerHTML='<div class=\\'map-placeholder\\'>Map image failed to load. Verify the Maps Static API is enabled in Google Cloud.</div>'">`;
}

// ═══════════════════════════════════════════════════════════════
// INSTALL CLOSEOUT SYSTEM (Stage E)
// When a booked install end date passes, the PM Lead and Install
// Admin get a notification asking them to confirm closeout.
// ═══════════════════════════════════════════════════════════════

const CLOSEOUT_ITEMS = [
  { key: 'installed',    label: 'Installation complete' },
  { key: 'commissioned', label: 'Commissioned with client' },
  { key: 'signed_off',   label: 'Client signed off on final acceptance' },
  { key: 'de_prepped',   label: 'Unloaded, de-prepped, truck and shop tidy' }
];

function getCloseoutChecklist(projectId) {
  return state.closeoutChecklist[projectId] || {};
}

function setCloseoutItem(projectId, itemKey, checked) {
  if (!state.closeoutChecklist[projectId]) state.closeoutChecklist[projectId] = {};
  if (checked) {
    state.closeoutChecklist[projectId][itemKey] = {
      checked: true,
      checkedBy: getActiveTeamMemberId(),
      checkedAt: new Date().toISOString()
    };
  } else {
    delete state.closeoutChecklist[projectId][itemKey];
  }
  save('vi_closeout_checklist', state.closeoutChecklist);
}

function isCloseoutComplete(projectId) {
  const cl = getCloseoutChecklist(projectId);
  return CLOSEOUT_ITEMS.every(item => cl[item.key]?.checked);
}

// Is this project past its booked install end date and still in install stage?
function isProjectInCloseout(p) {
  if (p.stage !== 'install') return false;
  const win = getInstallWindow(p);
  if (!win || win.source !== 'booked' || !win.end) return false;
  // Past if end date < today
  const end = new Date(win.end);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return end < today;
}

// Returns all projects currently needing closeout review
function getProjectsNeedingCloseout() {
  return state.projects.filter(p => !p.archived && isProjectInCloseout(p));
}

// Which projects does the current user personally own for closeout?
// PM Lead primary; if no PM on project, Install Admin catches it.
function getMyCloseoutProjects(memberId) {
  const installAdmin = currentUserHasPermission('install.manage_crew');
  return getProjectsNeedingCloseout().filter(p => {
    const assignment = getProjectAssignment(p.id);
    const pmPeople = assignment.pm || [];
    const pmLead = pmPeople.find(x => x.lead);
    // I'm PM Lead on this one
    if (pmLead?.id === memberId) return true;
    // No PM assigned at all, and I have Install Admin permissions
    if (pmPeople.length === 0 && installAdmin) return true;
    return false;
  });
}

// ── Closeout confirmation dialog ──
function openCloseoutDialog(projectId) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  const canEdit = currentUserHasPermission('install.edit');
  const checklist = getCloseoutChecklist(projectId);

  document.getElementById('closeout-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'closeout-dialog';
  modal.className = 'modal-overlay';

  const win = getInstallWindow(p);
  const endLabel = win?.end ? fmtDate(win.end) : 'unknown';

  modal.innerHTML = `
    <div class="modal-container" style="max-width:520px">
      <div class="modal-header" style="background:#0D1117;border-bottom:1px solid #30363D">
        <div>
          <div class="modal-title" style="display:flex;align-items:center;gap:8px">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style="flex-shrink:0"><circle cx="10" cy="10" r="8" stroke="#3FB950" stroke-width="1.5"/><path d="M6 10l3 3 5-6" stroke="#3FB950" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Close Out ${esc(p.name)}
          </div>
          <div class="modal-sub">Booked install ended ${esc(endLabel)}. Confirm the install is wrapped up.</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('closeout-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="font-size:11px;color:#8B949E;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Closeout Checklist</div>
        <div id="closeout-items" style="display:flex;flex-direction:column;gap:6px">
          ${renderCloseoutItems(projectId, canEdit)}
        </div>

        <div style="margin-top:18px;padding:12px;background:#0D1117;border:1px solid #1C2333;border-radius:5px">
          <div style="font-size:11px;color:#8B949E;margin-bottom:8px">If the install isn&rsquo;t actually done yet:</div>
          <button class="btn btn-sm" onclick="document.getElementById('closeout-dialog')?.remove();extendInstallFromCloseout(${projectId})" style="font-size:12px;padding:6px 12px">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style="vertical-align:-1px;margin-right:4px"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Extend install window
          </button>
          <div style="font-size:10px;color:#6E7681;margin-top:6px">Your checklist progress will be saved.</div>
        </div>

        <div id="closeout-footer" style="margin-top:18px">
          ${renderCloseoutFooter(projectId, canEdit)}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function renderCloseoutItems(projectId, canEdit) {
  const checklist = getCloseoutChecklist(projectId);
  return CLOSEOUT_ITEMS.map(item => {
    const entry = checklist[item.key];
    const isChecked = !!entry?.checked;
    const checkedBy = entry?.checkedBy ? getTeamMember(entry.checkedBy) : null;
    return `
      <div onclick="${canEdit ? `toggleCloseoutItem(${projectId}, '${item.key}')` : ''}"
        style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:${isChecked ? '#0D1A0E' : '#0D1117'};border:1px solid ${isChecked ? '#238636' : '#1C2333'};border-radius:5px;cursor:${canEdit ? 'pointer' : 'default'};-webkit-tap-highlight-color:transparent;transition:all 0.15s">
        <div style="width:20px;height:20px;border-radius:4px;border:1.5px solid ${isChecked ? '#3FB950' : (canEdit ? '#58A6FF' : '#30363D')};background:${isChecked ? '#3FB950' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${isChecked ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6.5l2.5 2.5L10 3.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:#E6EDF3;${isChecked ? 'text-decoration:line-through;opacity:0.75' : ''}">${esc(item.label)}</div>
          ${isChecked && checkedBy ? `<div style="font-size:10px;color:#6E7681;margin-top:2px">${esc(checkedBy.name)} · ${fmtDate(entry.checkedAt)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderCloseoutFooter(projectId, canEdit) {
  const complete = isCloseoutComplete(projectId);
  if (!complete) {
    return `
      <div style="font-size:11px;color:#6E7681;text-align:center;padding:10px">
        Check all four items to mark the project complete.
      </div>
    `;
  }
  return `
    <div style="padding:12px;background:#0D1A0E;border:1px solid #238636;border-radius:5px;text-align:center">
      <div style="font-size:12px;color:#3FB950;font-weight:500;margin-bottom:8px">All closeout items confirmed</div>
      <button class="btn-primary" onclick="reviewAndCompleteProject(${projectId})" style="background:#238636;padding:8px 20px;font-size:13px">
        Review milestones &amp; mark Complete &rarr;
      </button>
    </div>
  `;
}

function toggleCloseoutItem(projectId, itemKey) {
  if (!currentUserHasPermission('install.edit')) return;
  const current = getCloseoutChecklist(projectId);
  const isChecked = !!current[itemKey]?.checked;
  setCloseoutItem(projectId, itemKey, !isChecked);
  // Re-render only the inner parts of the dialog
  const itemsEl = document.getElementById('closeout-items');
  const footerEl = document.getElementById('closeout-footer');
  if (itemsEl) itemsEl.innerHTML = renderCloseoutItems(projectId, true);
  if (footerEl) footerEl.innerHTML = renderCloseoutFooter(projectId, true);
}

// "Extend install window" — reuses the existing booked install dialog
function extendInstallFromCloseout(projectId) {
  // Open project first so state.currentProject is set, then show dialog
  openProject(projectId);
  setTimeout(() => {
    if (typeof showBookedInstallDialog === 'function') {
      showBookedInstallDialog(projectId);
    }
  }, 100);
}

// ── Review & complete: final review dialog ──
function reviewAndCompleteProject(projectId) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  const installPhase = PHASES.find(ph => ph.key === 'install');
  if (!installPhase) return;

  document.getElementById('closeout-dialog')?.remove();
  document.getElementById('review-complete-dialog')?.remove();

  const modal = document.createElement('div');
  modal.id = 'review-complete-dialog';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:560px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Review Install Milestones</div>
          <div class="modal-sub">Confirm each milestone before marking ${esc(p.name)} as complete.</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('review-complete-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="font-size:11px;color:#6E7681;padding:8px 10px;background:#0D1117;border-left:2px solid #58A6FF;border-radius:2px;margin-bottom:14px">
          Each item below will be marked complete when you click &ldquo;Mark Project Complete.&rdquo; Uncheck anything that genuinely wasn&rsquo;t done so the record is accurate.
        </div>
        <div id="review-milestones" style="display:flex;flex-direction:column;gap:6px">
          ${renderReviewMilestones(p.id, installPhase)}
        </div>
        <div style="display:flex;gap:8px;margin-top:18px">
          <button class="btn" style="flex:1" onclick="document.getElementById('review-complete-dialog')?.remove()">Cancel</button>
          <button class="btn-primary" style="flex:2;background:#238636" onclick="finalizeProjectCompletion(${projectId})">Mark Project Complete</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function renderReviewMilestones(projectId, installPhase) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return '';
  return installPhase.milestones.map(m => {
    const prog = milestoneProgress(p, installPhase, m);
    const done = prog >= 1;
    return `
      <div onclick="toggleReviewMilestone(${projectId}, '${m.key}')"
        style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:${done ? '#0D1A0E' : '#0D1117'};border:1px solid ${done ? '#238636' : '#1C2333'};border-radius:5px;cursor:pointer;-webkit-tap-highlight-color:transparent">
        <div style="width:18px;height:18px;border-radius:4px;border:1.5px solid ${done ? '#3FB950' : '#58A6FF'};background:${done ? '#3FB950' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${done ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6.5l2.5 2.5L10 3.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        </div>
        <div style="font-size:12px;color:#E6EDF3;flex:1">${esc(m.label)}</div>
        ${prog > 0 && prog < 1 ? `<span style="font-size:10px;color:#D29922">${Math.round(prog * 100)}%</span>` : ''}
      </div>
    `;
  }).join('');
}

function toggleReviewMilestone(projectId, milestoneKey) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  const installPhase = PHASES.find(ph => ph.key === 'install');
  const m = installPhase.milestones.find(mi => mi.key === milestoneKey);
  if (!m) return;
  const current = milestoneProgress(p, installPhase, m) >= 1;
  setMilestone(projectId, 'install', milestoneKey, !current);
  const el = document.getElementById('review-milestones');
  if (el) el.innerHTML = renderReviewMilestones(projectId, installPhase);
}

function finalizeProjectCompletion(projectId) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  p.stage = 'complete';
  // Log activity
  if (!state.recentActivity) state.recentActivity = {};
  state.recentActivity[projectId] = new Date().toISOString();
  // Clear from currentProject if we're looking at it, to refresh display
  save('vi_projects_cache', state.projects);
  document.getElementById('review-complete-dialog')?.remove();
  showToast(`${p.name} marked Complete`, 'success');
  renderCurrentPage();
}

// ── Install Department Management dashboard ──
// For Clint and other install leads: all install projects with closeout queue as priority
// ═══════════════════════════════════════════════════════════════════
// PLANNING DASHBOARD (Install Department Management)
// Forward-planning oriented view for the Install Manager / PM.
// Shows post-mobilization projects grouped by status:
//   Planning → Ready for Install → Prep → In Install → Closeout
// ═══════════════════════════════════════════════════════════════════

// Compute the "planning status" of a project. Returns one of:
//   'mobilizing' | 'planning' | 'ready' | 'prep' | 'in_install' | 'closeout' | 'complete'
function getPlanningStatus(p) {
  if (p.stage === 'complete') return 'complete';
  if (isProjectInCloseout(p)) return 'closeout';

  // Pre-contract → not on Planning at all
  if (['lead', 'proposal', 'sent'].includes(p.stage)) return null;

  // Contract stage with mobilization incomplete
  if (p.stage === 'contract' && !isMobilizationComplete(p.id)) return 'mobilizing';

  // In-install — today within booked window
  const win = getInstallWindow(p);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (win?.source === 'booked' && win.start) {
    const start = new Date(win.start);
    const end = win.end ? new Date(win.end) : start;
    if (today >= start && today <= end) return 'in_install';
  }

  // Auto-prep: ready for install AND within 7 days of install start
  // OR manual prep flag
  const ready = isReadyForInstallStatus(p);
  const manualPrepFlag = state.mobilizationFlags?.[p.id]?.prep_active;
  if (ready) {
    const start = win?.source === 'booked' ? new Date(win.start) : null;
    const daysOut = start ? Math.round((start - today) / 86400000) : null;
    if (manualPrepFlag) return 'prep';
    if (daysOut !== null && daysOut >= 0 && daysOut <= 7) return 'prep';
    return 'ready';
  }

  // Default: in planning
  return 'planning';
}

// "Ready for Install" gate — all of:
//   1. Design phase complete (kickoff logged + design milestones done)
//   2. Equipment ordered (purchasing milestones complete)
//   3. Equipment received (warehouse milestone)
//   4. Booked install dates set
//   5. PM assigned
//   6. Crew assigned (at least 1 person on install)
function isReadyForInstallStatus(p) {
  return getReadyForInstallGates(p).every(g => g.met);
}

function getReadyForInstallGates(p) {
  const a = getProjectAssignment(p.id);
  const designPhase = PHASES.find(ph => ph.key === 'design');
  const purchasingPhase = PHASES.find(ph => ph.key === 'purchasing');
  const planningPhase = PHASES.find(ph => ph.key === 'planning');
  const designDone = designPhase
    ? designPhase.milestones.every(m => milestoneProgress(p, designPhase, m) >= 1)
    : true;
  const purchasingDone = purchasingPhase
    ? purchasingPhase.milestones.every(m => milestoneProgress(p, purchasingPhase, m) >= 1)
    : true;
  // Warehouse received = the "received_at_warehouse" milestone in planning, if it exists
  const warehouseReceived = (() => {
    if (!planningPhase) return true;
    const ms = planningPhase.milestones.find(m =>
      ['warehouse_received', 'gear_received', 'received', 'check_in'].includes(m.key)
    );
    if (!ms) return true; // milestone doesn't exist yet — treat as not-blocking
    return milestoneProgress(p, planningPhase, ms) >= 1;
  })();
  const win = getInstallWindow(p);
  const datesBooked = win?.source === 'booked';
  const pmAssigned = (a.pm || []).length > 0;
  const crewAssigned = (a.install || []).length > 0;
  return [
    { key: 'design',    label: 'Design phase complete',        met: designDone },
    { key: 'purchasing',label: 'All equipment ordered',         met: purchasingDone },
    { key: 'warehouse', label: 'Equipment received at warehouse',met: warehouseReceived },
    { key: 'dates',     label: 'Install dates booked',          met: datesBooked },
    { key: 'pm',        label: 'PM assigned',                   met: pmAssigned },
    { key: 'crew',      label: 'Crew assigned',                 met: crewAssigned }
  ];
}

// Build the planning groups for the dashboard
function getPlanningGroups(activeProjects) {
  const groups = {
    planning: [], ready: [], prep: [], in_install: [], closeout: []
  };
  activeProjects.forEach(p => {
    const status = getPlanningStatus(p);
    if (!status) return;          // pre-contract — skip
    if (status === 'mobilizing') return; // in Sales, not Planning
    if (status === 'complete') return;   // done — skip
    if (groups[status]) groups[status].push(p);
  });

  // Sort each group by closest install start date
  Object.keys(groups).forEach(key => {
    groups[key].sort((a, b) => {
      const wa = getInstallWindow(a);
      const wb = getInstallWindow(b);
      const da = wa?.start ? new Date(wa.start).getTime() : Infinity;
      const db = wb?.start ? new Date(wb.start).getTime() : Infinity;
      return da - db;
    });
  });

  return groups;
}

// Get projects with active days this week (install or prep)
function getThisWeekActivity(activeProjects) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7)); // back up to Monday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // For each project, derive which days this week it's active
  const days = []; // [{date, dateStr, dow, items: [{p, kind: 'install'|'prep'}]}]
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: d, dateStr, dow: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i], items: [] });
  }

  activeProjects.forEach(p => {
    const status = getPlanningStatus(p);
    if (!['ready','prep','in_install','closeout'].includes(status)) return;
    const win = getInstallWindow(p);
    if (!win || !win.start) return;
    const start = new Date(win.start);
    const end = win.end ? new Date(win.end) : new Date(win.start);
    days.forEach(d => {
      if (d.date >= start && d.date <= end) {
        d.items.push({ p, kind: 'install' });
      }
    });
    // Prep days = up to 3 days before install (heuristic — refine later if needed)
    if (status === 'prep' || status === 'ready') {
      const prepStart = new Date(start);
      prepStart.setDate(prepStart.getDate() - 3);
      const prepEnd = new Date(start);
      prepEnd.setDate(prepEnd.getDate() - 1);
      days.forEach(d => {
        if (d.date >= prepStart && d.date <= prepEnd && d.date >= today) {
          d.items.push({ p, kind: 'prep' });
        }
      });
    }
  });

  return { monday, sunday, days };
}

function renderInstallMgmtDashboard(activeProjects) {
  const groups = getPlanningGroups(activeProjects);
  const week = getThisWeekActivity(activeProjects);

  const planningCount = groups.planning.length;
  const readyCount = groups.ready.length;
  const prepCount = groups.prep.length;
  const inInstallCount = groups.in_install.length;
  const closeoutCount = groups.closeout.length;
  const total = planningCount + readyCount + prepCount + inInstallCount + closeoutCount;

  return `
    ${renderDeptDashboardHeader('Installation Department Management', 'Forward planning + active job oversight', '#F0883E')}

    <!-- Hero metrics -->
    <div data-context-section="metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">
      <div class="metric-card">
        <div class="metric-label">Active</div>
        <div class="metric-value">${total}</div>
        <div class="metric-sub">post-mobilization</div>
      </div>
      <div class="metric-card" style="${readyCount > 0 ? 'border-color:#3FB950' : ''}">
        <div class="metric-label">Ready for Install</div>
        <div class="metric-value" style="${readyCount > 0 ? 'color:#3FB950' : ''}">${readyCount}</div>
      </div>
      <div class="metric-card" style="${inInstallCount > 0 ? 'border-color:#F0883E' : ''}">
        <div class="metric-label">In Install</div>
        <div class="metric-value" style="${inInstallCount > 0 ? 'color:#F0883E' : ''}">${inInstallCount}</div>
      </div>
      <div class="metric-card" style="${closeoutCount > 0 ? 'border-color:#DA3633' : ''}">
        <div class="metric-label">Closeout</div>
        <div class="metric-value" style="${closeoutCount > 0 ? 'color:#F85149' : ''}">${closeoutCount}</div>
      </div>
    </div>

    <!-- This Week card (compact, no crew detail — tap to drill in) -->
    <div data-context-section="this-week" class="dashboard-card" style="margin-bottom:14px">
      <div class="dashboard-card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>This Week</span>
        <span style="font-size:11px;color:#8B949E;font-weight:400">${week.monday.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${week.sunday.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
      </div>
      ${renderPlanningWeekStrip(week)}
    </div>

    <!-- Planning groups -->
    ${renderPlanningGroup('Planning', 'planning', groups.planning, '#58A6FF', 'Mobilized — gathering everything to be Ready for Install')}
    ${renderPlanningGroup('Ready for Install', 'ready', groups.ready, '#3FB950', 'All gates met — waiting for prep to begin')}
    ${renderPlanningGroup('Prep', 'prep', groups.prep, '#D29922', 'Within 7 days of install start')}
    ${renderPlanningGroup('In Install', 'in_install', groups.in_install, '#F0883E', 'Install window currently active')}
    ${renderPlanningGroup('Closeout', 'closeout', groups.closeout, '#DA3633', 'Install complete — closeout checklist incomplete')}
  `;
}

function renderPlanningWeekStrip(week) {
  if (week.days.every(d => d.items.length === 0)) {
    return `<div style="font-size:12px;color:#6E7681;font-style:italic;padding:10px 0">Nothing scheduled this week</div>`;
  }
  return `
    <div class="planning-week-strip">
      ${week.days.map(d => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = d.date.getTime() === today.getTime();
        const isPast = d.date < today;
        return `
          <div class="planning-week-day${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}">
            <div class="planning-week-dow">${d.dow}</div>
            <div class="planning-week-date">${d.date.getDate()}</div>
            <div class="planning-week-items">
              ${d.items.length === 0 ? '<div class="planning-week-empty">—</div>' :
                d.items.map(item => `
                  <div class="planning-week-item planning-week-${item.kind}" onclick="openProject(${item.p.id},'install')" title="${esc(item.p.name)} (${item.kind})">
                    <span class="planning-week-item-kind">${item.kind === 'install' ? 'I' : 'P'}</span>
                    <span class="planning-week-item-name">${esc(item.p.name)}</span>
                  </div>
                `).join('')
              }
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderPlanningGroup(label, contextKey, projects, color, hint) {
  if (projects.length === 0) return '';
  return `
    <div data-context-section="${contextKey}" class="dashboard-card" style="margin-bottom:12px;border-left:3px solid ${color}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:baseline;gap:8px">
          <span style="font-size:13px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.06em">${esc(label)}</span>
          <span style="font-size:11px;color:#6E7681">${projects.length}</span>
        </div>
      </div>
      <div style="font-size:11px;color:#6E7681;margin-bottom:10px">${esc(hint)}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${projects.map(p => renderPlanningRow(p, contextKey)).join('')}
      </div>
    </div>
  `;
}

function renderPlanningRow(p, statusKey) {
  const a = getProjectAssignment(p.id);
  const win = getInstallWindow(p);
  const installPhase = PHASES.find(ph => ph.key === 'install');
  const installMilestones = installPhase?.milestones || [];
  const installDone = installMilestones.filter(m => milestoneProgress(p, installPhase, m) >= 1).length;
  const installTotal = installMilestones.length;

  // Date string
  const dateStr = win?.start
    ? `${fmtDate(win.start)}${win.end && win.end !== win.start ? ' — ' + fmtDate(win.end) : ''}`
    : 'No dates';
  const dateColor = win?.source === 'booked' ? '#3FB950' : (win?.source === 'estimated' ? '#58A6FF' : '#6E7681');
  const dateLabel = win?.source === 'booked' ? 'Booked' : (win?.source === 'estimated' ? 'Est.' : null);

  // Crew + PM short labels
  const pm = (a.pm || []).find(x => x.lead) || (a.pm || [])[0];
  const pmName = pm ? getTeamMember(pm.id)?.name?.split(' ')[0] : null;
  const crewCount = (a.install || []).length;

  // Why-not-ready details for Planning rows
  let gateInfo = '';
  if (statusKey === 'planning') {
    const gates = getReadyForInstallGates(p);
    const missing = gates.filter(g => !g.met);
    if (missing.length > 0) {
      gateInfo = `
        <div class="planning-row-gates">
          <span class="planning-row-gates-label">Waiting on:</span>
          ${missing.map(g => `<span class="planning-row-gate-chip">${esc(g.label)}</span>`).join('')}
        </div>
      `;
    }
  }

  return `
    <div class="planning-row" onclick="openProject(${p.id},'install')">
      <div class="planning-row-main">
        <div class="planning-row-name">${esc(p.name)}${p.client_name ? `<span class="planning-row-client"> · ${esc(p.client_name)}</span>` : ''}</div>
        <div class="planning-row-meta">
          ${dateLabel ? `<span style="color:${dateColor}">${esc(dateLabel)}: ${esc(dateStr)}</span>` : `<span style="color:#6E7681">${esc(dateStr)}</span>`}
          ${pmName ? `<span>PM: ${esc(pmName)}</span>` : '<span style="color:#D29922">No PM</span>'}
          ${crewCount > 0 ? `<span>${crewCount} crew</span>` : '<span style="color:#D29922">No crew</span>'}
          ${installTotal > 0 ? `<span>Tasks: ${installDone}/${installTotal}</span>` : ''}
        </div>
        ${gateInfo}
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;color:#6E7681"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  `;
}

// ── Department dashboard header helper ──
function renderDeptDashboardHeader(title, subtitle, color) {
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #1C2333">
      <div style="width:4px;height:28px;background:${color};border-radius:2px;flex-shrink:0"></div>
      <div>
        <div style="font-size:16px;font-weight:600;color:#E6EDF3">${esc(title)}</div>
        <div style="font-size:11px;color:#6E7681;margin-top:1px">${esc(subtitle)}</div>
      </div>
    </div>
  `;
}

// ── Design Department Management dashboard ──
function renderDesignMgmtDashboard(activeProjects) {
  // Projects currently in Design phase (parallel with Purchasing/Planning — projects that are past Contract but not yet Install)
  const inDesign = activeProjects.filter(p => {
    if (p.stage !== 'contract') return false;
    const designPhase = PHASES.find(ph => ph.key === 'design');
    if (!designPhase) return false;
    const pct = phaseProgress(p, designPhase);
    return pct > 0 && pct < 1;
  });

  // Pending kickoff: projects past contract stage where Design Kickoff hasn't been logged
  const pendingKickoff = activeProjects.filter(p => {
    if (p.stage !== 'contract') return false;
    // Project must be past the contract milestones being complete
    const contractPhase = PHASES.find(ph => ph.key === 'contract');
    if (!contractPhase) return false;
    const contractDone = phaseProgress(p, contractPhase) >= 1;
    if (!contractDone) return false;
    const designPhase = PHASES.find(ph => ph.key === 'design');
    const kickoffMilestone = designPhase?.milestones.find(m => m.key === 'kickoff');
    if (!kickoffMilestone) return false;
    return milestoneProgress(p, designPhase, kickoffMilestone) < 1;
  });

  // Pending handoff: designs at or near 100% completed milestone but handoff milestone not checked
  const pendingHandoff = activeProjects.filter(p => {
    const designPhase = PHASES.find(ph => ph.key === 'design');
    if (!designPhase) return false;
    const completedMilestone = designPhase.milestones.find(m => m.key === 'completed');
    const handoffMilestone = designPhase.milestones.find(m => m.key === 'handoff');
    if (!completedMilestone || !handoffMilestone) return false;
    const completedProg = milestoneProgress(p, designPhase, completedMilestone);
    const handoffDone = milestoneProgress(p, designPhase, handoffMilestone) >= 1;
    return completedProg >= 0.8 && !handoffDone;
  });

  // Stuck designs: in design phase, no sub-task activity 14+ days (use created_at as proxy for activity)
  const stuckDesigns = inDesign.filter(p => {
    const subtasks = getSubtasks(p.id, 'design');
    if (subtasks.length === 0) return false;
    const mostRecent = subtasks.reduce((latest, t) => {
      const d = new Date(t.completed_at || t.created_at);
      return d > latest ? d : latest;
    }, new Date(0));
    const days = (Date.now() - mostRecent.getTime()) / 86400000;
    return days > 14;
  });

  // Pending template suggestions
  const pendingSuggestions = (state.templateSuggestions || []).filter(s => s.status === 'pending');

  // Total open design sub-tasks across all active projects (workload indicator)
  let totalOpenTasks = 0;
  activeProjects.forEach(p => {
    const subtasks = getSubtasks(p.id, 'design');
    totalOpenTasks += subtasks.filter(t => t.status !== 'done').length;
  });

  return `
    ${renderDeptDashboardHeader('Design Department Management', 'Design phase oversight across all active projects', '#A371F7')}

    <!-- Hero metrics -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:18px">
      <div class="metric-card">
        <div class="metric-label">In Design</div>
        <div class="metric-value">${inDesign.length}</div>
        <div class="metric-sub">active designs</div>
      </div>
      <div class="metric-card" style="${pendingKickoff.length > 0 ? 'border-color:#D29922' : ''}">
        <div class="metric-label">Awaiting Kickoff</div>
        <div class="metric-value" style="${pendingKickoff.length > 0 ? 'color:#D29922' : ''}">${pendingKickoff.length}</div>
        <div class="metric-sub">contracts past ready</div>
      </div>
      <div class="metric-card" style="${pendingHandoff.length > 0 ? 'border-color:#3FB950' : ''}">
        <div class="metric-label">Awaiting Handoff</div>
        <div class="metric-value" style="${pendingHandoff.length > 0 ? 'color:#3FB950' : ''}">${pendingHandoff.length}</div>
        <div class="metric-sub">ready for install handoff</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Open Tasks</div>
        <div class="metric-value">${totalOpenTasks}</div>
        <div class="metric-sub">across all designs</div>
      </div>
    </div>

    <!-- Template Suggestions (priority if any) -->
    ${pendingSuggestions.length > 0 ? `
      <div class="dashboard-card" style="margin-bottom:16px;border-left:3px solid #D29922">
        <div class="dashboard-card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span style="color:#D29922">Template Suggestions &middot; ${pendingSuggestions.length}</span>
          <button class="btn btn-sm" onclick="state.adminTab='templates';navigate('admin')" style="font-size:11px;padding:4px 10px">Review in Admin &rarr;</button>
        </div>
        <div style="font-size:11px;color:#8B949E;margin-bottom:8px">Team-suggested additions to design templates awaiting your review</div>
        ${pendingSuggestions.slice(0, 3).map(s => {
          const suggestedBy = getTeamMember(s.suggested_by);
          const templateName = TEMPLATES[s.phase]?.[s.scope]?.name || s.scope;
          return `
            <div style="padding:8px 10px;background:#0D1117;border:1px solid #1C2333;border-radius:4px;margin-bottom:4px">
              <div style="font-size:12px;color:#E6EDF3">"${esc(s.text)}"</div>
              <div style="font-size:10px;color:#6E7681;margin-top:2px">For ${esc(templateName)} &middot; by ${esc(suggestedBy?.name || 'unknown')}</div>
            </div>
          `;
        }).join('')}
        ${pendingSuggestions.length > 3 ? `<div style="font-size:10px;color:#6E7681;text-align:center;padding:4px">+${pendingSuggestions.length - 3} more</div>` : ''}
      </div>
    ` : ''}

    <!-- Pending Kickoff + Pending Handoff in 2-col -->
    ${(pendingKickoff.length > 0 || pendingHandoff.length > 0) ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-bottom:16px">
        ${pendingKickoff.length > 0 ? `
          <div class="dashboard-card" style="border-left:2px solid #D29922">
            <div class="dashboard-card-title"><span style="color:#D29922">Awaiting Kickoff &middot; ${pendingKickoff.length}</span></div>
            <div style="font-size:11px;color:#6E7681;margin-bottom:8px">Contracts ready but design hasn&rsquo;t started</div>
            ${pendingKickoff.map(p => {
              const assignment = getProjectAssignment(p.id);
              const designLead = (assignment.design || []).find(x => x.lead);
              const leadName = designLead ? getTeamMember(designLead.id)?.name : null;
              return `
                <div onclick="openProject(${p.id})" style="padding:8px 10px;background:#0D1117;border:1px solid #1C2333;border-radius:4px;margin-bottom:4px;cursor:pointer;-webkit-tap-highlight-color:transparent">
                  <div style="font-size:12px;color:#E6EDF3;font-weight:500">${esc(p.name)}</div>
                  <div style="font-size:10px;color:#6E7681;margin-top:2px">${esc(p.client_name || '')}${leadName ? ' &middot; Lead: ' + esc(leadName) : ' &middot; <span style="color:#D29922">No lead assigned</span>'}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
        ${pendingHandoff.length > 0 ? `
          <div class="dashboard-card" style="border-left:2px solid #3FB950">
            <div class="dashboard-card-title"><span style="color:#3FB950">Awaiting Handoff &middot; ${pendingHandoff.length}</span></div>
            <div style="font-size:11px;color:#6E7681;margin-bottom:8px">Designs ready for install handoff meeting</div>
            ${pendingHandoff.map(p => {
              const designPhase = PHASES.find(ph => ph.key === 'design');
              const completedMilestone = designPhase.milestones.find(m => m.key === 'completed');
              const completedProg = Math.round(milestoneProgress(p, designPhase, completedMilestone) * 100);
              return `
                <div onclick="openProject(${p.id})" style="padding:8px 10px;background:#0D1117;border:1px solid #1C2333;border-radius:4px;margin-bottom:4px;cursor:pointer;-webkit-tap-highlight-color:transparent">
                  <div style="font-size:12px;color:#E6EDF3;font-weight:500">${esc(p.name)}</div>
                  <div style="font-size:10px;color:#6E7681;margin-top:2px">${esc(p.client_name || '')} &middot; ${completedProg}% design complete</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    ` : ''}

    <!-- Design Queue: all projects currently in design -->
    <div class="dashboard-card" style="margin-bottom:16px">
      <div class="dashboard-card-title">Design Queue &middot; ${inDesign.length}</div>
      ${inDesign.length === 0 ? '<div style="font-size:12px;color:#6E7681;font-style:italic;padding:10px 0">No designs currently in progress</div>' : inDesign.map(p => {
        const designPhase = PHASES.find(ph => ph.key === 'design');
        const pct = Math.round(phaseProgress(p, designPhase) * 100);
        const assignment = getProjectAssignment(p.id);
        const designPeople = assignment.design || [];
        const designLead = designPeople.find(x => x.lead);
        const leadName = designLead ? getTeamMember(designLead.id)?.name : null;
        const openTasks = getSubtasks(p.id, 'design').filter(t => t.status !== 'done').length;
        const isStuck = stuckDesigns.some(sp => sp.id === p.id);
        return `
          <div onclick="openProject(${p.id})" style="padding:10px 12px;background:#0D1117;border:1px solid ${isStuck ? '#9E6A03' : '#1C2333'};border-radius:5px;margin-bottom:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;${isStuck ? 'border-left:2px solid #D29922' : ''}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div style="flex:1;min-width:180px">
                <div style="font-size:13px;color:#E6EDF3;font-weight:500">${esc(p.name)}</div>
                <div style="font-size:10px;color:#6E7681;margin-top:2px">
                  ${esc(p.client_name || '')}${leadName ? ' &middot; Lead: ' + esc(leadName) : ''}${designPeople.length > 1 ? ` &middot; ${designPeople.length} designers` : ''}${openTasks > 0 ? ` &middot; ${openTasks} task${openTasks === 1 ? '' : 's'}` : ''}${isStuck ? ' &middot; <span style="color:#D29922">no recent activity</span>' : ''}
                </div>
              </div>
              <div style="font-size:11px;color:${pct === 100 ? '#3FB950' : '#A371F7'};font-weight:600">${pct}%</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Sales Department Management dashboard ──
// Two tabs: Action (default) and Pipeline. Stats moved into a sheet on Pipeline tab.
function renderSalesMgmtDashboard(activeProjects) {
  const tab = state.salesDashTab || 'action';
  const tabs = [
    { key: 'action',   label: 'Action' },
    { key: 'pipeline', label: 'Pipeline' }
  ];

  const tabBar = `
    <div class="sales-subtab-bar">
      ${tabs.map(t => `
        <button type="button" class="sales-subtab${tab === t.key ? ' active' : ''}" onclick="setSalesDashTab('${t.key}')">${t.label}</button>
      `).join('')}
    </div>
  `;

  // Search bar — quick project lookup
  const searchBar = `
    <button type="button" onclick="quickActionProjectPicker('Search projects', (id) => openProject(id))" class="sales-search-bar">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/><path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      <span>Search projects&hellip;</span>
    </button>
  `;

  let body = '';
  if (tab === 'pipeline') {
    body = renderSalesPipelineTab(activeProjects);
  } else {
    body = renderSalesActionTab(activeProjects);
  }

  return `
    ${renderDeptDashboardHeader('Sales Department Management', 'Pipeline oversight and sales rep performance', '#3FB950')}
    ${searchBar}
    ${tabBar}
    ${body}
  `;
}

function setSalesDashTab(tab) {
  state.salesDashTab = tab;
  localStorage.setItem('vi_sales_dash_tab', tab);
  renderDashboard(document.getElementById('content'));
}

// ── Sales Pipeline tab — kanban + Stats button ──
function renderSalesPipelineTab(activeProjects) {
  const needsReview = activeProjects.filter(p => isContractNeedsReview(p));
  const collapsed = localStorage.getItem('vi_sales_stats_collapsed') === '1';
  return `
    <!-- Desktop inline stats panel (hidden on mobile via CSS) -->
    <div class="sales-stats-inline${collapsed ? ' collapsed' : ''}" id="sales-stats-inline">
      <div class="sales-stats-inline-header">
        <div style="font-size:11px;font-weight:700;color:#8B949E;text-transform:uppercase;letter-spacing:0.08em">Sales Stats</div>
        <button type="button" class="btn btn-sm" onclick="toggleSalesStatsInline()" style="font-size:11px;padding:4px 10px">
          ${collapsed ? 'Show Stats' : 'Hide Stats'}
        </button>
      </div>
      ${collapsed ? '' : `<div class="sales-stats-inline-body">${renderSalesStatsContent()}</div>`}
    </div>

    <!-- Mobile-only Stats button (hidden on desktop via CSS) -->
    <div class="sales-stats-mobile-trigger">
      <button type="button" onclick="openSalesStatsSheet()" class="btn btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-size:12px">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 12V6M6 12V2M10 12V8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        Stats
      </button>
    </div>

    ${renderSalesKanban(activeProjects, needsReview)}
  `;
}

function toggleSalesStatsInline() {
  const cur = localStorage.getItem('vi_sales_stats_collapsed') === '1';
  localStorage.setItem('vi_sales_stats_collapsed', cur ? '0' : '1');
  renderDashboard(document.getElementById('content'));
}

// Shared stats content used by both inline panel and mobile sheet
function renderSalesStatsContent() {
  const activeProjects = state.projects.filter(p => !p.archived);
  const totalValue = getPipelineValue(activeProjects);
  const likelyValue = getLikelyToCloseTotal();
  const likelyCount = activeProjects.filter(p => isLikelyToClose(p.id)).length;
  const closeRate = getCloseRate();
  const needsReview = activeProjects.filter(p => isContractNeedsReview(p)).length;

  // Personal KPIs — projects where current user is Sales Lead
  const myId = getActiveTeamMemberId();
  const myProjects = activeProjects.filter(p => {
    const sales = (getProjectAssignment(p.id).sales || []);
    const lead = sales.find(x => x.lead);
    return lead?.id === myId;
  });
  const myValue = myProjects.reduce((s, p) => s + (p.total || 0), 0);
  const myLikely = myProjects.filter(p => isLikelyToClose(p.id)).length;
  const myActive = myProjects.filter(p => !['complete','archived'].includes(p.stage)).length;

  // Per-employee breakdown — Sales Lead KPIs
  const byLead = {};
  activeProjects.forEach(p => {
    const sales = (getProjectAssignment(p.id).sales || []);
    const lead = sales.find(x => x.lead);
    const id = lead?.id || 'unassigned';
    if (!byLead[id]) byLead[id] = { id, value: 0, active: 0, likely: 0, won: 0, lost: 0 };
    byLead[id].value += (p.total || 0);
    if (!['complete','archived'].includes(p.stage)) byLead[id].active++;
    if (isLikelyToClose(p.id)) byLead[id].likely++;
  });
  // Compute won/lost from completed/archived
  state.projects.forEach(p => {
    const sales = (getProjectAssignment(p.id).sales || []);
    const lead = sales.find(x => x.lead);
    const id = lead?.id || 'unassigned';
    if (!byLead[id]) byLead[id] = { id, value: 0, active: 0, likely: 0, won: 0, lost: 0 };
    if (p.stage === 'complete' || (p.archived && p.archived_reason === 'won')) byLead[id].won++;
    else if (p.archived && p.archived_reason === 'lost') byLead[id].lost++;
  });
  const leadSummary = Object.values(byLead).sort((a, b) => b.value - a.value);

  return `
    <div style="font-size:10px;font-weight:600;color:#6E7681;text-transform:uppercase;letter-spacing:0.08em;margin:0 4px 6px">Team</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:14px">
      <div class="metric-card" style="padding:10px 12px"><div class="metric-label">Pipeline</div><div class="metric-value" style="font-size:18px">${fmt(totalValue)}</div><div class="metric-sub">${activeProjects.length} active</div></div>
      <div class="metric-card" style="padding:10px 12px"><div class="metric-label">Likely</div><div class="metric-value" style="font-size:18px;color:#3FB950">${fmt(likelyValue)}</div><div class="metric-sub">${likelyCount} project${likelyCount === 1 ? '' : 's'}</div></div>
      <div class="metric-card" style="padding:10px 12px${needsReview > 0 ? ';border-color:#DA3633' : ''}"><div class="metric-label">Needs Review</div><div class="metric-value" style="font-size:18px${needsReview > 0 ? ';color:#F85149' : ''}">${needsReview}</div><div class="metric-sub">contracts</div></div>
      <div class="metric-card" style="padding:10px 12px"><div class="metric-label">Close Rate</div><div class="metric-value" style="font-size:18px${closeRate !== null && closeRate >= 50 ? ';color:#3FB950' : ''}">${closeRate !== null ? closeRate + '%' : '—'}</div><div class="metric-sub">all-time</div></div>
    </div>

    <div style="font-size:10px;font-weight:600;color:#6E7681;text-transform:uppercase;letter-spacing:0.08em;margin:14px 4px 6px">My KPIs</div>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:14px">
      <div class="metric-card" style="padding:10px 12px"><div class="metric-label">Pipeline</div><div class="metric-value" style="font-size:18px">${fmt(myValue)}</div></div>
      <div class="metric-card" style="padding:10px 12px"><div class="metric-label">Likely</div><div class="metric-value" style="font-size:18px;color:#3FB950">${myLikely}</div></div>
      <div class="metric-card" style="padding:10px 12px"><div class="metric-label">Active</div><div class="metric-value" style="font-size:18px">${myActive}</div></div>
    </div>

    <div style="font-size:10px;font-weight:600;color:#6E7681;text-transform:uppercase;letter-spacing:0.08em;margin:14px 4px 6px">By Sales Lead</div>
    <div style="display:flex;flex-direction:column;gap:4px">
      ${leadSummary.length === 0 ? '<div style="font-size:12px;color:#6E7681;font-style:italic;padding:10px">No assignments</div>' : leadSummary.map(g => {
        const m = g.id === 'unassigned' ? null : getTeamMember(g.id);
        const name = m?.name || 'Unassigned';
        const cr = (g.won + g.lost > 0) ? Math.round((g.won / (g.won + g.lost)) * 100) : null;
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0D1117;border:1px solid #1C2333;border-radius:6px">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;color:#E6EDF3;font-weight:500">${esc(name)}</div>
              <div style="font-size:10px;color:#6E7681;margin-top:2px">${g.active} active &middot; ${g.likely} likely${cr !== null ? ' &middot; ' + cr + '% close rate' : ''}</div>
            </div>
            <div style="font-size:13px;color:#3FB950;font-weight:600;font-variant-numeric:tabular-nums">${fmt(g.value)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Sales Stats sheet — opened from Pipeline tab ──
function openSalesStatsSheet() {
  document.getElementById('sales-stats-sheet')?.remove();
  const sheet = document.createElement('div');
  sheet.id = 'sales-stats-sheet';
  sheet.className = 'qa-sheet';
  sheet.innerHTML = `
    <div class="qa-backdrop" onclick="closeSalesStatsSheet()"></div>
    <div class="qa-panel" role="dialog" aria-label="Sales stats">
      <div class="qa-handle"></div>
      <div class="qa-header">
        <div class="qa-title">Sales Stats</div>
        <button class="qa-close" onclick="closeSalesStatsSheet()" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
      </div>
      ${renderSalesStatsContent()}
    </div>
  `;
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('open'));
}

function closeSalesStatsSheet() {
  const sheet = document.getElementById('sales-stats-sheet');
  if (!sheet) return;
  sheet.classList.remove('open');
  setTimeout(() => sheet.remove(), 220);
}

// ═══════════════════════════════════════════════════════════════════
// SALES ACTION TAB — auto-derived + manual + assigned actions
// ═══════════════════════════════════════════════════════════════════

const ACTION_SECTIONS = [
  { key: 'quote',   label: 'Quotes',    desc: 'Bids to send and follow up on',         color: '#58A6FF' },
  { key: 'email',   label: 'Emails',    desc: 'Follow-ups and outreach',               color: '#A371F7' },
  { key: 'meeting', label: 'Meetings',  desc: 'Walkthroughs, kickoffs, hand-offs',     color: '#3FB950' },
  { key: 'likely',  label: 'Likely Closes', desc: 'Hot deals to keep warm',            color: '#3FB950' },
  { key: 'notify',  label: 'Notifications', desc: 'System alerts',                     color: '#D29922' },
  { key: 'other',   label: 'Misc Tasks', desc: 'Miscellaneous follow-ups',              color: '#6E7681' }
];

// ── Action engine ──
// Each action has: { key, section, source, projectId, projectName, text, ageDays, complete? }
// source: 'auto' | 'manual' | 'assigned'
// Build sales actions list. Returns auto + manual actions enriched with assigneeId.
// `mode` controls filtering:
//   'department' — return ALL sales-relevant actions (used by Sales Dept dashboard)
//   'mine' — return only actions assigned to currentMemberId (used by My Work)
function buildSalesActions(activeProjects, currentMemberId, mode) {
  if (!mode) mode = 'department';
  const auto = [];
  const SEVEN_DAYS = 7 * 86400000;
  const FOURTEEN_DAYS = 14 * 86400000;
  const now = Date.now();

  // Helper: find role lead's id on a project, or null
  function getRoleLeadId(projectId, role) {
    const arr = (getProjectAssignment(projectId)[role] || []);
    const lead = arr.find(x => x.lead);
    return lead ? lead.id : null;
  }

  activeProjects.forEach(p => {
    const lastActivity = state.recentActivity?.[p.id];
    const lastActivityMs = lastActivity ? new Date(lastActivity).getTime() : null;
    const daysSinceActivity = lastActivityMs ? (now - lastActivityMs) / 86400000 : null;
    const proposalPhase = PHASES.find(ph => ph.key === 'proposal');
    const sentMilestone = proposalPhase?.milestones.find(m => m.key === 'proposal_sent');
    const proposalSent = sentMilestone ? milestoneProgress(p, proposalPhase, sentMilestone) >= 1 : false;
    const salesLead = getRoleLeadId(p.id, 'sales');
    const designLead = getRoleLeadId(p.id, 'design');

    // Quotes — Lead with no proposal
    if (p.stage === 'lead') {
      auto.push({
        key: `auto_send_quote_${p.id}`,
        section: 'quote',
        source: 'auto',
        projectId: p.id,
        projectName: p.name,
        clientName: p.client_name,
        text: `Send quote for ${p.name}`,
        autoType: 'send_quote',
        roleForLead: 'sales',
        assigneeId: salesLead
      });
    }

    // Quotes — proposal sent 7+ days, no movement
    if (p.stage === 'proposal' && proposalSent && daysSinceActivity !== null && daysSinceActivity >= 7) {
      auto.push({
        key: `auto_quote_followup_${p.id}`,
        section: 'quote',
        source: 'auto',
        projectId: p.id,
        projectName: p.name,
        clientName: p.client_name,
        text: `Follow up on quote for ${p.name}`,
        ageDays: Math.floor(daysSinceActivity),
        autoType: 'quote_followup',
        roleForLead: 'sales',
        assigneeId: salesLead
      });
    }

    // Emails — proposal stage, sent 7+ days, no contract
    if (p.stage === 'proposal' && proposalSent && daysSinceActivity !== null && daysSinceActivity >= 7) {
      auto.push({
        key: `auto_email_followup_${p.id}`,
        section: 'email',
        source: 'auto',
        projectId: p.id,
        projectName: p.name,
        clientName: p.client_name,
        text: `Email ${p.client_name || 'client'} re: ${p.name}`,
        ageDays: Math.floor(daysSinceActivity),
        autoType: 'email_followup',
        roleForLead: 'sales',
        assigneeId: salesLead
      });
    }

    // Meetings — Lead 14+ days, no walkthrough logged
    const walkthroughLog = state.meetingLogs?.[p.id]?.walkthrough;
    if (p.stage === 'lead' && (!walkthroughLog) && lastActivityMs && (now - lastActivityMs) > FOURTEEN_DAYS) {
      auto.push({
        key: `auto_walkthrough_${p.id}`,
        section: 'meeting',
        source: 'auto',
        projectId: p.id,
        projectName: p.name,
        clientName: p.client_name,
        text: `Schedule walkthrough for ${p.name}`,
        ageDays: Math.floor((now - lastActivityMs) / 86400000),
        autoType: 'walkthrough',
        roleForLead: 'sales',
        assigneeId: salesLead
      });
    }

    // Meetings — Contract stage, design kickoff not logged
    const kickoffLog = state.meetingLogs?.[p.id]?.design_kickoff;
    if (p.stage === 'contract' && !kickoffLog && !isContractNeedsReview(p)) {
      auto.push({
        key: `auto_design_kickoff_${p.id}`,
        section: 'meeting',
        source: 'auto',
        projectId: p.id,
        projectName: p.name,
        clientName: p.client_name,
        text: `Schedule design kickoff for ${p.name}`,
        autoType: 'design_kickoff',
        roleForLead: 'design',
        assigneeId: designLead
      });
    }

    // Meetings (hand-offs) — contract signed, not yet handed off
    if (isContractNeedsReview(p)) {
      auto.push({
        key: `auto_handoff_${p.id}`,
        section: 'meeting',
        source: 'auto',
        projectId: p.id,
        projectName: p.name,
        clientName: p.client_name,
        text: `Hand off ${p.name} to Design & Install`,
        priority: 'high',
        autoType: 'handoff',
        roleForLead: 'sales',
        assigneeId: salesLead
      });
    }

    // Likely Closes
    if (isLikelyToClose(p.id)) {
      auto.push({
        key: `auto_likely_${p.id}`,
        section: 'likely',
        source: 'auto',
        projectId: p.id,
        projectName: p.name,
        clientName: p.client_name,
        text: `${p.name} — keep warm`,
        amount: p.total,
        autoType: 'likely',
        roleForLead: 'sales',
        assigneeId: salesLead
      });
    }
  });

  // Apply assignee override from actionsState (if user re-assigned an auto-action via Edit)
  const stateMap = state.actionsState || {};
  auto.forEach(a => {
    const override = stateMap[a.key]?.assigneeOverride;
    if (override !== undefined) a.assigneeId = override;
  });

  // Pull manual actions (sales-relevant only — section in quote/email/meeting/likely/other)
  const SALES_SECTIONS = new Set(['quote','email','meeting','likely','other','notify']);
  const manual = (state.actionsManual || []).filter(a => SALES_SECTIONS.has(a.section || 'other')).map(a => ({
    key: `manual_${a.id}`,
    section: a.section || 'other',
    source: a.assigneeId && a.createdBy && a.assigneeId !== a.createdBy ? 'assigned' : 'manual',
    projectId: a.projectId || null,
    projectName: a.projectId ? state.projects.find(p => p.id === a.projectId)?.name : null,
    clientName: a.projectId ? state.projects.find(p => p.id === a.projectId)?.client_name : null,
    text: a.text,
    createdBy: a.createdBy,
    assigneeId: a.assigneeId || null,
    manualId: a.id
  }));

  // ── Dedup pass ──
  // For each (section, projectId) pair: keep best by precedence (manual > assigned > auto).
  // Standalone manual (no projectId) always shown.
  const all = [...manual, ...auto];
  const seen = new Map();
  const standalone = [];
  const sourceRank = { manual: 3, assigned: 2, auto: 1 };

  for (const a of all) {
    if (!a.projectId) {
      standalone.push(a);
      continue;
    }
    const dedupKey = `${a.section}_${a.projectId}`;
    const existing = seen.get(dedupKey);
    if (!existing || sourceRank[a.source] > sourceRank[existing.source]) {
      seen.set(dedupKey, a);
    }
  }

  let combined = [...standalone, ...seen.values()];

  // Filter out items in dismissed/snoozed state
  combined = combined.filter(a => {
    const s = stateMap[a.key];
    if (!s) return true;
    if (s.status === 'done' || s.status === 'dismissed') return false;
    if (s.status === 'snoozed' && s.snoozeUntil && new Date(s.snoozeUntil).getTime() > now) return false;
    return true;
  });

  // Filter by mode
  if (mode === 'mine') {
    combined = combined.filter(a => a.assigneeId === currentMemberId);
  }
  // 'department' mode returns everything (including unassigned)

  return combined;
}

// Build a list of "Needs Assignment" projects — projects where some auto-actions
// have no assignee because no role lead is designated for the responsible role.
function buildNeedsAssignment(activeProjects) {
  const needs = []; // { projectId, projectName, role, count, sections }
  const byProject = {};

  // Re-derive auto-actions to find unassigned ones
  const allActions = buildSalesActions(activeProjects, null, 'department');
  allActions.forEach(a => {
    if (a.source !== 'auto') return;
    if (a.assigneeId) return; // assigned, skip
    const role = a.roleForLead;
    if (!role) return;
    const key = `${a.projectId}_${role}`;
    if (!byProject[key]) {
      const p = state.projects.find(x => x.id === a.projectId);
      byProject[key] = {
        projectId: a.projectId,
        projectName: p?.name || 'Unknown',
        clientName: p?.client_name || '',
        role,
        sections: new Set(),
        count: 0
      };
    }
    byProject[key].sections.add(a.section);
    byProject[key].count++;
  });

  return Object.values(byProject).map(x => ({ ...x, sections: [...x.sections] }));
}

// Render Action tab — Sales Dept dashboard shows ALL department actions
function renderSalesActionTab(activeProjects) {
  const memberId = getActiveTeamMemberId();
  // Sales Dept dashboard = department mode (all actions across team)
  const actions = buildSalesActions(activeProjects, memberId, 'department');
  const bySec = {};
  ACTION_SECTIONS.forEach(s => bySec[s.key] = []);
  actions.forEach(a => {
    if (bySec[a.section]) bySec[a.section].push(a);
    else bySec.other.push(a);
  });

  // Mobilization — projects in Contract that need their mobilization checklist done
  // Visible to anyone with assign_team perms (sales managers, PMs, admins)
  const canSeeMobilization = currentUserHasPermission('assign_team.sales') ||
                             currentUserHasPermission('assign_team.design') ||
                             currentUserHasPermission('assign_team.pm') ||
                             currentUserHasPermission('admin.system');
  const mobilizationProjects = canSeeMobilization ? getProjectsNeedingMobilization() : [];

  // Calendar widget content
  const calendarHTML = renderActionCalendarWidget();

  // Sections
  const sectionsHTML = ACTION_SECTIONS.map(sec => {
    const items = bySec[sec.key];
    return `
      <div class="action-section" data-context-section="${sec.key}">
        <div class="action-section-header">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:3px;height:14px;background:${sec.color};border-radius:1px"></div>
            <span class="action-section-name">${sec.label}</span>
            <span class="action-section-count">${items.length}</span>
          </div>
          <button type="button" onclick="openManualActionDialog('${sec.key}')" class="action-add-btn" title="Add">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
        </div>
        ${items.length === 0
          ? `<div class="action-empty">No ${sec.label.toLowerCase()} pending</div>`
          : items.map(a => renderActionRow(a)).join('')
        }
      </div>
    `;
  }).join('');

  return `
    <div class="action-tab-wrap">
      ${calendarHTML}
      ${mobilizationProjects.length > 0 ? `
        <div class="action-section" data-context-section="mobilization" style="border-color:#D29922">
          <div class="action-section-header">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:3px;height:14px;background:#D29922;border-radius:1px"></div>
              <span class="action-section-name" style="color:#D29922">Project Mobilization &mdash; Needs Review</span>
              <span class="action-section-count">${mobilizationProjects.length}</span>
            </div>
          </div>
          <div style="font-size:11px;color:#8B949E;margin-bottom:8px">Newly contracted projects need their mobilization checklist completed to unlock Design + Planning.</div>
          ${mobilizationProjects.map(p => {
            const s = getMobilizationState(p.id);
            const completed = MOBILIZATION_ITEMS.filter(it => s[it.key]).length;
            const total = MOBILIZATION_ITEMS.length;
            const pct = Math.round((completed / total) * 100);
            return `
              <div class="action-row" style="border-color:#D2992233">
                <div class="action-row-main" onclick="openMobilizationDialog(${p.id})">
                  <div class="action-row-text">${esc(p.name)}</div>
                  <div class="action-row-meta">
                    ${p.client_name ? `<span>${esc(p.client_name)}</span>` : ''}
                    <span style="color:#D29922">${completed}/${total} items complete (${pct}%)</span>
                  </div>
                </div>
                <div class="action-row-actions">
                  <button type="button" class="action-btn action-btn-done" onclick="event.stopPropagation();openMobilizationDialog(${p.id})" title="Open mobilization checklist">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
      ${sectionsHTML}
      <div style="text-align:center;margin-top:18px">
        <button type="button" onclick="openActionsArchiveDialog()" class="btn btn-sm" style="font-size:11px;color:#8B949E">View archive</button>
      </div>
    </div>
  `;
}

// Single action row
function renderActionRow(a) {
  const sourceLabel = a.source === 'auto' ? 'Auto'
                    : a.source === 'assigned' ? 'Assigned'
                    : 'Mine';
  const sourceClass = a.source === 'auto' ? 'src-auto'
                    : a.source === 'assigned' ? 'src-assigned'
                    : 'src-mine';
  const ageStr = a.ageDays ? `${a.ageDays}d ago` : '';
  const amountStr = a.amount ? fmt(a.amount) : '';
  const pri = a.priority === 'high';
  const hi = pri ? ' action-row-priority' : '';
  // Apply user-text override if present
  const userText = state.actionsState?.[a.key]?.userText;
  const displayText = userText || a.text;
  const wasEdited = !!userText && userText !== a.text;
  // Assignee badge
  const assignee = a.assigneeId ? getTeamMember(a.assigneeId) : null;
  const assigneeBadge = assignee
    ? `<span class="action-assignee" title="Assigned to ${esc(assignee.name)}"><span class="action-assignee-dot" style="background:${assignee.color || '#1565C0'}">${esc(getInitials(assignee.name))}</span>${esc(assignee.name.split(' ')[0])}</span>`
    : `<span class="action-assignee action-assignee-none">Unassigned</span>`;
  // Map auto-action types to a milestone anchor in the Progress tab
  const anchorMap = {
    'send_quote':       'milestone_proposal_proposal_sent',
    'quote_followup':   'phase_proposal',
    'email_followup':   'phase_proposal',
    'walkthrough':      'phase_lead',
    'design_kickoff':   'milestone_design_kickoff',
    'handoff':          'phase_contract',
    'likely':           'phase_proposal'
  };
  const anchor = a.autoType ? anchorMap[a.autoType] : null;
  const openHandler = a.projectId
    ? (anchor ? `onclick="openProject(${a.projectId},'progress','${anchor}')"` : `onclick="openProject(${a.projectId})"`)
    : '';
  return `
    <div class="action-row${hi}">
      <div class="action-row-main" ${openHandler}>
        <div class="action-row-text">${esc(displayText)}${wasEdited ? ' <span style="font-size:9px;color:#6E7681;font-weight:400">(edited)</span>' : ''}</div>
        <div class="action-row-meta">
          ${a.clientName ? `<span>${esc(a.clientName)}</span>` : ''}
          ${ageStr ? `<span>${ageStr}</span>` : ''}
          ${amountStr ? `<span style="color:#3FB950">${amountStr}</span>` : ''}
          ${assigneeBadge}
          <span class="action-source ${sourceClass}">${sourceLabel}</span>
        </div>
      </div>
      <div class="action-row-actions">
        <button type="button" class="action-btn action-btn-done" onclick="completeAction('${a.key}')" title="Done">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7.5l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="action-btn" onclick="editActionText('${a.key}')" title="Edit">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2l3 3-7 7H2v-3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="action-btn" onclick="snoozeAction('${a.key}')" title="Snooze">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M7 4v3l2 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button type="button" class="action-btn" onclick="dismissAction('${a.key}')" title="Dismiss">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
  `;
}

// ── Calendar widget on Action tab ──
function renderActionCalendarWidget() {
  if (!state.actionCalendarToggles) {
    state.actionCalendarToggles = { booked: true, estimated: true, personal: true };
  }
  const toggles = state.actionCalendarToggles;

  // 7-day strip starting from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const dStr = d.toISOString().substring(0, 10);
    const events = [];
    if (toggles.booked || toggles.estimated) {
      state.projects.forEach(p => {
        if (p.archived) return;
        const dates = (typeof getCalendarDates === 'function') ? getCalendarDates(p) : null;
        if (!dates?.start) return;
        const sd = dates.start.substring(0, 10);
        let inRange = sd === dStr;
        if (!inRange && dates.end) {
          const start = new Date(dates.start);
          const end = new Date(dates.end);
          const check = new Date(dStr);
          inRange = check >= start && check <= end;
        }
        if (!inRange) return;
        if (dates.source === 'booked' && !toggles.booked) return;
        if (dates.source === 'estimated' && !toggles.estimated) return;
        events.push({ id: p.id, name: p.name, source: dates.source });
      });
    }
    days.push({
      date: d,
      dateStr: dStr,
      isToday: i === 0,
      events
    });
  }

  return `
    <div class="action-calendar">
      <div class="action-cal-header">
        <div class="action-cal-title">This Week</div>
        <div class="action-cal-toggles">
          <button type="button" class="action-cal-toggle${toggles.booked ? ' on' : ''}" onclick="toggleActionCalendar('booked')">
            <span class="dot dot-booked"></span>Booked
          </button>
          <button type="button" class="action-cal-toggle${toggles.estimated ? ' on' : ''}" onclick="toggleActionCalendar('estimated')">
            <span class="dot dot-estimated"></span>Estimated
          </button>
          <button type="button" class="action-cal-toggle${toggles.personal ? ' on' : ''}" onclick="toggleActionCalendar('personal')">
            <span class="dot dot-personal"></span>Personal
          </button>
        </div>
      </div>
      <div class="action-cal-strip">
        ${days.map(d => {
          const dayName = d.date.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNum = d.date.getDate();
          return `
            <div class="action-cal-day${d.isToday ? ' today' : ''}${d.events.length > 0 ? ' has-events' : ''}" title="${esc(dayName)} ${dayNum}: ${d.events.length} event${d.events.length === 1 ? '' : 's'}">
              <div class="cal-day-name">${dayName}</div>
              <div class="cal-day-num">${dayNum}</div>
              <div class="cal-day-dots">
                ${d.events.slice(0, 3).map(e => `<span class="cal-day-dot dot-${e.source}"></span>`).join('')}
                ${d.events.length > 3 ? `<span class="cal-day-more">+${d.events.length - 3}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function toggleActionCalendar(key) {
  if (!state.actionCalendarToggles) {
    state.actionCalendarToggles = { booked: true, estimated: true, personal: true };
  }
  state.actionCalendarToggles[key] = !state.actionCalendarToggles[key];
  renderDashboard(document.getElementById('content'));
}

// ── Action lifecycle ──
function _persistActionState() {
  save('vi_actions_state', state.actionsState);
}
function _persistActionArchive() {
  save('vi_actions_archive', state.actionsArchive);
}
function _persistActionsManual() {
  save('vi_actions_manual', state.actionsManual);
}
function _archiveAction(key, status, actionRecord) {
  const entry = {
    key,
    status,
    resolvedAt: new Date().toISOString(),
    resolvedBy: getActiveTeamMemberId(),
    text: actionRecord?.text || '',
    section: actionRecord?.section || '',
    projectId: actionRecord?.projectId || null,
    projectName: actionRecord?.projectName || null,
    autoType: actionRecord?.autoType || null,
    source: actionRecord?.source || null,
    manualEntry: null
  };
  // For manual/assigned actions, preserve the original entry so it can be restored
  if ((actionRecord?.source === 'manual' || actionRecord?.source === 'assigned') && actionRecord?.manualId) {
    const m = state.actionsManual.find(x => x.id === actionRecord.manualId);
    if (m) entry.manualEntry = { ...m };
  }
  if (!state.actionsArchive) state.actionsArchive = [];
  state.actionsArchive.unshift(entry);
  if (state.actionsArchive.length > 500) state.actionsArchive = state.actionsArchive.slice(0, 500);
  _persistActionArchive();
}

// Find an action by key from current build (need it for archive context)
function _findCurrentAction(key) {
  const memberId = getActiveTeamMemberId();
  const activeProjects = state.projects.filter(p => !p.archived);
  // Use department mode so we find ALL actions, not just user's
  const all = buildSalesActions(activeProjects, memberId, 'department');
  return all.find(a => a.key === key);
}

function completeAction(key) {
  const a = _findCurrentAction(key);
  if (!a) return;
  state.actionsState[key] = { status: 'done', resolvedAt: new Date().toISOString() };
  _persistActionState();
  // Project state change for auto actions
  if (a.source === 'auto' && a.projectId && a.autoType) {
    handleAutoActionCompletion(a);
  }
  // If manual, remove the manual entry
  if (a.source === 'manual' || a.source === 'assigned') {
    if (a.manualId) {
      state.actionsManual = state.actionsManual.filter(m => m.id !== a.manualId);
      _persistActionsManual();
    }
  }
  _archiveAction(key, 'done', a);
  showToast(`Marked done: ${a.text}`, 'success');
  renderDashboard(document.getElementById('content'));
}

function snoozeAction(key) {
  // Show options
  const options = [
    { label: '1 day',  ms: 1 * 86400000 },
    { label: '3 days', ms: 3 * 86400000 },
    { label: '1 week', ms: 7 * 86400000 },
    { label: '2 weeks', ms: 14 * 86400000 }
  ];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'snooze-picker';
  overlay.innerHTML = `
    <div class="modal-container" style="max-width:280px">
      <div class="modal-header">
        <div class="modal-title">Snooze for...</div>
        <button class="modal-close" onclick="document.getElementById('snooze-picker')?.remove()">&times;</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:6px">
        ${options.map(o => `<button type="button" class="btn" onclick="confirmSnooze('${key}', ${o.ms})" style="padding:10px;text-align:left">${o.label}</button>`).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function confirmSnooze(key, ms) {
  document.getElementById('snooze-picker')?.remove();
  const a = _findCurrentAction(key);
  if (!a) return;
  state.actionsState[key] = {
    status: 'snoozed',
    resolvedAt: new Date().toISOString(),
    snoozeUntil: new Date(Date.now() + ms).toISOString()
  };
  _persistActionState();
  showToast(`Snoozed: ${a.text}`, 'info');
  renderDashboard(document.getElementById('content'));
}

function dismissAction(key) {
  const a = _findCurrentAction(key);
  if (!a) return;
  state.actionsState[key] = { status: 'dismissed', resolvedAt: new Date().toISOString() };
  _persistActionState();
  if (a.source === 'manual' || a.source === 'assigned') {
    if (a.manualId) {
      state.actionsManual = state.actionsManual.filter(m => m.id !== a.manualId);
      _persistActionsManual();
    }
  }
  _archiveAction(key, 'dismissed', a);
  showToast(`Dismissed: ${a.text}`, 'info');
  renderDashboard(document.getElementById('content'));
}

// ── Auto-action completion handlers — apply project state changes ──
function handleAutoActionCompletion(a) {
  const p = state.projects.find(pr => pr.id === a.projectId);
  if (!p) return;
  const now = new Date().toISOString();
  switch (a.autoType) {
    case 'send_quote': {
      // Mark proposal_sent milestone done, advance to proposal stage if still in lead
      setMilestone(p.id, 'proposal', 'proposal_sent', true);
      if (p.stage === 'lead') p.stage = 'proposal';
      state.recentActivity[p.id] = now;
      save('vi_projects_cache', state.projects);
      break;
    }
    case 'quote_followup':
    case 'email_followup': {
      // Touch the project so the trigger silences for 7 more days
      state.recentActivity[p.id] = now;
      break;
    }
    case 'walkthrough': {
      // Add walkthrough meeting log entry
      if (typeof setMeetingLog === 'function') {
        setMeetingLog(p.id, 'walkthrough', { notes: 'Walkthrough completed (logged from Action)', date: now });
      }
      state.recentActivity[p.id] = now;
      break;
    }
    case 'design_kickoff': {
      if (typeof setMeetingLog === 'function') {
        setMeetingLog(p.id, 'design_kickoff', { notes: 'Design kickoff completed (logged from Action)', date: now });
      }
      state.recentActivity[p.id] = now;
      break;
    }
    case 'handoff': {
      if (typeof markContractReviewed === 'function') {
        markContractReviewed(p.id);
      }
      break;
    }
    case 'likely': {
      // No state change — likely flag stays until manually changed
      break;
    }
  }
}

// ── Manual action dialog ──
function openManualActionDialog(presetSection) {
  document.getElementById('manual-action-dialog')?.remove();
  const memberId = getActiveTeamMemberId();
  const teamForAssign = state.team.filter(m => !m.archived);
  const overlay = document.createElement('div');
  overlay.id = 'manual-action-dialog';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-container" style="max-width:420px">
      <div class="modal-header">
        <div class="modal-title">Add Action</div>
        <button class="modal-close" onclick="document.getElementById('manual-action-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label class="form-label">Category</label>
            <select id="ma-section" class="form-input">
              <option value="quote"${presetSection === 'quote' ? ' selected' : ''}>Quote</option>
              <option value="email"${presetSection === 'email' ? ' selected' : ''}>Email</option>
              <option value="meeting"${presetSection === 'meeting' ? ' selected' : ''}>Meeting</option>
              <option value="other"${presetSection === 'other' || !['quote','email','meeting'].includes(presetSection) ? ' selected' : ''}>Misc Tasks</option>
            </select>
          </div>
          <div>
            <label class="form-label">Text</label>
            <input type="text" id="ma-text" class="form-input" placeholder="What needs to happen?" autofocus>
          </div>
          <div>
            <label class="form-label">Project (optional)</label>
            <button type="button" id="ma-project-btn" class="form-input" onclick="pickProjectForManualAction()" style="text-align:left;cursor:pointer">
              <span id="ma-project-display" style="color:#6E7681">No project</span>
            </button>
            <input type="hidden" id="ma-project-id" value="">
          </div>
          <div>
            <label class="form-label">Assigned to</label>
            <select id="ma-assignee" class="form-input">
              ${teamForAssign.map(m => `<option value="${m.id}"${m.id === memberId ? ' selected' : ''}>${esc(m.name)}${m.id === memberId ? ' (me)' : ''}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button type="button" class="btn" onclick="document.getElementById('manual-action-dialog')?.remove()" style="flex:1">Cancel</button>
          <button type="button" class="btn-primary" onclick="saveManualAction()" style="flex:2">Add</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function pickProjectForManualAction() {
  quickActionProjectPicker('Link to project', (id) => {
    const p = state.projects.find(pr => pr.id === id);
    if (!p) return;
    document.getElementById('ma-project-id').value = String(id);
    const disp = document.getElementById('ma-project-display');
    if (disp) {
      disp.textContent = p.name;
      disp.style.color = '#E6EDF3';
    }
  });
}

function saveManualAction() {
  const section = document.getElementById('ma-section').value;
  const text = document.getElementById('ma-text').value.trim();
  const projectIdRaw = document.getElementById('ma-project-id').value;
  const projectId = projectIdRaw ? parseInt(projectIdRaw, 10) : null;
  const assigneeId = document.getElementById('ma-assignee').value || null;
  if (!text) {
    showToast('Action text required', 'warn');
    return;
  }
  const entry = {
    id: Date.now(),
    section,
    text,
    projectId,
    assigneeId: assigneeId ? parseInt(assigneeId, 10) : null,
    createdBy: getActiveTeamMemberId(),
    createdAt: new Date().toISOString()
  };
  if (!state.actionsManual) state.actionsManual = [];
  state.actionsManual.push(entry);
  _persistActionsManual();
  document.getElementById('manual-action-dialog')?.remove();
  showToast('Action added', 'success');
  renderDashboard(document.getElementById('content'));
}

// ── Archive dialog ──
function openActionsArchiveDialog() {
  document.getElementById('actions-archive-dialog')?.remove();
  const items = state.actionsArchive || [];
  const overlay = document.createElement('div');
  overlay.id = 'actions-archive-dialog';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-container" style="max-width:520px;max-height:80vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <div>
          <div class="modal-title">Action Archive</div>
          <div class="modal-sub">${items.length} resolved item${items.length === 1 ? '' : 's'}</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('actions-archive-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body" id="archive-body" style="overflow-y:auto;flex:1;min-height:0">
        ${renderArchiveBody()}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function renderArchiveBody() {
  const items = state.actionsArchive || [];
  if (items.length === 0) {
    return '<div style="font-size:12px;color:#6E7681;text-align:center;padding:20px;font-style:italic">No archived actions yet</div>';
  }
  return items.slice(0, 100).map((it, idx) => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;background:#0D1117;border:1px solid #1C2333;border-radius:6px;margin-bottom:4px">
      <div style="width:20px;height:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center">
        ${it.status === 'done'
          ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7.5l3.5 3.5L12 4" stroke="#3FB950" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          : '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="#6E7681" stroke-width="1.6" stroke-linecap="round"/></svg>'
        }
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:${it.status === 'done' ? '#C9D1D9' : '#8B949E'};text-decoration:${it.status === 'dismissed' ? 'line-through' : 'none'}">${esc(it.text)}</div>
        <div style="font-size:10px;color:#6E7681;margin-top:2px">${it.status === 'done' ? 'Done' : 'Dismissed'} &middot; ${fmtDate(it.resolvedAt)}${it.projectName ? ' &middot; ' + esc(it.projectName) : ''}</div>
      </div>
      <button type="button" class="btn btn-sm" onclick="restoreArchivedAction(${idx})" style="font-size:10px;padding:3px 8px;flex-shrink:0" title="Restore as incomplete">Restore</button>
    </div>
  `).join('');
}

// Restore an archived action — full reversal for Done items, simple restore for Dismissed.
function restoreArchivedAction(idx) {
  const items = state.actionsArchive || [];
  const item = items[idx];
  if (!item) return;

  if (item.status === 'done' && item.autoType) {
    // Done auto-action — confirm reversal of propagated state changes
    document.getElementById('restore-confirm-dialog')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'restore-confirm-dialog';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '1100';
    overlay.innerHTML = `
      <div class="modal-container" style="max-width:420px">
        <div class="modal-header">
          <div class="modal-title">Restore action?</div>
          <button class="modal-close" onclick="document.getElementById('restore-confirm-dialog')?.remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div style="font-size:13px;color:#C9D1D9;line-height:1.5;margin-bottom:14px">
            "<strong>${esc(item.text)}</strong>" was marked Done. Restoring will return it to your active list.
          </div>
          <div style="background:#0D1117;border:1px solid #1C2333;border-radius:6px;padding:10px 12px;margin-bottom:14px">
            <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12px;color:#E6EDF3">
              <input type="checkbox" id="undo-state-changes" checked style="margin-top:2px">
              <span>Also reverse the linked project state change<br><span style="font-size:10px;color:#8B949E">${esc(_describeAutoTypeReversal(item.autoType))}</span></span>
            </label>
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn" onclick="document.getElementById('restore-confirm-dialog')?.remove()" style="flex:1">Cancel</button>
            <button type="button" class="btn-primary" onclick="_doRestore(${idx})" style="flex:2">Restore</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    // Dismissed or non-auto — simple restore
    _doRestore(idx, false);
  }
}

function _describeAutoTypeReversal(autoType) {
  const map = {
    'send_quote': 'Will uncheck the "Proposal sent" milestone',
    'quote_followup': 'Will reset the activity timestamp',
    'email_followup': 'Will reset the activity timestamp',
    'walkthrough': 'Will remove the auto-logged walkthrough meeting entry',
    'design_kickoff': 'Will remove the kickoff meeting entry and uncheck the milestone',
    'handoff': 'Will return the contract to "needs review" status',
    'likely': 'No state change to reverse'
  };
  return map[autoType] || 'No state change to reverse';
}

function _doRestore(idx, askedAboutReversal) {
  const items = state.actionsArchive || [];
  const item = items[idx];
  if (!item) return;
  const undo = askedAboutReversal === false ? false : (document.getElementById('undo-state-changes')?.checked ?? false);

  // Remove from archive
  items.splice(idx, 1);
  save('vi_actions_archive', items);

  // Clear actionsState entry so the auto-action surfaces again
  if (state.actionsState[item.key]) {
    delete state.actionsState[item.key];
    _persistActionState();
  }

  // For manual actions, we need to restore the original entry
  if (item.source === 'manual' || item.source === 'assigned') {
    if (item.manualEntry) {
      // Re-add to actionsManual
      const max = state.actionsManual.reduce((m, a) => Math.max(m, a.id || 0), 0);
      const restored = { ...item.manualEntry, id: max + 1 };
      state.actionsManual.push(restored);
      _persistActionsManual();
    }
  }

  // Reverse state propagation if requested
  if (undo && item.status === 'done' && item.autoType && item.projectId) {
    _reverseAutoActionPropagation(item);
  }

  // Close dialogs and refresh
  document.getElementById('restore-confirm-dialog')?.remove();
  document.getElementById('actions-archive-dialog')?.remove();
  showToast('Action restored', 'success');
  renderCurrentPage();
  // Re-open archive after a tick so user sees updated list
  setTimeout(() => openActionsArchiveDialog(), 100);
}

function _reverseAutoActionPropagation(item) {
  const projectId = item.projectId;
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;

  switch (item.autoType) {
    case 'send_quote': {
      // Uncheck proposal_sent milestone
      const phaseKey = 'proposal';
      const milestoneKey = 'proposal_sent';
      if (state.milestones?.[projectId]?.[phaseKey]) {
        delete state.milestones[projectId][phaseKey][milestoneKey];
        save('vi_milestones', state.milestones);
      }
      break;
    }
    case 'walkthrough': {
      // Remove auto-logged walkthrough meeting
      if (state.meetingLogs?.[projectId]?.walkthrough?.source === 'action_completion') {
        delete state.meetingLogs[projectId].walkthrough;
        save('vi_meeting_logs', state.meetingLogs);
      }
      break;
    }
    case 'design_kickoff': {
      // Remove auto-logged kickoff + uncheck milestone
      if (state.meetingLogs?.[projectId]?.design_kickoff?.source === 'action_completion') {
        delete state.meetingLogs[projectId].design_kickoff;
        save('vi_meeting_logs', state.meetingLogs);
      }
      if (state.milestones?.[projectId]?.design?.kickoff) {
        delete state.milestones[projectId].design.kickoff;
        save('vi_milestones', state.milestones);
      }
      break;
    }
    case 'handoff': {
      // Mark contract back as needing review (clear the reviewed flag)
      if (p.contract_reviewed_at) {
        delete p.contract_reviewed_at;
        save('vi_projects', state.projects);
      }
      break;
    }
    case 'quote_followup':
    case 'email_followup': {
      // Reset activity timestamp (set to old date that triggers follow-up again)
      if (state.recentActivity?.[projectId]) {
        const old = new Date();
        old.setDate(old.getDate() - 8);
        state.recentActivity[projectId] = old.toISOString();
        save('vi_recent_activity', state.recentActivity);
      }
      break;
    }
  }
}

// ── Sales Department Kanban (4 columns) ──
// 4 columns side-by-side: Lead / Proposal / Sent / Contract (needs review only).
// Uses the same column layout as Full Pipeline but with compact card style.
function renderSalesKanban(activeProjects, needsReview) {
  const SALES_STAGES = STAGES.filter(s => ['lead','proposal','sent','contract'].includes(s.key));
  const byStage = {};
  SALES_STAGES.forEach(s => byStage[s.key] = []);

  activeProjects.forEach(p => {
    if (p.stage === 'contract') {
      if (isContractNeedsReview(p)) byStage.contract.push(p);
    } else if (byStage[p.stage]) {
      byStage[p.stage].push(p);
    }
  });

  SALES_STAGES.forEach(s => {
    byStage[s.key] = sortByColumnOrder(byStage[s.key], s.key);
  });

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <div style="font-size:11px;font-weight:700;color:#8B949E;text-transform:uppercase;letter-spacing:0.1em">Pipeline</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="display:flex;background:#0D1117;border:1px solid #30363D;border-radius:6px;overflow:hidden;font-size:11px">
          <div onclick="if(state.timelineMode!=='estimated')toggleTimelineMode()" style="padding:5px 12px;cursor:pointer;transition:all 0.15s;${state.timelineMode === 'estimated' ? 'background:#1565C0;color:#58A6FF;font-weight:500' : 'color:#6E7681'}">Estimated</div>
          <div onclick="if(state.timelineMode!=='booked')toggleTimelineMode()" style="padding:5px 12px;cursor:pointer;transition:all 0.15s;${state.timelineMode === 'booked' ? 'background:#1565C0;color:#58A6FF;font-weight:500' : 'color:#6E7681'}">Booked</div>
        </div>
      </div>
    </div>

    <div class="pipeline-grid sales-kanban" style="margin-bottom:16px">
      ${SALES_STAGES.map(s => {
        const col = byStage[s.key] || [];
        const LIMIT = 12;
        const expanded = !!state.expandedCols[s.key];
        const visible = expanded ? col : col.slice(0, LIMIT);
        const hiddenCount = col.length - LIMIT;
        const isContractCol = s.key === 'contract';
        return `
        <div data-context-section="${s.key}" class="pipeline-col${col.length === 0 ? ' pipeline-col-empty' : ''}" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDropStage(event, '${s.key}')">
          <div class="pipeline-col-header">
            <span class="pipeline-col-name">${s.label}${isContractCol ? ' <span style="font-weight:400;color:#8B949E;font-size:10px">(review)</span>' : ''}</span>
            <span class="pipeline-col-count">${col.length}</span>
          </div>
          ${visible.length === 0 ? '<div class="empty-state" style="padding:20px 10px;font-size:12px">No projects</div>' : visible.map(p => renderSalesKanbanCard(p, s)).join('')}
          ${!expanded && hiddenCount > 0 ? `<div onclick="event.stopPropagation();toggleColExpanded('${s.key}')" style="text-align:center;padding:8px 6px;font-size:11px;color:#58A6FF;cursor:pointer;border-top:1px solid #1C2333;margin-top:4px;-webkit-tap-highlight-color:transparent">+${hiddenCount} more</div>` : ''}
          ${expanded && col.length > LIMIT ? `<div onclick="event.stopPropagation();toggleColExpanded('${s.key}')" style="text-align:center;padding:8px 6px;font-size:11px;color:#6E7681;cursor:pointer;border-top:1px solid #1C2333;margin-top:4px;-webkit-tap-highlight-color:transparent">Show less ↑</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

// Compact card used inside the Sales Kanban columns.
// Tighter padding, less vertical space, combined info rows.
function renderSalesKanbanCard(p, stage) {
  const gbbTier = getGBBTier(p.id);
  const likely = isLikelyToClose(p.id);
  const needsReview = isContractNeedsReview(p);
  const dt = getInstallDateDisplay(p);

  const borderStyle = needsReview
    ? 'border-color:#DA3633'
    : (likely ? 'border-color:#238636' : '');

  const gbbBadge = gbbTier
    ? '<span style="font-size:8px;font-weight:700;padding:1px 4px;border-radius:2px;background:' +
      (gbbTier === 'better' ? '#0D1626;color:#58A6FF;border:1px solid #1565C0' :
       gbbTier === 'best'   ? '#0D1A0E;color:#3FB950;border:1px solid #238636' :
                              '#161B22;color:#6E7681;border:1px solid #30363D') +
      '">' + gbbTier.toUpperCase() + '</span>'
    : '';

  const banner = likely
    ? '<div style="background:#238636;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;margin-bottom:4px;text-align:center;letter-spacing:0.05em">LIKELY TO CLOSE</div>'
    : needsReview
      ? '<div style="background:#DA3633;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;margin-bottom:4px;text-align:center;letter-spacing:0.05em">REVIEW &mdash; SEND TO DESIGN &amp; INSTALL</div>'
      : '';

  const valueDisplay = canSee('financials') ? fmt(p.total) : '';

  const tags = p.systems.length
    ? '<div class="sk-compact-tags">' + p.systems.slice(0, 2).map(systemTagHTML).join('') + (p.systems.length > 2 ? '<span style="font-size:9px;color:#6E7681;padding:1px 3px">+' + (p.systems.length - 2) + '</span>' : '') + '</div>'
    : '';

  return (
    '<div class="project-card sk-compact-card' + (likely ? ' likely-card' : '') + '"' +
      ' draggable="true"' +
      ' ondragstart="onReorderDragStart(event, ' + p.id + ', \'' + stage.key + '\')"' +
      ' ondragend="onDragEnd(event)"' +
      ' ondragover="event.preventDefault()"' +
      ' ondrop="onReorderDrop(event, ' + p.id + ', \'' + stage.key + '\')"' +
      ' onclick="openProject(' + p.id + ')"' +
      ' style="' + borderStyle + '">' +
      banner +
      '<div class="sk-compact-top">' +
        '<div class="sk-compact-name">' + esc(p.name) + '</div>' +
        (gbbBadge ? '<div style="flex-shrink:0">' + gbbBadge + '</div>' : '') +
      '</div>' +
      '<div class="sk-compact-client">' + esc(p.client_name || 'No client') +
        (p.city ? ' &middot; ' + esc(p.city) : '') +
      '</div>' +
      '<div class="sk-compact-meta">' +
        (valueDisplay ? '<span class="sk-compact-value">' + valueDisplay + '</span>' : '') +
        '<span class="sk-compact-date" style="color:' + dt.color + '">' + dt.value + '</span>' +
      '</div>' +
      (tags ? tags : '') +
      '<button class="move-btn sk-compact-move" onclick="event.stopPropagation();showMoveMenu(' + p.id + ', event)" title="Move">⋮</button>' +
    '</div>'
  );
}


// ═══════════════════════════════════════════════════════════════════
// MOBILE BOTTOM CONTEXTUAL NAV
// A second nav bar that sits above the global bottom nav.
// Content depends on current page: project tabs on project pages,
// section anchors on dashboards. Hides when there's no context.
// ═══════════════════════════════════════════════════════════════════

function ensureContextNavElement() {
  let el = document.getElementById('context-nav');
  if (!el) {
    el = document.createElement('div');
    el.id = 'context-nav';
    el.innerHTML = '<div class="ctx-nav-scroll"><div class="ctx-nav-inner"></div></div><div class="ctx-nav-fade"></div>';
    document.body.appendChild(el);
    // Single delegated click handler — more robust than inline onclick attributes
    el.addEventListener('click', function(ev) {
      const chip = ev.target.closest('.ctx-chip');
      if (!chip) return;
      ev.preventDefault();
      ev.stopPropagation();
      // Update active state immediately for visual feedback
      const allChips = el.querySelectorAll('.ctx-chip');
      allChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const action = chip.getAttribute('data-action');
      const arg = chip.getAttribute('data-arg');
      handleContextChipClick(action, arg);
    }, true);
  }
  return el;
}

// Handles the click action for a chip — driven by data-action / data-arg attributes
function handleContextChipClick(action, arg) {
  if (action === 'switchTab') {
    if (typeof switchProjectTab === 'function') switchProjectTab(arg);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (action === 'scrollSection') {
    scrollToContextSection(arg);
  }
}

// Called after every page render to update the contextual nav.
function updateContextNav() {
  const nav = ensureContextNavElement();
  const inner = nav.querySelector('.ctx-nav-inner');

  // Determine context: project page or dashboard page?
  const page = state.currentPage;
  let chips = [];

  if (page === 'project' && state.currentProject) {
    // Project page tabs (from prail items)
    const railItems = [
      { key: 'overview', label: 'Overview' },
      { key: 'progress', label: 'Progress' },
      { key: 'details',  label: 'Details'  },
      { key: 'design',   label: 'Design'   },
      { key: 'install',  label: 'Install'  },
      { key: 'location', label: 'Location' },
      { key: 'files',    label: 'Files'    },
      { key: 'notes',    label: 'Notes'    }
    ];
    const activeTab = state.projectTab || 'overview';
    chips = railItems.map(it => ({
      key: it.key,
      label: it.label,
      active: it.key === activeTab,
      action: 'switchTab',
      arg: it.key
    }));
  } else if (page === 'dashboard') {
    chips = getDashboardContextChips();
  }

  if (chips.length === 0) {
    nav.classList.remove('active');
    document.body.classList.remove('has-context-nav');
    inner.innerHTML = '';
    return;
  }

  nav.classList.add('active');
  document.body.classList.add('has-context-nav');
  inner.innerHTML = chips.map(c => (
    `<button type="button" class="ctx-chip${c.active ? ' active' : ''}" data-action="${c.action}" data-arg="${c.arg || ''}">${esc(c.label)}</button>`
  )).join('');

  // After paint, scroll the active chip into view if needed
  requestAnimationFrame(() => {
    const activeChip = inner.querySelector('.ctx-chip.active');
    if (activeChip) activeChip.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
    updateContextNavFade();
  });
}

// Returns chips for the current dashboard mode.
// Hand-curated per mode (will iterate on these as we nail dashboards).
function getDashboardContextChips() {
  const mode = state.dashboardMode || 'mine';

  if (mode === 'sales_mgmt') {
    const subtab = state.salesDashTab || 'action';
    if (subtab === 'pipeline') {
      return [
        { key: 'lead',     label: 'Lead',     action: 'scrollSection', arg: 'lead' },
        { key: 'proposal', label: 'Proposal', action: 'scrollSection', arg: 'proposal' },
        { key: 'sent',     label: 'Sent',     action: 'scrollSection', arg: 'sent' },
        { key: 'contract', label: 'Contract', action: 'scrollSection', arg: 'contract' }
      ];
    }
    // Action tab — chips for each section
    return [
      { key: 'quote',   label: 'Quotes',   action: 'scrollSection', arg: 'quote' },
      { key: 'email',   label: 'Emails',   action: 'scrollSection', arg: 'email' },
      { key: 'meeting', label: 'Meetings', action: 'scrollSection', arg: 'meeting' },
      { key: 'likely',  label: 'Likely',   action: 'scrollSection', arg: 'likely' },
      { key: 'notify',  label: 'Notify',   action: 'scrollSection', arg: 'notify' },
      { key: 'other',   label: 'Misc',    action: 'scrollSection', arg: 'other' }
    ];
  }
  if (mode === 'design_mgmt') {
    return [
      { key: 'metrics',     label: 'Top',        action: 'scrollSection', arg: 'metrics' },
      { key: 'kickoff',     label: 'Kickoff',    action: 'scrollSection', arg: 'kickoff' },
      { key: 'handoff',     label: 'Handoff',    action: 'scrollSection', arg: 'handoff' },
      { key: 'queue',       label: 'Queue',      action: 'scrollSection', arg: 'queue' },
      { key: 'templates',   label: 'Templates',  action: 'scrollSection', arg: 'templates' }
    ];
  }
  if (mode === 'install_mgmt') {
    return [
      { key: 'metrics',     label: 'Top',         action: 'scrollSection', arg: 'metrics' },
      { key: 'this-week',   label: 'This Week',   action: 'scrollSection', arg: 'this-week' },
      { key: 'planning',    label: 'Planning',    action: 'scrollSection', arg: 'planning' },
      { key: 'ready',       label: 'Ready',       action: 'scrollSection', arg: 'ready' },
      { key: 'prep',        label: 'Prep',        action: 'scrollSection', arg: 'prep' },
      { key: 'in_install',  label: 'In Install',  action: 'scrollSection', arg: 'in_install' },
      { key: 'closeout',    label: 'Closeout',    action: 'scrollSection', arg: 'closeout' }
    ];
  }
  if (mode === 'executive') {
    return [
      { key: 'metrics',     label: 'Metrics',    action: 'scrollSection', arg: 'metrics' },
      { key: 'pipeline',    label: 'Pipeline',   action: 'scrollSection', arg: 'pipeline' },
      { key: 'attention',   label: 'Attention',  action: 'scrollSection', arg: 'attention' },
      { key: 'activity',    label: 'Activity',   action: 'scrollSection', arg: 'activity' }
    ];
  }
  if (mode === 'pipeline') {
    return [
      { key: 'lead',      label: 'Lead',      action: 'scrollSection', arg: 'lead' },
      { key: 'proposal',  label: 'Proposal',  action: 'scrollSection', arg: 'proposal' },
      { key: 'sent',      label: 'Sent',      action: 'scrollSection', arg: 'sent' },
      { key: 'contract', label: 'Contract', action: 'scrollSection', arg: 'contract' },
      { key: 'design',   label: 'Design',   action: 'scrollSection', arg: 'design' },
      { key: 'install',  label: 'Install',  action: 'scrollSection', arg: 'install' },
      { key: 'complete', label: 'Complete', action: 'scrollSection', arg: 'complete' }
    ];
  }
  // 'mine' — My Work — show only role sections present for the user
  if (mode === 'mine') {
    const memberId = getActiveTeamMemberId();
    const activeProjects = state.projects.filter(p => !p.archived);
    const myAssignments = computeMyAssignments(memberId, activeProjects);
    const closeouts = getMyCloseoutProjects(memberId);
    const chips = [];
    if (closeouts.length > 0) chips.push({ key: 'closeout', label: 'Closeout', action: 'scrollSection', arg: 'closeout' });
    if (myAssignments.sales?.length)     chips.push({ key: 'sales',     label: 'Sales',     action: 'scrollSection', arg: 'sales' });
    if (myAssignments.design?.length)    chips.push({ key: 'design',    label: 'Design',    action: 'scrollSection', arg: 'design' });
    if (myAssignments.pm?.length)        chips.push({ key: 'pm',        label: 'PM',        action: 'scrollSection', arg: 'pm' });
    if (myAssignments.install?.length)   chips.push({ key: 'install',   label: 'Install',   action: 'scrollSection', arg: 'install' });
    if (myAssignments.warehouse?.length) chips.push({ key: 'warehouse', label: 'Warehouse', action: 'scrollSection', arg: 'warehouse' });
    return chips;
  }
  return [];
}

// Scroll to an element by data-context-section attribute, accounting for context nav height
function scrollToContextSection(key) {
  const target = document.querySelector(`[data-context-section="${key}"]`);
  // Find the actual scrolling container — could be window OR #content depending on layout
  const content = document.getElementById('content');
  const scroller = (content && content.scrollHeight > content.clientHeight) ? content : window;
  if (!target) {
    if (scroller === window) window.scrollTo({ top: 0, behavior: 'smooth' });
    else scroller.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const offset = 16;
  if (scroller === window) {
    const rect = target.getBoundingClientRect();
    const top = window.scrollY + rect.top - offset - 4;
    window.scrollTo({ top, behavior: 'smooth' });
  } else {
    // For container scrolling, compute target's offsetTop within the scroller
    const containerRect = scroller.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = scroller.scrollTop + (targetRect.top - containerRect.top) - offset;
    scroller.scrollTo({ top, behavior: 'smooth' });
  }
}

// Just scroll to top after switching project tabs so the user sees the new content
function scrollContextNavTo(tabKey) {
  const content = document.getElementById('content');
  const scroller = (content && content.scrollHeight > content.clientHeight) ? content : window;
  if (scroller === window) window.scrollTo({ top: 0, behavior: 'smooth' });
  else scroller.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update fade indicator on the context nav (so user knows there's more)
function updateContextNavFade() {
  const nav = document.getElementById('context-nav');
  if (!nav) return;
  const scroll = nav.querySelector('.ctx-nav-scroll');
  const fade = nav.querySelector('.ctx-nav-fade');
  if (!scroll || !fade) return;
  const atEnd = scroll.scrollLeft >= (scroll.scrollWidth - scroll.clientWidth - 4);
  fade.style.opacity = atEnd ? '0' : '1';
}

// Wire up scroll listener once
(function initContextNav() {
  if (window._ctxNavInit) return;
  window._ctxNavInit = true;
  document.addEventListener('scroll', () => {}, { passive: true });
  // Listen for scroll on the context nav itself for fade update
  setTimeout(() => {
    const nav = document.getElementById('context-nav');
    const scroll = nav?.querySelector('.ctx-nav-scroll');
    if (scroll) scroll.addEventListener('scroll', updateContextNavFade, { passive: true });
  }, 100);
  window.addEventListener('resize', updateContextNavFade);
})();
// ── Shop Work ──
// Shape: { id, text, assignee_id, priority, project_id, status: 'open'|'done', created, completed }
function migrateShopWork() {
  let changed = false;
  state.shopwork.forEach(t => {
    if (!t.id) { t.id = Date.now() + Math.random(); changed = true; }
    if (t.assignee && !t.assignee_id) {
      // Try to match by name
      const m = state.team.find(tm => tm.name === t.assignee);
      if (m) { t.assignee_id = m.id; changed = true; }
    }
    if (!t.status) { t.status = 'open'; changed = true; }
    if (t.project && typeof t.project === 'string' && !t.project_id) {
      const p = state.projects.find(pr => pr.name === t.project);
      if (p) { t.project_id = p.id; changed = true; }
    }
  });
  if (changed) save('vi_shopwork', state.shopwork);
}

function getShopWorkForProject(projectId) {
  return state.shopwork.filter(t => t.project_id === projectId);
}

function areAllShopTasksDoneForProject(projectId) {
  const tasks = getShopWorkForProject(projectId);
  if (tasks.length === 0) return false;
  return tasks.every(t => t.status === 'done');
}

function renderShopWork(c) {
  migrateShopWork();
  const tasks = state.shopwork;
  const filter = state.shopWorkFilter || 'open';
  const activeMember = getTeamMember(getActiveTeamMemberId());

  let visible = tasks;
  if (filter === 'open') visible = tasks.filter(t => t.status !== 'done');
  else if (filter === 'done') visible = tasks.filter(t => t.status === 'done');
  else if (filter === 'unassigned') visible = tasks.filter(t => !t.assignee_id && t.status !== 'done');
  else if (filter === 'mine') visible = tasks.filter(t => t.assignee_id === activeMember?.id && t.status !== 'done');

  const openCount = tasks.filter(t => t.status !== 'done').length;
  const myOpenCount = tasks.filter(t => t.assignee_id === activeMember?.id && t.status !== 'done').length;
  const unassignedCount = tasks.filter(t => !t.assignee_id && t.status !== 'done').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  c.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div class="section-title" style="margin:0">Shop Work Queue</div>
      <button class="btn-primary" onclick="showShopWorkDialog()" style="padding:8px 14px;font-size:13px">+ Add Task</button>
    </div>

    <!-- Filter tabs -->
    <div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">
      ${[
        { key: 'open', label: 'Open', count: openCount, color: '#58A6FF' },
        { key: 'mine', label: 'Mine', count: myOpenCount, color: '#3FB950' },
        { key: 'unassigned', label: 'Unassigned', count: unassignedCount, color: '#D29922' },
        { key: 'done', label: 'Done', count: doneCount, color: '#6E7681' },
        { key: 'all', label: 'All', count: tasks.length, color: '#8B949E' }
      ].map(f => `
        <div onclick="state.shopWorkFilter='${f.key}';renderShopWork(document.getElementById('content'))" style="padding:6px 12px;font-size:11px;font-weight:500;border-radius:6px;cursor:pointer;background:${filter === f.key ? f.color + '22' : '#161B22'};color:${filter === f.key ? f.color : '#8B949E'};border:1px solid ${filter === f.key ? f.color + '66' : '#1C2333'};-webkit-tap-highlight-color:transparent">
          ${f.label}${f.count > 0 ? ` <span style="opacity:0.7;margin-left:3px">${f.count}</span>` : ''}
        </div>
      `).join('')}
    </div>

    ${visible.length === 0 ? `
      <div class="card" style="padding:40px 20px;text-align:center">
        <div style="font-size:32px;opacity:0.4;margin-bottom:8px">🔧</div>
        <div style="font-size:14px;color:#8B949E">${filter === 'open' ? 'No open shop work tasks' : filter === 'mine' ? 'Nothing assigned to you' : filter === 'unassigned' ? 'Everything is assigned' : filter === 'done' ? 'No completed tasks' : 'No shop work tasks'}</div>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:6px">
        ${visible.map(t => renderShopWorkItem(t)).join('')}
      </div>
    `}
  `;
}

function renderShopWorkItem(t) {
  const assignee = t.assignee_id ? getTeamMember(t.assignee_id) : null;
  const project = t.project_id ? state.projects.find(p => p.id === t.project_id) : null;
  const priorityColors = { high: '#F85149', med: '#D29922', low: '#6E7681' };
  const priorityColor = priorityColors[t.priority] || '#6E7681';
  const isDone = t.status === 'done';

  return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#161B22;border:1px solid #1C2333;border-radius:6px;${isDone ? 'opacity:0.5' : ''}">
      <!-- Priority dot -->
      <div style="width:8px;height:8px;border-radius:50%;background:${priorityColor};flex-shrink:0" title="${t.priority || 'low'} priority"></div>

      <!-- Main content -->
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:#E6EDF3;${isDone ? 'text-decoration:line-through' : ''}">${esc(t.text)}</div>
        <div style="display:flex;gap:10px;margin-top:3px;font-size:11px;color:#6E7681;flex-wrap:wrap">
          ${assignee ? `<span>${esc(assignee.name)}</span>` : '<span style="color:#D29922">Unassigned</span>'}
          ${project ? `<span onclick="openProject(${project.id})" style="color:#58A6FF;cursor:pointer;-webkit-tap-highlight-color:transparent">${esc(project.name)}</span>` : ''}
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="btn btn-sm" onclick="showShopWorkDialog(${t.id})" style="font-size:11px;padding:4px 8px">Edit</button>
        ${!isDone ? `<button class="btn btn-sm" onclick="completeShopWork(${t.id})" style="font-size:11px;padding:4px 8px;color:#3FB950;border-color:#238636">Done</button>` : `<button class="btn btn-sm" onclick="reopenShopWork(${t.id})" style="font-size:11px;padding:4px 8px">Reopen</button>`}
        <button class="btn btn-sm" onclick="removeShopWork(${t.id})" style="font-size:11px;padding:4px 8px;color:#8B949E" title="Delete">×</button>
      </div>
    </div>
  `;
}

function showShopWorkDialog(taskId) {
  const task = taskId ? state.shopwork.find(t => t.id === taskId) : null;
  const isEdit = !!task;
  document.getElementById('shopwork-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'shopwork-dialog';
  modal.className = 'modal-overlay';

  const activeProjects = state.projects.filter(p => !p.archived);

  modal.innerHTML = `
    <div class="modal-container" style="max-width:480px">
      <div class="modal-header">
        <div>
          <div class="modal-title">${isEdit ? 'Edit' : 'New'} Shop Work Task</div>
          <div class="modal-sub">Shop tasks can be assigned to a team member and linked to a project</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('shopwork-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Task</label>
        <textarea id="sw-text" class="form-textarea" rows="2" placeholder="What needs to happen..." style="width:100%;margin-bottom:12px">${esc(task?.text || '')}</textarea>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Assigned to</label>
            <select id="sw-assignee" class="form-input" style="width:100%">
              <option value="">Unassigned</option>
              ${state.team.filter(m => m.status !== 'inactive').map(m => `
                <option value="${m.id}" ${task?.assignee_id === m.id ? 'selected' : ''}>${esc(m.name)}</option>
              `).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Priority</label>
            <select id="sw-priority" class="form-input" style="width:100%">
              <option value="low" ${(!task || task.priority === 'low') ? 'selected' : ''}>Low</option>
              <option value="med" ${task?.priority === 'med' ? 'selected' : ''}>Medium</option>
              <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>
        </div>

        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Project (optional)</label>
        <select id="sw-project" class="form-input" style="width:100%;margin-bottom:14px">
          <option value="">— No specific project (general shop work) —</option>
          ${activeProjects.map(p => `
            <option value="${p.id}" ${task?.project_id === p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.client_name || '')}</option>
          `).join('')}
        </select>
        <div style="font-size:10px;color:#6E7681;margin-top:-10px;margin-bottom:14px">When linked to a project, this task shows up on the project page and contributes to its Shop Work milestone.</div>

        <div style="display:flex;gap:8px">
          <button class="btn" style="flex:1" onclick="document.getElementById('shopwork-dialog')?.remove()">Cancel</button>
          <button class="btn-primary" style="flex:1" onclick="saveShopWork(${taskId || 'null'})">${isEdit ? 'Save' : 'Add Task'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveShopWork(taskId) {
  const text = document.getElementById('sw-text')?.value?.trim();
  if (!text) { alert('Task description required'); return; }
  const assigneeVal = document.getElementById('sw-assignee')?.value;
  const priority = document.getElementById('sw-priority')?.value || 'low';
  const projectVal = document.getElementById('sw-project')?.value;
  const assignee_id = assigneeVal ? parseInt(assigneeVal) : null;
  const project_id = projectVal ? parseInt(projectVal) : null;

  if (taskId) {
    const task = state.shopwork.find(t => t.id === taskId);
    if (task) {
      task.text = text;
      task.assignee_id = assignee_id;
      task.priority = priority;
      task.project_id = project_id;
    }
  } else {
    state.shopwork.push({
      id: Date.now() + Math.random(),
      text, assignee_id, priority, project_id,
      status: 'open',
      created: new Date().toISOString()
    });
  }
  save('vi_shopwork', state.shopwork);

  // Auto-check milestone if applicable
  if (project_id) checkShopWorkMilestone(project_id);

  document.getElementById('shopwork-dialog')?.remove();
  renderCurrentPage();
}

function checkShopWorkMilestone(projectId) {
  // If all shop tasks for this project are done (and there's at least 1), check the milestone
  if (areAllShopTasksDoneForProject(projectId)) {
    setMilestone(projectId, 'install', 'shop_work_done', true);
  } else {
    // If there are shop tasks but not all done, uncheck the milestone
    const tasks = getShopWorkForProject(projectId);
    if (tasks.length > 0) {
      setMilestone(projectId, 'install', 'shop_work_done', false);
    }
  }
}

function completeShopWork(taskId) {
  const task = state.shopwork.find(t => t.id === taskId);
  if (!task) return;
  task.status = 'done';
  task.completed = new Date().toISOString();
  save('vi_shopwork', state.shopwork);
  if (task.project_id) checkShopWorkMilestone(task.project_id);
  renderCurrentPage();
}

function reopenShopWork(taskId) {
  const task = state.shopwork.find(t => t.id === taskId);
  if (!task) return;
  task.status = 'open';
  delete task.completed;
  save('vi_shopwork', state.shopwork);
  if (task.project_id) checkShopWorkMilestone(task.project_id);
  renderCurrentPage();
}

function removeShopWork(taskId) {
  if (!confirm('Remove this task?')) return;
  const task = state.shopwork.find(t => t.id === taskId);
  const projectId = task?.project_id;
  state.shopwork = state.shopwork.filter(t => t.id !== taskId);
  save('vi_shopwork', state.shopwork);
  if (projectId) checkShopWorkMilestone(projectId);
  renderCurrentPage();
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

// ── Admin page (Pass 3A) ──
function renderAdmin(c) {
  const activeMemberId = getActiveTeamMemberId();
  const canViewUsers = currentUserHasPermission('admin.view_users');
  const canReviewTemplates = currentUserHasPermission('templates.review');
  if (!canViewUsers && !canReviewTemplates) {
    c.innerHTML = `
      <div style="max-width:520px;margin:40px auto;text-align:center;padding:40px 24px">
        <div style="font-size:40px;margin-bottom:12px">🔒</div>
        <div style="font-size:16px;font-weight:600;color:#E6EDF3;margin-bottom:6px">Admin access required</div>
        <div style="font-size:13px;color:#8B949E">You need the <code style="color:#58A6FF">admin.view_users</code> or <code style="color:#58A6FF">templates.review</code> permission to see this page.</div>
      </div>
    `;
    return;
  }
  const canAssignPerms = currentUserHasPermission('admin.assign_permissions');
  const isMasterAdmin = currentUserHasPermission('admin.system');
  const canEditAnyUser = _ALL_USER_EDIT_PERMS.some(k => currentUserHasPermission(k));

  // Build tab list based on permissions
  const tabs = [];
  if (canViewUsers) tabs.push({ key: 'users', label: 'Users' });
  if (canViewUsers) tabs.push({ key: 'bundles', label: 'Permission Bundles' });
  if (canReviewTemplates) {
    const pending = getPendingSuggestions().length;
    tabs.push({ key: 'templates', label: 'Template Suggestions', badge: pending });
  }
  let adminTab = state.adminTab || tabs[0]?.key || 'users';
  // Guard: fall back if user can't see selected tab
  if (!tabs.find(t => t.key === adminTab)) adminTab = tabs[0]?.key;

  c.innerHTML = `
    <div style="max-width:880px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <div style="font-size:20px;font-weight:600;color:#E6EDF3">Admin</div>
          <div style="font-size:12px;color:#6E7681;margin-top:2px">Users, permissions, and system configuration</div>
        </div>
        ${isMasterAdmin ? '<span style="font-size:10px;padding:3px 8px;border-radius:4px;background:#F8514922;color:#F85149;border:1px solid #F8514944;font-weight:600;letter-spacing:0.05em">MASTER ADMIN</span>' : ''}
      </div>

      <!-- Sub-tabs -->
      <div style="display:flex;gap:2px;border-bottom:1px solid #1C2333;margin-bottom:16px;flex-wrap:wrap">
        ${tabs.map(t => {
          const active = adminTab === t.key;
          return `<div onclick="state.adminTab='${t.key}';renderCurrentPage()" style="padding:8px 14px;font-size:12px;font-weight:500;cursor:pointer;border-bottom:2px solid ${active ? '#58A6FF' : 'transparent'};color:${active ? '#58A6FF' : '#8B949E'};-webkit-tap-highlight-color:transparent;display:flex;align-items:center;gap:6px">${t.label}${t.badge > 0 ? `<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:#DA3633;color:#fff;font-weight:600">${t.badge}</span>` : ''}</div>`;
        }).join('')}
      </div>

      ${adminTab === 'users' ? renderAdminUsers(activeMemberId, canEditAnyUser, canAssignPerms, isMasterAdmin)
        : adminTab === 'bundles' ? renderAdminBundles(isMasterAdmin)
        : adminTab === 'templates' ? renderAdminTemplateSuggestions()
        : ''}
    </div>
  `;
}

function renderAdminTemplateSuggestions() {
  const pending = state.templateSuggestions.filter(s => s.status === 'pending');
  const recent = state.templateSuggestions
    .filter(s => s.status !== 'pending')
    .sort((a, b) => new Date(b.reviewed_at || 0) - new Date(a.reviewed_at || 0))
    .slice(0, 20);

  return `
    <div class="alert alert-info" style="margin-bottom:14px;font-size:12px">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v3M8 10v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <span>Team members in the field can flag design/install sub-tasks as suggested additions to a template. Accepted suggestions appear on all future projects with that scope.</span>
    </div>

    <div style="font-size:11px;font-weight:700;color:#D29922;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Pending Review · ${pending.length}</div>
    ${pending.length === 0 ? `
      <div style="font-size:12px;color:#6E7681;font-style:italic;padding:14px;background:#0D1117;border:1px solid #1C2333;border-radius:6px;text-align:center">No pending suggestions</div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${pending.map(s => {
          const suggestedBy = getTeamMember(s.suggested_by);
          const project = state.projects.find(p => p.id === s.project_id);
          const templateName = TEMPLATES[s.phase]?.[s.scope]?.name || s.scope;
          return `
            <div style="padding:12px 14px;background:#161B22;border:1px solid #1C2333;border-radius:6px;border-left:3px solid #D29922">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px">
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;color:#E6EDF3;margin-bottom:4px">"${esc(s.text)}"</div>
                  <div style="font-size:11px;color:#8B949E">
                    Add to <strong style="color:#58A6FF">${esc(templateName)}</strong> (${s.phase})
                  </div>
                  <div style="font-size:10px;color:#6E7681;margin-top:4px">
                    Suggested by ${esc(suggestedBy?.name || 'unknown')}${project ? ` · while on ${esc(project.name)}` : ''} · ${fmtDate(s.created_at)}
                  </div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                  <button class="btn-primary" style="padding:5px 12px;font-size:11px;background:#238636" onclick="acceptTemplateSuggestion(${s.id})">Accept</button>
                  <button class="btn btn-sm" style="font-size:11px" onclick="rejectTemplateSuggestion(${s.id})">Reject</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}

    ${recent.length > 0 ? `
      <div style="font-size:11px;font-weight:700;color:#6E7681;text-transform:uppercase;letter-spacing:0.08em;margin:20px 0 8px">Recently Reviewed</div>
      <div style="display:flex;flex-direction:column;gap:5px">
        ${recent.map(s => {
          const suggestedBy = getTeamMember(s.suggested_by);
          const reviewedBy = getTeamMember(s.reviewed_by);
          const templateName = TEMPLATES[s.phase]?.[s.scope]?.name || s.scope;
          const badgeColor = s.status === 'accepted' ? '#3FB950' : '#F85149';
          return `
            <div style="padding:8px 10px;background:#0D1117;border:1px solid #1C2333;border-radius:5px;opacity:0.75">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;color:#C9D1D9">"${esc(s.text)}"</div>
                  <div style="font-size:10px;color:#6E7681;margin-top:2px">
                    ${esc(templateName)} · by ${esc(suggestedBy?.name || 'unknown')}
                  </div>
                </div>
                <span style="font-size:9px;padding:2px 6px;border-radius:3px;color:${badgeColor};border:1px solid ${badgeColor}66;font-weight:600;flex-shrink:0">${s.status.toUpperCase()}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}
  `;
}

function canManageUser(targetMemberId) {
  // Returns true if current user can edit/remove target user's permissions
  if (currentUserHasPermission('admin.system')) return true;
  const targetUp = getUserPermissions(targetMemberId);
  const targetBundle = targetUp?.bundle || 'installer';
  return currentUserHasPermission(`admin.edit_users.${targetBundle}`);
}

function toggleAdvancedPerms() {
  const content = document.getElementById('advanced-perms-content');
  const arrow = document.getElementById('adv-perms-arrow');
  if (!content) return;
  const isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(90deg)';
}

function renderAdminUsers(activeMemberId, canEditAnyUser, canAssignPerms, isMasterAdmin) {
  return `
    <div class="alert alert-info" style="margin-bottom:14px;font-size:12px">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v3M8 10v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <span>Each user has a permission bundle that determines what they can see and do. ${isMasterAdmin ? 'Click a user to edit their bundle or individual permissions.' : 'You can only manage users whose bundle you&rsquo;re authorized for.'}</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px">
      ${state.team.map(m => {
        const up = getUserPermissions(m.id);
        const bundleKey = up?.bundle || 'installer';
        const bundle = state.bundles[bundleKey];
        const effectivePerms = getEffectivePermissions(m.id);
        const isYou = m.id === activeMemberId;
        const hasOverrides = up?.overrides && Object.keys(up.overrides).length > 0;
        const primaryColor = bundle?.color || '#6E7681';
        const canManage = canManageUser(m.id);
        return `
          <div class="card card-sm" style="${isYou ? 'border-color:#1565C0;background:#0D1626' : ''}">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:40px;height:40px;border-radius:50%;background:${primaryColor}22;border:1.5px solid ${primaryColor};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:${primaryColor};flex-shrink:0">${esc(m.initials || getInitials(m.name))}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span style="font-size:14px;font-weight:500;color:#E6EDF3">${esc(m.name)}</span>
                  ${isYou ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#1565C0;color:#fff;font-weight:600">YOU</span>' : ''}
                  <span style="font-size:10px;padding:2px 7px;border-radius:3px;background:${primaryColor}22;color:${primaryColor};border:1px solid ${primaryColor}44;font-weight:500">${bundle?.label || bundleKey}</span>
                  ${hasOverrides ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#1A150D;color:#D29922;border:1px solid #9E6A03">CUSTOM</span>' : ''}
                </div>
                <div style="font-size:11px;color:#6E7681;margin-top:3px">${effectivePerms.size} permission${effectivePerms.size === 1 ? '' : 's'}${m.email ? ' · ' + esc(m.email) : ''}</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                ${canAssignPerms && canManage ? `<button class="btn btn-sm" onclick="showUserPermissionsDialog(${m.id})">Permissions</button>` : (!canManage ? `<span style="font-size:10px;color:#6E7681;padding:6px 8px" title="Your permissions don&rsquo;t include managing users on this bundle">Not authorized</span>` : '')}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderAdminBundles(isMasterAdmin) {
  return `
    <div class="alert alert-info" style="margin-bottom:14px;font-size:12px">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v3M8 10v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <span>Bundles are permission presets. ${isMasterAdmin ? 'Edit a bundle to change what permissions it grants &mdash; your changes apply to every user on that bundle.' : 'View-only &mdash; only Master Admins can edit bundles.'}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${Object.entries(state.bundles).map(([key, b]) => `
        <div class="card card-sm" style="border-left:3px solid ${b.color}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                <span style="font-size:14px;font-weight:600;color:${b.color}">${esc(b.label)}</span>
                <span style="font-size:10px;color:#6E7681;font-family:monospace">${key}</span>
              </div>
              <div style="font-size:12px;color:#8B949E;margin-bottom:6px">${esc(b.desc)}</div>
              <div style="font-size:11px;color:#6E7681">${b.permissions.length} permission${b.permissions.length === 1 ? '' : 's'}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
              <div style="font-size:11px;color:#8B949E">
                ${state.team.filter(m => getUserPermissions(m.id)?.bundle === key).length} user${state.team.filter(m => getUserPermissions(m.id)?.bundle === key).length === 1 ? '' : 's'}
              </div>
              ${isMasterAdmin ? `<button class="btn btn-sm" onclick="showBundleEditDialog('${key}')" style="font-size:11px;padding:4px 10px">Edit</button>` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Bundle editor (Pass 3B Priority 3) ──
function showBundleEditDialog(bundleKey) {
  if (!currentUserHasPermission('admin.system')) return; // only Master Admin can edit bundles
  const bundle = state.bundles[bundleKey];
  if (!bundle) return;
  // Snapshot for cancel
  window._bundleOriginal = { key: bundleKey, snapshot: JSON.stringify(bundle) };

  document.getElementById('bundle-edit-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'bundle-edit-dialog';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:600px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column">
      <div class="modal-header">
        <div>
          <div class="modal-title">Edit Bundle: <span style="color:${bundle.color}">${esc(bundle.label)}</span></div>
          <div class="modal-sub">Changes apply to all users on this bundle</div>
        </div>
        <button class="modal-close" onclick="cancelBundleEdit()">&times;</button>
      </div>
      <div class="modal-body" style="overflow-y:auto;flex:1">
        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Label</label>
        <input type="text" id="bundle-label" class="form-input" value="${esc(bundle.label)}" style="width:100%;margin-bottom:12px">

        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Description</label>
        <textarea id="bundle-desc" class="form-textarea" rows="2" style="width:100%;margin-bottom:14px">${esc(bundle.desc)}</textarea>

        <div style="font-size:11px;color:#8B949E;font-weight:500;margin-bottom:8px">Permissions in this bundle</div>
        <div id="bundle-perm-list" style="display:flex;flex-direction:column;gap:4px">
          ${renderBundleEditPermissions(bundleKey)}
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:14px;border-top:1px solid #1C2333">
        <button class="btn" style="flex:1" onclick="cancelBundleEdit()">Cancel</button>
        <button class="btn-primary" style="flex:1" onclick="saveBundleEdit('${bundleKey}')">Save Bundle</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function renderBundleEditPermissions(bundleKey) {
  const bundle = state.bundles[bundleKey];
  const bundleSet = new Set(bundle.permissions);
  const groups = {};
  PERMISSION_KEYS.forEach(k => {
    const g = k.split('.')[0];
    if (!groups[g]) groups[g] = [];
    groups[g].push(k);
  });
  const labels = {
    admin: 'Admin', projects: 'Projects', design: 'Design', install: 'Install',
    purchasing: 'Purchasing', warehouse: 'Warehouse', vendors: 'Vendors',
    financials: 'Financials', sales: 'Sales', client: 'Client'
  };
  return Object.entries(groups).map(([g, perms]) => `
    <div style="margin-top:10px">
      <div style="font-size:10px;font-weight:700;color:#6E7681;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">${labels[g] || g}</div>
      ${perms.map(k => {
        const checked = bundleSet.has(k);
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:4px;border:1px solid #1C2333;margin-bottom:3px">
            <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleBundlePermission('${bundleKey}','${k}',this.checked)" style="margin:0">
            <div style="font-size:12px;color:#E6EDF3;font-family:monospace">${k}</div>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');
}

function toggleBundlePermission(bundleKey, permKey, checked) {
  const bundle = state.bundles[bundleKey];
  if (!bundle) return;
  const set = new Set(bundle.permissions);
  if (checked) set.add(permKey);
  else set.delete(permKey);
  bundle.permissions = Array.from(set);
}

function saveBundleEdit(bundleKey) {
  const bundle = state.bundles[bundleKey];
  if (!bundle) return;
  const label = document.getElementById('bundle-label')?.value;
  const desc = document.getElementById('bundle-desc')?.value;
  if (label) bundle.label = label;
  if (desc !== undefined) bundle.desc = desc;
  save('vi_bundles', state.bundles);
  window._bundleOriginal = null;
  document.getElementById('bundle-edit-dialog')?.remove();
  renderCurrentPage();
}

function cancelBundleEdit() {
  if (window._bundleOriginal) {
    state.bundles[window._bundleOriginal.key] = JSON.parse(window._bundleOriginal.snapshot);
    window._bundleOriginal = null;
  }
  document.getElementById('bundle-edit-dialog')?.remove();
}

function showUserPermissionsDialog(memberId) {
  const m = getTeamMember(memberId);
  if (!m) return;
  const up = getUserPermissions(memberId) || { bundle: 'installer', overrides: {} };
  // Snapshot original for cancel
  window._permOriginal = { memberId, snapshot: JSON.stringify(state.userPermissions[memberId] || { bundle: 'installer', overrides: {} }) };
  const activeId = getActiveTeamMemberId();
  const activePerms = getEffectivePermissions(activeId);
  const isMasterAdmin = activePerms.has('admin.system');

  document.getElementById('user-perm-dialog')?.remove();
  const modal = document.createElement('div');
  modal.id = 'user-perm-dialog';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:560px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column">
      <div class="modal-header">
        <div>
          <div class="modal-title">Permissions: ${esc(m.name)}</div>
          <div class="modal-sub">Bundle sets the base; overrides grant or deny individual permissions</div>
        </div>
        <button class="modal-close" onclick="cancelUserPermissions()">&times;</button>
      </div>
      <div class="modal-body" style="overflow-y:auto;flex:1">
        <label style="font-size:11px;color:#8B949E;font-weight:500;display:block;margin-bottom:4px">Permission Bundle</label>
        <select id="perm-bundle-select" class="form-input" style="width:100%;margin-bottom:16px" onchange="previewBundleChange(${memberId}, this.value)">
          ${Object.entries(state.bundles).map(([key, b]) => {
            // Non-master-admins can't grant master_admin
            // And non-master-admins can't grant a bundle that contains permissions they don't have themselves
            let disabled = key === 'master_admin' && !isMasterAdmin;
            let disabledReason = disabled ? 'Master Admin only' : '';
            if (!disabled && !isMasterAdmin) {
              const missingPerms = b.permissions.filter(p => !activePerms.has(p));
              if (missingPerms.length > 0) {
                disabled = true;
                disabledReason = `Exceeds your permissions (${missingPerms.length} flag${missingPerms.length === 1 ? '' : 's'})`;
              }
            }
            return `<option value="${key}" ${up.bundle === key ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${esc(b.label)}${disabledReason ? ' — ' + disabledReason : ''}</option>`;
          }).join('')}
        </select>
        ${!isMasterAdmin ? '<div style="font-size:11px;color:#6E7681;margin-top:-10px;margin-bottom:14px;padding:8px 10px;background:#0D1117;border:1px solid #1C2333;border-radius:4px">You can only grant permissions and bundles that you hold yourself. Bundles you don&rsquo;t qualify to grant are greyed out.</div>' : ''}

        <!-- Advanced permissions expander — individual overrides are hidden by default -->
        <div id="advanced-perms-section" style="margin-top:14px">
          <div onclick="toggleAdvancedPerms()" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 10px;background:#0D1117;border:1px solid #1C2333;border-radius:4px;-webkit-tap-highlight-color:transparent;user-select:none">
            <svg id="adv-perms-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none" style="transition:transform 0.2s"><path d="M3 2l4 3-4 3" stroke="#8B949E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span style="font-size:12px;font-weight:500;color:#C9D1D9">Advanced &mdash; Individual permission overrides</span>
            <span style="font-size:10px;color:#6E7681;margin-left:auto">${(up.overrides && Object.keys(up.overrides).length) || 0} override${(up.overrides && Object.keys(up.overrides).length) === 1 ? '' : 's'}</span>
          </div>
          <div id="advanced-perms-content" style="display:none;margin-top:10px">
            <div style="font-size:11px;color:#6E7681;margin-bottom:10px;padding:6px 10px;background:#0D1117;border-left:2px solid #D29922;border-radius:2px">Use these to grant or deny specific permissions beyond what the bundle provides. Overrides show as amber highlights.</div>
            <div id="perm-list" style="display:flex;flex-direction:column;gap:4px">
              ${renderPermissionList(memberId)}
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:14px;border-top:1px solid #1C2333">
        <button class="btn" style="flex:1" onclick="cancelUserPermissions()">Cancel</button>
        <button class="btn-primary" style="flex:1" onclick="saveUserPermissions(${memberId})">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function cancelUserPermissions() {
  // Restore snapshot
  if (window._permOriginal) {
    const { memberId, snapshot } = window._permOriginal;
    state.userPermissions[memberId] = JSON.parse(snapshot);
    window._permOriginal = null;
  }
  document.getElementById('user-perm-dialog')?.remove();
  // Don't re-render — nothing changed persistently
}

function renderPermissionList(memberId) {
  const up = getUserPermissions(memberId) || { bundle: 'installer', overrides: {} };
  const bundle = state.bundles[up.bundle];
  const bundleSet = new Set(bundle?.permissions || []);
  const overrides = up.overrides || {};
  // Grantor's permissions — used to gate what checkboxes can be toggled
  const grantorPerms = getEffectivePermissions(getActiveTeamMemberId());
  const grantorIsMasterAdmin = grantorPerms.has('admin.system');
  // Group permissions by prefix
  const groups = {};
  PERMISSION_KEYS.forEach(k => {
    const g = k.split('.')[0];
    if (!groups[g]) groups[g] = [];
    groups[g].push(k);
  });
  const labels = {
    admin: 'Admin', projects: 'Projects', design: 'Design', install: 'Install',
    purchasing: 'Purchasing', warehouse: 'Warehouse', vendors: 'Vendors',
    financials: 'Financials', sales: 'Sales', client: 'Client'
  };
  return Object.entries(groups).map(([g, perms]) => `
    <div style="margin-top:10px">
      <div style="font-size:10px;font-weight:700;color:#6E7681;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">${labels[g] || g}</div>
      ${perms.map(k => {
        const inBundle = bundleSet.has(k);
        const override = overrides[k];
        const effective = override === true || (override !== false && inBundle);
        const isCustom = override !== undefined;
        // Grantor can toggle this permission ONLY if they hold it themselves (or are Master Admin)
        const canGrant = grantorIsMasterAdmin || grantorPerms.has(k);
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:4px;background:${isCustom ? '#1A150D' : 'transparent'};border:1px solid ${isCustom ? '#9E6A03' : '#1C2333'};margin-bottom:3px;opacity:${canGrant ? '1' : '0.5'}">
            <input type="checkbox" data-perm="${k}" ${effective ? 'checked' : ''} ${canGrant ? '' : 'disabled'} onchange="onPermToggle('${k}', ${memberId}, this.checked)" style="margin:0">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;color:#E6EDF3;font-family:monospace">${k}</div>
              ${!canGrant ? '<div style="font-size:10px;color:#F85149;margin-top:2px">You cannot grant this &mdash; not in your permissions</div>' : (isCustom ? '<div style="font-size:10px;color:#D29922;margin-top:2px">Override</div>' : (inBundle ? '<div style="font-size:10px;color:#6E7681;margin-top:2px">From bundle</div>' : '<div style="font-size:10px;color:#6E7681;margin-top:2px">Not in bundle</div>'))}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');
}

function previewBundleChange(memberId, bundleKey) {
  if (!state.userPermissions[memberId]) state.userPermissions[memberId] = { bundle: bundleKey, overrides: {} };
  state.userPermissions[memberId].bundle = bundleKey;
  const listEl = document.getElementById('perm-list');
  if (listEl) listEl.innerHTML = renderPermissionList(memberId);
}

function onPermToggle(permKey, memberId, checked) {
  // Defensive check — grantor must hold the permission (or be Master Admin) to toggle it
  const grantorPerms = getEffectivePermissions(getActiveTeamMemberId());
  if (!grantorPerms.has('admin.system') && !grantorPerms.has(permKey)) {
    // Revert the checkbox visually and bail
    const listEl = document.getElementById('perm-list');
    if (listEl) listEl.innerHTML = renderPermissionList(memberId);
    return;
  }
  if (!state.userPermissions[memberId]) state.userPermissions[memberId] = { bundle: 'installer', overrides: {} };
  const up = state.userPermissions[memberId];
  if (!up.overrides) up.overrides = {};
  const bundle = state.bundles[up.bundle];
  const inBundle = bundle?.permissions.includes(permKey);
  if ((checked && inBundle) || (!checked && !inBundle)) {
    delete up.overrides[permKey];
  } else {
    up.overrides[permKey] = checked;
  }
  const listEl = document.getElementById('perm-list');
  if (listEl) listEl.innerHTML = renderPermissionList(memberId);
}

function saveUserPermissions(memberId) {
  save('vi_user_perms', state.userPermissions);
  window._permOriginal = null;
  document.getElementById('user-perm-dialog')?.remove();
  renderCurrentPage();
}function showMemberDialog(memberId) {
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
        if (existing) {
          // Preserve Valiant-owned state on re-sync. Once a project exists in Valiant,
          // Jetbuilt is only the source of truth for "who/what" fields — not "where is it in our process."
          enriched.archived = existing.archived;
          // Stage: Valiant owns this after initial import. Never let Jetbuilt overwrite.
          enriched.stage = existing.stage;
          // Preserve the raw Jetbuilt stage string for display/debugging, but don't act on it
          enriched._jb_stage_current = enriched.raw_stage;
          enriched.raw_stage = existing.raw_stage;
          // Notify if Jetbuilt stage has diverged from Valiant stage (soft alert)
          if (enriched._jb_stage_current && enriched._jb_stage_current !== existing.raw_stage) {
            enriched._stage_divergence = {
              jb_stage: enriched._jb_stage_current,
              valiant_stage: existing.stage,
              noticed_at: new Date().toISOString()
            };
          }
        }
        // New projects (no existing record) accept Jetbuilt's stage as-is — this is the
        // "new project enters Valiant" flow. Once it's in, Valiant owns the stage forever.
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
// Refresh Team + Admin nav items based on current user's permissions
function refreshAdminNav() {
  const toolsSection = document.querySelectorAll('.nav-section')[1];
  // Gate the top-bar "+ New Intake" button by projects.create permission
  const intakeButtons = document.querySelectorAll('button[onclick*="startNewIntake"]');
  const canCreate = currentUserHasPermission('projects.create');
  intakeButtons.forEach(btn => {
    btn.style.display = canCreate ? '' : 'none';
  });
  // Gate the "+ New Intake" nav link (if the current user can't create)
  const intakeNav = document.querySelector('[data-page="intake"]');
  if (intakeNav) intakeNav.style.display = canCreate ? '' : 'none';

  // Inject "Open Projects" nav item right after Projects, in the first nav section.
  // Always visible — content is permission-scoped inside the page itself.
  if (!document.querySelector('[data-page="open-projects"]')) {
    const projectsLink = document.querySelector('[data-page="projects"]');
    if (projectsLink && projectsLink.parentNode) {
      const link = document.createElement('a');
      link.className = 'nav-item';
      link.dataset.page = 'open-projects';
      link.onclick = () => navigate('open-projects');
      link.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4.5h5l1.5 2H14v5.5a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M2 8h12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><span>Open Projects</span><span class="nav-badge" id="open-projects-badge"></span>';
      projectsLink.parentNode.insertBefore(link, projectsLink.nextSibling);
    }
  }
  // Update Open Projects badge count
  const openProjectsBadge = document.getElementById('open-projects-badge');
  if (openProjectsBadge) {
    const count = getOpenProjectsForUser().length;
    openProjectsBadge.textContent = count > 0 ? count : '';
    openProjectsBadge.style.display = count > 0 ? '' : 'none';
  }

  if (!toolsSection) return;
  const activeMember = getTeamMember(getActiveTeamMemberId());
  // Team nav — legacy admin gate
  if (activeMember && activeMember.access.includes('admin')) {
    if (!document.querySelector('[data-page="team"]')) {
      const teamLink = document.createElement('a');
      teamLink.className = 'nav-item';
      teamLink.dataset.page = 'team';
      teamLink.onclick = () => navigate('team');
      teamLink.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" stroke-width="1.2"/><circle cx="11" cy="5" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M1 14c0-2.761 2.239-4.5 5-4.5s5 1.739 5 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M11 9.5c1.933 0 3.5 1.119 3.5 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><span>Team</span>';
      toolsSection.appendChild(teamLink);
    }
  }
  // Admin nav — gated by new permission system
  if (!document.querySelector('[data-page="admin"]') && currentUserHasPermission('admin.view_users')) {
    const adminLink = document.createElement('a');
    adminLink.className = 'nav-item';
    adminLink.dataset.page = 'admin';
    adminLink.onclick = () => navigate('admin');
    adminLink.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l5 2.5v3c0 3-2.2 5.5-5 6.5-2.8-1-5-3.5-5-6.5v-3L8 2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 8l1.5 1.5L10 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Admin</span>';
    toolsSection.appendChild(adminLink);
  }
}

async function init() {
  // Seed default vehicles and tools on first load (can be edited later via Team/Settings)
  if (!state.vehicles || state.vehicles.length === 0) {
    state.vehicles = [
      { id: 'van-1', name: 'White Sprinter Van', type: 'van' },
      { id: 'van-2', name: 'Cargo Van', type: 'van' },
      { id: 'trailer-1', name: '20ft Enclosed Trailer', type: 'trailer' },
      { id: 'truck-1', name: 'F-250 Pickup', type: 'truck' }
    ];
    save('vi_vehicles', state.vehicles);
  }
  if (!state.tools || state.tools.length === 0) {
    state.tools = [
      { id: 'tool-lift', name: 'Genie Scissor Lift', category: 'access' },
      { id: 'tool-ladders', name: 'Extension Ladders (set)', category: 'access' },
      { id: 'tool-rack-cart', name: 'Rack Cart', category: 'transport' },
      { id: 'tool-pallet-jack', name: 'Pallet Jack', category: 'transport' },
      { id: 'tool-hand-kit', name: 'Hand Tool Kit', category: 'hand' },
      { id: 'tool-drill-kit', name: 'Drill & Impact Kit', category: 'power' },
      { id: 'tool-cable-tester', name: 'Cable Tester / Toner', category: 'testing' },
      { id: 'tool-rf-analyzer', name: 'RF Analyzer', category: 'testing' },
      { id: 'tool-spl-meter', name: 'SPL Meter', category: 'testing' },
      { id: 'tool-laser', name: 'Laser Level', category: 'measure' }
    ];
    save('vi_tools', state.tools);
  }
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
  refreshAdminNav();
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

// ── Dev override: always-available user switcher ──
// Triggered by: triple-click on the "Valiant Integrations" sidebar header, or Ctrl+Shift+U
function showDevUserSwitcher() {
  document.getElementById('dev-switcher')?.remove();
  const modal = document.createElement('div');
  modal.id = 'dev-switcher';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:480px">
      <div class="modal-header" style="background:#1A150D">
        <div>
          <div class="modal-title" style="color:#D29922">Dev User Switcher</div>
          <div class="modal-sub">Override the active user regardless of permissions. Use this if you get locked out.</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('dev-switcher')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:6px">
          ${state.team.map(m => {
            const up = state.userPermissions[m.id];
            const bundleKey = up?.bundle || 'installer';
            const bundle = state.bundles[bundleKey];
            const bundleColor = bundle?.color || '#6E7681';
            const isActive = m.id === getActiveTeamMemberId();
            return `
              <div onclick="devSwitchToUser(${m.id})" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${isActive ? '#0D1626' : '#0D1117'};border:1px solid ${isActive ? '#1565C0' : '#1C2333'};border-radius:6px;cursor:pointer;-webkit-tap-highlight-color:transparent">
                <div style="width:32px;height:32px;border-radius:50%;background:${bundleColor}22;border:1.5px solid ${bundleColor};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:${bundleColor}">${esc(m.initials || getInitials(m.name))}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:500;color:#E6EDF3">${esc(m.name)}${isActive ? ' <span style="font-size:10px;color:#58A6FF;font-weight:400;margin-left:4px">· active</span>' : ''}</div>
                  <div style="font-size:11px;color:${bundleColor};margin-top:1px">${bundle?.label || bundleKey}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div style="margin-top:14px;padding:10px;background:#0D1117;border:1px solid #1C2333;border-radius:6px;font-size:11px;color:#6E7681">
          <strong style="color:#8B949E">Keyboard shortcut:</strong> Ctrl+Shift+U (or Cmd+Shift+U on Mac) opens this dialog from anywhere.<br>
          <strong style="color:#8B949E">Triple-click</strong> the "Valiant Integrations" header in the sidebar also works.
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function devSwitchToUser(memberId) {
  document.getElementById('dev-switcher')?.remove();
  switchUser(memberId);
}

// Attach global listeners for dev override
(function attachDevOverride() {
  // Keyboard shortcut: Ctrl+Shift+U / Cmd+Shift+U
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'U' || e.key === 'u')) {
      e.preventDefault();
      showDevUserSwitcher();
    }
  });
  // Triple-click on sidebar header
  let clickCount = 0;
  let clickTimer = null;
  document.addEventListener('click', function(e) {
    const target = e.target.closest('.sidebar-header, .sidebar-logo, .nav-section:first-child');
    if (!target) { clickCount = 0; return; }
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickCount = 0; }, 600);
    if (clickCount >= 3) {
      clickCount = 0;
      showDevUserSwitcher();
    }
  });
})();

init();

// ═══════════════════════════════════════════════════════════════════
// QUICK ACTIONS BOTTOM SHEET
// Triggered by the center "Quick" button in the bottom nav.
// Shows a list of common actions; each opens its own flow.
// Items without a backing flow yet show a "Coming soon" toast.
// ═══════════════════════════════════════════════════════════════════

const QUICK_ACTIONS = [
  {
    key: 'meeting',
    label: 'Log a meeting',
    desc: 'Record meeting notes against a project',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="17" cy="9" r="2"/><path d="M14 21v-1a3 3 0 013-3h2a3 3 0 013 3v1"/></svg>',
    handler: () => quickActionLogMeeting(),
    available: true
  },
  {
    key: 'task',
    label: 'Create a task',
    desc: 'Add a shop work task or project sub-task',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg>',
    handler: () => quickActionCreateTask(),
    available: true
  },
  {
    key: 'note',
    label: 'Create a note',
    desc: 'Add a quick note to a project',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    handler: () => quickActionCreateNote(),
    available: true
  },
  {
    key: 'photo',
    label: 'Take a photo',
    desc: 'Snap a job-site photo (coming soon)',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    handler: () => quickActionComingSoon('Take a photo'),
    available: false
  },
  {
    key: 'package',
    label: 'Receive package',
    desc: 'Log incoming equipment delivery (coming soon)',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v6m-4-3h8M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>',
    handler: () => quickActionComingSoon('Receive package'),
    available: false
  },
  {
    key: 'inventory',
    label: 'Move inventory',
    desc: 'Track equipment location changes (coming soon)',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9 4-9-4 9-4 9 4z"/><path d="M3 16l9 4 9-4M3 12l9 4 9-4"/></svg>',
    handler: () => quickActionComingSoon('Move inventory'),
    available: false
  },
  {
    key: 'intake',
    label: 'New intake',
    desc: 'Start a new project from a sales meeting',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
    handler: () => quickActionNewIntake(),
    available: true
  }
];

function openQuickActions() {
  closeQuickActions();
  const sheet = document.createElement('div');
  sheet.id = 'quick-actions-sheet';
  sheet.className = 'qa-sheet';
  sheet.innerHTML = `
    <div class="qa-backdrop" onclick="closeQuickActions()"></div>
    <div class="qa-panel" role="dialog" aria-label="Quick actions">
      <div class="qa-handle"></div>
      <div class="qa-header">
        <div class="qa-title">Quick Actions</div>
        <button class="qa-close" onclick="closeQuickActions()" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="qa-list">
        ${QUICK_ACTIONS.map(a => `
          <button type="button" class="qa-item${!a.available ? ' qa-item-disabled' : ''}" data-key="${a.key}">
            <div class="qa-icon">${a.icon}</div>
            <div class="qa-text">
              <div class="qa-label">${esc(a.label)}${!a.available ? ' <span class="qa-soon">SOON</span>' : ''}</div>
              <div class="qa-desc">${esc(a.desc)}</div>
            </div>
            <svg class="qa-chev" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(sheet);

  // Delegated click for action items
  sheet.querySelector('.qa-list').addEventListener('click', function(ev) {
    const item = ev.target.closest('.qa-item');
    if (!item) return;
    const key = item.getAttribute('data-key');
    const action = QUICK_ACTIONS.find(a => a.key === key);
    if (!action) return;
    closeQuickActions();
    if (typeof action.handler === 'function') action.handler();
  });

  // Trigger animation in
  requestAnimationFrame(() => sheet.classList.add('open'));
}

function closeQuickActions() {
  const sheet = document.getElementById('quick-actions-sheet');
  if (!sheet) return;
  sheet.classList.remove('open');
  setTimeout(() => sheet.remove(), 220);
}

function quickActionComingSoon(label) {
  if (typeof showToast === 'function') showToast(`${label} — coming soon`, 'info');
  else alert(`${label} — coming soon`);
}

function quickActionNewIntake() {
  navigate('intake');
}

// ── Project picker modal — used by smart actions that need to know which project ──
function quickActionProjectPicker(promptLabel, onProjectChosen) {
  document.getElementById('qa-project-picker')?.remove();
  const projects = state.projects.filter(p => !p.archived).sort((a, b) => {
    // Most recently active first
    const la = state.recentActivity?.[a.id] || 0;
    const lb = state.recentActivity?.[b.id] || 0;
    return new Date(lb) - new Date(la);
  });
  const modal = document.createElement('div');
  modal.id = 'qa-project-picker';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:480px;max-height:80vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <div>
          <div class="modal-title">${esc(promptLabel)}</div>
          <div class="modal-sub">Search or pick a project</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('qa-project-picker')?.remove()">&times;</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;flex:1;min-height:0;padding-top:10px">
        <input type="text" id="qa-pp-search" placeholder="Search projects&hellip;" class="form-input" style="margin-bottom:10px" autofocus>
        <div id="qa-pp-list" style="overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:4px"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function renderList(filterText) {
    const f = (filterText || '').toLowerCase().trim();
    const list = document.getElementById('qa-pp-list');
    if (!list) return;
    const filtered = !f ? projects : projects.filter(p =>
      (p.name || '').toLowerCase().includes(f) ||
      (p.client_name || '').toLowerCase().includes(f) ||
      String(p.id).includes(f)
    );
    if (filtered.length === 0) {
      list.innerHTML = '<div style="font-size:12px;color:#6E7681;padding:14px;text-align:center;font-style:italic">No projects match</div>';
      return;
    }
    list.innerHTML = filtered.slice(0, 50).map(p => {
      const stg = STAGES.find(s => s.key === p.stage) || STAGES[0];
      return `
        <button type="button" class="qa-pp-row" data-id="${p.id}">
          <div style="flex:1;min-width:0;text-align:left">
            <div style="font-size:13px;color:#E6EDF3;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
            <div style="font-size:11px;color:#8B949E;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.client_name || 'No client')}</div>
          </div>
          <span class="status-pill status-${stg.color}" style="flex-shrink:0">${stg.label}</span>
        </button>
      `;
    }).join('');
  }

  renderList('');
  document.getElementById('qa-pp-search').addEventListener('input', e => renderList(e.target.value));
  document.getElementById('qa-pp-list').addEventListener('click', ev => {
    const row = ev.target.closest('.qa-pp-row');
    if (!row) return;
    const id = parseInt(row.getAttribute('data-id'), 10);
    document.getElementById('qa-project-picker')?.remove();
    if (typeof onProjectChosen === 'function') onProjectChosen(id);
  });
}

function quickActionLogMeeting() {
  quickActionProjectPicker('Log a meeting — for which project?', (projectId) => {
    if (typeof showLogMeetingDialog === 'function') {
      showLogMeetingDialog(projectId);
    } else {
      // Open the project's Overview tab where meeting log entry exists in milestones
      openProject(projectId);
      showToast('Open the relevant milestone to log the meeting', 'info');
    }
  });
}

function quickActionCreateTask() {
  quickActionProjectPicker('Create a task — for which project?', (projectId) => {
    if (typeof showShopWorkDialog === 'function') {
      showShopWorkDialog({ project_id: projectId });
    } else if (typeof addShopWork === 'function') {
      navigate('shopwork');
      setTimeout(() => addShopWork(), 100);
    } else {
      navigate('shopwork');
    }
  });
}

function quickActionCreateNote() {
  quickActionProjectPicker('Create a note — for which project?', (projectId) => {
    openProject(projectId);
    state.projectTab = 'notes';
    renderCurrentPage();
    setTimeout(() => {
      const ta = document.querySelector('#content textarea[onblur*="saveNotes"], #content textarea[oninput*="saveNotes"]');
      if (ta) ta.focus();
    }, 200);
  });
}

// ═══════════════════════════════════════════════════════════════════
// OPEN PROJECTS PAGE
// Shows projects in the in-production phase (Contract → Design → Install).
// Excludes pre-contract sales pipeline (Lead/Proposal/Sent) and Complete.
// Visible to all users; scoped by permission inside the page.
// ═══════════════════════════════════════════════════════════════════

const OPEN_PROJECT_STAGES = ['contract', 'design', 'install'];

function getOpenProjectsForUser() {
  const memberId = getActiveTeamMemberId();
  const canViewAll = currentUserHasPermission('projects.view_all');
  let projects = state.projects.filter(p => !p.archived && OPEN_PROJECT_STAGES.includes(p.stage));
  if (!canViewAll) {
    // Scope to projects this user is assigned to in any role
    projects = projects.filter(p => {
      const a = getProjectAssignment(p.id);
      return ['sales', 'design', 'pm', 'install', 'warehouse'].some(role =>
        (a[role] || []).some(x => x.id === memberId)
      );
    });
  }
  return projects;
}

function renderOpenProjects(c) {
  document.getElementById('page-title').textContent = 'Open Projects';
  const memberId = getActiveTeamMemberId();
  const canViewAll = currentUserHasPermission('projects.view_all');
  const canSeeFinancials = currentUserHasPermission('financials.view_project_totals');
  const projects = getOpenProjectsForUser();

  // Group by stage
  const byStage = {};
  OPEN_PROJECT_STAGES.forEach(s => byStage[s] = []);
  projects.forEach(p => {
    if (byStage[p.stage]) byStage[p.stage].push(p);
  });

  // Sort each stage's projects by closest install date first
  Object.keys(byStage).forEach(s => {
    byStage[s].sort((a, b) => {
      const wa = getInstallWindow(a);
      const wb = getInstallWindow(b);
      const da = wa?.start ? new Date(wa.start).getTime() : Infinity;
      const db = wb?.start ? new Date(wb.start).getTime() : Infinity;
      return da - db;
    });
  });

  // Filter chips state
  if (!state.openProjectsFilter) state.openProjectsFilter = 'all';
  const filter = state.openProjectsFilter;
  const filteredStages = filter === 'all' ? OPEN_PROJECT_STAGES :
                         filter === 'design' ? ['design'] :
                         filter === 'install' ? ['install'] :
                         filter === 'contract' ? ['contract'] :
                         OPEN_PROJECT_STAGES;

  const totalCount = projects.length;
  const visibleProjects = projects.filter(p => filteredStages.includes(p.stage));

  // Compute aggregate metrics (gated by financials permission)
  const aggregateValue = canSeeFinancials
    ? projects.reduce((sum, p) => sum + (p.total || 0), 0)
    : null;

  const heroMetrics = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px">
      <div class="metric-card">
        <div class="metric-label">${canViewAll ? 'Active Projects' : 'My Active'}</div>
        <div class="metric-value">${totalCount}</div>
        <div class="metric-sub">in production</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">In Design</div>
        <div class="metric-value" style="color:#A371F7">${byStage.design.length}</div>
        <div class="metric-sub">design phase</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">In Install</div>
        <div class="metric-value" style="color:#F0883E">${byStage.install.length}</div>
        <div class="metric-sub">install phase</div>
      </div>
      ${canSeeFinancials ? `
        <div class="metric-card">
          <div class="metric-label">Total Value</div>
          <div class="metric-value" style="color:#3FB950">${fmt(aggregateValue)}</div>
          <div class="metric-sub">all open</div>
        </div>
      ` : ''}
    </div>
  `;

  const filterChips = `
    <div style="display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px">
      ${[
        { key: 'all',      label: `All (${totalCount})` },
        { key: 'contract', label: `Contract (${byStage.contract.length})`, color: '#58A6FF' },
        { key: 'design',   label: `Design (${byStage.design.length})`,     color: '#A371F7' },
        { key: 'install',  label: `Install (${byStage.install.length})`,   color: '#F0883E' }
      ].map(c => `
        <button type="button" onclick="setOpenProjectsFilter('${c.key}')" class="op-filter-chip${filter === c.key ? ' active' : ''}" ${c.color && filter === c.key ? `style="background:${c.color}22;color:${c.color};border-color:${c.color}66"` : ''}>${esc(c.label)}</button>
      `).join('')}
    </div>
  `;

  const projectsHTML = visibleProjects.length === 0
    ? `<div class="empty-state" style="padding:40px 20px;text-align:center;color:#6E7681;font-style:italic">${canViewAll ? 'No projects in this view' : 'No active projects assigned to you'}</div>`
    : `<div class="op-grid">${visibleProjects.map(p => renderOpenProjectCard(p, memberId, canSeeFinancials)).join('')}</div>`;

  c.innerHTML = `
    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:#6E7681;font-weight:500">Projects in production: Contract &middot; Design &middot; Install</div>
    </div>
    ${heroMetrics}
    ${filterChips}
    ${projectsHTML}
  `;
}

function setOpenProjectsFilter(key) {
  state.openProjectsFilter = key;
  renderCurrentPage();
}

function renderOpenProjectCard(p, memberId, canSeeFinancials) {
  const stg = STAGES.find(s => s.key === p.stage) || STAGES[0];
  const assignment = getProjectAssignment(p.id);
  const allRolePeople = ['sales', 'design', 'pm', 'install', 'warehouse']
    .map(r => (assignment[r] || []).map(x => ({ ...x, role: r })))
    .flat();
  const isOnTeam = allRolePeople.some(x => x.id === memberId);

  // Phase progress
  const totalMilestones = PHASES.reduce((s, ph) => s + ph.milestones.length, 0);
  const doneMilestones = PHASES.reduce((s, ph) => {
    return s + ph.milestones.reduce((ms, m) => ms + (milestoneProgress(p, ph, m) >= 1 ? 1 : 0), 0);
  }, 0);
  const overallPct = totalMilestones > 0 ? Math.round((doneMilestones / totalMilestones) * 100) : 0;

  // Install window
  const win = getInstallWindow(p);
  const dateStr = win?.start
    ? `${fmtDate(win.start)}${win.end && win.end !== win.start ? ' - ' + fmtDate(win.end) : ''}`
    : null;
  const dateColor = win?.source === 'booked' ? '#3FB950' : (win?.source === 'estimated' ? '#58A6FF' : '#6E7681');
  const dateLabel = win?.source === 'booked' ? 'Booked' : (win?.source === 'estimated' ? 'Est.' : null);

  // Closeout flag
  const closeout = isProjectInCloseout(p);

  // Team avatars/initials
  const teamCircles = allRolePeople.slice(0, 5).map((x, i) => {
    const m = getTeamMember(x.id);
    if (!m) return '';
    return `<div class="op-team-circle" title="${esc(m.name)} (${esc(x.role)})" style="background:${m.color || '#1565C0'};margin-left:${i === 0 ? '0' : '-6px'};z-index:${5 - i}">${esc(getInitials(m.name))}</div>`;
  }).join('');
  const teamMore = allRolePeople.length > 5 ? `<div class="op-team-circle" style="background:#1C2333;margin-left:-6px;color:#8B949E">+${allRolePeople.length - 5}</div>` : '';

  return `
    <div class="op-card${isOnTeam ? ' op-card-mine' : ''}${closeout ? ' op-card-closeout' : ''}" onclick="openProject(${p.id})">
      <div class="op-card-top">
        <div class="op-card-name">${esc(p.name)}</div>
        <span class="status-pill status-${stg.color}">${stg.label}</span>
      </div>
      <div class="op-card-client">${esc(p.client_name || 'No client')}${p.city ? ' &middot; ' + esc(p.city) : ''}</div>
      <div class="op-card-progress">
        <div class="op-progress-bar"><div class="op-progress-fill" style="width:${overallPct}%;background:${stg.color === 'red' ? '#F0883E' : stg.color === 'purple' ? '#A371F7' : '#58A6FF'}"></div></div>
        <div class="op-progress-text">${overallPct}% &middot; ${doneMilestones}/${totalMilestones}</div>
      </div>
      <div class="op-card-meta">
        ${dateStr ? `<div class="op-meta-item"><span style="color:${dateColor}">${esc(dateLabel)}: ${esc(dateStr)}</span></div>` : '<div class="op-meta-item" style="color:#6E7681">No install date</div>'}
        ${canSeeFinancials && p.total ? `<div class="op-meta-item op-meta-value">${fmt(p.total)}</div>` : ''}
      </div>
      ${closeout ? '<div class="op-card-closeout-banner">CLOSEOUT NEEDED</div>' : ''}
      ${allRolePeople.length > 0 ? `<div class="op-card-team">${teamCircles}${teamMore}</div>` : ''}
    </div>
  `;
}

// Edit the text of any action row (auto / manual / assigned).
// Stored as userText override on actionsState; key preserved so propagation still works.
function editActionText(key) {
  const a = _findCurrentAction(key);
  if (!a) return;
  const currentText = state.actionsState?.[key]?.userText || a.text;
  const currentAssignee = a.assigneeId || null;
  const teamForAssign = state.team.filter(m => !m.archived);
  const stateOverride = state.actionsState?.[key];
  const hasUserText = !!stateOverride?.userText;
  const hasAssigneeOverride = stateOverride && 'assigneeOverride' in stateOverride;

  document.getElementById('edit-action-dialog')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'edit-action-dialog';
  overlay.innerHTML = `
    <div class="modal-container" style="max-width:420px">
      <div class="modal-header">
        <div>
          <div class="modal-title">Edit action</div>
          <div class="modal-sub">${a.source === 'auto' ? 'Auto-derived — edits override defaults' : 'Manual action'}</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('edit-action-dialog')?.remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label class="form-label">Action text</label>
            <textarea id="edit-action-text" class="form-input" rows="3" style="width:100%;resize:vertical;font-family:inherit">${esc(currentText)}</textarea>
          </div>
          <div>
            <label class="form-label">Assigned to</label>
            <select id="edit-action-assignee" class="form-input">
              <option value="">Unassigned</option>
              ${teamForAssign.map(m => `<option value="${m.id}"${m.id === currentAssignee ? ' selected' : ''}>${esc(m.name)}${m.id === getActiveTeamMemberId() ? ' (me)' : ''}</option>`).join('')}
            </select>
            ${a.source === 'auto' && a.roleForLead ? `<div style="font-size:10px;color:#6E7681;margin-top:4px">Default: project's ${a.roleForLead} lead${hasAssigneeOverride ? ' &middot; <span style="color:#D29922">overridden</span>' : ''}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          ${(hasUserText || hasAssigneeOverride) ? `<button type="button" class="btn" onclick="resetActionText('${key}')" style="font-size:12px">Reset to default</button>` : ''}
          <div style="flex:1"></div>
          <button type="button" class="btn" onclick="document.getElementById('edit-action-dialog')?.remove()">Cancel</button>
          <button type="button" class="btn-primary" onclick="saveActionText('${key}')">Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('edit-action-text')?.focus(), 50);
}

function saveActionText(key) {
  const ta = document.getElementById('edit-action-text');
  const sel = document.getElementById('edit-action-assignee');
  if (!ta) return;
  const newText = ta.value.trim();
  const newAssignee = sel?.value ? parseInt(sel.value, 10) : null;
  if (!newText) {
    showToast('Action text cannot be empty', 'error');
    return;
  }
  const a = _findCurrentAction(key);
  if (!a) return;
  // For manual/assigned: edit the manualEntry text + assignee directly
  if ((a.source === 'manual' || a.source === 'assigned') && a.manualId) {
    const m = state.actionsManual.find(x => x.id === a.manualId);
    if (m) {
      m.text = newText;
      m.assigneeId = newAssignee;
      _persistActionsManual();
    }
  } else {
    // For auto: store as userText override + assigneeOverride (key preserved for propagation)
    if (!state.actionsState[key]) state.actionsState[key] = {};
    if (newText !== a.text) {
      state.actionsState[key].userText = newText;
    } else {
      delete state.actionsState[key].userText;
    }
    // Only store assignee override if it differs from the role-derived default
    // We track it explicitly so user can clear back to default later
    state.actionsState[key].assigneeOverride = newAssignee;
    _persistActionState();
  }
  document.getElementById('edit-action-dialog')?.remove();
  showToast('Action updated', 'success');
  renderDashboard(document.getElementById('content'));
}

function resetActionText(key) {
  if (!state.actionsState[key]) return;
  delete state.actionsState[key].userText;
  delete state.actionsState[key].assigneeOverride;
  // If state object is now empty (no status etc.), clean up
  if (Object.keys(state.actionsState[key]).length === 0) {
    delete state.actionsState[key];
  }
  _persistActionState();
  document.getElementById('edit-action-dialog')?.remove();
  showToast('Reset to defaults', 'info');
  renderDashboard(document.getElementById('content'));
}

// ═══════════════════════════════════════════════════════════════════
// PROJECT MOBILIZATION
// Replaces the older "Needs Assignment" concept. When a project enters
// Contract stage, it must complete a mobilization checklist before
// Design and Planning can fully kick in.
// (MOBILIZATION_ITEMS is declared near the top of this file alongside
//  SCOPE_TAGS so it's available before Sales dashboard render runs.)
// ═══════════════════════════════════════════════════════════════════

// Returns the mobilization state for a project. Each item is auto-derived
// from project state OR has a manual confirmation flag stored separately.
function getMobilizationState(projectId) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return null;
  const a = getProjectAssignment(projectId);
  const salesLead = (a.sales || []).find(x => x.lead);
  const designLead = (a.design || []).find(x => x.lead);
  const pmLead = (a.pm || []).find(x => x.lead);
  const win = getInstallWindow(p);
  const tags = p.systems || [];
  const pinsCount = (state.projectPins?.[projectId] || []).length;
  const briefingSkipped = state.mobilizationFlags?.[projectId]?.site_briefing_skipped;
  const designKickoffLog = state.meetingLogs?.[projectId]?.design_kickoff;
  const designKickoffScheduled = state.mobilizationFlags?.[projectId]?.design_kickoff_scheduled;

  return {
    sales_lead:     !!salesLead,
    design_lead:    !!designLead,
    pm_lead:        !!pmLead,
    install_window: !!win,
    scope_tags:     tags.length > 0,
    site_briefing:  pinsCount > 0 || !!briefingSkipped,
    design_kickoff: !!designKickoffLog || !!designKickoffScheduled
  };
}

function isMobilizationComplete(projectId) {
  const s = getMobilizationState(projectId);
  if (!s) return false;
  return MOBILIZATION_ITEMS.every(it => s[it.key]);
}

// Projects that need mobilization review — Contract stage with incomplete checklist
function getProjectsNeedingMobilization() {
  return state.projects.filter(p =>
    !p.archived &&
    p.stage === 'contract' &&
    !isMobilizationComplete(p.id)
  );
}

// Open the mobilization dialog for a project
function openMobilizationDialog(projectId) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  document.getElementById('mobilization-dialog')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'mobilization-dialog';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-container" style="max-width:560px;max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <div>
          <div class="modal-title">Project Mobilization</div>
          <div class="modal-sub">${esc(p.name)} &middot; complete to unlock Design + Planning</div>
        </div>
        <button class="modal-close" onclick="closeMobilizationDialog()">&times;</button>
      </div>
      <div class="modal-body" id="mobilization-body" style="overflow-y:auto;flex:1">
        ${renderMobilizationBody(projectId)}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function refreshMobilizationBody(projectId) {
  const body = document.getElementById('mobilization-body');
  if (body) body.innerHTML = renderMobilizationBody(projectId);
}

// Close the mobilization dialog AND re-render the underlying page so any
// changes (leads set, scope tags, install window) reflect in dashboards.
function closeMobilizationDialog() {
  document.getElementById('mobilization-dialog')?.remove();
  renderCurrentPage();
}

function renderMobilizationBody(projectId) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return '';
  const s = getMobilizationState(projectId);
  const a = getProjectAssignment(projectId);
  const win = getInstallWindow(p);
  const tags = p.systems || [];
  const flags = state.mobilizationFlags?.[projectId] || {};
  const team = state.team.filter(m => !m.archived);

  const rows = MOBILIZATION_ITEMS.map(it => {
    const done = s[it.key];
    const dotColor = done ? '#3FB950' : '#6E7681';
    let detail = '';
    if (it.key === 'sales_lead') {
      const lead = (a.sales || []).find(x => x.lead);
      detail = lead ? esc(getTeamMember(lead.id)?.name || '') : '<span style="color:#D29922">Not designated</span>';
    } else if (it.key === 'design_lead') {
      const lead = (a.design || []).find(x => x.lead);
      detail = lead ? esc(getTeamMember(lead.id)?.name || '') : '<span style="color:#D29922">Not designated</span>';
    } else if (it.key === 'pm_lead') {
      const lead = (a.pm || []).find(x => x.lead);
      detail = lead ? esc(getTeamMember(lead.id)?.name || '') : '<span style="color:#D29922">Not designated</span>';
    } else if (it.key === 'install_window') {
      detail = win ? `${fmtDate(win.start)}${win.end && win.end !== win.start ? ' — ' + fmtDate(win.end) : ''} <span style="color:#6E7681">(${esc(win.source)})</span>` : '<span style="color:#D29922">No window set</span>';
    } else if (it.key === 'scope_tags') {
      detail = tags.length > 0 ? tags.map(t => `<span style="font-size:10px;padding:2px 6px;background:#1C2333;border:1px solid #30363D;border-radius:3px;color:#C9D1D9;margin-right:3px">${esc(t)}</span>`).join('') : '<span style="color:#D29922">No tags</span>';
    } else if (it.key === 'site_briefing') {
      const pinsCount = (state.projectPins?.[projectId] || []).length;
      detail = pinsCount > 0 ? `${pinsCount} pin${pinsCount === 1 ? '' : 's'}` : (flags.site_briefing_skipped ? '<span style="color:#8B949E">Skipped</span>' : '<span style="color:#D29922">No pins yet</span>');
    } else if (it.key === 'design_kickoff') {
      detail = (state.meetingLogs?.[projectId]?.design_kickoff) ? '<span style="color:#3FB950">Logged</span>' :
               (flags.design_kickoff_scheduled ? '<span style="color:#3FB950">Scheduled</span>' : '<span style="color:#D29922">Not scheduled</span>');
    }

    return `
      <div class="mob-row${done ? ' mob-done' : ''}">
        <div class="mob-row-top">
          <div class="mob-dot" style="background:${dotColor}"></div>
          <div class="mob-text">
            <div class="mob-label">${esc(it.label)}</div>
            <div class="mob-hint">${esc(it.hint)}</div>
          </div>
          <div class="mob-actions">
            ${renderMobilizationItemAction(projectId, it.key, done)}
          </div>
        </div>
        <div class="mob-detail">${detail}</div>
        ${renderMobilizationInlineEditor(projectId, it.key)}
      </div>
    `;
  }).join('');

  const allDone = MOBILIZATION_ITEMS.every(it => s[it.key]);
  const completed = MOBILIZATION_ITEMS.filter(it => s[it.key]).length;
  const total = MOBILIZATION_ITEMS.length;
  // Already sent to Install? (contract reviewed flag set)
  const alreadySent = !!p.contract_reviewed_at;

  return `
    <div style="font-size:12px;color:#8B949E;margin-bottom:12px;line-height:1.5">
      Complete all 7 items to send this project to Design &amp; Install. Items auto-check as the underlying state is set.
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:8px 12px;background:#0D1117;border:1px solid #1C2333;border-radius:6px">
      <div style="font-size:12px;color:${allDone ? '#3FB950' : '#D29922'};font-weight:600">${completed}/${total} complete</div>
      <div style="flex:1;height:6px;background:#1C2333;border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.round((completed/total)*100)}%;background:${allDone ? '#3FB950' : '#D29922'};transition:width 0.3s"></div>
      </div>
    </div>
    ${rows}
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid #1C2333">
      ${alreadySent ? `
        <div style="padding:10px 12px;background:#0D1A0E;border:1px solid #238636;border-radius:6px;display:flex;align-items:center;gap:8px">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7.5l3.5 3.5L12 4" stroke="#3FB950" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span style="font-size:12px;color:#3FB950;font-weight:500">Already sent to Design &amp; Install &middot; on Planning dashboard</span>
        </div>
      ` : `
        <button type="button"
          onclick="${allDone ? `sendProjectToInstall(${projectId})` : ''}"
          ${allDone ? '' : 'disabled'}
          class="btn-primary"
          style="width:100%;padding:12px;font-size:13px;font-weight:600;${allDone ? 'background:#238636;border-color:#2EA043;cursor:pointer' : 'background:#161B22;border-color:#30363D;color:#6E7681;cursor:not-allowed;opacity:0.55'}">
          ${allDone ? '✓ Send to Design &amp; Install' : `${total - completed} item${total - completed === 1 ? '' : 's'} remaining`}
        </button>
        ${allDone ? '<div style="font-size:11px;color:#8B949E;text-align:center;margin-top:6px">Project will move to Planning dashboard</div>' : ''}
      `}
    </div>
  `;
}

function renderMobilizationItemAction(projectId, itemKey, done) {
  if (itemKey === 'sales_lead' || itemKey === 'design_lead' || itemKey === 'pm_lead') {
    return `<button type="button" class="btn btn-sm" onclick="openMobilizationLeadPicker(${projectId}, '${itemKey.replace('_lead', '')}')" style="font-size:11px;padding:4px 10px">${done ? 'Change' : 'Set Lead'}</button>`;
  }
  if (itemKey === 'install_window') {
    return `<button type="button" class="btn btn-sm" onclick="openMobilizationInstallEditor(${projectId})" style="font-size:11px;padding:4px 10px">${done ? 'Edit' : 'Set Window'}</button>`;
  }
  if (itemKey === 'scope_tags') {
    return `<button type="button" class="btn btn-sm" onclick="openMobilizationTagsEditor(${projectId})" style="font-size:11px;padding:4px 10px">Edit Tags</button>`;
  }
  if (itemKey === 'site_briefing') {
    const flags = state.mobilizationFlags?.[projectId] || {};
    const pinsCount = (state.projectPins?.[projectId] || []).length;
    if (pinsCount > 0) {
      return `<button type="button" class="btn btn-sm" onclick="openProject(${projectId},'location')" style="font-size:11px;padding:4px 10px">Open</button>`;
    }
    return `
      <button type="button" class="btn btn-sm" onclick="openProject(${projectId},'location')" style="font-size:11px;padding:4px 10px">Open</button>
      <button type="button" class="btn btn-sm" onclick="toggleMobilizationFlag(${projectId},'site_briefing_skipped')" style="font-size:11px;padding:4px 10px">${flags.site_briefing_skipped ? 'Un-skip' : 'Skip'}</button>
    `;
  }
  if (itemKey === 'design_kickoff') {
    const flags = state.mobilizationFlags?.[projectId] || {};
    return `<button type="button" class="btn btn-sm" onclick="toggleMobilizationFlag(${projectId},'design_kickoff_scheduled')" style="font-size:11px;padding:4px 10px">${flags.design_kickoff_scheduled ? 'Unschedule' : 'Mark Scheduled'}</button>`;
  }
  return '';
}

function renderMobilizationInlineEditor(projectId, itemKey) {
  const editing = state.mobilizationEditing?.[projectId];
  if (editing !== itemKey) return '';
  if (itemKey === 'scope_tags') {
    const p = state.projects.find(x => x.id === projectId);
    const current = new Set(p.systems || []);
    return `
      <div class="mob-inline-editor">
        <div style="font-size:11px;color:#8B949E;margin-bottom:8px">Tap tags to toggle</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${SCOPE_TAGS.map(t => `
            <button type="button" onclick="toggleScopeTag(${projectId}, '${esc(t).replace(/'/g, "\\'")}')" class="mob-tag-chip${current.has(t) ? ' active' : ''}">${esc(t)}</button>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px">
          <button type="button" class="btn btn-sm" onclick="closeMobilizationEditor(${projectId})" style="font-size:11px;padding:4px 10px">Done</button>
        </div>
      </div>
    `;
  }
  if (itemKey === 'sales_lead' || itemKey === 'design_lead' || itemKey === 'pm_lead') {
    const role = itemKey.replace('_lead', '');
    const a = getProjectAssignment(projectId);
    const list = a[role] || [];
    const currentLeadId = list.find(x => x.lead)?.id;
    const team = state.team.filter(m => !m.archived);
    return `
      <div class="mob-inline-editor">
        <div style="font-size:11px;color:#8B949E;margin-bottom:8px">Select ${role} lead</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${team.map(m => `
            <button type="button" onclick="setMobilizationLead(${projectId},'${role}',${m.id})" class="mob-tag-chip${m.id === currentLeadId ? ' active' : ''}">${esc(m.name)}</button>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px">
          <button type="button" class="btn btn-sm" onclick="closeMobilizationEditor(${projectId})" style="font-size:11px;padding:4px 10px">Done</button>
        </div>
      </div>
    `;
  }
  return '';
}

function openMobilizationTagsEditor(projectId) {
  if (!state.mobilizationEditing) state.mobilizationEditing = {};
  state.mobilizationEditing[projectId] = 'scope_tags';
  refreshMobilizationBody(projectId);
}

function openMobilizationInstallEditor(projectId) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  const existing = getEstimatedInstallRange(p);
  const stored = state.estimatedInstallOverride?.[projectId];
  const storedObj = (stored && typeof stored === 'object') ? stored : {};
  openInstallWindowPicker({
    projectId,
    mode: 'estimated',
    initialStart: existing?.start,
    initialEnd: existing?.end,
    initialExcludeWeekends: storedObj.excludeWeekends !== false,
    initialWeekendIncludes: storedObj.weekendIncludes || [],
    onConfirm: (start, end, result) => {
      setEstimatedInstallOverride(projectId, {
        start, end,
        excludeWeekends: result.excludeWeekends,
        weekendIncludes: result.weekendIncludes
      });
      refreshMobilizationBody(projectId);
    }
  });
}

function openMobilizationLeadPicker(projectId, role) {
  if (!state.mobilizationEditing) state.mobilizationEditing = {};
  state.mobilizationEditing[projectId] = role + '_lead';
  refreshMobilizationBody(projectId);
}

function closeMobilizationEditor(projectId) {
  if (state.mobilizationEditing) delete state.mobilizationEditing[projectId];
  refreshMobilizationBody(projectId);
}

function toggleScopeTag(projectId, tag) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  if (!p.systems) p.systems = [];
  const idx = p.systems.indexOf(tag);
  if (idx >= 0) p.systems.splice(idx, 1);
  else p.systems.push(tag);
  save('vi_projects', state.projects);
  refreshMobilizationBody(projectId);
}

function saveMobilizationInstallWindow(projectId) {
  const start = document.getElementById('mob-est-start')?.value;
  const end = document.getElementById('mob-est-end')?.value || start;
  if (!start) { showToast('Set a start date', 'error'); return; }
  if (!state.estimatedInstall) state.estimatedInstall = {};
  state.estimatedInstall[projectId] = { start, end };
  save('vi_estimated_install', state.estimatedInstall);
  closeMobilizationEditor(projectId);
}

function setMobilizationLead(projectId, role, memberId) {
  // Within mobilization, we do a clean assignment without invoking setRoleLead's
  // cascade dialog (which would cover the mobilization dialog and re-render the page).
  // Mobilization is for newly-contracted projects — there's no prior lead with
  // assigned manual actions to cascade, so the simpler path is correct.
  const a = getProjectAssignment(projectId);
  const list = a[role] || [];
  const idx = list.findIndex(x => x.id === memberId);
  // If person isn't on the role yet, add them
  if (idx < 0) {
    list.push({ id: memberId, lead: false });
  }
  // Set this person as lead, unset others
  list.forEach(x => x.lead = (x.id === memberId));
  setProjectAssignment(projectId, role, list);
  // Just refresh the dialog body — no full-page render
  closeMobilizationEditor(projectId);
}

function toggleMobilizationFlag(projectId, flagKey) {
  if (!state.mobilizationFlags) state.mobilizationFlags = {};
  if (!state.mobilizationFlags[projectId]) state.mobilizationFlags[projectId] = {};
  state.mobilizationFlags[projectId][flagKey] = !state.mobilizationFlags[projectId][flagKey];
  save('vi_mobilization_flags', state.mobilizationFlags);
  refreshMobilizationBody(projectId);
}

// ═══════════════════════════════════════════════════════════════════
// INSTALL WINDOW PICKER — full-page calendar modal for picking a
// start/end date range. Shows booked + estimated install windows for
// ALL other projects so the user can spot conflicts.
//
// Usage: openInstallWindowPicker({
//   projectId,                    // project being scheduled (excluded from conflict view)
//   mode: 'booked' | 'estimated', // which date type we're setting
//   initialStart, initialEnd,     // pre-fill if there's an existing window
//   onConfirm: (start, end) => {} // callback when user clicks Confirm
// })
// ═══════════════════════════════════════════════════════════════════

const _pickerState = {
  projectId: null,
  mode: 'booked',
  selectStart: null,        // YYYY-MM-DD
  selectEnd: null,          // YYYY-MM-DD
  hoveredDate: null,
  visibleMonth: null,       // {year, month}
  excludeWeekends: true,    // default ON — weekends are off-days unless explicitly included
  weekendIncludes: [],      // array of YYYY-MM-DD strings — weekends user opted INTO as work days
  onConfirm: null
};

function openInstallWindowPicker(opts) {
  document.getElementById('install-window-picker')?.remove();
  _pickerState.projectId = opts.projectId;
  _pickerState.mode = opts.mode || 'booked';
  _pickerState.selectStart = opts.initialStart || null;
  _pickerState.selectEnd = opts.initialEnd || null;
  _pickerState.hoveredDate = null;
  // Default: exclude weekends. If editing existing window, preserve their setting.
  _pickerState.excludeWeekends = (opts.initialExcludeWeekends !== undefined)
    ? !!opts.initialExcludeWeekends : true;
  _pickerState.weekendIncludes = Array.isArray(opts.initialWeekendIncludes)
    ? [...opts.initialWeekendIncludes] : [];
  _pickerState.onConfirm = opts.onConfirm;

  // Default visible month: month of initialStart, or current month
  const init = opts.initialStart ? new Date(opts.initialStart + 'T00:00:00') : new Date();
  _pickerState.visibleMonth = { year: init.getFullYear(), month: init.getMonth() };

  const overlay = document.createElement('div');
  overlay.id = 'install-window-picker';
  overlay.className = 'iwp-overlay';
  overlay.innerHTML = renderInstallWindowPickerShell();
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  overlay.addEventListener('click', _iwpHandleClick);
  refreshInstallWindowPicker();
}

function closeInstallWindowPicker() {
  const overlay = document.getElementById('install-window-picker');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
}

function _iwpHandleClick(ev) {
  const dayCell = ev.target.closest('[data-iwp-day]');
  if (dayCell) {
    const date = dayCell.getAttribute('data-iwp-day');
    _iwpSelectDate(date);
    return;
  }
}

// Returns true if dateStr is a Saturday or Sunday
function _iwpIsWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

// Returns true if dateStr is inside [start, end] inclusive
function _iwpInRange(dateStr, start, end) {
  if (!start || !end) return false;
  return dateStr >= start && dateStr <= end;
}

function _iwpSelectDate(date) {
  const s = _pickerState;

  // If we have a complete range and user taps INSIDE it on a weekend → toggle weekend include
  if (s.selectStart && s.selectEnd && _iwpInRange(date, s.selectStart, s.selectEnd)) {
    if (_iwpIsWeekend(date) && s.excludeWeekends) {
      const idx = s.weekendIncludes.indexOf(date);
      if (idx >= 0) s.weekendIncludes.splice(idx, 1);
      else s.weekendIncludes.push(date);
      refreshInstallWindowPicker();
      return;
    }
    // Tap a weekday inside the range — no-op (don't accidentally restart selection)
    return;
  }

  // Otherwise: standard range selection (start, then end)
  if (!s.selectStart || (s.selectStart && s.selectEnd)) {
    // Starting a new selection — clear any weekend-includes that were range-specific
    s.selectStart = date;
    s.selectEnd = null;
    s.weekendIncludes = [];
  } else {
    // We have a start, no end — set the end
    if (date < s.selectStart) {
      // User clicked earlier than start — swap
      s.selectEnd = s.selectStart;
      s.selectStart = date;
    } else {
      s.selectEnd = date;
    }
    // Drop weekend-includes outside the new range
    s.weekendIncludes = s.weekendIncludes.filter(d => _iwpInRange(d, s.selectStart, s.selectEnd));
  }
  refreshInstallWindowPicker();
}

function _iwpChangeMonth(delta) {
  const s = _pickerState;
  let m = s.visibleMonth.month + delta;
  let y = s.visibleMonth.year;
  while (m > 11) { m -= 12; y += 1; }
  while (m < 0) { m += 12; y -= 1; }
  s.visibleMonth = { year: y, month: m };
  refreshInstallWindowPicker();
}

function _iwpClearSelection() {
  _pickerState.selectStart = null;
  _pickerState.selectEnd = null;
  _pickerState.weekendIncludes = [];
  refreshInstallWindowPicker();
}

function _iwpToggleExcludeWeekends() {
  _pickerState.excludeWeekends = !_pickerState.excludeWeekends;
  // If we just turned it OFF, clear weekendIncludes (they're no longer relevant)
  if (!_pickerState.excludeWeekends) _pickerState.weekendIncludes = [];
  refreshInstallWindowPicker();
}

function _iwpConfirm() {
  const s = _pickerState;
  if (!s.selectStart) return;
  const end = s.selectEnd || s.selectStart;
  const cb = s.onConfirm;
  const result = {
    start: s.selectStart,
    end,
    excludeWeekends: s.excludeWeekends,
    weekendIncludes: [...s.weekendIncludes]
  };
  closeInstallWindowPicker();
  if (typeof cb === 'function') cb(result.start, result.end, result);
}

function renderInstallWindowPickerShell() {
  const project = state.projects.find(p => p.id === _pickerState.projectId);
  const projectName = project?.name || 'project';
  const modeLabel = _pickerState.mode === 'booked' ? 'Booked Install' : 'Estimated Install';
  const modeColor = _pickerState.mode === 'booked' ? '#3FB950' : '#58A6FF';
  return `
    <div class="iwp-panel">
      <div class="iwp-header">
        <div>
          <div class="iwp-title">Pick ${esc(modeLabel)} Window</div>
          <div class="iwp-sub">for ${esc(projectName)}</div>
        </div>
        <button class="iwp-close" onclick="closeInstallWindowPicker()" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="iwp-body" id="iwp-body">
        <!-- Filled by refreshInstallWindowPicker -->
      </div>
      <div class="iwp-footer" id="iwp-footer">
        <!-- Filled by refreshInstallWindowPicker -->
      </div>
    </div>
  `;
}

function refreshInstallWindowPicker() {
  const body = document.getElementById('iwp-body');
  const footer = document.getElementById('iwp-footer');
  if (!body || !footer) return;
  body.innerHTML = renderInstallWindowPickerCalendar();
  footer.innerHTML = renderInstallWindowPickerFooter();
}

function renderInstallWindowPickerCalendar() {
  const s = _pickerState;
  const { year, month } = s.visibleMonth;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const firstOfMonth = new Date(year, month, 1);
  const monthName = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = (firstOfMonth.getDay() + 6) % 7; // Mon=0 ... Sun=6

  // Collect events from all projects (booked + estimated) — filtered to current month
  const monthStart = new Date(year, month, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(year, month, daysInMonth).toISOString().slice(0, 10);
  const eventsByDate = {}; // dateStr → array of {project, type}

  state.projects.forEach(p => {
    if (p.archived) return;
    if (p.id === s.projectId) return; // exclude self
    // Booked
    const booked = getBookedTimeline(p.id);
    if (booked && booked.start) {
      const start = booked.start;
      const end = booked.end || booked.start;
      _addEventsForRange(eventsByDate, start, end, p, 'booked', monthStart, monthEnd);
    }
    // Estimated
    const est = getEstimatedInstallRange(p);
    if (est && (!booked || !booked.start)) {
      _addEventsForRange(eventsByDate, est.start, est.end, p, 'estimated', monthStart, monthEnd);
    }
  });

  // Build day cells
  const cells = [];
  for (let i = 0; i < startDow; i++) {
    cells.push('<div class="iwp-day iwp-day-blank"></div>');
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;
    const events = eventsByDate[dateStr] || [];

    // Determine selection state
    let inRange = false, isStart = false, isEnd = false;
    if (s.selectStart && s.selectEnd) {
      isStart = dateStr === s.selectStart;
      isEnd = dateStr === s.selectEnd;
      inRange = dateStr >= s.selectStart && dateStr <= s.selectEnd;
    } else if (s.selectStart && !s.selectEnd) {
      isStart = dateStr === s.selectStart;
    }

    // Off-day = excluded weekend in the range that hasn't been opted into
    const optedIn = s.weekendIncludes.includes(dateStr);
    const isOffDay = inRange && isWeekend && s.excludeWeekends && !optedIn;
    const isWorkDay = inRange && (!isWeekend || !s.excludeWeekends || optedIn);

    const classes = ['iwp-day'];
    if (isWeekend) classes.push('iwp-day-weekend');
    if (isToday) classes.push('iwp-day-today');
    if (isPast) classes.push('iwp-day-past');
    if (isStart) classes.push('iwp-day-range-start');
    if (isEnd) classes.push('iwp-day-range-end');
    if (inRange && !isStart && !isEnd) classes.push(isOffDay ? 'iwp-day-range-off' : 'iwp-day-range-mid');
    if (events.length > 0) classes.push('iwp-day-has-events');
    if (optedIn) classes.push('iwp-day-weekend-opted-in');

    // Title hint for off-days / opted-in weekends
    let titleHint = '';
    if (inRange && isWeekend && s.excludeWeekends) {
      titleHint = optedIn
        ? 'title="Weekend included as work day — tap to remove"'
        : 'title="Weekend excluded — tap to include as work day"';
    }

    cells.push(`
      <div class="${classes.join(' ')}" data-iwp-day="${dateStr}" ${titleHint}>
        <div class="iwp-day-num">${day}</div>
        <div class="iwp-day-events">
          ${events.slice(0, 3).map(e => `
            <div class="iwp-event iwp-event-${e.type}" title="${esc(e.project.name)}">
              <span class="iwp-event-dot" style="background:${e.type === 'booked' ? '#3FB950' : '#58A6FF'}"></span>
              <span class="iwp-event-label">${esc(e.project.name)}</span>
            </div>
          `).join('')}
          ${events.length > 3 ? `<div class="iwp-event-more">+${events.length - 3}</div>` : ''}
        </div>
      </div>
    `);
  }

  return `
    <div class="iwp-month-nav">
      <button type="button" class="iwp-month-btn" onclick="_iwpChangeMonth(-1)" aria-label="Previous month">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="iwp-month-name">${esc(monthName)}</div>
      <button type="button" class="iwp-month-btn" onclick="_iwpChangeMonth(1)" aria-label="Next month">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <div class="iwp-dow">
      ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => `<div class="iwp-dow-cell${i >= 5 ? ' iwp-dow-weekend' : ''}">${d}</div>`).join('')}
    </div>
    <div class="iwp-grid">${cells.join('')}</div>
    <div class="iwp-legend">
      <span class="iwp-legend-item"><span class="iwp-event-dot" style="background:#3FB950"></span>Booked</span>
      <span class="iwp-legend-item"><span class="iwp-event-dot" style="background:#58A6FF"></span>Estimated</span>
      <span class="iwp-legend-item"><span class="iwp-legend-swatch iwp-legend-weekend"></span>Weekend</span>
    </div>
  `;
}

function _addEventsForRange(map, start, end, project, type, clipStart, clipEnd) {
  // Iterate from start to end (inclusive), adding to each date in the visible month
  const a = new Date(start + 'T00:00:00');
  const b = new Date(end + 'T00:00:00');
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    if (ds < clipStart || ds > clipEnd) continue;
    if (!map[ds]) map[ds] = [];
    map[ds].push({ project, type });
  }
}

function renderInstallWindowPickerFooter() {
  const s = _pickerState;

  // Step indicator at top
  let step = '';
  if (!s.selectStart) {
    step = `<div class="iwp-step iwp-step-active"><span class="iwp-step-num">1</span> Tap a date to set the <strong>START</strong></div>`;
  } else if (s.selectStart && !s.selectEnd) {
    step = `<div class="iwp-step iwp-step-active"><span class="iwp-step-num">2</span> Tap a date to set the <strong>END</strong></div>`;
  } else {
    step = `<div class="iwp-step iwp-step-done"><svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7.5l3.5 3.5L12 4" stroke="#3FB950" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Range selected &middot; tap weekend dates inside to include them</div>`;
  }

  // Summary line
  let summary = '';
  if (s.selectStart && s.selectEnd) {
    const totalDays = Math.round((new Date(s.selectEnd) - new Date(s.selectStart)) / 86400000) + 1;
    let workDays = 0;
    let weekendCount = 0;
    let weekendIncluded = 0;
    const startD = new Date(s.selectStart + 'T00:00:00');
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startD);
      d.setDate(startD.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      if (isWeekend) {
        weekendCount++;
        if (s.weekendIncludes.includes(ds)) weekendIncluded++;
        if (!s.excludeWeekends || s.weekendIncludes.includes(ds)) workDays++;
      } else {
        workDays++;
      }
    }
    summary = `
      <div class="iwp-summary">
        <div><strong>${fmtDate(s.selectStart)}</strong> &mdash; <strong>${fmtDate(s.selectEnd)}</strong></div>
        <div class="iwp-summary-counts">
          <span><strong>${totalDays}</strong> total day${totalDays === 1 ? '' : 's'}</span>
          <span class="iwp-sep">&middot;</span>
          <span style="color:#3FB950"><strong>${workDays}</strong> work day${workDays === 1 ? '' : 's'}</span>
          ${s.excludeWeekends && weekendCount > 0 ? `<span class="iwp-sep">&middot;</span><span style="color:#8B949E">${weekendCount - weekendIncluded} weekend${(weekendCount - weekendIncluded) === 1 ? '' : 's'} excluded${weekendIncluded > 0 ? `, ${weekendIncluded} included` : ''}</span>` : ''}
        </div>
      </div>
    `;
  } else if (s.selectStart) {
    summary = `<div class="iwp-summary">Start: <strong>${fmtDate(s.selectStart)}</strong></div>`;
  }

  return `
    ${step}
    ${summary}
    <label class="iwp-toggle">
      <input type="checkbox" ${s.excludeWeekends ? 'checked' : ''} onchange="_iwpToggleExcludeWeekends()">
      <span>Exclude weekends from work days</span>
    </label>
    <div class="iwp-actions">
      <button type="button" class="btn" onclick="_iwpClearSelection()" ${!s.selectStart ? 'disabled' : ''} style="${!s.selectStart ? 'opacity:0.4;cursor:not-allowed' : ''}">Clear</button>
      <button type="button" class="btn" onclick="closeInstallWindowPicker()">Cancel</button>
      <button type="button" class="btn-primary" onclick="_iwpConfirm()" ${!s.selectStart ? 'disabled' : ''} style="${!s.selectStart ? 'opacity:0.4;cursor:not-allowed' : 'background:#238636;border-color:#2EA043'}">Confirm</button>
    </div>
  `;
}
