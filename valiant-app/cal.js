// /api/cal.js — Valiant Integrations personal calendar feed (read-only ICS).
//
// One-way subscribe feed for Google / Apple Calendar. Each person gets a private
// token (?t=...); the feed returns ONLY their personal assignments, broken out
// DAY BY DAY (not one big window block):
//   1. An "On site — Project" marker for each individual day of an install they're crewed on
//   2. Meetings they're an attendee of (at their time)
//   3. Their dated tasks / subtasks (install + design) — at the task's time if set, else all-day
//   4. Their logistics assignments (prep / load / drive to & from / load in & out / unload / de-prep)
//   5. Their personal events (PTO, etc.)
//
// Reads the shared app data straight from Supabase using the service-role key
// (server-side only — never exposed to the browser). No writes.

const KEYS = [
  'vi_team', 'vi_projects', 'vi_assignments', 'vi_booked_dates', 'vi_estimated_install',
  'vi_meetings', 'vi_install_tasks', 'vi_design_tasks', 'vi_personal_events',
  'vi_logistics', 'vi_asset_allocations', 'vi_assets'
];

export default async function handler(req, res) {
  try {
    const token = String((req.query && req.query.t) || '').trim();
    if (!token) return res.status(400).send('Missing token');

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUP_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).send('Server not configured');

    const inList = KEYS.map(k => `"${k}"`).join(',');
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=key,value&key=in.(${inList})`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    if (!r.ok) return res.status(502).send('Upstream error');

    const rows = await r.json();
    const data = {};
    rows.forEach(row => { data[row.key] = row.value; });

    const team = data.vi_team || [];
    const member = team.find(m => m && m.calToken === token);
    if (!member) return res.status(404).send('Unknown calendar');
    const mid = member.id;

    const projects = indexById(data.vi_projects || []);
    const assignments = data.vi_assignments || {};
    const booked = data.vi_booked_dates || {};
    const estimated = data.vi_estimated_install || {};
    const meetings = data.vi_meetings || [];
    const personal = data.vi_personal_events || [];
    const installTasks = data.vi_install_tasks || [];
    const designTasks = data.vi_design_tasks || [];
    const logistics = data.vi_logistics || {};
    const allocations = data.vi_asset_allocations || [];
    const assets = indexById(data.vi_assets || []);

    const idsOf = arr => (arr || []).map(x => (x && typeof x === 'object') ? (x.id != null ? x.id : x.memberId) : x);
    const windowOf = pid => booked[pid] || estimated[pid] || null;
    const events = [];

    // 1) Install — one entry per individual day of the window (crew member only)
    Object.keys(assignments).forEach(pid => {
      const crew = idsOf((assignments[pid] || {}).install);
      if (!crew.includes(mid)) return;
      const w = windowOf(pid);
      if (!w || !w.start) return;
      const p = projects[pid];
      eachDay(w.start, w.end || w.start, dk => {
        events.push({
          uid: `vi-onsite-${pid}-${dk}@valiant`,
          allDay: true, start: dk, end: dk,
          summary: 'On site — ' + (p ? p.name : 'Project'),
          location: locOf(p)
        });
      });
    });

    // 2) Meetings this member is an attendee of
    meetings.forEach(m => {
      if (!m || !m.date) return;
      if (!idsOf(m.attendees).includes(mid)) return;
      const p = m.projectId != null ? projects[m.projectId] : null;
      events.push({
        uid: `vi-mtg-${m.id}@valiant`,
        allDay: !m.time,
        start: m.date, time: m.time || null, duration: m.duration || 60,
        summary: (m.title || 'Meeting') + (p ? ' \u00b7 ' + p.name : ''),
        location: locOf(p),
        description: m.notes || ''
      });
    });

    // 3) Dated tasks / subtasks assigned to this member — timed if a time is set
    const scan = (tasks, phase) => {
      (tasks || []).forEach(t => {
        const p = projects[t.projectId];
        const subs = t.subtasks || [];
        if (subs.length) {
          subs.forEach(s => {
            const a = (s.assigneeIds && s.assigneeIds.length) ? s.assigneeIds : (t.assigneeIds || []);
            if (!a.includes(mid) || !s.date) return;
            events.push({
              uid: `vi-sub-${t.id}-${s.id}@valiant`,
              allDay: !s.time, start: s.date, time: s.time || null, duration: 60,
              summary: s.title + (p ? ' \u00b7 ' + p.name : '')
            });
          });
        } else if ((t.assigneeIds || []).includes(mid)) {
          const dr = taskRange(t);
          if (!dr) return;
          events.push({
            uid: `vi-task-${t.id}@valiant`,
            allDay: true, start: dr.start, end: dr.end,
            summary: t.title + (p ? ' \u00b7 ' + p.name : '')
          });
        }
      });
    };
    scan(installTasks, 'install');
    scan(designTasks, 'design');

    // 4) Logistics assignments (prep / load / drives / load in & out / unload / de-prep)
    Object.keys(logistics).forEach(pid => {
      const rec = logistics[pid] || {};
      const items = rec.items || {};
      const p = projects[pid];
      const w = windowOf(pid) || {};
      const dts = rec.dates || {};
      const dPrep = dts.prep || w.start || null;
      const dLoad = dts.load || w.start || null;
      const dUnload = dts.unload || w.end || null;
      const dDeprep = dts.deprep || w.end || null;

      // Rigs: each allocated vehicle (noting trailers it tows) + each personal-tow trailer
      const projAllocs = allocations.filter(a => String(a.projectId) === String(pid));
      const vehicles = projAllocs.filter(a => { const x = assets[a.assetId]; return x && x.type === 'vehicle'; });
      const trailers = projAllocs.filter(a => { const x = assets[a.assetId]; return x && x.type === 'trailer'; });
      const towMode = a => {
        if (a.towedBy === 'personal') return { mode: 'personal' };
        if (a.towedBy && vehicles.some(v => String(v.id) === String(a.towedBy))) return { mode: 'vehicle', vid: a.towedBy };
        if (vehicles.length) return { mode: 'vehicle', vid: vehicles[0].id };
        return { mode: 'personal' };
      };
      const rigs = [];
      vehicles.forEach(v => {
        const nm = (assets[v.assetId] || {}).name || 'Vehicle';
        const towed = trailers.filter(t => { const r = towMode(t); return r.mode === 'vehicle' && String(r.vid) === String(v.id); })
          .map(t => (assets[t.assetId] || {}).name).filter(Boolean);
        rigs.push({ id: v.id, label: nm + (towed.length ? ' + ' + towed.join(' + ') : '') });
      });
      trailers.forEach(t => { if (towMode(t).mode === 'personal') rigs.push({ id: t.id, label: ((assets[t.assetId] || {}).name || 'Trailer') + ' (personal truck)' }); });

      const emit = (key, title, date) => {
        const it = items[key];
        if (!it || !date) return;
        if (!(it.assigneeIds || []).includes(mid)) return;
        events.push({
          uid: `vi-logi-${pid}-${key}@valiant`,
          allDay: !it.time, start: date, time: it.time || null, duration: 60,
          summary: title + (p ? ' \u00b7 ' + p.name : ''),
          location: locOf(p)
        });
      };
      emit('prep', 'Prep', dPrep);
      emit('load', 'Load', dLoad);
      rigs.forEach(rg => emit('drive_out_' + rg.id, 'Drive to job — ' + rg.label, dLoad));
      emit('load_in', 'Load in', w.start || dLoad);
      emit('load_out', 'Load out', w.end || dDeprep);
      rigs.forEach(rg => emit('drive_back_' + rg.id, 'Drive back — ' + rg.label, dDeprep));
      emit('unload', 'Unload', dUnload);
      emit('deprep', 'De-prep', dDeprep);
    });

    // 5) Personal events
    personal.forEach(e => {
      if (!e || e.memberId !== mid || !e.date) return;
      events.push({
        uid: `vi-pe-${e.id}@valiant`,
        allDay: !e.startTime,
        start: e.date, time: e.startTime || null, endTime: e.endTime || null, duration: 60,
        summary: e.title || labelType(e.type),
        description: e.detail || ''
      });
    });

    const ics = buildICS(member, events);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Disposition', 'inline; filename="valiant.ics"');
    return res.status(200).send(ics);
  } catch (e) {
    return res.status(500).send('Error');
  }
}

function indexById(arr) { const o = {}; (arr || []).forEach(x => { if (x && x.id != null) o[x.id] = x; }); return o; }
function locOf(p) { return p ? (p.address || p.site_address || p.location || '') : ''; }
function labelType(t) { return ({ pto: 'PTO', sick: 'Sick', vacation: 'Vacation', custom: 'Personal' })[t] || 'Personal'; }

// Iterate each calendar day from start..end (inclusive), YYYY-MM-DD, UTC-safe.
function eachDay(start, end, fn) {
  if (!start) return;
  const [y, m, d] = String(start).split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  const [ey, em, ed] = String(end || start).split('-').map(Number);
  const last = new Date(Date.UTC(ey, em - 1, ed));
  let guard = 0;
  while (cur <= last && guard++ < 400) {
    fn(`${cur.getUTCFullYear()}-${pad(cur.getUTCMonth() + 1)}-${pad(cur.getUTCDate())}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

function taskRange(t) {
  if (t.schedStart) return { start: t.schedStart, end: t.schedEnd || t.schedStart };
  if (t.isMilestone) return t.dueDate ? { start: t.dueDate, end: t.dueDate } : null;
  const d = (t.subtasks || []).map(s => s.date).filter(Boolean).sort();
  return d.length ? { start: d[0], end: d[d.length - 1] } : null;
}

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(s) { return String(s || '').replace(/-/g, ''); }
function addDay(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}
function dtLocal(date, time) { return ymd(date) + 'T' + (time ? time.replace(':', '') + '00' : '000000'); }
function addMinutes(date, time, mins) {
  const [y, mo, d] = String(date).split('-').map(Number);
  const [h, mi] = String(time || '00:00').split(':').map(Number);
  const dt = new Date(y, mo - 1, d, h, mi);
  dt.setMinutes(dt.getMinutes() + (mins || 60));
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function buildICS(member, events) {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const first = String(member.name || 'My').split(' ')[0];
  const L = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'PRODID:-//Valiant Integrations//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:Valiant \u2014 ${esc(first)}`, 'X-PUBLISHED-TTL:PT15M', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M'
  ];
  events.forEach(ev => {
    L.push('BEGIN:VEVENT');
    L.push('UID:' + ev.uid);
    L.push('DTSTAMP:' + stamp);
    if (ev.allDay) {
      L.push('DTSTART;VALUE=DATE:' + ymd(ev.start));
      L.push('DTEND;VALUE=DATE:' + addDay(ev.end || ev.start));
    } else {
      L.push('DTSTART:' + dtLocal(ev.start, ev.time));
      L.push('DTEND:' + (ev.endTime ? dtLocal(ev.start, ev.endTime) : addMinutes(ev.start, ev.time, ev.duration)));
    }
    L.push('SUMMARY:' + esc(ev.summary));
    if (ev.location) L.push('LOCATION:' + esc(ev.location));
    if (ev.description) L.push('DESCRIPTION:' + esc(ev.description));
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(foldLine).join('\r\n');
}

// Fold lines longer than 75 octets per RFC 5545.
function foldLine(line) {
  if (line.length <= 73) return line;
  let out = line.slice(0, 73);
  let rest = line.slice(73);
  while (rest.length > 72) { out += '\r\n ' + rest.slice(0, 72); rest = rest.slice(72); }
  return out + '\r\n ' + rest;
}
