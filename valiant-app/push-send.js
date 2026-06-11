// Vercel serverless function — sends web push notifications.
// Requires the "web-push" dependency (see package.json) and 3 env vars in Vercel:
//   VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (e.g. mailto:jacob@valiantintegrations.com)

const webpush = require('web-push');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const pub = process.env.VAPID_PUBLIC;
  const priv = process.env.VAPID_PRIVATE;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@valiantintegrations.com';
  if (!pub || !priv) {
    res.status(500).json({ error: 'VAPID keys not configured in Vercel env' });
    return;
  }
  webpush.setVapidDetails(subject, pub, priv);

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const subs = Array.isArray(body.subscriptions) ? body.subscriptions.filter(Boolean) : [];
  const payload = JSON.stringify({
    title: body.title || 'Valiant Integrations',
    body: body.body || '',
    url: body.url || '/',
    tag: body.tag
  });

  if (!subs.length) { res.status(200).json({ sent: 0, total: 0, expired: [] }); return; }

  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s, payload))
  );

  // Endpoints that are gone (subscription expired/unsubscribed) so the client can prune them.
  const expired = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const code = r.reason && r.reason.statusCode;
      if (code === 404 || code === 410) {
        const ep = subs[i] && subs[i].endpoint;
        if (ep) expired.push(ep);
      }
    }
  });

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  res.status(200).json({ sent, total: subs.length, expired });
};
