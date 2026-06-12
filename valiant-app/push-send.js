// Valiant push sender. Place at /api/push-send.js in the repo.
// Requires Vercel env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUP_URL, SUPABASE_SERVICE_ROLE_KEY
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const PUB = process.env.VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
if (PUB && PRIV) {
  webpush.setVapidDetails('mailto:notifications@valiantintegrations.com', PUB, PRIV);
}
const sb = createClient(process.env.SUP_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const ids = (body.memberIds || []).filter((x) => x != null);
    if (!ids.length) { res.status(200).json({ sent: 0 }); return; }

    const { data, error } = await sb.from('push_subscriptions').select('*').in('member_id', ids);
    if (error) { res.status(500).json({ error: error.message }); return; }

    const payload = JSON.stringify({
      title: body.title || 'Valiant',
      body: body.body || '',
      url: body.url || '/'
    });

    let sent = 0;
    await Promise.all((data || []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (err) {
        // 404/410 = subscription expired; clean it up
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          try { await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint); } catch (e) {}
        }
      }
    }));
    res.status(200).json({ sent });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
