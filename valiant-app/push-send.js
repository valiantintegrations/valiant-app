// Valiant push sender. Place at /api/push-send.js
// Requires Vercel env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
const webpush = require('web-push');

const PUB = process.env.VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
if (PUB && PRIV) {
  webpush.setVapidDetails('mailto:notifications@valiantintegrations.com', PUB, PRIV);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const subs = Array.isArray(body.subscriptions) ? body.subscriptions : [];
    if (!subs.length) { res.status(200).json({ sent: 0, expired: [] }); return; }

    const payload = JSON.stringify({
      title: body.title || 'Valiant',
      body: body.body || '',
      url: body.url || '/',
      tag: body.tag || undefined
    });

    let sent = 0;
    const expired = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, payload);
        sent++;
      } catch (err) {
        // 404/410 = subscription no longer valid; report so the client can prune it
        if (err && (err.statusCode === 404 || err.statusCode === 410) && s && s.endpoint) {
          expired.push(s.endpoint);
        }
      }
    }));
    res.status(200).json({ sent, expired });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
